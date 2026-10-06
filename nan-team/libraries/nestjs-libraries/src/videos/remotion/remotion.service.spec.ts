jest.setTimeout(30000);
process.env.FRONTEND_URL = 'http://localhost:4200';
import 'reflect-metadata';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Organization } from '@prisma/client';

// previewOf derives the on-screen hook via hookOverlay (unit-tested in storyboard.service.spec); this stub
// keeps the real module (AGY gateway, DTOs) out of the orchestration tests.
jest.mock('./storyboard.service', () => ({ StoryboardService: class {},
  hookOverlay: (hook?: { overlay?: string; chosen?: string }) => hook?.overlay ?? hook?.chosen }), { virtual: true });
jest.mock('./tts.service', () => ({ TtsService: class {} }), { virtual: true });
jest.mock('@gitroom/nestjs-libraries/database/prisma/media/media.repository', () => ({ MediaRepository: class {} }));
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({ UploadFactory: { createStorage: jest.fn() } }));
jest.mock('./remotion.renderer', () => ({ downloadVideoAsset: jest.fn(), serveVideoAssets: jest.fn(), renderVideoFile: jest.fn(), verifyRenderedVideo: jest.fn().mockResolvedValue({ durationInFrames: 450, width: 1080, height: 1920, fps: 30, codec: 'h264', pixelFormat: 'yuv420p' }) }));
import { RemotionService } from './remotion.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { downloadVideoAsset, renderVideoFile, serveVideoAssets } from './remotion.renderer';

const org = { id: 'tenant-a' } as Organization;
const input = { title: 'Video thử nghiệm', targetDuration: 15 as const, voice: 'vi-VN-HoaiMyNeural', scenes:
  Array.from({ length: 3 }, (_, sceneIndex) => ({ sceneIndex, voiceText: 'Xin chào Việt Nam',
    imagePrompt: 'A test scene', keywordHighlight: 'Việt Nam', imageUrl: `http://localhost:4200/uploads/test-${sceneIndex}.png` })) };
const settle = async (service: RemotionService, jobId: string) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const state = await service.getStatus(org.id, jobId);
    if (state.status === 'completed' || state.status === 'failed') return state;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Job did not settle');
};

