import { createRequire } from 'node:module';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, loadavg, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { assertAiVideoAssetUrl, readLocalVideoAsset } from '../video.asset';
import { memAvailableBytes } from '../runtime.path';
import { runTtsProcess } from './tts.process';

/** Two-pass EBU R128 loudnorm of the final mux to -14 LUFS / -1.5 dBTP (same target as source-video);
 * video is stream-copied (frame count untouched, no -shortest); asetpts keeps audio/container
 * duration equal to the source sample count (loudnorm's 192k timestamps otherwise inflate it ~0.1s). Renders without an audio stream are left unchanged. */
export async function normalizeLoudness(file: string, signal?: AbortSignal) {
  try { await applyLoudnorm(file, signal); } catch (error) {
    // Cosmetic step: only cancellation propagates; any ffmpeg failure keeps the original render.
    if (signal?.aborted) throw error;
    console.warn(`Loudness normalization skipped for ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function applyLoudnorm(file: string, signal?: AbortSignal) {
  const target = 'I=-14:TP=-1.5:LRA=11';
  const audio = await runTtsProcess('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index',
    '-of', 'csv=p=0', file], { timeoutMs: 30000, signal });
  if (!audio.trim()) return;
  const log = await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-i', file, '-vn', '-af',
    `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { timeoutMs: 120000, signal, stderr: true });
  const json = /\{[^{}]*"input_i"[^{}]*\}/.exec(log)?.[0];
  if (!json) return;
  const m = JSON.parse(json) as Record<string, string>;
  if (![m.input_i, m.input_tp, m.input_lra, m.input_thresh, m.target_offset].every((value) => Number.isFinite(Number(value)))) return;
  const output = `${file}.loudnorm.mp4`;
  try {
    await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-map', '0:v', '-map', '0:a',
      '-c:v', 'copy', '-af', `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}`
        + `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000,asetpts=N/SR/TB`,
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output], { timeoutMs: 180000, signal });
    await rename(output, file);
  } finally { await rm(output, { force: true }); }
}

export async function verifyRenderedVideo(path: string, expectedFrames: number, signal: AbortSignal, expectedAspectRatio: '9:16' | '16:9' | '1:1' = '9:16') {
  const probe = JSON.parse(await runTtsProcess('ffprobe', ['-v', 'error', '-count_frames',
    '-show_streams', '-show_format', '-of', 'json', path], { signal, timeoutMs: 60_000 }));
  const video = probe.streams?.find((stream: any) => stream.codec_type === 'video');
  const audio = probe.streams?.find((stream: any) => stream.codec_type === 'audio');
  const expectedSeconds = expectedFrames / 30;
  const videoSeconds = Number(video?.duration);
  const containerSeconds = Number(probe.format?.duration);
  const dims = {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
  }[expectedAspectRatio] || { width: 1080, height: 1920 };
  if (!video || !audio || video.width !== dims.width || video.height !== dims.height ||
    video.avg_frame_rate !== '30/1' || Number(video.nb_read_frames) !== expectedFrames ||
    video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p' || audio.codec_name !== 'aac' ||
    Number(audio.sample_rate) !== 48000 || video.color_space !== 'bt709' ||
    !Number.isFinite(videoSeconds) || !Number.isFinite(containerSeconds) ||
    Math.abs(videoSeconds - expectedSeconds) > 0.001 ||
    Math.abs(containerSeconds - expectedSeconds) > 0.1) {
    throw new Error(`Rendered video failed format, audio, frame count (${video?.nb_read_frames}/${expectedFrames}), resolution (${video?.width}x${video?.height} vs ${dims.width}x${dims.height}), or duration verification`);
  }
  return { width: video.width, height: video.height, fps: 30, codec: video.codec_name,
    pixelFormat: video.pix_fmt, audioCodec: audio.codec_name, durationInFrames: Number(video.nb_read_frames),
    videoDuration: Number(video.duration), containerDuration: Number(probe.format.duration),
    audioSampleRate: Number(audio.sample_rate), colorSpace: video.color_space };
}

export interface EngineProps {
  title: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  width?: number;
  height?: number;
  scenes: Array<{ imagePath: string; durationInFrames: number; text: string; keyword?: string }>;
  audioPath: string;
  captions: Array<{ text: string; startMs: number; endMs: number }>;
  bgmPath?: string;
  bgmVolume?: number;
  theme?: {
    style?: 'cinematic' | 'tech_modern' | 'minimalist' | 'ugc_viral';
    subtitleStyle?: 'clean_shadow' | 'dark_pill' | 'pop_karaoke';
    primaryColor?: string;
    accentColor?: string;
    showBadge?: boolean;
    showProgressBar?: boolean;
  };
}

