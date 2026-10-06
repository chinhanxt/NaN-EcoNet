jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({ PostsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/agent/agent.graph.service', () => ({ AgentGraphService: class {} }));
jest.mock('@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service', () => ({ AgyMcpService: class {} }));
jest.mock('@gitroom/nestjs-libraries/short-linking/short.link.service', () => ({ ShortLinkService: class {} }));
jest.mock('@gitroom/backend/services/auth/permissions/permissions.ability', () => ({ CheckPolicies: () => () => {} }));
import { EventEmitter } from 'node:events';
import { PostsController } from '../../apps/backend/src/api/routes/posts.controller';

function response() {
  return Object.assign(new EventEmitter(), {
    destroyed: false, writableEnded: false,
    setHeader: jest.fn(), flushHeaders: jest.fn(), write: jest.fn(), end: jest.fn(),
  });
}
const org = { id: 'org-a' } as any;
const body = { research: 'Write a post about water', tone: 'personal', format: 'one_short', isPicture: false } as any;

describe('native post HTTP lifecycle', () => {
  it('streams progress immediately and ends a completed graph', async () => {
    const event = { event: 'on_chain_start', name: 'agent' };
    const graph = { start: jest.fn(async function* () { yield event; }) };
    const res = response();
    await new PostsController({} as any, graph as any, {} as any, {} as any).generatePosts(org, body, res as any);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(res.flushHeaders).toHaveBeenCalledTimes(1);
    expect(res.write).toHaveBeenCalledWith(JSON.stringify(event) + '\n');
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('aborts native generation on disconnect without later writes or response completion', async () => {
    let signal!: AbortSignal;
    let started!: () => void;
    const ready = new Promise<void>(resolve => started = resolve);
    const graph = { start: jest.fn(async function* (_org: string, _body: any, taskSignal: AbortSignal) {
      signal = taskSignal; started();
      await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      yield { name: 'post-time' };
    }) };
    const res = response();
    const pending = new PostsController({} as any, graph as any, {} as any, {} as any).generatePosts(org, body, res as any);
    await ready; res.destroyed = true; res.emit('close'); await pending;
    expect(signal.aborted).toBe(true);
    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    expect(res.listenerCount('close')).toBe(0);
  });

  it('emits a terminal error frame without exposing provider details', async () => {
    const graph = { start: async function* () { throw new Error('private-provider-detail'); yield {}; } };
    const res = response();
    await new PostsController({} as any, graph as any, {} as any, {} as any).generatePosts(org, body, res as any);
    const emitted = JSON.parse(res.write.mock.calls[0][0]);
    expect(emitted).toMatchObject({ name: 'error', error: true });
    expect(emitted.message).not.toContain('private-provider-detail');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('passes disconnect cancellation through the split endpoint and releases its listener', async () => {
    let signal!: AbortSignal;
    const posts = { separatePosts: jest.fn(async (_text, _length, taskSignal) => {
      signal = taskSignal;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    }) };
    const res = response();
    const pending = new PostsController(posts as any, {} as any, {} as any, {} as any).separatePosts(org, { content: 'Hello world', len: 20 }, res as any);
    res.destroyed = true; res.emit('close');
    await expect(pending).rejects.toThrow('Split client disconnected');
    expect(signal.aborted).toBe(true);
    expect(res.listenerCount('close')).toBe(0);
  });
});
