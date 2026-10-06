jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/posts/posts.service',
  () => ({ PostsService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/media/media.service',
  () => ({ MediaService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service', () => ({
  AgyMcpService: class {},
  boldTitle: (s: string) => s,
  CAPTION_ROLE: 'caption-writer',
  CAPTION_SKILLS: ['copywriting', 'viral-copywriting-master'],
  TEXT_EDIT_ROLE: 'text-editor',
}));
import { AgentGraphService } from '../../libraries/nestjs-libraries/src/agent/agent.graph.service';
import { z } from 'zod';

function fixture(thread = false, picture = false) {
  const posts = {
    findAllExistingCategories: jest.fn(async () => [
      { category: 'Environment' },
    ]),
    findAllExistingTopicsOfCategory: jest.fn(async () => [{ topic: 'Water' }]),
    findPopularPosts: jest.fn(async () => [
      { content: 'Example', hook: 'Example hook' },
    ]),
    findFreeDateTime: jest.fn(async (_org: string, _integration?: string, _signal?: AbortSignal) => '2026-10-01T10:00:00Z'),
  };
  const media = {
    saveFile: jest.fn(async (org, name, path) => ({
      id: 'media-id',
      organizationId: org,
      name,
      path,
    })),
  };
  const item: { content: string; website: string | null; prompt?: string } = {
    content: 'Turn off taps.',
    website: null,
    ...(picture ? { prompt: 'Rainwater in a glass' } : {}),
  };
  const agy = {
    analyzeJson: jest.fn(
      async (request: any, _signal?: AbortSignal): Promise<any> => {
        const key = request.schema.required[0];
        return key === 'content'
          ? {
              content: thread
                ? [item, { ...item, content: 'Reuse rainwater.' }]
                : item,
            }
          : {
              [key]: (
                {
                  category: 'Environment',
                  topic: 'Water',
                  hook: 'Save water today.',
                } as Record<string, string>
              )[key],
            };
      }
    ),
    image: jest.fn(
      async (_prompt: string, _signal?: AbortSignal, _aspect?: string) =>
        'https://storage.test/picture.png'
    ),
    chat: jest.fn(async (_request: any) => ''),
  };
  const graph = new AgentGraphService(posts as any, media as any, agy as any);
  (graph as any).researchTools = [];
  const body = {
    research: 'Write about saving water at home.',
    format: thread ? 'thread_short' : 'one_short',
    tone: 'personal',
    isPicture: picture,
  } as any;
  return { graph, posts, media, agy, body };
}

async function collect(
  graph: AgentGraphService,
  body: any,
  signal?: AbortSignal
) {
  const events = [];
  for await (const event of graph.start('org-a', body, signal))
    events.push(event);
  return events;
}

describe('native AGY post graph', () => {
  it.each([false, true])(
    'preserves final stream contract, thread=%s',
    async (thread) => {
      const { graph, posts, media, agy, body } = fixture(thread);
      const signal = new AbortController().signal;
      const events = await collect(graph, body, signal);
      const final = events
        .filter((e) => e.event === 'on_chain_end' && e.name === 'LangGraph')
        .pop()?.data.output;
      expect(final).toMatchObject({
        hook: 'Save water today.',
        date: '2026-10-01T10:00:00Z',
      });
      expect(final.content).toHaveLength(thread ? 2 : 1);
      expect(final.content[0]).toMatchObject({
        content: 'Turn off taps.',
        website: null,
      });
    expect(agy.analyzeJson.mock.calls[0][0].prompt).toContain(body.research);
    expect(agy.analyzeJson.mock.calls[0][0].skills).toEqual([]);
      expect(media.saveFile).not.toHaveBeenCalled();
      expect(posts.findFreeDateTime).toHaveBeenCalledWith('org-a', undefined, expect.any(AbortSignal));
    }
  );

  it('registers the native published image as tenant Media once', async () => {
    const { graph, media, agy, body } = fixture(false, true);
    const events = await collect(graph, body, new AbortController().signal);
    const final = events
      .filter((e) => e.event === 'on_chain_end' && e.name === 'LangGraph')
      .pop()?.data.output;
    expect(agy.image).toHaveBeenCalledWith(
      'Rainwater in a glass',
      expect.anything(),
      'auto'
    );
    expect(media.saveFile).toHaveBeenCalledTimes(1);
    expect(media.saveFile).toHaveBeenCalledWith(
      'org-a',
      'picture.png',
      'https://storage.test/picture.png'
    );
    expect(final.content[0].image).toMatchObject({
      id: 'media-id',
      path: 'https://storage.test/picture.png',
    });
  });

  it('a failed picture leaves only that post without an image; the others keep theirs', async () => {
    const { graph, agy } = fixture(true, true);
    agy.image.mockImplementation(async (prompt: string) => {
      if (prompt === 'fail') throw new Error('Image unavailable');
      return `https://storage.test/${prompt}.png`;
    });
    const result = (await graph.generatePictures({
      isPicture: true,
      content: [{ prompt: 'fail' }, { prompt: 'ok' }],
    } as any)) as any;
    expect(agy.image).toHaveBeenCalledTimes(2);
    expect(result.content[0]).toEqual({ prompt: 'fail' });
    expect(result.content[1]).toEqual({ prompt: 'ok', image: 'https://storage.test/ok.png' });
  });

  it('fails the picture step only when every picture failed', async () => {
    const { graph, media, agy } = fixture(true, true);
    agy.image.mockRejectedValue(new Error('Image unavailable'));
    await expect(
      graph.generatePictures({
        isPicture: true,
        content: [{ prompt: 'a' }, { prompt: 'b' }],
      } as any)
    ).rejects.toThrow();
    expect(media.saveFile).not.toHaveBeenCalled();
  });

  it('rejects cancelled image registration before persisting tenant Media', async () => {
    const { graph, media } = fixture(false, true);
    const abort = new AbortController();
    abort.abort(new Error('Disconnected'));
    await expect(
      graph.uploadPictures(
        {
          orgId: 'org-a',
          content: [{ image: 'https://storage.test/picture.png' }],
        } as any,
        { signal: abort.signal }
      )
    ).rejects.toThrow('Disconnected');
    expect(media.saveFile).not.toHaveBeenCalled();
  });

  it('fails schema-invalid inference before scheduling or Media persistence', async () => {
    const { graph, posts, media, agy, body } = fixture();
    agy.analyzeJson.mockResolvedValue({ category: 99 });
    await expect(collect(graph, body)).rejects.toThrow();
    expect(posts.findFreeDateTime).not.toHaveBeenCalled();
    expect(media.saveFile).not.toHaveBeenCalled();
  });

  it('propagates disconnect cancellation into native inference', async () => {
    const { graph, posts, media, agy, body } = fixture();
    const abort = new AbortController();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => (started = resolve));
    agy.analyzeJson.mockImplementation(async (_request, signal) => {
      started();
      return new Promise((_resolve, reject) =>
        signal!.addEventListener('abort', () => reject(signal!.reason), {
          once: true,
        })
      );
    });
    const pending = collect(graph, body, abort.signal);
    await ready;
    abort.abort(new Error('Client disconnected'));
    await expect(pending).rejects.toThrow();
    expect(posts.findFreeDateTime).not.toHaveBeenCalled();
    expect(media.saveFile).not.toHaveBeenCalled();
  });

  it('propagates disconnect cancellation while finding a posting time', async () => {
    const { graph, posts, body } = fixture();
    const abort = new AbortController(); let started!: () => void;
    const ready = new Promise<void>(resolve => started = resolve);
    let observed!: AbortSignal;
    posts.findFreeDateTime.mockImplementation(async (_org, _integration, signal) => {
      observed = signal!; started();
      return new Promise<string>((_resolve, reject) => observed.addEventListener('abort', () => reject(observed.reason), { once: true }));
    });
    const pending = collect(graph, body, abort.signal);
    await ready; abort.abort(new Error('Disconnected while finding time'));
    await expect(pending).rejects.toThrow();
    expect(observed.aborted).toBe(true);
  });

  it('exposes research through validated MCP callbacks and preserves evidence', async () => {
    const { graph, agy, body } = fixture();
    const invoke = jest.fn(async () => 'Source https://example.test/water');
    (graph as any).researchTools = [
      {
        name: 'search',
        description: 'Search sources',
        schema: z.object({ query: z.string() }),
        invoke,
      },
    ];
    agy.chat.mockImplementation(async (request) => {
      expect(
        await request.tools[0].execute({ query: 'water' }, request.signal)
      ).toContain('https://example.test');
      await expect(
        request.tools[0].execute({ query: 123 }, request.signal)
      ).rejects.toThrow();
      return 'Verified evidence https://example.test/water';
    });
    const abort = new AbortController();
    const result = await graph.startCall(
      { messages: [{ content: body.research }] } as any,
      { signal: abort.signal }
    );
    expect(result.fresearch).toContain(body.research);
    expect(result.fresearch).toContain('Verified evidence');
    expect(invoke).toHaveBeenCalledWith(
      { query: 'water' },
      { signal: abort.signal }
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