export interface SourceMotionProps {
  videoUrl: string; durationSeconds: number; aspectRatio: '9:16'|'16:9'|'1:1'; title: string;
  captions: Array<{text:string;startMs:number;endMs:number}>;
  captionStyle: 'karaoke'|'classic'|'neon'|'pop'|'box'; hook?:string; hookDurationSeconds?:number;
  captionAppearance?: Omit<import('../openshorts/source-video.dto').SourceCaptionsDto, 'enabled'|'style'>;
  design: {theme:'clean'|'bold'|'minimal';transitions:'none'|'fade'|'slide';lowerThird?:string;accentColor:string;
    zooms:Array<{startSeconds:number;endSeconds:number;strength:number}>};
}

export async function downloadVideoAsset(url: string, directory: string, name: string,
  kind: 'image' | 'audio', signal: AbortSignal): Promise<{ path: string; mime: string }> {
  const safeUrl = assertAiVideoAssetUrl(url);
  const abort = new AbortController();
  const forwardAbort = () => abort.abort(signal.reason);
  signal.addEventListener('abort', forwardAbort, { once: true });
  if (signal.aborted) forwardAbort();
  const timer = setTimeout(() => abort.abort(new Error('Asset download timed out')), 30_000);
  const cap = kind === 'image' ? 20 * 1024 * 1024 : 30 * 1024 * 1024;
  try {
    let bytes=await readLocalVideoAsset(safeUrl,cap,abort.signal);
    if(bytes===undefined){
      const response = await fetch(safeUrl, { signal: abort.signal, redirect: 'error' });
      if (!response.ok || !response.body) throw new Error(`Asset download failed: HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > cap) throw new Error('Asset exceeds size limit');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > cap) throw new Error('Asset exceeds size limit');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      bytes = Buffer.concat(chunks);
    }
    const { fileTypeFromBuffer } = require('file-type');
    const detected = await fileTypeFromBuffer(bytes);
    const accepted = kind === 'image'
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
      : ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4'];
    if (!detected || !accepted.includes(detected.mime)) throw new Error(`Unsupported ${kind} bytes`);
    const path = join(directory, `${name}.${detected.ext}`);
    await writeFile(path, bytes);
    return { path, mime: detected.mime };
  } finally { clearTimeout(timer); signal.removeEventListener('abort', forwardAbort); }
}

/** Browser sees only exact, staged assets bound to this render's ephemeral loopback server. */
export async function serveVideoAssets(assets: Record<string, { path: string; mime: string }>) {
  const server = createServer((request, response) => {
    const asset = assets[request.url || ''];
    if (!asset || !['GET', 'HEAD'].includes(request.method || '')) {
      response.writeHead(404).end(); return;
    }
    response.setHeader('Content-Type', asset.mime);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 'no-store');
    let size:number;
    try { size=statSync(asset.path).size; } catch { response.writeHead(404).end(); return; }
    response.setHeader('Accept-Ranges','bytes');
    let start=0,end=size-1;
    if(request.headers.range) {
      const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if(range && (range[1] || range[2])) {
        start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));
        end=range[1] && range[2]?Math.min(size-1,Number(range[2])):size-1;
      } else start=-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start) {
        response.setHeader('Content-Range',`bytes */${size}`);response.writeHead(416).end();return;
      }
      response.statusCode=206;response.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
    }
    response.setHeader('Content-Length',Math.max(0,end-start+1));
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(asset.path,{start,end});
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  });
  await new Promise<void>((done, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', done);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start video asset server');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((done) => { server.close(() => done()); server.closeAllConnections(); }),
  };
}

async function sourceFiles(directory: string, prefix = ''): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const key = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(hashes, await sourceFiles(join(directory, entry.name), key + '/'));
    else if (entry.isFile()) hashes[key] = createHash('sha256').update(await readFile(join(directory, entry.name))).digest('hex');
    else throw new Error('Remotion source or bundle must not contain symlinks');
  }
  return hashes;
}

/** Frames rendered in parallel: ≤4 tabs (more gave no gain on 12 cores), ~2 idle cores per tab
 * (cores minus 1-min load average), ≥2.5 GiB RAM left free at 640 MiB per tab (a headless Chrome tab is
 * ~400-600 MiB, plus its share of the compositor and x264), and at most 2 tabs below 6 GiB available:
 * MemAvailable is sampled once while the frontend (up to ~3.9 GiB after HMR), voice clone and AGY keep
 * growing, and this 15.6 GB host hard-reset twice on 2026-10-01 under swap exhaustion. An explicit override never exceeds the cores.
 * round3 idea30 (MemAvailable ~3.9 GB, load from TTS/AGY) got 1 tab under the old 4 GiB / 3-core rule: 900 frames
 * in ~245 s (3.7 fps) vs ~17 fps idle. A frame timeout still halves the tabs (renderWithRetry). */
export function renderConcurrency(availableBytes = memAvailableBytes(), cores = availableParallelism(), load = loadavg()[0]): number {
  const configured = Number(process.env.REMOTION_CONCURRENCY);
  if (Number.isInteger(configured) && configured >= 1) return Math.max(1, Math.min(configured, cores, 16));
  const idleCores = Math.max(0, cores - (Number.isFinite(load) ? load : 0));
  const byMemory = Math.floor((availableBytes - 2.5 * 1024 ** 3) / (640 * 1024 ** 2));
  const ceiling = availableBytes < 6 * 1024 ** 3 ? 2 : 4;
  return Math.max(1, Math.min(ceiling, Math.floor(idleCores / 2), byMemory));
}

/** CRF 18 keeps quality; 'faster' cuts x264 time ~2x vs 'medium' for a slightly larger file (encode overlaps capture only when tabs > 1). */
export const X264_PRESET = process.env.REMOTION_X264_PRESET || 'faster';

/** Per-frame and default delayRender budget (images/audio): an overloaded host stalled frames past 60 s. */
export const RENDER_TIMEOUT_MS = 180_000;

export const isFrameTimeout = (error: unknown) =>
  /Timeout \(\d+ms\) exceeded rendering the component|delayRender\(\)[^]*?(?:timeout|was called but not cleared)/i
    .test(error instanceof Error ? error.message : String(error));

/** Runs a render; a frame/delayRender timeout (host overload) is retried once with half the tabs. */
export async function renderWithRetry(render: (concurrency: number) => Promise<unknown>, concurrency: number, signal: AbortSignal) {
  try { await render(concurrency); } catch (error) {
    if (signal.aborted || !isFrameTimeout(error)) throw error;
    const reduced = Math.max(1, Math.floor(concurrency / 2));
    console.warn(`Remotion frame timeout at concurrency ${concurrency}; retrying once at ${reduced}: ${error instanceof Error ? error.message : String(error)}`);
    await render(reduced);
  }
}

const bundleCacheRoot = () => resolve(process.env.REMOTION_BUNDLE_CACHE_DIRECTORY || join(tmpdir(), 'nan-remotion-bundle-cache'));
const bundleBuilds = new Map<string, Promise<unknown>>();

/** Drops bundles for other engine revisions that have not been rebuilt for a day. */
async function pruneBundles(root: string, keep: string) {
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    const name = entry.name.replace(/\.json$/, '');
    if (name === keep || !/^[0-9a-f]{64}$/.test(name)) continue;
    const path = join(root, entry.name);
    try { if (Date.now() - statSync(path).mtimeMs > 86_400_000) await rm(path, { recursive: true, force: true }); } catch { /* Raced with another pruner. */ }
  }
}

/**
 * Reuses one bundle per engine-source digest across jobs. A cached bundle is used only
 * when its file hashes still equal the manifest written when it was built; otherwise it
 * is rebuilt. Bundles are built into a private temp dir and published by atomic rename.
 */
async function cachedBundle(engine: string, sources: Record<string, string>, bundle: (options: object) => Promise<string>,
  onProgress: (percent: number) => void) {
  const digest = createHash('sha256').update(JSON.stringify([engine, sources])).digest('hex');
  const root = bundleCacheRoot();
  const target = join(root, digest);
  const manifest = join(root, `${digest}.json`);
  const load = async () => {
    const expected = JSON.parse(await readFile(manifest, 'utf8'));
    const files = await sourceFiles(target);
    if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error('Bundle cache mismatch');
    return { serveUrl: target, files };
  };
  for (let attempt = 0; ; attempt++) {
    let build = bundleBuilds.get(digest);
    if (!build) {
      build = (async () => {
        try { return await load(); } catch { /* Missing or altered cache entry: rebuild. */ }
        await mkdir(root, { recursive: true, mode: 0o700 });
        const staging = await mkdtemp(join(root, 'build-'));
        try {
          await bundle({ entryPoint: join(engine, 'src/index.ts'), publicDir: join(engine, 'public'), outDir: staging, onProgress });
          const files = await sourceFiles(staging);
          // Keys are relative, so the manifest is valid for the renamed directory too.
          await writeFile(`${manifest}.${process.pid}.tmp`, JSON.stringify(files), { mode: 0o600 });
          await rename(`${manifest}.${process.pid}.tmp`, manifest);
          try { await rename(staging, target); } catch {
            // Another process published first (or a stale entry exists): keep a valid one, else replace it.
            try { const existing = await load(); await rm(staging, { recursive: true, force: true }); return existing; }
            catch { await rm(target, { recursive: true, force: true }); await rename(staging, target); }
          }
          await pruneBundles(root, digest);
          return { serveUrl: target, files };
        } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
      })();
      bundleBuilds.set(digest, build);
      build.catch(() => bundleBuilds.delete(digest));
    }
    await build;
    // Re-verify on every reuse so a changed or deleted cache entry is never rendered.
    try { return await load(); } catch (error) {
      bundleBuilds.delete(digest);
      if (attempt) throw error;
    }
  }
}

export async function renderVideoFile(directory: string, props: EngineProps | SourceMotionProps,
  signal: AbortSignal, onProgress: (progress: number, stage: string) => void, compositionId: 'TikTokVideo' | 'SourceVideo' = 'TikTokVideo'): Promise<string> {
  let engine: string;
  if (process.env.REMOTION_ENGINE_DIRECTORY) {
    if (!isAbsolute(process.env.REMOTION_ENGINE_DIRECTORY)) throw new Error('REMOTION_ENGINE_DIRECTORY must be absolute');
    engine = resolve(process.env.REMOTION_ENGINE_DIRECTORY);
  } else {
    let candidate = resolve(process.cwd());
    while (!existsSync(join(candidate, 'packages/remotion-engine/package.json'))) {
      const parent = dirname(candidate);
      if (parent === candidate) throw new Error('Remotion engine was not found; set REMOTION_ENGINE_DIRECTORY');
      candidate = parent;
    }
    engine = join(candidate, 'packages/remotion-engine');
  }
  const engineRequire = createRequire(join(engine, 'package.json'));
  const { bundle } = engineRequire('@remotion/bundler');
  const { renderMedia, selectComposition, makeCancelSignal } = engineRequire('@remotion/renderer');
  const cancellation = makeCancelSignal();
  const cancel = () => cancellation.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    const sources = await sourceFiles(join(engine, 'src'), 'src/');
    for (const name of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'remotion.config.ts']) {
      if (existsSync(join(engine, name))) sources[name] = createHash('sha256').update(await readFile(join(engine, name))).digest('hex');
    }
    onProgress(30, 'bundling');
    const { serveUrl, files: bundleFiles } = await cachedBundle(engine, sources, bundle,
      (percent: number) => onProgress(30 + percent * 0.1, 'bundling'));
    signal.throwIfAborted();
    await writeFile(join(directory, 'renderer-inputs.json'), JSON.stringify({
      engineDirectory: engine, sources, bundle: bundleFiles,
      inputPropsSha256: createHash('sha256').update(JSON.stringify(props)).digest('hex'),
    }), { mode: 0o600 });
    const browser = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
    const composition = await selectComposition({ serveUrl, id: compositionId, inputProps: props,
      browserExecutable: browser, timeoutInMilliseconds: RENDER_TIMEOUT_MS });
    signal.throwIfAborted();
    const outputLocation = join(directory, 'video.mp4');
    // Frames are captured as max-quality JPEG (PNG capture was the bottleneck: 104s→26s for a
    // 15s 1080x1920 video at 4 tabs, same x264 CRF 18/yuv420p/bt709 output, SSIM ≥0.989 vs PNG).
    // Software libx264 keeps output identical across machines; encoder threads stay bounded.
    const encoderThreads = String(Math.max(2, Math.min(4, Math.floor(availableParallelism() / 3))));
    // A retry restarts renderMedia at 0%; reported progress never moves backwards.
    let rendered = 0;
    const concurrency = renderConcurrency();
    console.log(`Remotion render ${compositionId}: ${composition.durationInFrames} frames, concurrency ${concurrency} `
      + `(load ${loadavg()[0].toFixed(1)}/${availableParallelism()} cores, ${Math.round(memAvailableBytes() / 1024 ** 2)} MiB available), x264 ${X264_PRESET}`);
    await renderWithRetry((concurrency) => renderMedia({ composition, serveUrl, codec: 'h264', audioCodec: 'aac',
      inputProps: props, outputLocation, overwrite: true, concurrency, offthreadVideoThreads: 1, offthreadVideoCacheSizeInBytes: 64 * 1024 * 1024, pixelFormat: 'yuv420p',
      colorSpace: 'bt709', imageFormat: 'jpeg', jpegQuality: 100, crf: 18, x264Preset: X264_PRESET, audioBitrate: '192k', sampleRate: 48000,
      browserExecutable: browser, cancelSignal: cancellation.cancelSignal,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS, disallowParallelEncoding: concurrency === 1,
      ffmpegOverride: ({args}:{args:string[]}) => [...args.slice(0,-1), '-threads',encoderThreads,'-filter_threads','1','-filter_complex_threads','1', ...args.slice(-1)],
      onProgress: ({ progress }: { progress: number }) => { rendered = Math.max(rendered, progress); onProgress(40 + rendered * 50, 'rendering'); } }), concurrency, signal);
    signal.throwIfAborted();
    await normalizeLoudness(outputLocation, signal);
    return outputLocation;
  } finally { signal.removeEventListener('abort', cancel); }
}
