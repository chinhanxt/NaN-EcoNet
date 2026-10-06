jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.repository',
  () => ({ AutopostRepository: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/posts/posts.service',
  () => ({ PostsService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({ IntegrationService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service', () => ({
  AgyMcpService: class {},
}));
jest.mock('nestjs-temporal-core', () => ({
  TemporalService: class {},
  Activity: () => () => {},
  ActivityMethod: () => () => {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/prisma.service', () => ({
  PrismaTransaction: class {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
}));
jest.mock('@temporalio/activity', () => ({ Context: { current: jest.fn() } }));

import { AutopostService } from './autopost.service';
import { AutopostActivity } from '../../../../../../apps/orchestrator/src/activities/autopost.activity';
import { Context } from '@temporalio/activity';

describe('AutopostService AGY generation', () => {
  const agy = { analyzeJson: jest.fn(), image: jest.fn() };
  const service = new AutopostService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    agy as any,
    {} as any,
    {} as any
  );
  const state: any = {
    body: { generateContent: true, content: 'manual' },
    load: {
      url: 'https://example.com/a',
      description: 'Bài viết về uống nước mỗi ngày',
    },
  };
  beforeEach(() => jest.clearAllMocks());

  it('writes the post through AGY analyzeJson with a structured schema in the content language', async () => {
    agy.analyzeJson.mockResolvedValue({
      socialMediaPostContent: 'Uống nước 💧\nKhỏe mỗi ngày',
    });
    const result = await service.generateDescription(state);
    expect(result.description).toBe('Uống nước 💧\nKhỏe mỗi ngày');
    const [request] = agy.analyzeJson.mock.calls[0];
    expect(request.prompt).toContain('Bài viết về uống nước mỗi ngày');
    expect(request.prompt).toContain('same language');
    expect(request.schema.required).toEqual(['socialMediaPostContent']);
    expect(request.schema.properties.socialMediaPostContent.maxLength).toBe(
      120
    );
  });

  it('keeps the manual content without calling AGY when generation is off', async () => {
    const result = await service.generateDescription({
      ...state,
      body: { generateContent: false, content: 'manual' },
    });
    expect(result.description).toBe('manual');
    expect(agy.analyzeJson).not.toHaveBeenCalled();
  });

  it('generates the picture through AGY image as a square image', async () => {
    agy.image.mockResolvedValue('https://storage/img.jpg');
    const result = await service.generatePicture({
      ...state,
      description: 'x',
    });
    expect(result.image).toBe('https://storage/img.jpg');
    expect(agy.image).toHaveBeenCalledWith(
      expect.stringContaining('Bài viết về uống nước mỗi ngày'),
      undefined,
      '1:1'
    );
  });
});

// Model transaction isolation/rollback with a serialized in-memory database.
// No real DB, Temporal worker, network request, or AGY job is started.
function fixture() {
  const db = { lastUrl: 'old', posts: [] as any[] };
  let lock = Promise.resolve();
  const tx = {
    autoPost: { updateMany: jest.fn() },
    post: { findFirst: jest.fn(), createMany: jest.fn() },
  };
  const transaction = {
    model: {
      $transaction: jest.fn(async (run: any) => {
        const previous = lock;
        let release!: () => void;
        lock = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        const snapshot = { lastUrl: db.lastUrl, posts: [...db.posts] };
        tx.autoPost.updateMany.mockImplementation(async ({ where, data }) => {
          if (db.lastUrl !== where.lastUrl) return { count: 0 };
          db.lastUrl = data.lastUrl;
          return { count: 1 };
        });
        tx.post.findFirst.mockImplementation(
          async ({ where }) =>
            db.posts.find((post) => post.id.startsWith(where.id.startsWith)) ||
            null
        );
        try {
          return await run(tx);
        } catch (error) {
          Object.assign(db, snapshot);
          throw error;
        } finally {
          release();
        }
      }),
    },
  };
  tx.post.createMany.mockImplementation(async ({ data }) => {
    db.posts.push(...data);
  });
  const postsService = {
    findFreeDateTime: jest.fn().mockResolvedValue('2026-10-01T12:00:00'),
  };
  const agy = { analyzeJson: jest.fn(), image: jest.fn() };
  const manager = { getSocialIntegration: jest.fn().mockReturnValue({}) };
  const repository = { getAutopost: jest.fn() };
  const integrations = { getIntegrationsList: jest.fn() };
  const service = new AutopostService(
    repository as any,
    {} as any,
    integrations as any,
    postsService as any,
    agy as any,
    transaction as any,
    manager as any
  );
  const state: any = {
    id: 'autopost-1',
    body: {
      organizationId: 'org',
      lastUrl: 'old',
      active: true,
      generateContent: true,
      addPicture: true,
    },
    description: 'Hello',
    load: { url: 'https://example.com/a', description: 'Feed text' },
    integrations: ['one', 'two'].map((id) => ({
      id,
      organizationId: 'org',
      providerIdentifier: 'test',
    })),
  };
  return {
    db,
    tx,
    transaction,
    service,
    state,
    postsService,
    agy,
    manager,
    repository,
    integrations,
  };
}

describe('AutopostService atomic drafts', () => {
  it('commits only one set of drafts for racing attempts', async () => {
    const { service, state, db, tx } = fixture();
    await Promise.all([
      service.schedulePost(state),
      service.schedulePost(state),
    ]);
    expect(db.posts).toHaveLength(2); // one draft per selected integration
    expect(new Set(db.posts.map((p) => p.id)).size).toBe(2);
    expect(tx.post.createMany).toHaveBeenCalledTimes(1);
    expect(db.lastUrl).toBe(state.load.url);
    expect(db.posts[0]).toMatchObject({
      state: 'DRAFT',
      creationMethod: 'AUTOPOST',
      organizationId: 'org',
    });
    expect(tx.autoPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: state.id,
          organizationId: 'org',
          active: true,
          deletedAt: null,
          lastUrl: 'old',
        },
      })
    );
  });

  it('dedupes an older URL after checkpoint advance, deletion, and integration changes', async () => {
    const { service, state, db, tx } = fixture();
    await service.schedulePost(state);
    db.lastUrl = 'newer';
    db.posts.forEach((post) => {
      post.deletedAt = new Date();
      post.state = 'PUBLISHED';
    });
    await service.schedulePost({
      ...state,
      body: { ...state.body, lastUrl: 'newer' },
      integrations: [{ ...state.integrations[0], id: 'three' }],
    });
    expect(db.posts).toHaveLength(2);
    expect(tx.post.createMany).toHaveBeenCalledTimes(1);
  });

  it('rolls back the checkpoint on insertion failure and permits a successful retry', async () => {
    const { service, state, db, tx } = fixture();
    tx.post.createMany.mockRejectedValueOnce(new Error('write failed'));
    await expect(service.schedulePost(state)).rejects.toThrow('write failed');
    expect(db).toEqual({ lastUrl: 'old', posts: [] });
    await service.schedulePost(state);
    expect(db.posts).toHaveLength(2);
  });

  it('allows the same URL for a different autopost', async () => {
    const first = fixture(),
      second = fixture();
    second.state.id = 'autopost-2';
    await first.service.schedulePost(first.state);
    await second.service.schedulePost(second.state);
    expect(first.db.posts[0].id).not.toBe(second.db.posts[0].id);
  });

  it('checks cancellation after finding a free slot and before opening a transaction', async () => {
    const { service, state, transaction, postsService } = fixture();
    const abort = new AbortController();
    postsService.findFreeDateTime.mockImplementation(async () => {
      abort.abort(new Error('cancelled'));
      return '2026-10-01T12:00:00';
    });
    await expect(service.schedulePost(state, abort.signal)).rejects.toThrow(
      'cancelled'
    );
    expect(transaction.model.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back drafts and checkpoint if cancellation arrives during insertion', async () => {
    const { service, state, db, tx } = fixture();
    const abort = new AbortController();
    tx.post.createMany.mockImplementation(async ({ data }) => {
      db.posts.push(...data);
      abort.abort(new Error('deadline'));
    });
    await expect(service.schedulePost(state, abort.signal)).rejects.toThrow(
      'deadline'
    );
    expect(db).toEqual({ lastUrl: 'old', posts: [] });
  });

  it('preserves generic provider link stripping for drafts', async () => {
    const { service, state, db, manager } = fixture();
    manager.getSocialIntegration.mockReturnValue({ stripLinks: () => true });
    await service.schedulePost(state);
    expect(db.posts[0].content).not.toContain(state.load.url);
  });

  it('passes the same signal to both AGY calls and prevents late generation from scheduling', async () => {
    const { service, state, agy, repository, integrations, transaction } =
      fixture();
    repository.getAutopost.mockResolvedValue({
      ...state.body,
      url: 'https://example.com/feed',
    });
    integrations.getIntegrationsList.mockResolvedValue(state.integrations);
    jest
      .spyOn(service, 'loadXML')
      .mockResolvedValue({ success: true, ...state.load });
    agy.analyzeJson.mockResolvedValue({ socialMediaPostContent: 'Generated' });
    const abort = new AbortController();
    // An uncooperative generation result must still never reach draft creation.
    agy.image.mockImplementation(async () => {
      abort.abort(new Error('deadline'));
      return 'image.png';
    });
    await expect(service.startAutopost(state.id, abort.signal)).rejects.toThrow(
      'deadline'
    );
    expect(agy.analyzeJson).toHaveBeenCalledWith(
      expect.any(Object),
      abort.signal
    );
    expect(agy.image).toHaveBeenCalledWith(
      expect.any(String),
      abort.signal,
      '1:1'
    );
    expect(transaction.model.$transaction).not.toHaveBeenCalled();
  });
});

describe('AutopostActivity deadline', () => {
  const current = Context.current as jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  function setup(info: Record<string, number> = {}) {
    const cancel = new AbortController();
    current.mockReturnValue({
      cancellationSignal: cancel.signal,
      info: {
        currentAttemptScheduledTimestampMs: Date.now(),
        startToCloseTimeoutMs: 600_000,
        scheduledTimestampMs: Date.now(),
        scheduleToCloseTimeoutMs: 0,
        ...info,
      },
    });
    const startAutopost = jest.fn(
      async (_id: string, signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          })
        )
    );
    return {
      cancel,
      startAutopost,
      activity: new AutopostActivity({ startAutopost } as any),
    };
  }

  it('aborts generation by nine minutes and cleans up its timer', async () => {
    const { activity, startAutopost } = setup();
    const pending = expect(activity.autoPost('id')).rejects.toThrow('deadline');
    await jest.advanceTimersByTimeAsync(540_000);
    await pending;
    expect(startAutopost.mock.calls[0][1].aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates Temporal cancellation and clears the deadline timer', async () => {
    const { activity, cancel } = setup();
    const pending = expect(activity.autoPost('id')).rejects.toThrow(
      'cancelled'
    );
    cancel.abort(new Error('cancelled'));
    await pending;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects an already expired attempt before calling the service', async () => {
    const { activity, startAutopost } = setup({
      currentAttemptScheduledTimestampMs: Date.now() - 600_000,
    });
    await expect(activity.autoPost('id')).rejects.toThrow('deadline');
    expect(startAutopost).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('honors the earlier remaining schedule-to-close deadline', async () => {
    const { activity } = setup({
      scheduledTimestampMs: Date.now() - 60_000,
      scheduleToCloseTimeoutMs: 90_000,
    });
    const pending = expect(activity.autoPost('id')).rejects.toThrow('deadline');
    await jest.advanceTimersByTimeAsync(15_000);
    await pending;
  });

  it('clears the timer on ordinary success', async () => {
    const { activity, startAutopost } = setup();
    startAutopost.mockResolvedValueOnce(undefined);
    await activity.autoPost('id');
    expect(jest.getTimerCount()).toBe(0);
  });
});
