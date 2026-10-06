jest.mock('../../libraries/nestjs-libraries/src/upload/upload.factory', () => ({ UploadFactory: {} }));
import { AgyMcpModelFactory } from '../../libraries/nestjs-libraries/src/chat/agy.mcp.model';
import type { AgyMcpService } from '../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service';

import type { LanguageModelV2CallOptions } from '@ai-sdk/provider';
const options: LanguageModelV2CallOptions = {
  prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Tạo một video' }] }],
  tools: [{ type: 'function' as const, name: 'processSourceVideoTool', description: 'Process video',
    inputSchema: { type: 'object', properties: { mediaId: { type: 'string' } }, required: ['mediaId'] } }],
};
const context = { get: (key: string) => key === 'organization' ? JSON.stringify({ id: 'org-a' }) : undefined };

describe('native AGY model integration', () => {
  it('executes an authenticated native MCP tool exactly once and reports its actual result', async () => {
    const execute = jest.fn(async (_input: unknown, _context: any) => ({ jobId: 'actual-job', status: 'queued' }));
    const chat = jest.fn(async (request) => {
      expect(await request.tools[0].execute({ mediaId: 'owned-media' })).toEqual({ jobId: 'actual-job', status: 'queued' });
      return 'Video đang được xử lý.';
    });
    const model = new AgyMcpModelFactory({ chat } as unknown as AgyMcpService)
      .create({ processSourceVideoTool: { execute } }, context);
    const result = await model.doGenerate(options);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[1]?.requestContext).toBe(context);
    expect(result.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool-call', providerExecuted: true }),
      expect.objectContaining({ type: 'tool-result', providerExecuted: true, result: { jobId: 'actual-job', status: 'queued' } }),
    ]));
    expect(result.finishReason).toBe('stop');
  });

  it('bounds video status waiting per turn so a chat reply never outlives the AGY deadline', async () => {
    const execute = jest.fn(async (input: any) => ({ jobId: 'job', status: 'rendering', stage: 'rendering', waited: input.waitSeconds ?? null }));
    const statusOptions: LanguageModelV2CallOptions = { ...options, tools: [{ type: 'function' as const, name: 'aiVideoStatusTool', description: 'Status',
      inputSchema: { type: 'object', properties: { jobId: { type: 'string' }, waitSeconds: { type: 'number' } } } }] };
    const chat = jest.fn(async (request) => {
      const call = () => request.tools[0].execute({ jobId: 'job', waitSeconds: 25 });
      expect(await call()).toEqual(expect.objectContaining({ waited: 25 }));
      expect(await call()).toEqual(expect.objectContaining({ waited: 25 }));
      const third = await call();
      expect(third).toEqual(expect.objectContaining({ waited: null, instruction: expect.stringContaining('reply now with the jobId') }));
      await expect(call()).rejects.toThrow('polling budget');
      return 'Video đang render.';
    });
    await new AgyMcpModelFactory({ chat } as unknown as AgyMcpService).create({ aiVideoStatusTool: { execute } }, context).doGenerate(statusOptions);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('does not accept model-supplied organization as authorization', async () => {
    const execute = jest.fn();
    const chat = jest.fn(async (request) => {
      await request.tools[0].execute({ mediaId: 'other-media', organizationId: 'org-a' });
      return 'Must not happen';
    });
    const model = new AgyMcpModelFactory({ chat } as unknown as AgyMcpService)
      .create({ processSourceVideoTool: { execute } });
    await expect(model.doGenerate(options)).rejects.toThrow('authenticated organization');
    expect(execute).not.toHaveBeenCalled();
  });

  it('defers browser-owned actions without claiming provider execution', async () => {
    const chat = jest.fn(async (request) => {
      expect(await request.tools[0].execute({ mediaId: 'owned-media' })).toEqual(expect.objectContaining({ deferred: true }));
      return 'Đang mở trình soạn bài.';
    });
    const model = new AgyMcpModelFactory({ chat } as unknown as AgyMcpService).create({}, context);
    const result = await model.doGenerate(options);
    expect(result.content[0]).toEqual(expect.objectContaining({ type: 'tool-call', providerExecuted: false }));
    expect(result.content.some((part) => part.type === 'tool-result')).toBe(false);
    expect(result.finishReason).toBe('tool-calls');
  });

  it('aborts the native task when the consumer cancels its stream', async () => {
    let taskSignal: AbortSignal | undefined;
    const chat = jest.fn(async (request) => {
      taskSignal = request.signal;
      return new Promise<string>((_resolve, reject) => request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true }));
    });
    const model = new AgyMcpModelFactory({ chat } as unknown as AgyMcpService).create({}, context);
    const { stream } = await model.doStream(options);
    const reader = stream.getReader();
    expect((await reader.read()).value?.type).toBe('stream-start');
    await reader.cancel();
    expect(taskSignal?.aborted).toBe(true);
  });
});
