import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { AgyMcpService, AgyAspectRatio, agyImageVariation, agyMaxImagesPerRequest, agyRequestImageConcurrency } from '@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service';
import { generationError } from '@gitroom/nestjs-libraries/openai/generation.error';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { Organization } from '@prisma/client';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { AiDesignEditDto } from '@gitroom/nestjs-libraries/dtos/media/ai.design.edit.dto';
import { assertAiVideoAssetUrl, readLocalVideoAsset } from '@gitroom/nestjs-libraries/videos/video.asset';
import { resolveWorkspaceArtifact } from '@gitroom/nestjs-libraries/videos/runtime.path';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VideoManager } from '@gitroom/nestjs-libraries/videos/video.manager';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import { organizationId } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { MediaProcessorJob } from '@gitroom/nestjs-libraries/upload/media.processor.interface';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import {
  getMaxSize,
  uploadStreamToStorage,
} from '@gitroom/nestjs-libraries/upload/custom.upload.validation';

// What every upload is normalized to before a provider ever sees it. The
// service applies exactly these, so a platform-specific need belongs in the
// provider, not here.
const VIDEO_RULES: MediaProcessorJob['rules'] = {
  short_side_min: 1080,
  short_side_max: 1080,
  long_side_max: 1920,
  video: {
    container: 'mp4',
    video_codec: 'h264',
    profile: 'high',
    pixel_format: 'yuv420p',
    fps_max: 60,
    quality: 23,
    audio_codec: 'aac',
    audio_bitrate_kbps: 128,
    audio_sample_rate: 48000,
    faststart: true,
  },
};
const IMAGE_RULES: MediaProcessorJob['rules'] = {
  short_side_min: 1,
  short_side_max: 1080,
  long_side_max: 1920,
  image: { jpeg_quality: 90, keep_format: true },
};
const LIMITS: MediaProcessorJob['limits'] = {
  max_input_bytes: 1073741824,
  max_duration_seconds: 900,
  timeout_seconds: 1200,
};
// Extension of the normalized file and the content type the presigned PUT is
// minted for; anything else (gif, avif, ...) is stored as uploaded
const PROCESSABLE: Record<
  string,
  { type: 'video' | 'image'; ext: string; contentType: string }
