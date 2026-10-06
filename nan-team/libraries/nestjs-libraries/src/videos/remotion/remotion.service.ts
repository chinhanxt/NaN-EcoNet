import pLimit from 'p-limit';
import { BadRequestException, HttpException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { Storyboard, StoryboardCheckpoint, StoryboardService, hookOverlay } from './storyboard.service';
import { TtsService, VideoSpeech, VietnameseVoice } from './tts.service';
import { GenerateAiVideoDto, GenerateStoryboardDto, PreviewVoiceDto, RenderVideoDto } from './dto/ai.video.dto';
import { assertAiVideoAssetUrl } from '../video.asset';
import { downloadVideoAsset, EngineProps, renderVideoFile, serveVideoAssets, verifyRenderedVideo } from './remotion.renderer';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

type Media = Awaited<ReturnType<MediaRepository['saveFile']>>;
const STORAGE_ERRORS = new Set(['ENOSPC', 'EDQUOT', 'EACCES', 'EPERM', 'EROFS', 'ENOTDIR']);
/** Disk-full / unwritable job storage becomes a clear Vietnamese message; other errors pass through. */
export const describeStorageError = (error: unknown): Error | undefined => {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (!code || !STORAGE_ERRORS.has(code)) return undefined;
  const cause = ['ENOSPC', 'EDQUOT'].includes(code) ? 'ổ đĩa máy chủ đã đầy' : 'thư mục tác vụ không cho phép ghi';
  return new Error(`Không ghi được dữ liệu video vì ${cause} (${code}). Hãy giải phóng dung lượng hoặc kiểm tra quyền ghi rồi thử lại.`);
};
export interface AiVideoJobStatus {
  jobId: string; status: 'queued' | 'rendering' | 'completed' | 'failed';
  progress: number; stage: string; media?: Media; error?: string; warnings?: string[];
}
/** Narration synthesized while scene images are still being generated. */
interface SpeechPrefetch {
  texts: string[]; voice: string; targetDuration: number;
  speech: Promise<VideoSpeech | undefined>; dispose: () => Promise<void>;
}
/** Partial idea storyboard shown in the studio while scene images are still rendering. */
export interface AiVideoJobPreview {
  title: string; hook?: string; facts: Array<{ claim: string; basis: string }>;
  scenes: Array<{ sceneIndex: number; voiceText: string; keywordHighlight: string; imageUrl?: string }>;
}
interface VideoJob {
  orgId: string; state: AiVideoJobStatus; abort: AbortController; createdAt: number; preview?: AiVideoJobPreview;
  /** Result of a storyboard-only job (startStoryboard); such jobs complete without media. */
  storyboard?: Storyboard;
  work: () => Promise<void>; receipt: Promise<void>; lastPersist: number;
}

@Injectable()
export class RemotionService implements OnModuleDestroy {
  private jobs = new Map<string, VideoJob>();
  private queue: VideoJob[] = [];
  private active = 0;
  private running = new Set<Promise<void>>();
  private previews = 0;
  private stopping = false;
  private readonly jobDirectory = resolve(process.env.AI_VIDEO_JOB_DIRECTORY || join(tmpdir(), 'nan-ai-video-jobs'));

  constructor(private storyboard: StoryboardService, private tts: TtsService,
    private mediaRepository: MediaRepository) {}

  private async validated<T extends object>(type: new () => T, input: T): Promise<T> {
    const dto = plainToInstance(type, input);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    if (errors.length) throw new BadRequestException('Invalid AI video request: ' + errors.map((error) => error.property).join(', '));
    return dto;
  }

  async startRender(org: Organization, input: RenderVideoDto): Promise<{ jobId: string }> {
    const dto = await this.validated(RenderVideoDto, input);
    return this.enqueue(org.id, async (job) => this.render(job, dto));
  }

  async startFromTopic(org: Organization, input: GenerateAiVideoDto): Promise<{ jobId: string }> {
    const request = await this.validated(GenerateAiVideoDto, input);
    const { resumeJobId, ...dto } = request;
    if (!resumeJobId) return this.startTopic(org, dto);
    // Two concurrent resumes of one failed job would both pass the status check and double AGY/TTS cost.
    const claimed = this.resuming.get(resumeJobId);
    if (this.resuming.has(resumeJobId) && (claimed === undefined || ['queued', 'rendering'].includes(this.jobs.get(claimed)?.state.status ?? '')))
      throw new HttpException('This job is already being resumed', 409);
    this.resuming.set(resumeJobId, undefined);
    try {
      const started = await this.startTopic(org, dto, resumeJobId);
      this.resuming.set(resumeJobId, started.jobId);
      return started;
    } catch (error) { this.resuming.delete(resumeJobId); throw error; }
  }

  /** resumeJobId -> resumed job id (undefined while the resume is being validated). */
  private resuming = new Map<string, string | undefined>();

  /** Saved script and images of a failed job, for a resume with the identical request. */
  private async resumeCheckpoint(orgId: string, dto: GenerateStoryboardDto, resumeJobId: string): Promise<StoryboardCheckpoint> {
    const previous = await this.getStatus(orgId, resumeJobId);
    if (previous.status !== 'failed') throw new HttpException('Only a failed or interrupted idea job can be resumed', 409);
    let stored: { orgId: string; request: GenerateStoryboardDto; checkpoint: StoryboardCheckpoint };
    try { stored = JSON.parse(await readFile(join(this.jobDirectory, `${resumeJobId}.generation.json`), 'utf8')); }
    catch { throw new HttpException('No saved storyboard is available for this job', 409); }
    if (stored.orgId !== orgId) throw new NotFoundException('Video job not found');
    const identity = (value: GenerateStoryboardDto) => JSON.stringify([value.topic, value.targetDuration, value.voice, value.aspectRatio || '9:16', value.seedImageUrl || null]);
    if (identity(stored.request) !== identity(dto)) throw new HttpException('Resume requires the original topic, duration, voice, aspect ratio and seed image', 409);
    return stored.checkpoint;
  }

  /**
   * Storyboard-only job for the studio review step: script, then each scene image, reported through the
   * same status/preview/cancel as idea jobs. It runs beside the render queue, like the synchronous endpoint.
   */
  async startStoryboard(org: Organization, input: GenerateAiVideoDto): Promise<{ jobId: string }> {
    const { resumeJobId, ...dto } = await this.validated(GenerateAiVideoDto, input);
    const resume = resumeJobId ? await this.resumeCheckpoint(org.id, dto, resumeJobId) : undefined;
    return this.enqueue(org.id, async (job) => {
      this.progress(job, 1, 'generating-storyboard');
      const board = await this.storyboard.generate(dto, job.abort.signal, { resume,
        onCheckpoint: async (checkpoint) => {
          await this.evidence(job, 'generation', { request: dto, checkpoint, ...(resumeJobId ? { parentJobId: resumeJobId } : {}) });
          job.preview = this.previewOf(checkpoint, dto.topic);
          const done = Object.keys(checkpoint.images).length;
          const total = checkpoint.script.scenes.length;
          this.progress(job, 10 + 85 * done / Math.max(1, total), `generating-images:${done}/${total}`);
        },
      });
      job.abort.signal.throwIfAborted();
      await this.evidence(job, 'storyboard', { request: dto, ...board });
      job.storyboard = board;
      job.state.status = 'completed'; job.state.progress = 100; job.state.stage = 'completed';
      await this.persist(job);
    }, false);
  }

  private async startTopic(org: Organization, dto: Omit<GenerateAiVideoDto, 'resumeJobId'>, resumeJobId?: string): Promise<{ jobId: string }> {
    const resume = resumeJobId ? await this.resumeCheckpoint(org.id, dto, resumeJobId) : undefined;
    return this.enqueue(org.id, async (job) => {
      let prefetch: SpeechPrefetch | undefined;
      try {
        this.progress(job, 1, 'generating-storyboard');
        const board = await this.storyboard.generate(dto, job.abort.signal, { resume,
          onCheckpoint: async (checkpoint) => {
            await this.evidence(job, 'generation', { request: dto, checkpoint, ...(resumeJobId ? { parentJobId: resumeJobId } : {}) });
            // The narration is final once the script validates: voice it while images render.
            prefetch ??= await this.prefetchSpeech(checkpoint.script.scenes, dto, job.abort.signal);
            job.preview = this.previewOf(checkpoint, dto.topic);
            this.progress(job, 1, `generating-images:${Object.keys(checkpoint.images).length}/${checkpoint.script.scenes.length}`);
          },
        });
        job.abort.signal.throwIfAborted();
        await this.evidence(job, 'storyboard', { request: dto, ...board });
        const render = await this.validated(RenderVideoDto, { title: board.title,
          targetDuration: dto.targetDuration, voice: dto.voice, scenes: board.scenes,
          aspectRatio: dto.aspectRatio || '9:16', ...(board.theme ? {theme:board.theme} : {}) });
        await this.render(job, render, prefetch);
      } finally { await prefetch?.dispose(); }
    });
  }

  private async prefetchSpeech(scenes: Array<{ voiceText: string }>, dto: GenerateStoryboardDto,
    signal: AbortSignal): Promise<SpeechPrefetch | undefined> {
    if (signal.aborted || !Array.isArray(scenes) || !scenes.length) return undefined;
    const directory = await mkdtemp(join(tmpdir(), 'nan-tts-prefetch-'));
    const abort = new AbortController();
    const forward = () => abort.abort(signal.reason);
    signal.addEventListener('abort', forward, { once: true });
    const texts = scenes.map((scene) => String(scene?.voiceText ?? '').trim());
    // A failed prefetch is not fatal: render() synthesizes again and reports that error.
    const speech = this.tts.synthesizeVideo(texts.map((voiceText) => ({ voiceText })), dto.voice as VietnameseVoice,
      dto.targetDuration, directory, abort.signal).catch(() => undefined);
    return { texts, voice: dto.voice, targetDuration: dto.targetDuration, speech,
      dispose: async () => {
        signal.removeEventListener('abort', forward);
        abort.abort(new Error('Speech prefetch released'));
        await speech;
        await rm(directory, { recursive: true, force: true });
      } };
  }

  /** queued=false starts the job at once instead of waiting for the single render slot. */
  private async enqueue(orgId: string, work: (job: VideoJob) => Promise<void>, queued = true) {
    if (!orgId) throw new BadRequestException('Organization is required');
    if (this.stopping) throw new HttpException('Video renderer is shutting down', 503);
    const unfinished = [...this.jobs.values()].filter((job) => ['queued', 'rendering'].includes(job.state.status));
    if (unfinished.length >= 10 || unfinished.filter((job) => job.orgId === orgId).length >= 2) {
      throw new HttpException('AI video queue is full; wait for an existing job to finish', 429);
    }
    // Finished jobs remain on disk and can be looked up after this in-memory retention period.
    for (const [id, previous] of this.jobs) {
      if (!['queued', 'rendering'].includes(previous.state.status) && Date.now() - previous.createdAt > 3_600_000) this.jobs.delete(id);
    }
    const state: AiVideoJobStatus = { jobId: randomUUID(), status: 'queued', progress: 0, stage: 'queued' };
    const job: VideoJob = { orgId, state, abort: new AbortController(), createdAt: Date.now(),
      work: () => work(job), receipt: Promise.resolve(), lastPersist: 0 };
    this.jobs.set(state.jobId, job);
    try { await this.persist(job); } catch (error) {
      this.jobs.delete(state.jobId);
      const storage = describeStorageError(error);
      if (!storage) throw error;
      console.error(`AI video job directory ${this.jobDirectory} is not writable`, error);
      throw new HttpException(storage.message, 507);
    }
    if (queued) {
      this.queue.push(job);
      setImmediate(() => this.drain());
    } else {
      setImmediate(() => { if (!job.abort.signal.aborted) this.run(job, () => undefined); });
    }
    return { jobId: state.jobId };
  }

  private drain() {
    if (this.active || this.stopping) return;
    const job = this.queue.shift();
    if (!job) return;
    if (job.abort.signal.aborted) { this.drain(); return; }
    this.active++;
    this.run(job, () => { this.active--; this.drain(); });
  }

  private run(job: VideoJob, done: () => void) {
    job.state.status = 'rendering';
    const timer = setTimeout(() => job.abort.abort(new Error('AI video job exceeded 20 minute timeout')), 20 * 60_000);
    const running = this.persist(job).then(() => job.work()).catch(async (error: unknown) => {
      job.state.status = 'failed'; job.state.stage = 'failed';
      const reason = job.abort.signal.aborted ? job.abort.signal.reason : error;
      job.state.error = describeStorageError(reason)?.message ?? (reason instanceof Error ? reason.message : 'Video generation failed');
      await this.persist(job);
    }).finally(async () => {
      clearTimeout(timer);
      try { await this.persist(job); } catch (error) { console.error('AI video receipt persistence failed', error); }
      this.running.delete(running); done();
    });
    this.running.add(running);
    void running.catch((error) => console.error('AI video worker failed', error));
  }

  private progress(job: VideoJob, progress: number, stage: string) {
    if (job.abort.signal.aborted) return;
    job.state.progress = Math.max(job.state.progress, Math.min(99, Math.round(progress)));
    const changed = job.state.stage !== stage;
    job.state.stage = stage;
    if (changed || Date.now() - job.lastPersist > 2000) {
      void this.persist(job).catch((error) => console.error('AI video progress receipt failed', error));
    }
  }

  private async persist(job: VideoJob) {
    const snapshot = JSON.stringify({ orgId: job.orgId, createdAt: job.createdAt, updatedAt: Date.now(), ...job.state });
    job.lastPersist = Date.now();
    job.receipt = job.receipt.catch(() => undefined).then(async () => {
      await mkdir(this.jobDirectory, { recursive: true, mode: 0o700 });
      const file = join(this.jobDirectory, `${job.state.jobId}.json`);
      await writeFile(`${file}.tmp`, snapshot, { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    });
    return job.receipt;
  }

  private async evidence(job: VideoJob, stage: string, data: object) {
    await mkdir(this.jobDirectory, { recursive: true, mode: 0o700 });
    const file = join(this.jobDirectory, `${job.state.jobId}.${stage}.json`);
    await writeFile(`${file}.tmp`,
      JSON.stringify({ jobId: job.state.jobId, orgId: job.orgId, recordedAt: new Date().toISOString(), ...data }, null, 2), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
  }

  private previewOf(checkpoint: StoryboardCheckpoint, topic?: string): AiVideoJobPreview {
    const script = checkpoint.script;
    // Older checkpoints carry only `chosen` (= scene 0's spoken line); derive a distinct overlay.
    // Same filter as the render-time overlay (topic numbers allowed), so preview and video agree.
    const hook = hookOverlay(script.hook, script.scenes, script.title, checkpoint.grounding?.facts, topic);
    return { title: script.title, ...(hook ? { hook } : {}),
      facts: checkpoint.grounding?.facts ?? [],
      scenes: script.scenes.map((scene) => ({ sceneIndex: scene.sceneIndex, voiceText: scene.voiceText,
        keywordHighlight: scene.keywordHighlight,
        ...(checkpoint.images[String(scene.sceneIndex)] ? { imageUrl: checkpoint.images[String(scene.sceneIndex)] } : {}) })) };
  }

  /** generation.json parsed once per (mtime,size): studio polls stat the file instead of re-reading/parsing it. */
  private checkpoints = new Map<string, { mtimeMs: number; size: number; orgId?: string; resumable: boolean; preview?: AiVideoJobPreview }>();
  private async storedCheckpoint(jobId: string) {
    const path = join(this.jobDirectory, `${jobId}.generation.json`);
    const { mtimeMs, size } = await stat(path);
    const cached = this.checkpoints.get(jobId);
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return cached;
    const stored = JSON.parse(await readFile(path, 'utf8'));
    const resumable = !!stored?.checkpoint?.script;
    let preview: AiVideoJobPreview | undefined;
    try { if (resumable) preview = this.previewOf(stored.checkpoint, stored?.request?.topic); } catch { /* partial checkpoint: resumable without preview */ }
    const entry = { mtimeMs, size, orgId: stored?.orgId, resumable, ...(preview ? { preview } : {}) };
    this.checkpoints.delete(jobId); this.checkpoints.set(jobId, entry);
    if (this.checkpoints.size > 200) this.checkpoints.delete(this.checkpoints.keys().next().value as string);
    return entry;
  }

  /** Studio status: job state plus the latest idea checkpoint (script, hook, facts, finished images). */
  async getStudioStatus(orgId: string, jobId: string): Promise<AiVideoJobStatus & { preview?: AiVideoJobPreview; resumable: boolean; storyboard?: Storyboard }> {
    const state = await this.getStatus(orgId, jobId);
    const live = this.jobs.get(jobId);
    let preview = live?.preview;
    let resumable = false;
    // A storyboard-only job completes without media; its result is in memory or, after a restart, in its evidence.
    let storyboard = live?.storyboard;
    if (!storyboard && !live && state.status === 'completed' && !state.media) {
      try {
        const stored = JSON.parse(await readFile(join(this.jobDirectory, `${jobId}.storyboard.json`), 'utf8'));
        if (stored?.orgId === orgId && Array.isArray(stored.scenes)) {
          const { title, visualDna, theme, scenes, hook, grounding } = stored as Storyboard;
          storyboard = { title, visualDna, scenes, ...(theme ? { theme } : {}), ...(hook ? { hook } : {}), ...(grounding ? { grounding } : {}) };
        }
      } catch { /* not a storyboard-only job */ }
    }
    if (storyboard) return { ...state, ...(preview ? { preview } : {}), resumable, storyboard };
    if (preview && state.status !== 'failed') return { ...state, preview, resumable };
    try {
      const checkpoint = await this.storedCheckpoint(jobId);
      resumable = checkpoint.orgId === orgId && checkpoint.resumable;
      if (resumable && !preview) preview = checkpoint.preview;
    } catch { /* no checkpoint yet or a render-only job */ }
    return { ...state, ...(preview ? { preview } : {}), resumable: resumable && state.status === 'failed' };
  }

  async getStatus(orgId: string, jobId: string): Promise<AiVideoJobStatus> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) throw new NotFoundException('Video job not found');
    const live = this.jobs.get(jobId);
    if (live) {
      if (live.orgId !== orgId) throw new NotFoundException('Video job not found');
      // A receipt write can fail (disk full); the in-memory state is still the truth for this process.
      if (['completed', 'failed'].includes(live.state.status)) await live.receipt.catch(() => undefined);
      return { ...live.state };
    }
    let stored: AiVideoJobStatus & { orgId: string };
    try { stored = JSON.parse(await readFile(join(this.jobDirectory, `${jobId}.json`), 'utf8')); }
    catch { throw new NotFoundException('Video job not found'); }
    if (stored.orgId !== orgId) throw new NotFoundException('Video job not found');
    const { status, progress, stage, media, error, warnings } = stored;
    const extra = Array.isArray(warnings) && warnings.length ? { warnings } : {};
    if (status === 'queued' || status === 'rendering') return { jobId, status: 'failed', progress,
      stage: 'interrupted', error: 'Backend restarted during video generation; start a new job', ...extra };
    return { jobId, status, progress, stage, ...(media ? { media } : {}), ...(error ? { error } : {}), ...extra };
  }

  async cancel(orgId: string, jobId: string): Promise<AiVideoJobStatus> {
    const state = await this.getStatus(orgId, jobId);
    const job = this.jobs.get(jobId);
    if (job && ['queued', 'rendering'].includes(state.status)) {
      if (job.state.stage === 'saving-media') throw new HttpException('Video is being saved; cancellation is no longer available', 409);
      job.abort.abort(new Error('Video generation cancelled'));
      if (state.status === 'queued') {
        this.queue = this.queue.filter((queued) => queued !== job);
        job.state.status = 'failed'; job.state.stage = 'cancelled'; job.state.error = 'Video generation cancelled';
        await this.persist(job);
      } else { job.state.stage = 'cancelling'; }
    }
    return this.getStatus(orgId, jobId);
  }

  async previewVoice(input: PreviewVoiceDto): Promise<{ audioUrl: string; durationInSeconds: number }> {
    const dto = await this.validated(PreviewVoiceDto, input);
    if (this.previews >= 2) throw new HttpException('Voice preview is busy; try again shortly', 429);
    this.previews++;
    let directory: string | undefined;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(new Error('Voice preview timed out')), 90_000);
    try {
      directory = await mkdtemp(join(tmpdir(), 'nan-voice-preview-'));
      const audio = await this.tts.synthesizePreview(dto.text, dto.voice as VietnameseVoice, directory, abort.signal);
      abort.signal.throwIfAborted();
      const storage = UploadFactory.createStorage();
      const uploaded = await storage.uploadStream(createReadStream(audio.audioPath), 'audio/wav', 'wav');
      return { audioUrl: uploaded.path, durationInSeconds: audio.durationInSeconds };
    } finally {
      clearTimeout(timer); this.previews--;
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }

  private async hash(path: string) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex');
  }

  private async render(job: VideoJob, dto: RenderVideoDto, prefetch?: SpeechPrefetch) {
    const directory = await mkdtemp(join(tmpdir(), 'nan-remotion-'));
    let server: Awaited<ReturnType<typeof serveVideoAssets>> | undefined;
    try {
      const signal = job.abort.signal;
      signal.throwIfAborted();
      this.progress(job, 5, 'downloading-images');
      const assets: Record<string, { path: string; mime: string }> = {};
      // Scene images (and BGM) download and hash in parallel, at most 4 at a time; results keep scene order.
      const limit = pLimit(4);
      const [imageHashes, bgm] = await Promise.all([
        Promise.all(dto.scenes.map((scene, index) => limit(async () => {
          const asset = await downloadVideoAsset(assertAiVideoAssetUrl(scene.imageUrl), directory, `scene-${index}`, 'image', signal);
          assets[`/scene-${index}`] = asset;
          return { sceneIndex: scene.sceneIndex, imageUrl: scene.imageUrl, sha256: await this.hash(asset.path) };
        }))),
        dto.bgm ? limit(() => downloadVideoAsset(dto.bgm!, directory, 'bgm', 'audio', signal)) : undefined,
      ]);
      if (bgm) assets['/bgm'] = bgm;
      this.progress(job, 15, 'synthesizing-voice');
      const matchesPrefetch = prefetch && prefetch.voice === dto.voice && prefetch.targetDuration === dto.targetDuration &&
        prefetch.texts.length === dto.scenes.length && dto.scenes.every((scene, index) => scene.voiceText.trim() === prefetch.texts[index]);
      const speech = (matchesPrefetch ? await prefetch.speech : undefined) ??
        await this.tts.synthesizeVideo(dto.scenes, dto.voice as VietnameseVoice, dto.targetDuration, directory, signal);
      signal.throwIfAborted();
      if (speech.voiceFallback) job.state.warnings = [...(job.state.warnings || []), speech.voiceFallback.warning];
      if (speech.durationInFrames !== dto.targetDuration * 30 || speech.sceneTimings.length !== dto.scenes.length ||
        speech.sceneTimings.some((timing, index) => timing.sceneIndex !== index || timing.durationInFrames <= 0) ||
        speech.sceneTimings.reduce((sum, timing) => sum + timing.durationInFrames, 0) !== speech.durationInFrames) {
        throw new Error('TTS scene timing does not match the requested video');
      }
      assets['/voice.wav'] = { path: speech.audioPath, mime: 'audio/wav' };
      server = await serveVideoAssets(assets);
      const props: EngineProps = { title: dto.title, ...(dto.theme ? {theme:dto.theme} : {}), aspectRatio: dto.aspectRatio || '9:16', scenes: dto.scenes.map((scene, index) => ({
        imagePath: `${server!.baseUrl}/scene-${index}`, durationInFrames: speech.sceneTimings[index].durationInFrames,
        text: scene.voiceText, keyword: scene.keywordHighlight,
      })), audioPath: `${server.baseUrl}/voice.wav`, captions: speech.captions,
        ...(dto.bgm ? { bgmPath: `${server.baseUrl}/bgm`, bgmVolume: 0.12 } : {}) };
      await this.evidence(job, 'inputs', { storyboard: dto, images: imageHashes,
        tts: { ...speech, ...await Promise.all([this.hash(speech.audioPath), this.hash(speech.vttPath)])
          .then(([audioSha256, vttSha256]) => ({ audioSha256, vttSha256 })) }, props });
      const output = await renderVideoFile(directory, props, signal, (progress, stage) => this.progress(job, progress, stage));
      signal.throwIfAborted();
      this.progress(job, 92, 'verifying-video');
      const [outputSha256, verification] = await Promise.all([this.hash(output),
        verifyRenderedVideo(output, speech.durationInFrames, signal, dto.aspectRatio || '9:16')]);
      const renderer = JSON.parse(await readFile(join(directory, 'renderer-inputs.json'), 'utf8'));
      await this.evidence(job, 'renderer', renderer);
      await this.evidence(job, 'output', { outputSha256, ...verification });
      signal.throwIfAborted();
      this.progress(job, 95, 'saving-media');
      const storage = UploadFactory.createStorage();
      const uploaded = await storage.uploadStream(createReadStream(output), 'video/mp4', 'mp4');
      let media: Media;
      try { media = await this.mediaRepository.saveFile(job.orgId, uploaded.filename, uploaded.path, dto.title); }
      catch (error) { await storage.removeFile(uploaded.path).catch(() => undefined); throw error; }
      job.state.media = media;
      job.state.status = 'completed'; job.state.progress = 100; job.state.stage = 'completed';
      await this.persist(job);
    } finally {
      await server?.close();
      await rm(directory, { recursive: true, force: true });
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    for (const job of this.jobs.values()) {
      if (['queued', 'rendering'].includes(job.state.status)) {
        job.abort.abort(new Error('Backend shutting down'));
        if (job.state.status === 'queued') {
          job.state.status = 'failed'; job.state.stage = 'interrupted'; job.state.error = 'Backend shutting down';
          await this.persist(job);
        }
      }
    }
    await Promise.allSettled([...this.running]);
  }
}
