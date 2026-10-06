import { separateNativePosts } from '../../libraries/nestjs-libraries/src/agent/separate.posts';
import { readNdjson } from '../../libraries/helpers/src/utils/read.ndjson';

describe('native post splitting', () => {
  it('passes cancellation to native inference and rejects already cancelled requests', async () => {
    const analyzeJson = jest.fn(
      async (_request: unknown, _signal?: AbortSignal) => ({
        posts: ['Save water.'],
      })
    );
    const abort = new AbortController();
    await separateNativePosts(
      { analyzeJson } as any,
      'Save water.',
      20,
      abort.signal
    );
    expect(analyzeJson.mock.calls[0][1]).toBe(abort.signal);
    abort.abort(new Error('Disconnected'));
    await expect(
      separateNativePosts(
        { analyzeJson } as any,
        'Save water.',
        20,
        abort.signal
      )
    ).rejects.toThrow('Disconnected');
    expect(analyzeJson).toHaveBeenCalledTimes(1);
  });
  it('preserves the public response and constrains native inference', async () => {
    const analyzeJson = jest.fn(async () => ({
      posts: ['Xin chào.', 'Giữ nước sạch.'],
    }));
    expect(
      await separateNativePosts(
        { analyzeJson } as any,
        'Xin chào. Giữ nước sạch.',
        20
      )
    ).toEqual({ posts: ['Xin chào.', 'Giữ nước sạch.'] });
    expect(analyzeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'text-editor',
        skills: [],
        schema: expect.objectContaining({
          properties: {
            posts: expect.objectContaining({
              items: { type: 'string', minLength: 1, maxLength: 20 },
            }),
          },
        }),
      }),
      undefined
    );
  });

  it.each([
    ['hello world', ['helloworld']],
    ['helloworld', ['hello', 'world']],
  ])('rejects altered word boundaries in %s', async (content, posts) => {
    await expect(
      separateNativePosts(
        { analyzeJson: async () => ({ posts }) } as any,
        content as string,
        20
      )
    ).rejects.toThrow();
  });

  it.each([0, -1, 1.5, 10001, NaN])(
    'rejects invalid length %s before native calls',
    async (len) => {
      const analyzeJson = jest.fn();
      await expect(
        separateNativePosts({ analyzeJson } as any, 'text', len)
      ).rejects.toThrow();
      expect(analyzeJson).not.toHaveBeenCalled();
    }
  );

  it.each([
    { posts: ['rewritten'] },
    { posts: ['Hello!', 'too long output'] },
    { posts: [] },
    { posts: ['   '] },
  ])('rejects changed or invalid posts %j', async ({ posts }) => {
    await expect(
      separateNativePosts(
        { analyzeJson: async () => ({ posts }) } as any,
        'Hello! World.',
        10
      )
    ).rejects.toThrow('AGY returned an invalid thread');
  });
});

describe('NDJSON decoding', () => {
  function reader(text: string, byteSize: number) {
    const bytes = new TextEncoder().encode(text);
    let offset = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) return controller.close();
        controller.enqueue(bytes.slice(offset, offset + byteSize));
        offset += byteSize;
      },
    }).getReader();
  }
  it.each([1, 7, 999])(
    'keeps UTF-8 and JSON across chunks of %s bytes',
    async (size) => {
      const events = [
        { name: 'agent', data: 'Tiếng Việt' },
        { data: { output: { hook: 'Giữ nước sạch' } } },
      ];
      const output = [];
      for await (const event of readNdjson(
        reader('\n' + events.map((e) => JSON.stringify(e)).join('\r\n'), size)
      ))
        output.push(event);
      expect(output).toEqual(events);
    }
  );
  it('rejects malformed frames instead of silently dropping them', async () => {
    const collect = async () => {
      for await (const _ of readNdjson(reader('{bad}\n', 1))) {
      }
    };
    await expect(collect()).rejects.toThrow();
  });
  it('cancels and releases the stream when the consumer exits early', async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"error":true}\n'));
      },
      cancel,
    });
    for await (const _ of readNdjson(stream.getReader())) break;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(stream.locked).toBe(false);
  });
});
