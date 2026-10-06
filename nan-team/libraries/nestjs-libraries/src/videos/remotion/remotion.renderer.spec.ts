process.env.FRONTEND_URL = 'http://localhost:4200';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Execute the real ESM sniffer in Node; Jest's CJS loader cannot parse its ESM dependency.
jest.mock('file-type', () => ({ fileTypeFromBuffer: async (bytes: Buffer) => {
  const output = require('node:child_process').execFileSync(process.execPath, ['-e',
    "require('file-type').fileTypeFromBuffer(Buffer.from(process.argv[1], 'base64')).then(type => process.stdout.write(JSON.stringify(type || null)))",
    bytes.toString('base64')], { cwd: process.cwd(), encoding: 'utf8' });
  return JSON.parse(output);
} }));
import { downloadVideoAsset, isFrameTimeout, normalizeLoudness, renderConcurrency, renderWithRetry, serveVideoAssets, verifyRenderedVideo } from './remotion.renderer';
import * as processes from './tts.process';

const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c6360f8cf0000020201007b0981780000000049454e44ae426082', 'hex');

describe('video asset boundary', () => {
  let directory: string;
  const actualFetch = global.fetch;
  const originalProvider=process.env.STORAGE_PROVIDER,originalUploads=process.env.UPLOAD_DIRECTORY;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'nan-assets-test-')); process.env.STORAGE_PROVIDER='cloudflare'; });
  afterEach(async () => { global.fetch = actualFetch; if(originalProvider===undefined)delete process.env.STORAGE_PROVIDER;else process.env.STORAGE_PROVIDER=originalProvider; if(originalUploads===undefined)delete process.env.UPLOAD_DIRECTORY;else process.env.UPLOAD_DIRECTORY=originalUploads; await rm(directory, { recursive: true, force: true }); });
  it('stages local image bytes without fetching a frontend URL',async()=>{
    process.env.STORAGE_PROVIDER='local';process.env.UPLOAD_DIRECTORY=join(directory,'uploads');await mkdir(process.env.UPLOAD_DIRECTORY);
    await writeFile(join(process.env.UPLOAD_DIRECTORY,'local.png'),png);global.fetch=jest.fn();
    const asset=await downloadVideoAsset('http://localhost:4200/uploads/local.png',directory,'staged','image',new AbortController().signal);
    expect(await readFile(asset.path)).toEqual(png);expect(asset.mime).toBe('image/png');expect(global.fetch).not.toHaveBeenCalled();
  });
  it('sniffs PNG bytes and explicitly disables redirects', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(png));
    const asset = await downloadVideoAsset('http://localhost:4200/uploads/genuine.png', directory, 'scene-0', 'image', new AbortController().signal);
    expect(asset.mime).toBe('image/png'); expect(await readFile(asset.path)).toEqual(png);
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: 'error' }));
  });
  it('rejects disguised HTML and oversized content before writing assets', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('<html>script</html>', { headers: { 'Content-Type': 'image/png' } }));
    await expect(downloadVideoAsset('http://localhost:4200/uploads/fake.png', directory, 'fake', 'image', new AbortController().signal)).rejects.toThrow('Unsupported image bytes');
    global.fetch = jest.fn().mockResolvedValue(new Response(png, { headers: { 'Content-Length': String(21 * 1024 * 1024) } }));
    await expect(downloadVideoAsset('http://localhost:4200/uploads/large.png', directory, 'big', 'image', new AbortController().signal)).rejects.toThrow('Asset exceeds size limit');
  });
  it('rejects nested percent traversal, off-origin URLs and embedded credentials before fetching', async () => {
    global.fetch = jest.fn();
    for (const url of ['http://localhost:4200/uploads/%252e%252e/secret', 'http://169.254.169.254/images/secret', 'http://user:pass@localhost:4200/uploads/secret']) {
      await expect(downloadVideoAsset(url, directory, 'scene', 'image', new AbortController().signal)).rejects.toThrow();
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('serves only exact staged paths on its private ephemeral loopback endpoint', async () => {
    const path = join(directory, 'scene.png'); await writeFile(path, png);
    const server = await serveVideoAssets({ '/scene-0': { path, mime: 'image/png' } });
    try {
      const response = await actualFetch(server.baseUrl + '/scene-0');
      expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
      expect((await actualFetch(server.baseUrl + '/secret')).status).toBe(404);
      expect((await actualFetch(server.baseUrl + '/scene-0?x=1')).status).toBe(404);
      expect((await actualFetch(server.baseUrl + '/scene-0', { method: 'POST' })).status).toBe(404);
    } finally { await server.close(); }
  });
});

describe('rendered MP4 verification', () => {
  const valid = () => ({ streams: [
    { codec_type: 'video', width: 1080, height: 1920, avg_frame_rate: '30/1',
      nb_read_frames: '900', codec_name: 'h264', pix_fmt: 'yuv420p', duration: '30.000', color_space: 'bt709' },
    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000' },
  ], format: { duration: '30.058667' } });
  afterEach(() => jest.restoreAllMocks());
  it('accepts the required format with normal AAC packet padding', async () => {
    jest.spyOn(processes, 'runTtsProcess').mockResolvedValue(JSON.stringify(valid()));
    await expect(verifyRenderedVideo('/tmp/video.mp4', 900, new AbortController().signal))
      .resolves.toMatchObject({ durationInFrames: 900, colorSpace: 'bt709', audioSampleRate: 48000 });
  });
  it.each(['frames', 'duration', 'missing-duration', 'pixel-format', 'color', 'audio', 'sample-rate'])
    ('rejects invalid %s before the media is saved', async (failure) => {
      const probe = valid();
      if (failure === 'frames') probe.streams[0].nb_read_frames = '899';
      if (failure === 'duration') probe.format.duration = '31';
      if (failure === 'missing-duration') delete (probe.streams[0] as any).duration;
      if (failure === 'pixel-format') probe.streams[0].pix_fmt = 'yuvj420p';
      if (failure === 'color') probe.streams[0].color_space = 'bt470bg';
      if (failure === 'audio') probe.streams.pop();
      if (failure === 'sample-rate') probe.streams[1].sample_rate = '44100';
      jest.spyOn(processes, 'runTtsProcess').mockResolvedValue(JSON.stringify(probe));
      await expect(verifyRenderedVideo('/tmp/video.mp4', 900, new AbortController().signal))
        .rejects.toThrow('Rendered video failed');
    });
});

describe('final mux loudness normalization', () => {
  const measured = '[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-23.10",\n\t"input_tp" : "-6.20",\n\t"input_lra" : "4.30",\n\t"input_thresh" : "-33.40",\n\t"output_i" : "-14.00",\n\t"target_offset" : "0.10"\n}\n';
  afterEach(() => jest.restoreAllMocks());
  it('leaves renders without an audio stream untouched', async () => {
    const run = jest.spyOn(processes, 'runTtsProcess').mockResolvedValue('');
    await normalizeLoudness('/tmp/video.mp4');
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('skips the second pass for silent audio (-inf measurement)', async () => {
    const run = jest.spyOn(processes, 'runTtsProcess').mockResolvedValueOnce('0\n')
      .mockResolvedValueOnce(measured.replace('"-23.10"', '"-inf"'));
    await normalizeLoudness('/tmp/video.mp4');
    expect(run).toHaveBeenCalledTimes(2);
  });
  it('applies measured values, copies video without -shortest and replaces the file in place', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loudnorm-'));
    const file = join(dir, 'out.mp4');
    await writeFile(file, 'original');
    try {
      const run = jest.spyOn(processes, 'runTtsProcess').mockResolvedValueOnce('0\n').mockResolvedValueOnce(measured)
        .mockImplementationOnce(async (_command, args) => { await writeFile(args[args.length - 1], 'normalized'); return ''; });
      await normalizeLoudness(file);
      const args = run.mock.calls[2][1];
      expect(args).toEqual(expect.arrayContaining(['-c:v', 'copy', '-c:a', 'aac']));
      expect(args).not.toContain('-shortest');
      expect(args.join(' ')).toContain('measured_I=-23.10:measured_TP=-6.20:measured_LRA=4.30:measured_thresh=-33.40:offset=0.10:linear=true,aresample=48000,asetpts=N/SR/TB');
      expect(await readFile(file, 'utf8')).toBe('normalized');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('keeps the original render and warns when the second pass fails (not cancelled)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loudnorm-'));
    const file = join(dir, 'out.mp4');
    await writeFile(file, 'original');
    try {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      jest.spyOn(processes, 'runTtsProcess').mockResolvedValueOnce('0\n').mockResolvedValueOnce(measured)
        .mockImplementationOnce(async (_command, args) => { await writeFile(args[args.length - 1], 'partial'); throw new Error('Speech tool ffmpeg failed (1): boom'); });
      await expect(normalizeLoudness(file, new AbortController().signal)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Loudness normalization skipped'));
      expect(await readFile(file, 'utf8')).toBe('original');
      expect(existsSync(`${file}.loudnorm.mp4`)).toBe(false);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('keeps the original render when the measuring pass fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const run = jest.spyOn(processes, 'runTtsProcess').mockResolvedValueOnce('0\n')
      .mockRejectedValueOnce(new Error('Speech tool ffmpeg timed out'));
    await expect(normalizeLoudness('/tmp/video.mp4')).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('still throws on cancellation and removes the temp output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loudnorm-'));
    const file = join(dir, 'out.mp4');
    await writeFile(file, 'original');
    const controller = new AbortController();
    try {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      jest.spyOn(processes, 'runTtsProcess').mockResolvedValueOnce('0\n').mockResolvedValueOnce(measured)
        .mockImplementationOnce(async (_command, args) => {
          await writeFile(args[args.length - 1], 'partial'); controller.abort(); throw new Error('Speech generation cancelled');
        });
      await expect(normalizeLoudness(file, controller.signal)).rejects.toThrow('cancelled');
      expect(warn).not.toHaveBeenCalled();
      expect(await readFile(file, 'utf8')).toBe('original');
      expect(existsSync(`${file}.loudnorm.mp4`)).toBe(false);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

describe('render concurrency', () => {
  const GiB = 1024 ** 3;
  afterEach(() => { delete process.env.REMOTION_CONCURRENCY; });
  it('uses up to four tabs on a 12-core machine while keeping 2.5 GiB free', () => {
    expect(renderConcurrency(12 * GiB, 12, 0)).toBe(4);
    // Below 6 GiB available at most 2 tabs (host hard-reset twice under memory pressure).
    expect(renderConcurrency(4.6 * GiB, 12, 0)).toBe(2);
    expect(renderConcurrency(5.99 * GiB, 12, 0)).toBe(2);
    expect(renderConcurrency(6 * GiB, 12, 0)).toBe(4);
    // 640 MiB per tab above the 2.5 GiB reserve: 3.5 GiB leaves room for one tab only.
    expect(renderConcurrency(3.5 * GiB, 12, 0)).toBe(1);
    // round3 idea30: ~3.9 GB available used to force a single tab.
    expect(renderConcurrency(3985 * 1024 ** 2, 12, 0)).toBe(2);
    expect(renderConcurrency(3 * GiB, 12, 0)).toBe(1);
    expect(renderConcurrency(12 * GiB, 4, 0)).toBe(2);
    expect(renderConcurrency(12 * GiB, 2, 0)).toBe(1);
  });
  it('drops tabs when the CPU is already busy (load average)', () => {
    expect(renderConcurrency(12 * GiB, 12, 6)).toBe(3);
    expect(renderConcurrency(12 * GiB, 12, 8.5)).toBe(1);
    expect(renderConcurrency(12 * GiB, 12, 11.5)).toBe(1);
    expect(renderConcurrency(12 * GiB, 12, 40)).toBe(1);
    expect(renderConcurrency(12 * GiB, 12, Number.NaN)).toBe(4);
  });
  it('honours an explicit integer override but never above the cores', () => {
    process.env.REMOTION_CONCURRENCY = '2'; expect(renderConcurrency(12 * GiB, 12, 0)).toBe(2);
    process.env.REMOTION_CONCURRENCY = '32'; expect(renderConcurrency(12 * GiB, 8, 0)).toBe(8);
    process.env.REMOTION_CONCURRENCY = 'lots'; expect(renderConcurrency(12 * GiB, 12, 0)).toBe(4);
  });
});

describe('render frame-timeout retry', () => {
  const frameTimeout = new Error('Timeout (60000ms) exceeded rendering the component at frame 222. Check that the component renders correctly.');
  afterEach(() => jest.restoreAllMocks());
  it('recognises frame and delayRender timeouts only', () => {
    expect(isFrameTimeout(frameTimeout)).toBe(true);
    expect(isFrameTimeout(new Error('A delayRender() "Loading <Img>" was called but not cleared after 179000ms.'))).toBe(true);
    expect(isFrameTimeout(new Error('Chromium failed'))).toBe(false);
    expect(isFrameTimeout(new Error('ENOSPC: no space left on device'))).toBe(false);
  });
  it('retries a frame timeout once with half the tabs', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const render = jest.fn().mockRejectedValueOnce(frameTimeout).mockResolvedValueOnce(undefined);
    await renderWithRetry(render, 4, new AbortController().signal);
    expect(render.mock.calls).toEqual([[4], [2]]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('retries at most once', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const render = jest.fn().mockRejectedValue(frameTimeout);
    await expect(renderWithRetry(render, 1, new AbortController().signal)).rejects.toThrow('Timeout (60000ms)');
    expect(render.mock.calls).toEqual([[1], [1]]);
  });
  it('does not retry other errors or cancelled renders', async () => {
    const other = jest.fn().mockRejectedValue(new Error('Chromium failed'));
    await expect(renderWithRetry(other, 4, new AbortController().signal)).rejects.toThrow('Chromium failed');
    expect(other).toHaveBeenCalledTimes(1);
    const controller = new AbortController(); controller.abort();
    const cancelled = jest.fn().mockRejectedValue(frameTimeout);
    await expect(renderWithRetry(cancelled, 4, controller.signal)).rejects.toThrow('Timeout');
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