> = {
  '.mp4': { type: 'video', ext: 'mp4', contentType: 'video/mp4' },
  '.mov': { type: 'video', ext: 'mp4', contentType: 'video/mp4' },
  '.jpg': { type: 'image', ext: 'jpg', contentType: 'image/jpeg' },
  '.jpeg': { type: 'image', ext: 'jpg', contentType: 'image/jpeg' },
  '.png': { type: 'image', ext: 'png', contentType: 'image/png' },
  '.webp': { type: 'image', ext: 'webp', contentType: 'image/webp' },
};
// Formats a post can carry without normalization; anything else only exists to be converted
const USABLE_AS_IS = new Set([
  '.mp4',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

const DESIGN_SCREENSHOT_MAX_BYTES = 4 * 1024 * 1024;
/** Upload path/URL as an absolute storage URL, or the decoded bytes of a PNG/JPEG data URL. */
export function designScreenshot(value: string): string | { data: Buffer; mimeType: string } {
  const inline = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (inline) {
    const data = Buffer.from(inline[2], 'base64');
    if (!data.length || data.length > DESIGN_SCREENSHOT_MAX_BYTES) throw new BadRequestException('Screenshot must be a PNG/JPEG of at most 4 MB');
    return { data, mimeType: inline[1] };
  }
  if (value.startsWith('data:')) throw new BadRequestException('Screenshot data URL must be PNG or JPEG');
  return storageImageUrl(value);
}

/** /uploads/... as an absolute URL; the AGY service then accepts only configured upload storage. */
export function storageImageUrl(value: string): string {
  if (value.startsWith('data:')) throw new BadRequestException('Reference images must be uploaded files');
  return value.startsWith('/') && process.env.FRONTEND_URL ? new URL(value, process.env.FRONTEND_URL).href : value;
}

const REMOVE_BACKGROUND_TIMEOUT_MS = 60_000;
const REMOVE_BACKGROUND_MAX_BYTES = 30_000_000;
// One rembg process at a time (~1 GB RAM each): later requests wait for the previous one.
let removeBackgroundQueue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = removeBackgroundQueue.then(task, task);
  removeBackgroundQueue = run.catch(() => undefined);
  return run;
}

// Image jobs in flight per org (process-wide): at most agyRequestImageConcurrency() run, the rest queue in
// order. Keeps one org's burst (e.g. a poster asking for 4 pictures) from taking every AGY account.
const orgImageQueues = new Map<string, { active: number; waiting: (() => void)[] }>();
async function orgImageSlot<T>(orgId: string, task: () => Promise<T>): Promise<T> {
  const queue = orgImageQueues.get(orgId) ?? { active: 0, waiting: [] };
  orgImageQueues.set(orgId, queue);
  // A finishing job hands its slot straight to the next waiter, so the cap is never exceeded.
  if (queue.active >= agyRequestImageConcurrency()) await new Promise<void>((resolve) => queue.waiting.push(resolve));
  else queue.active++;
  try { return await task(); }
  finally {
    const next = queue.waiting.shift();
    if (next) next();
    else if (--queue.active === 0) orgImageQueues.delete(orgId);
  }
}

@Injectable()
export class MediaService {
  private storage = UploadFactory.createStorage();
  private processor = UploadFactory.createProcessor();

  constructor(
    private _mediaRepository: MediaRepository,
    private readonly nativeAgy: AgyMcpService,
    private _subscriptionService: SubscriptionService,
    private _videoManager: VideoManager,
    private _temporalService: TemporalService
  ) {}

  async deleteMedia(org: string, id: string) {
    return this._mediaRepository.deleteMedia(org, id);
  }

  getMediaById(id: string) {
    return this._mediaRepository.getMediaById(id);
  }

  async generateImage(
    prompt: string,
    org: Organization,
    generatePromptFirst?: boolean,
    aspectRatio?: string,
    variation?: string,
    referenceImageUrls?: string[],
    signal?: AbortSignal
  ) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) throw new BadRequestException('Invalid image prompt');
    // Optional sample images to follow (AI design chat); upload storage only, at most 4.
    if (referenceImageUrls !== undefined && (!Array.isArray(referenceImageUrls) || referenceImageUrls.length > 4
      || referenceImageUrls.some((url) => typeof url !== 'string' || url.length > 2048))) throw new BadRequestException('Invalid reference images');
    const references = await Promise.all((referenceImageUrls || []).map((url) => this.orgImageUrl(org.id, url)));
    const ratios = ['auto','9:16','16:9','1:1','3:4','4:3','2:3','3:2','21:9'];
    if (aspectRatio && !ratios.includes(aspectRatio)) throw new BadRequestException('Unsupported image aspect ratio');
    try {
      return await this._subscriptionService.useCredit(org, 'ai_images', async () => {
        const description = prompt.match(/<!-- description -->([\s\S]*?)<!-- \/description -->/)?.[1]?.trim();
        const style = prompt.match(/<!-- style -->([\s\S]*?)<!-- \/style -->/)?.[1]?.trim();
        const cleanPrompt = `${description || prompt}${style ? ', phong cách: '+style : ''}${variation ? '\n'+variation : ''}`;
        // Per-org cap on simultaneous image jobs (design editor fires one request per generateImage op).
        return orgImageSlot(org.id, () => {
          signal?.throwIfAborted();
          return this.nativeAgy.image(cleanPrompt, signal, (aspectRatio || 'auto') as AgyAspectRatio, references);
        });
      });
    } catch (error) { throw generationError(error); }
  }

  /**
   * "AI thiết kế" (Polotno): one AGY content job views the page screenshot and returns sanitized
   * operations; no AI credit (chat-style editing). generateImage operations are returned, not executed (the frontend
   * calls /media/generate-image-with-prompt for them).
   */
  async aiDesignEdit(org: Organization, body: AiDesignEditDto, signal?: AbortSignal) {
    // Empty page: no screenshot is sent or needed (the AGY job then runs text-only).
    if (body.phase === 'layout-over-image' && !body.screenshot) throw new BadRequestException('The layout phase needs the page screenshot');
    const screenshot = body.screenshot ? designScreenshot(body.screenshot) : '';
    // Pasted images must be this org's media (404 otherwise), checked before the AGY job.
    const referenceImages = await Promise.all((body.referenceImages || []).map((url) => this.orgImageUrl(org.id, url)));
    try {
      return await this.nativeAgy.designEdit(org.id, { instruction: body.instruction, page: body.page,
        elements: body.elements, variants: body.variants, history: body.history,
        referenceImages, selectedIds: body.selectedIds, phase: body.phase, zones: body.zones,
        palette: body.palette }, screenshot, signal);
    } catch (error) { throw generationError(error); }
  }

  /** Absolute URL of an image that is live media of this org (upload storage); otherwise 404. */
  async orgImageUrl(orgId: string, value: string): Promise<string> {
    const url = assertAiVideoAssetUrl(storageImageUrl(value));
    const { pathname } = new URL(url);
    const media = await this._mediaRepository.findByPath(orgId, [...new Set([url, value, pathname, decodeURIComponent(pathname)])]);
    if (!media) throw new NotFoundException('Image not found in this organization media');
    return url;
  }

  /**
   * Real background removal (rembg, flood-fill fallback) for an image in upload storage; the
   * transparent PNG is saved as new org media. No AI credit.
   */
  async removeBackground(org: Organization, path: string) {
    // The org's own upload only; local files are read through readLocalVideoAsset, which refuses traversal.
    const url = await this.orgImageUrl(org.id, path);
    const input = await readLocalVideoAsset(url, REMOVE_BACKGROUND_MAX_BYTES) ?? await (async () => {
      const response = await fetch(url, { redirect: 'error' });
      if (!response.ok) throw new BadRequestException('Could not load the image');
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length > REMOVE_BACKGROUND_MAX_BYTES) throw new BadRequestException('Image exceeds size limit');
      return body;
    })();
    const folder = await mkdtemp(join(tmpdir(), 'postiz-remove-bg-'));
    try {
      const source = join(folder, 'in'), target = join(folder, 'out.png');
      await writeFile(source, input, { mode: 0o600 });
      const script = resolveWorkspaceArtifact('scripts/remove-background.py', process.env.REMOVE_BACKGROUND_SCRIPT);
      await oneAtATime(() => new Promise<void>((done, fail) => {
        execFile('nice', ['-n', '10', process.env.REMOVE_BACKGROUND_PYTHON || 'python3', script, source, target],
          { timeout: REMOVE_BACKGROUND_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 },
          (error, _stdout, stderr) => error
            ? fail(new BadRequestException(`Background removal failed: ${String(stderr || error.message).trim().slice(-300)}`))
            : done());
      }));
      const uploaded = await this.storage.uploadStream(createReadStream(target), 'image/png', 'png');
      const media = await this.saveFile(org.id, uploaded.originalname, uploaded.path);
      return { id: media.id, path: media.path };
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  /**
   * `count` images for one prompt: one AGY image job per image, all started together (the AGY pool
   * spreads them over accounts within its RAM gate). Each image uses one credit, gets a composition
   * variant and is saved to the media library; failed images are counted, not fatal, unless all fail.
   */
  async generateImageBatch(prompt: string, org: Organization, count: number, aspectRatio?: string, referenceImageUrls?: string[]) {
    const total = Math.max(1, Math.min(agyMaxImagesPerRequest(), Math.floor(Number(count)) || 1));
    const outcomes = await Promise.allSettled(Array.from({ length: total }, async (_, index) => {
      const file = await this.generateImage(prompt, org, true, aspectRatio, agyImageVariation(index, total), referenceImageUrls);
      return this.saveFile(org.id, file.split('/').pop()!, file);
    }));
    const images = outcomes.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
    if (!images.length) throw (outcomes[0] as PromiseRejectedResult).reason;
    return { ...images[0], images, failed: total - images.length };
  }

  /**
   * Streaming twin of generateImageBatch (count 1 included): same credit, variants and media saving
   * per image, but each saved image is reported through `emit` as soon as it is ready. Aborting
   * `signal` (client gone) stops images that have not started yet and cancels running AGY jobs.
   */
  async generateImageStream(
    prompt: string,
    org: Organization,
    count: number,
    emit: (event: { type: 'start'; count: number } | { type: 'image'; index: number; media: Awaited<ReturnType<MediaService['saveFile']>> } | { type: 'error'; index?: number; message: string }) => void,
    aspectRatio?: string,
    referenceImageUrls?: string[],
    signal?: AbortSignal
  ) {
    const total = Math.max(1, Math.min(agyMaxImagesPerRequest(), Math.floor(Number(count)) || 1));
    emit({ type: 'start', count: total });
    await Promise.allSettled(Array.from({ length: total }, async (_, index) => {
      try {
        const file = await this.generateImage(prompt, org, true, aspectRatio, agyImageVariation(index, total), referenceImageUrls, signal);
        const media = await this.saveFile(org.id, file.split('/').pop()!, file);
        if (!signal?.aborted) emit({ type: 'image', index, media });
      } catch (error) {
        if (signal?.aborted) return;
        emit({ type: 'error', index, message: error instanceof HttpException ? error.message : 'Image generation failed, please try again.' });
      }
    }));
  }

  // Streams the remote body straight into storage: only the sniffing prefix
  // and a few upload parts are ever in memory, so a 1 GB video does not cost
  // 1 GB of heap
  async uploadFromUrl(org: string, url: string) {
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        // @ts-ignore — undici option, not in lib.dom fetch types
        dispatcher: ssrfSafeDispatcher,
      });
    } catch (err) {
      // Network-level failure (DNS, connection refused, SSRF block, etc.) —
      // fetch rejects rather than returning a non-ok response. Keep the real
      // reason reachable for callers that want to surface it
      throw new BadRequestException('Failed to fetch URL', { cause: err });
    }
    if (!response.ok || !response.body) {
      throw new BadRequestException('Failed to fetch URL');
    }

    // Cheap early exit when the server declares the size; Content-Length may
    // be absent or wrong, so the stream cap below is what really enforces it.
    // The type isn't known yet (sniffed below), so this uses the largest cap
    const declaredSize = Number(response.headers.get('content-length'));
    if (declaredSize && declaredSize > getMaxSize('video/mp4')) {
      await response.body.cancel();
      throw new BadRequestException('File is too large.');
    }

    const uploaded = await uploadStreamToStorage(
      this.storage,
      response.body,
      declaredSize
    );
    return this.saveFile(org, uploaded.originalname, uploaded.path);
  }

  saveFile(
    org: string,
    fileName: string,
    filePath: string,
    originalName?: string
  ) {
    return this._mediaRepository.saveFile(
      org,
      fileName,
      filePath,
      originalName
    );
  }

  // Saves an upload and, when a normalizer is configured, hands it to the
  // processing workflow; the caller polls getMediaStatus until it is ready
  async saveUploadedFile(
    org: string,
    fileName: string,
    filePath: string,
    originalName?: string
  ) {
    const media = await this.saveFile(org, fileName, filePath, originalName);
    const client = this._temporalService.client.getRawClient();
    if (
      !this.processor ||
      !PROCESSABLE[extname(fileName).toLowerCase()] ||
      !client
    ) {
      return media;
    }

    await this._mediaRepository.startProcessing(org, media.id);
    try {
      await client.workflow.start('processMediaWorkflow', {
        workflowId: `media_${media.id}`,
        taskQueue: 'main',
        args: [{ mediaId: media.id }],
        typedSearchAttributes: new TypedSearchAttributes([
          {
            key: organizationId,
            value: org,
          },
        ]),
      });
    } catch (err) {
      // no workflow means nothing will ever flip the status
      return this.releaseUnprocessed(org, media.id, media.name);
    }

    return { ...media, status: 'processing' };
  }

  // Lets go of a media the normalizer will not touch. A source the platforms
  // accept as-is (mp4, png, ...) becomes ready; one that only exists to be
  // converted (mov) is failed, since nothing downstream can use it
  private async releaseUnprocessed(org: string, id: string, name: string) {
    const convertOnly = !USABLE_AS_IS.has(extname(name).toLowerCase());
    await this._mediaRepository.finishProcessing(org, id, {
      ...(convertOnly
        ? { error: 'No media processor is available to convert this file' }
        : {}),
    });
    return this._mediaRepository.getMediaStatus(org, id);
  }

  // Upload widget (MCP Apps): the session id is what the model sees and polls,
  // the ticket is the credential the widget uploads with. It is handed to the
  // widget only, so it doesn't end up in the conversation
  async createUploadSession(org: string) {
    const sessionId = randomBytes(16).toString('hex');
    await ioRedis.set(`uploadSession:${sessionId}`, org, 'EX', 3600);
    return sessionId;
  }

  private async checkUploadSession(org: string, sessionId: string) {
    if ((await ioRedis.get(`uploadSession:${sessionId}`)) !== org) {
      throw new HttpException('Upload session not found or expired', 404);
    }
  }

  async createUploadTicket(org: string, sessionId: string) {
    await this.checkUploadSession(org, sessionId);
    const ticket = randomBytes(32).toString('hex');
    await ioRedis.set(
      `uploadTicket:${ticket}`,
      JSON.stringify({ org, sessionId }),
      'EX',
      600
    );
    return ticket;
  }

  // A ticket never outlives its session: the file is streamed to storage right
  // after this check, so an expired session has to be refused here
  async getUploadTicket(ticket: string) {
    const found = JSON.parse(
      (await ioRedis.get(`uploadTicket:${ticket}`)) || 'null'
    ) as { org: string; sessionId: string } | null;
    if (
      !found ||
      (await ioRedis.get(`uploadSession:${found.sessionId}`)) !== found.org
    ) {
      return null;
    }
    return found;
  }

  async saveUploadSessionFile(
    org: string,
    sessionId: string,
    fileName: string,
    filePath: string,
    originalName?: string
  ) {
    await this.checkUploadSession(org, sessionId);
    const media = await this.saveUploadedFile(
      org,
      fileName,
      filePath,
      originalName
    );
    // a list, so parallel uploads of the same session can't overwrite each other
    await ioRedis.rpush(`uploadSessionMedia:${sessionId}`, media.id);
    await ioRedis.expire(`uploadSessionMedia:${sessionId}`, 3600);
    return media;
  }

  async getUploadSession(org: string, sessionId: string) {
    await this.checkUploadSession(org, sessionId);
    const list = await ioRedis.lrange(`uploadSessionMedia:${sessionId}`, 0, -1);
    return (
      await Promise.all(
        list.map((id) => this._mediaRepository.getMediaStatus(org, id))
      )
    ).filter((f) => f);
  }

  async getMediaStatus(org: string, id: string) {
    const media = await this._mediaRepository.getMediaStatus(org, id);
    if (!media) {
      throw new HttpException('Media not found', 404);
    }

    return media;
  }

  // The normalized file overwrites the original in place; only a container
  // change (mov -> mp4, jpeg -> jpg) lands under a new key. Either way the
  // polling side needs nothing but the media record to know where it is
  private normalizedName(name: string) {
    const ext = extname(name).toLowerCase();
    return `${name.slice(0, -ext.length)}.${PROCESSABLE[ext].ext}`;
  }

  // Returns the processor job id; when this process has nothing to run the
  // media (already marked processing by the upload) is released as ready, so
  // a worker without the processor configured never leaves an upload hanging
  async submitProcessing(mediaId: string) {
    const media = await this._mediaRepository.getMediaById(mediaId);
    if (!media) {
      return null;
    }

    const processable = PROCESSABLE[extname(media.name).toLowerCase()];
    if (
      !this.processor ||
      !processable ||
      !this.storage.signDownloadUrl ||
      !this.storage.signUploadUrl
    ) {
      await this.releaseUnprocessed(media.organizationId, media.id, media.name);
      return null;
    }

    const outputName = this.normalizedName(media.name);
    return this.processor.submit({
      version: 1,
      type: processable.type,
      reference: media.id,
      source: { url: await this.storage.signDownloadUrl(media.name) },
      output: {
        url: await this.storage.signUploadUrl(
          outputName,
          processable.contentType
        ),
        content_type: processable.contentType,
      },
      rules: processable.type === 'video' ? VIDEO_RULES : IMAGE_RULES,
      limits: LIMITS,
    });
  }

  // Returns true once the record is final. A transport error throws so the
  // activity retries the poll; a terminal answer from the queue or the service
  // marks the media failed and keeps the original usable
  async checkProcessing(mediaId: string, jobId: string) {
    const media = await this._mediaRepository.getMediaById(mediaId);
    if (!media) {
      return true;
    }

    // a retried activity after the record was already finalized must not
    // derive the output key a second time from the rewritten name
    if (media.status !== 'processing') {
      return true;
    }

    const org = media.organizationId;
    if (!this.processor) {
      await this.releaseUnprocessed(org, mediaId, media.name);
      return true;
    }

    const job = await this.processor.status(jobId);
    if (job.status === 'pending') {
      return false;
    }

    if (job.status === 'failed') {
      await this._mediaRepository.finishProcessing(org, mediaId, {
        error: job.error,
      });
      return true;
    }

    const { result } = job;
    if (
      !result ||
      !['completed', 'unchanged', 'failed'].includes(result.status)
    ) {
      await this._mediaRepository.finishProcessing(org, mediaId, {
        error: `Unexpected processor result: ${JSON.stringify(result).slice(
          0,
          500
        )}`,
      });
      return true;
    }

    if (result.status === 'failed') {
      // the stderr tail is the only way to know what ffmpeg objected to
      await this._mediaRepository.finishProcessing(org, mediaId, {
        error: [
          `${result.failure?.code || 'FAILED'}: ${
            result.failure?.message || ''
          }`,
          result.failure?.stderr_tail,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 4000),
      });
      return true;
    }

    if (result.status === 'unchanged') {
      await this._mediaRepository.finishProcessing(org, mediaId, {});
      return true;
    }

    const outputName = this.normalizedName(media.name);
    await this._mediaRepository.finishProcessing(org, mediaId, {
      name: outputName,
      path: media.path.slice(0, media.path.lastIndexOf('/') + 1) + outputName,
      fileSize: result.output?.bytes,
    });

    // a same-key output already replaced the original; a stray object after a
    // container change is harmless, so a failed delete never fails the media
    if (outputName !== media.name) {
      try {
        await this.storage.removeFile(media.name);
      } catch (err) {
        console.error(`Could not remove original media ${media.name}:`, err);
      }
    }
    return true;
  }

  async failProcessing(mediaId: string, error: string) {
    const media = await this._mediaRepository.getMediaById(mediaId);
    if (!media) {
      return;
    }

    return this._mediaRepository.finishProcessing(
      media.organizationId,
      mediaId,
      {
        error,
      }
    );
  }

  getMedia(org: string, page: number, search?: string) {
    return this._mediaRepository.getMedia(org, page, search);
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._mediaRepository.saveMediaInformation(org, data);
  }

  getVideoOptions() {
    return this._videoManager.getAllVideos();
  }

  async generateVideoAllowed(org: Organization, type: string) {
    const video = this._videoManager.getVideoByName(type);
    if (!video) {
      throw new Error(`Video type ${type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    return true;
  }

  private async validateVideoRequest(org: Organization, body: VideoDto) {
    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      'ai_videos'
    );

    if (totalCredits.credits <= 0) {
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.VIDEOS_PER_MONTH,
      });
    }

    const video = this._videoManager.getVideoByName(body.type);
    if (!video) {
      throw new Error(`Video type ${body.type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    await video.instance.processAndValidate(body.customParams);
    return video;
  }

  async generateVideo(org: Organization, body: VideoDto) {
    try {
      const video = await this.validateVideoRequest(org, body);

      return await this._subscriptionService.useCredit(
        org,
        'ai_videos',
        async () => {
          const loadedData = await video.instance.process(
            body.output,
            body.customParams
          );

          const file = await this.storage.uploadSimple(loadedData);
          return this.saveFile(org.id, file.split('/').pop(), file);
        }
      );
    } catch (err) {
      throw generationError(err);
    }
  }

  // Generating a video takes minutes, longer than an MCP request can stay open,
  // so the generation runs in a workflow and the caller polls its status by job id
  async startGenerateVideo(org: Organization, body: VideoDto) {
    // validated here as well as in the workflow so bad input fails before a job exists
    try {
      await this.validateVideoRequest(org, body);
    } catch (err) {
      throw generationError(err);
    }

    const client = this._temporalService.client.getRawClient();
    if (!client) {
      throw new HttpException('Video generation is not available', 503);
    }

    const jobId = `video_${org.id}_${makeId(10)}`;
    await client.workflow.start('generateVideoWorkflow', {
      workflowId: jobId,
      taskQueue: 'main',
      args: [
        {
          organizationId: org.id,
          body,
        },
      ],
      typedSearchAttributes: new TypedSearchAttributes([
        {
          key: organizationId,
          value: org.id,
        },
      ]),
    });

    return { jobId };
  }

  async getGenerateVideoStatus(
    org: Organization,
    jobId: string
  ): Promise<{
    status: 'pending' | 'completed' | 'failed';
    id?: string;
    path?: string;
    error?: string;
  }> {
    // the job id carries the organization, so one org can't poll another's job
    if (!jobId.startsWith(`video_${org.id}_`)) {
      throw new HttpException('Video job not found', 404);
    }

    const handle = await this._temporalService.client.getWorkflowHandle(jobId);
    let status: string;
    try {
      status = (await handle.describe()).status.name;
    } catch (err) {
      throw new HttpException('Video job not found', 404);
    }

    if (status === 'RUNNING') {
      return { status: 'pending' };
    }

    try {
      const media = (await handle.result()) as Awaited<
        ReturnType<MediaService['saveFile']>
      >;
      return { status: 'completed', id: media.id, path: media.path };
    } catch (err) {
      // the workflow failure wraps the activity failure which wraps the actual error
      let cause: any = err;
      while (cause?.cause && cause.cause !== cause) {
        cause = cause.cause;
      }
      return {
        status: 'failed',
        error: cause?.message || String(err),
      };
    }
  }

  async videoFunction(identifier: string, functionName: string, body: any) {
    const video = this._videoManager.getVideoByName(identifier);
    if (!video) {
      throw new Error(`Video with identifier ${identifier} not found`);
    }

    // @ts-ignore
    const functionToCall = video.instance[functionName];
    if (
      typeof functionToCall !== 'function' ||
      this._videoManager.checkAvailableVideoFunction(functionToCall)
    ) {
      throw new HttpException(
        `Function ${functionName} not found on video instance`,
        400
      );
    }

    return functionToCall(body);
  }
}