describe('tenant video render orchestration', () => {
  let directory: string;
  let service: RemotionService;
  let tts: { synthesizeVideo: jest.Mock };
  let media: { saveFile: jest.Mock };
  let storage: { uploadStream: jest.Mock; removeFile: jest.Mock };
  let close: jest.Mock;
  beforeEach(async () => {
    jest.clearAllMocks();
    directory = await mkdtemp(join(tmpdir(), 'nan-render-test-'));
    process.env.AI_VIDEO_JOB_DIRECTORY = directory;
    const audioPath = join(directory, 'voice.wav');
    const vttPath = join(directory, 'voice.vtt');
    await writeFile(audioPath, 'voice'); await writeFile(vttPath, 'captions');
    tts = { synthesizeVideo: jest.fn().mockResolvedValue({ audioPath, vttPath, durationInSeconds: 15,
      durationInFrames: 450, sceneTimings: [0, 1, 2].map((sceneIndex) => ({ sceneIndex, startFrame: sceneIndex * 150, durationInFrames: 150 })),
      captions: [{ text: 'Xin', startMs: 0, endMs: 500 }] }) };
    media = { saveFile: jest.fn().mockResolvedValue({ id: 'media-a', path: 'http://localhost:4200/uploads/result.mp4' }) };
    storage = { uploadStream: jest.fn().mockImplementation(async (stream) => {
      for await (const _chunk of stream) { /* Consume the upload like the real provider. */ }
      return { filename: 'result.mp4', path: 'http://localhost:4200/uploads/result.mp4' };
    }), removeFile: jest.fn().mockResolvedValue(undefined) };
    (UploadFactory.createStorage as jest.Mock).mockReturnValue(storage);
    (downloadVideoAsset as jest.Mock).mockImplementation(async (_url, folder, name) => {
      const path = join(folder, name + '.png'); await writeFile(path, 'image'); return { path, mime: 'image/png' };
    });
    close = jest.fn().mockResolvedValue(undefined);
    (serveVideoAssets as jest.Mock).mockResolvedValue({ baseUrl: 'http://127.0.0.1:9999', close });
    (renderVideoFile as jest.Mock).mockImplementation(async (folder, _props, _signal, progress) => {
      await writeFile(join(folder, 'renderer-inputs.json'), JSON.stringify({ sources: { 'src/index.ts': 'source-hash' } }));
      progress(70, 'rendering'); const output = join(folder, 'video.mp4'); await writeFile(output, 'video'); return output;
    });
    service = new RemotionService({} as never, tts as never, media as never);
  });
  afterEach(async () => { await service.onModuleDestroy(); await rm(directory, { recursive: true, force: true }); delete process.env.AI_VIDEO_JOB_DIRECTORY; });

  it('registers the rendered file for its tenant and retains props, TTS and hashes', async () => {
    const { jobId } = await service.startRender(org, input);
    expect((await service.getStatus(org.id, jobId)).status).toBe('queued');
    const state = await settle(service, jobId);
    expect(state).toMatchObject({ status: 'completed', progress: 100, media: { id: 'media-a' } });
    expect(media.saveFile).toHaveBeenCalledWith(org.id, 'result.mp4', 'http://localhost:4200/uploads/result.mp4', input.title);
    expect(renderVideoFile).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      scenes: expect.arrayContaining([expect.objectContaining({ durationInFrames: 150 })]),
      audioPath: 'http://127.0.0.1:9999/voice.wav', captions: [{ text: 'Xin', startMs: 0, endMs: 500 }],
    }), expect.any(AbortSignal), expect.any(Function));
    const evidence = JSON.parse(await readFile(join(directory, `${jobId}.inputs.json`), 'utf8'));
    expect(evidence.images).toHaveLength(3); expect(evidence.tts.audioSha256).toHaveLength(64);
    expect(close).toHaveBeenCalled();
    const restarted = new RemotionService({} as never, tts as never, media as never);
    // Terminal persistence follows completion in the background job finalizer.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(await restarted.getStatus(org.id, jobId)).toMatchObject({ status: 'completed', media: { id: 'media-a' } });
    await expect(restarted.getStatus('tenant-b', jobId)).rejects.toThrow('Video job not found');
  });

  it('denies status and cancellation across tenants and rejects path traversal job IDs', async () => {
    const { jobId } = await service.startRender(org, input);
    await expect(service.getStatus('tenant-b', jobId)).rejects.toThrow('Video job not found');
    await expect(service.cancel('tenant-b', jobId)).rejects.toThrow('Video job not found');
    await expect(service.getStatus(org.id, '../other.json')).rejects.toThrow('Video job not found');
    await settle(service, jobId);
  });

  it('records render failure without uploading or saving a Media record', async () => {
    (renderVideoFile as jest.Mock).mockRejectedValue(new Error('Chromium failed'));
    const { jobId } = await service.startRender(org, input);
    expect(await settle(service, jobId)).toMatchObject({ status: 'failed', error: 'Chromium failed' });
    expect(storage.uploadStream).not.toHaveBeenCalled(); expect(media.saveFile).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('removes uploaded output when Media registration fails', async () => {
    media.saveFile.mockRejectedValue(new Error('Database unavailable'));
    const { jobId } = await service.startRender(org, input);
    expect(await settle(service, jobId)).toMatchObject({ status: 'failed', error: 'Database unavailable' });
    expect(storage.removeFile).toHaveBeenCalledWith('http://localhost:4200/uploads/result.mp4');
  });

  it('cancels a queued job before it acquires rendering resources', async () => {
    const { jobId } = await service.startRender(org, input);
    expect(await service.cancel(org.id, jobId)).toMatchObject({ status: 'failed', stage: 'cancelled' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(tts.synthesizeVideo).not.toHaveBeenCalled();
  });

  it('propagates active cancellation into speech and refuses excess jobs for a tenant', async () => {
    let entered!: () => void;
    const enteredSpeech = new Promise<void>((resolve) => { entered = resolve; });
    tts.synthesizeVideo.mockImplementation((_scenes, _voice, _duration, _folder, signal: AbortSignal) => {
      entered();
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    const first = await service.startRender(org, input);
    await enteredSpeech;
    const second = await service.startRender(org, input);
    await expect(service.startRender(org, input)).rejects.toThrow('AI video queue is full');
    await service.cancel(org.id, second.jobId);
    await service.cancel(org.id, first.jobId);
    expect(await settle(service, first.jobId)).toMatchObject({ status: 'failed', error: 'Video generation cancelled' });
    expect(renderVideoFile).not.toHaveBeenCalled(); expect(media.saveFile).not.toHaveBeenCalled();
  });

  it('validates scene order and SSRF allowlist before accepting a job', async () => {
    await expect(service.startRender(org, { ...input, scenes: input.scenes.map((scene) => ({ ...scene, imageUrl: 'http://169.254.169.254/latest/meta-data' })) })).rejects.toThrow('Invalid AI video request');
    await expect(service.startRender(org, { ...input, scenes: input.scenes.map((scene) => ({ ...scene, sceneIndex: 1 })) })).rejects.toThrow('Invalid AI video request');
    expect(tts.synthesizeVideo).not.toHaveBeenCalled();
  });
  it('voices the validated script while images generate and reuses that narration for the render', async () => {
    const topic = { topic: 'Một ngày xanh', targetDuration: 15 as const, voice: input.voice };
    const script = { title: input.title, visualDna: 'green cinema', scenes: input.scenes.map(({ imageUrl, ...scene }) => scene) };
    let prefetchStartedBeforeImages = false;
    const generator = { generate: jest.fn(async (_dto, _signal, options) => {
      await options.onCheckpoint({ script, images: {} });
      await new Promise((resolve) => setImmediate(resolve));
      prefetchStartedBeforeImages = tts.synthesizeVideo.mock.calls.length === 1;
      await options.onCheckpoint({ script, images: { '0': input.scenes[0].imageUrl } });
      return { title: input.title, visualDna: 'green cinema', scenes: input.scenes };
    }) };
    service = new RemotionService(generator as never, tts as never, media as never);
    const { jobId } = await service.startFromTopic(org, topic);
    expect(await settle(service, jobId)).toMatchObject({ status: 'completed' });
    expect(prefetchStartedBeforeImages).toBe(true);
    expect(tts.synthesizeVideo).toHaveBeenCalledTimes(1);
    expect(tts.synthesizeVideo.mock.calls[0][3]).toContain('nan-tts-prefetch-');
    expect(renderVideoFile).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ audioPath: 'http://127.0.0.1:9999/voice.wav' }),
      expect.any(AbortSignal), expect.any(Function));
  });
  it('falls back to fresh narration when the prefetched script differs or prefetch failed', async () => {
    const topic = { topic: 'Một ngày xanh', targetDuration: 15 as const, voice: input.voice };
    const script = { title: input.title, visualDna: 'green cinema', scenes: input.scenes.map(({ imageUrl, ...scene }) => ({ ...scene, voiceText: 'Khác hẳn' })) };
    const generator = { generate: jest.fn(async (_dto, _signal, options) => {
      await options.onCheckpoint({ script, images: {} });
      return { title: input.title, visualDna: 'green cinema', scenes: input.scenes };
    }) };
    service = new RemotionService(generator as never, tts as never, media as never);
    let { jobId } = await service.startFromTopic(org, topic);
    expect(await settle(service, jobId)).toMatchObject({ status: 'completed' });
    expect(tts.synthesizeVideo).toHaveBeenCalledTimes(2);
    tts.synthesizeVideo.mockClear();
    const speech = await tts.synthesizeVideo.getMockImplementation()?.();
    tts.synthesizeVideo.mockRejectedValueOnce(new Error('clone server busy')).mockResolvedValueOnce(speech);
    generator.generate.mockImplementation(async (_dto, _signal, options) => {
      await options.onCheckpoint({ script: { ...script, scenes: input.scenes.map(({ imageUrl, ...scene }) => scene) }, images: {} });
      return { title: input.title, visualDna: 'green cinema', scenes: input.scenes };
    });
    ({ jobId } = await service.startFromTopic(org, topic));
    expect(await settle(service, jobId)).toMatchObject({ status: 'completed' });
    expect(tts.synthesizeVideo).toHaveBeenCalledTimes(2);
  });
  it('resumes a failed storyboard after restart with tenant and original-request checks', async () => {
    const topic = { topic: 'Một ngày xanh', targetDuration: 15 as const, voice: input.voice, aspectRatio: '1:1' as const };
    const script = { title: input.title, visualDna: 'green cinema', scenes: input.scenes.map(({ imageUrl, ...scene }) => scene) };
    const checkpoint = { script, images: { '0': input.scenes[0].imageUrl } };
    const generator = { generate: jest.fn(async (_dto, _signal, options) => {
      await options.onCheckpoint(checkpoint);
      throw new Error('503 model capacity');
    }) };
    service = new RemotionService(generator as never, tts as never, media as never);
    const parent = await service.startFromTopic(org, topic);
    expect(await settle(service, parent.jobId)).toMatchObject({ status: 'failed' });
    const saved = JSON.parse(await readFile(join(directory, `${parent.jobId}.generation.json`), 'utf8'));
    expect(saved).toMatchObject({ orgId: org.id, request: topic, checkpoint });
    await service.onModuleDestroy();
    const retryGenerator = { generate: jest.fn().mockRejectedValue(new Error('provider still unavailable')) };
    service = new RemotionService(retryGenerator as never, tts as never, media as never);
    await expect(service.startFromTopic({ id: 'tenant-b' } as Organization, { ...topic, resumeJobId: parent.jobId })).rejects.toThrow('Video job not found');
    await expect(service.startFromTopic(org, { ...topic, topic: 'Another topic', resumeJobId: parent.jobId })).rejects.toThrow('original topic');
    const [child, duplicate] = await Promise.allSettled([service.startFromTopic(org, { ...topic, resumeJobId: parent.jobId }), service.startFromTopic(org, { ...topic, resumeJobId: parent.jobId })])
      .then(([first, second]) => [first.status === 'fulfilled' ? first.value : second.status === 'fulfilled' ? second.value : undefined, first.status === 'rejected' ? first.reason : second.status === 'rejected' ? second.reason : undefined]);
    expect(String(duplicate)).toMatch(/already being resumed/);
    expect(await settle(service, child.jobId)).toMatchObject({ status: 'failed' });
    expect(retryGenerator.generate).toHaveBeenCalledTimes(1);
    expect(retryGenerator.generate).toHaveBeenCalledWith(expect.objectContaining(topic), expect.any(AbortSignal), expect.objectContaining({ resume: checkpoint }));
    expect(media.saveFile).not.toHaveBeenCalled();
  });
  it('refuses resume for active/completed jobs and missing checkpoints', async () => {
    const topic = { topic: 'Một ngày xanh', targetDuration: 15 as const, voice: input.voice };
    const active = await service.startRender(org, input);
    await expect(service.startFromTopic(org, { ...topic, resumeJobId: active.jobId })).rejects.toThrow('Only a failed');
    await settle(service, active.jobId);
    await expect(service.startFromTopic(org, { ...topic, resumeJobId: active.jobId })).rejects.toThrow('Only a failed');
    (renderVideoFile as jest.Mock).mockRejectedValueOnce(new Error('render failed'));
    const failed = await service.startRender(org, input); await settle(service, failed.jobId);
    await expect(service.startFromTopic(org, { ...topic, resumeJobId: failed.jobId })).rejects.toThrow('No saved storyboard');
  });

  it('after a hard kill mid-job the studio still sees the job as interrupted, resumable, with its preview', async () => {
    const topic = { topic: 'Một ngày xanh', targetDuration: 15 as const, voice: input.voice };
    const script = { title: input.title, hook: { chosen: 'Bạn đã thử chưa?' }, visualDna: 'green', scenes: input.scenes.map(({ imageUrl, ...scene }) => scene) };
    const checkpoint = { script, images: { '0': input.scenes[0].imageUrl } };
    let reached!: () => void;
    const atCheckpoint = new Promise<void>((resolve) => { reached = resolve; });
    // The old process stops at image generation and never reaches a terminal receipt (SIGKILL).
    const generator = { generate: jest.fn(async (_dto, signal: AbortSignal, options) => {
      await options.onCheckpoint(checkpoint); reached();
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    }) };
    const killed = new RemotionService(generator as never, tts as never, media as never);
    const { jobId } = await killed.startFromTopic(org, topic);
    await atCheckpoint;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(JSON.parse(await readFile(join(directory, `${jobId}.json`), 'utf8')).status).toBe('rendering');
    const restarted = new RemotionService({ generate: jest.fn().mockRejectedValue(new Error('still down')) } as never, tts as never, media as never);
    const studio = await restarted.getStudioStatus(org.id, jobId);
    expect(studio).toMatchObject({ status: 'failed', stage: 'interrupted', resumable: true,
      error: expect.stringContaining('Backend restarted'), preview: { title: input.title, hook: 'Bạn đã thử chưa?' } });
    expect(studio.preview!.scenes[0].imageUrl).toBe(input.scenes[0].imageUrl);
    // Unchanged generation.json (same mtime/size) is served from the parse cache, not re-read per poll.
    expect((await restarted.getStudioStatus(org.id, jobId)).preview).toBe(studio.preview);
    await expect(restarted.getStudioStatus('tenant-b', jobId)).rejects.toThrow('Video job not found');
    const child = await restarted.startFromTopic(org, { ...topic, resumeJobId: jobId });
    expect(child.jobId).not.toBe(jobId);
    await settle(restarted, child.jobId);
    await restarted.onModuleDestroy(); await killed.onModuleDestroy();
  });
  it('surfaces a voice-clone fallback warning in live and persisted status', async () => {
    const speech = await tts.synthesizeVideo();
    tts.synthesizeVideo.mockResolvedValue({ ...speech, voiceFallback: { requested: 'Thuyết Minh', used: 'vi-VN-NamMinhNeural',
      reason: 'ECONNREFUSED', warning: 'Voice clone "Thuyết Minh" unavailable (ECONNREFUSED); narrated with Edge voice vi-VN-NamMinhNeural' } });
    const { jobId } = await service.startRender(org, input);
    const state = await settle(service, jobId);
    expect(state).toMatchObject({ status: 'completed', warnings: [expect.stringContaining('narrated with Edge voice')] });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const restarted = new RemotionService({} as never, tts as never, media as never);
    expect((await restarted.getStatus(org.id, jobId)).warnings).toEqual(state.warnings);
  });
  it('rejects new jobs with a clear 507 when the job directory is unwritable, and reports disk-full failures clearly', async () => {
    const locked = join(directory, 'locked');
    await (await import('node:fs/promises')).mkdir(locked, { mode: 0o500 });
    process.env.AI_VIDEO_JOB_DIRECTORY = join(locked, 'jobs');
    const blocked = new RemotionService({} as never, tts as never, media as never);
    const error = await blocked.startRender(org, input).catch((reason) => reason);
    expect(error.getStatus?.()).toBe(507);
    expect(error.message).toMatch(/thư mục tác vụ không cho phép ghi \(EACCES\)/);
    process.env.AI_VIDEO_JOB_DIRECTORY = directory;
    (renderVideoFile as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' }));
    const { jobId } = await service.startRender(org, input);
    expect(await settle(service, jobId)).toMatchObject({ status: 'failed', error: expect.stringContaining('ổ đĩa máy chủ đã đầy (ENOSPC)') });
  });
});

describe('RenderVideoDto scene budget', () => {
  // Regression: 60s storyboards have 11 scenes (sceneIndex 0..10); @Max(7) rejected them.
  const { plainToInstance } = jest.requireActual('class-transformer') as typeof import('class-transformer');
  const { validateSync } = jest.requireActual('class-validator') as typeof import('class-validator');
  const { RenderVideoDto } = jest.requireActual('./dto/ai.video.dto') as typeof import('./dto/ai.video.dto');
  const scenes = (count: number) => Array.from({ length: count }, (_, sceneIndex) => ({ sceneIndex, voiceText: 'Xin chào Việt Nam',
    imagePrompt: 'A test scene', keywordHighlight: 'Việt Nam', imageUrl: `http://localhost:4200/uploads/test-${sceneIndex}.png` }));
  const errors = (body: object) => validateSync(plainToInstance(RenderVideoDto, body), { whitelist: true, forbidNonWhitelisted: true });

  it('accepts targetDuration 60 with 11 scenes (sceneIndex 0..10)', () => {
    expect(errors({ ...input, targetDuration: 60, scenes: scenes(11) })).toEqual([]);
  });

  it('rejects sceneIndex 12', () => {
    const outOfRange = scenes(11).map((scene, index) => index === 10 ? { ...scene, sceneIndex: 12 } : scene);
    const found = errors({ ...input, targetDuration: 60, scenes: outOfRange });
    expect(found.length).toBeGreaterThan(0);
    const nested = found.find((error) => error.property === 'scenes')?.children?.find((child) => child.property === '10');
    expect(nested?.children?.find((child) => child.property === 'sceneIndex')?.constraints).toHaveProperty('max');
  });
});
