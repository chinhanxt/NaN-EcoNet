import { Injectable } from '@nestjs/common';
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { EDGE_WORD_SCRIPT } from './tts.edge-script';
import { runTtsProcess } from './tts.process';
import {
  alignEstimatedCaptions, AUDIO_SAMPLE_RATE, captionsToVtt, MAX_TEMPO, planContinuousTimeline,
  parseWordCaptions, secondsToFrames, VIDEO_FPS, voicedIntervalsFromSilence, WordCaption,
} from './tts.timing';
import { AI_VIDEO_VOICES, CLONED_VOICES } from './dto/ai.video.dto';

const SPEECH_LEAD_PAD = 0.05;
const SPEECH_TAIL_PAD = 0.1;
/** Fitted source-video voice-over: lead-in before the first word, tail kept free, mildest slow-down. */
const PREVIEW_LEAD_SECONDS = 0.15;
const PREVIEW_TAIL_SECONDS = 0.25;
const PREVIEW_MIN_TEMPO = 0.94;
export type ClonedVoice = typeof CLONED_VOICES[number];
export type VietnameseVoice = typeof AI_VIDEO_VOICES[number];
export type EdgeVoice = 'vi-VN-HoaiMyNeural' | 'vi-VN-NamMinhNeural';
/** Edge voice used when the clone server cannot serve a cloned voice. */
export const CLONE_FALLBACK_VOICE: Record<ClonedVoice, EdgeVoice> = {
  'Thuyết Minh': 'vi-VN-NamMinhNeural', 'Chị gái': 'vi-VN-HoaiMyNeural', 'Giọng dạy': 'vi-VN-HoaiMyNeural',
  HTH: 'vi-VN-NamMinhNeural', Adam: 'vi-VN-NamMinhNeural',
};
/** The clone server is down, overloaded, timed out, or returned no usable audio. */
export class VoiceCloneUnavailableError extends Error {
  constructor(readonly voice: string, readonly detail: string) {
    super(`Máy chủ giọng nhân bản (Voice Clone) không phản hồi nên không đọc được giọng "${voice}" (${detail}). ` +
      'Hãy thử lại sau hoặc chọn giọng Edge-TTS (Hoài My / Nam Minh).');
    this.name = 'VoiceCloneUnavailableError';
  }
}
/** Set when a cloned voice was replaced by an Edge voice; callers surface `warning` to the user. */
export interface VoiceFallback { requested: ClonedVoice; used: EdgeVoice; reason: string; warning: string }
export interface SceneTiming { sceneIndex: number; startFrame: number; durationInFrames: number }
/** Runs `work` over `items` with bounded concurrency; waits for every started task before rejecting. */
async function mapLimit<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try { results[index] = await work(items[index], index); }
      catch (error) { failed = true; throw error; }
    }
  };
  const settled = await Promise.allSettled(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  const rejected = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  return results;
}

export interface VideoSpeech {
  audioPath: string; vttPath: string; durationInSeconds: number; durationInFrames: number;
  sceneTimings: SceneTiming[]; captions: WordCaption[]; voiceFallback?: VoiceFallback;
}

@Injectable()
export class TtsService {
  /** The clone server is GPU-bound (parallel requests gain no throughput and add VRAM); send one at a time. */
  private cloneQueue: Promise<unknown> = Promise.resolve();
  /** Circuit breaker: after an outage, queued/next clone requests fail fast instead of waiting per scene. */
  private cloneDownUntil = 0;
  private cloneDownReason = '';

  private cloneTimeoutMs() { return Math.max(1000, Number(process.env.VOICE_CLONE_TIMEOUT_MS) || 90_000); }
  private cloneCooldownMs() { return Math.max(0, Number(process.env.VOICE_CLONE_COOLDOWN_MS ?? 60_000)); }

  /**
   * Runs `synthesize` with the requested voice; if it is a cloned voice and the clone server is
   * unavailable, re-runs the whole narration with one Edge voice (no mixed voices) and records why.
   * VOICE_CLONE_FALLBACK=0 turns the fallback off: the Vietnamese VoiceCloneUnavailableError surfaces instead.
   */
  private async withCloneFallback<T extends object>(voice: VietnameseVoice, signal: AbortSignal | undefined,
    synthesize: (voice: VietnameseVoice) => Promise<T>): Promise<T & { voiceFallback?: VoiceFallback }> {
    try {
      return await synthesize(voice);
    } catch (error) {
      if (!(error instanceof VoiceCloneUnavailableError) || signal?.aborted || process.env.VOICE_CLONE_FALLBACK === '0') throw error;
      const used = CLONE_FALLBACK_VOICE[voice as ClonedVoice];
      const result = await synthesize(used);
      return { ...result, voiceFallback: { requested: voice as ClonedVoice, used, reason: error.detail,
        warning: `Voice clone "${voice}" unavailable (${error.detail}); narrated with Edge voice ${used}` } };
    }
  }

  private serializedClone<T>(task: () => Promise<T>): Promise<T> {
    const run = this.cloneQueue.catch(() => undefined).then(task);
    this.cloneQueue = run.catch(() => undefined);
    return run;
  }
  private validateText(text: string, maximum = 2500): string {
    if (typeof text !== 'string' || !text.trim() || text.length > maximum ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
      throw new Error(`Narration must contain 1–${maximum} characters without control characters`);
    }
    return text.trim();
  }

  private validateVoice(voice: string): asserts voice is VietnameseVoice {
    if (!(AI_VIDEO_VOICES as readonly string[]).includes(voice)) {
      throw new Error(`Unsupported Vietnamese voice: ${voice}`);
    }
  }

  private async workspace(directory: string): Promise<string> {
    if (typeof directory !== 'string' || !isAbsolute(directory) || directory.includes('\0') ||
        directory.split(/[\\/]/).includes('..') || normalize(directory) === sep) {
      throw new Error('Speech output directory must be an absolute directory without traversal');
    }
    await mkdir(directory, { recursive: true });
    // Every output is generated under a unique child of the trusted caller's directory.
    return mkdtemp(join(await realpath(resolve(directory)), 'speech-'));
  }

  private async duration(path: string, signal?: AbortSignal): Promise<number> {
    const output = await runTtsProcess('ffprobe', ['-v', 'error', '-show_entries',
      'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path], { signal, timeoutMs: 15000 });
    const seconds = Number(output.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid generated audio duration');
    return seconds;
  }

  private async voicedIntervals(path: string, seconds: number, signal?: AbortSignal) {
    const output = await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error',
      '-i', path, '-af', 'silencedetect=noise=-35dB:duration=0.03,ametadata=mode=print:file=-',
      '-f', 'null', '-'], { signal, timeoutMs: 30000 });
    // Short detector finds every edge silence; interior pauses under 150 ms stay inside a phrase.
    return voicedIntervalsFromSilence(output, seconds * 1000, 60, 150);
  }

  private async rawScene(text: string, voice: VietnameseVoice, directory: string,
    index: number, signal?: AbortSignal) {
    if (CLONED_VOICES.includes(voice as any)) {
      return this.rawSceneCloned(text, voice, directory, index, signal);
    }
    const mp3 = join(directory, `raw-${index}.mp3`);
    const audioPath = join(directory, `raw-${index}.wav`);
    const output = await runTtsProcess('python3', ['-c', EDGE_WORD_SCRIPT], {
      stdin: JSON.stringify({ text, voice, audioPath: mp3 }), signal,
    });
    const captions = parseWordCaptions(JSON.parse(output));
    await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
      '-i', mp3, '-ar', String(AUDIO_SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', audioPath], { signal });
    const seconds = await this.duration(audioPath, signal);
    return { audioPath, captions, seconds, voiced: await this.voicedIntervals(audioPath, seconds, signal) };
  }

  private async rawSceneCloned(text: string, voice: string, directory: string,
    index: number, signal?: AbortSignal) {
    const audioPath = join(directory, `raw-${index}.wav`);
    const serviceUrl = process.env.VOICE_CLONE_SERVICE_URL || 'http://127.0.0.1:8002';
    signal?.throwIfAborted();
    const abort = new AbortController();
    const forwardAbort = () => abort.abort(signal?.reason);
    signal?.addEventListener('abort', forwardAbort, { once: true });
    let timer: NodeJS.Timeout | undefined;
    try {
      let result: any;
      try {
        result = await this.serializedClone(async () => {
          abort.signal.throwIfAborted();
          if (Date.now() < this.cloneDownUntil) throw Object.assign(new Error(this.cloneDownReason), { cloneDown: true });
          // The deadline covers this request only, not time spent queued behind other scenes.
          const timeoutMs = this.cloneTimeoutMs();
          timer = setTimeout(() => abort.abort(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
          const response = await fetch(`${serviceUrl}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice }),
            signal: abort.signal,
          });
          if (!response.ok) {
            const err = await response.text().catch(() => '');
            throw Object.assign(new Error(`HTTP ${response.status}${err ? `: ${err.slice(0, 200)}` : ''}`), { status: response.status });
          }
          const body = await response.json();
          if (!body?.success || typeof body?.audio_base64 !== 'string' || !body.audio_base64) {
            throw Object.assign(new Error('unsuccessful result without audio'), { rejectedText: true });
          }
          return body;
        });
      } catch (error) {
        // Caller cancellation stays a cancellation; everything else is a clone-server outage.
        if (signal?.aborted) throw signal.reason ?? error;
        const cause = (error as { cause?: { code?: string } })?.cause?.code;
        const reason = abort.signal.aborted && abort.signal.reason instanceof Error ? abort.signal.reason.message
          : `${error instanceof Error ? error.message : String(error)}${cause ? ` ${cause}` : ''}`;
        const detail = (error as { cloneDown?: boolean })?.cloneDown ? reason : `${serviceUrl}: ${reason}`.slice(0, 300);
        // Only an outage (network error, timeout, 5xx) trips the shared breaker; a 4xx or a rejected text is this request's problem.
        const status = (error as { status?: number })?.status;
        const outage = abort.signal.aborted || (status === undefined ? !(error as { rejectedText?: boolean })?.rejectedText : status >= 500);
        if (outage && !(error as { cloneDown?: boolean })?.cloneDown && !(Date.now() < this.cloneDownUntil)) {
          this.cloneDownUntil = Date.now() + this.cloneCooldownMs();
          this.cloneDownReason = detail;
        }
        throw new VoiceCloneUnavailableError(voice, detail);
      }
      clearTimeout(timer);
      this.cloneDownUntil = 0;
      const rawAudio = Buffer.from(result.audio_base64, 'base64');
      const tempWav = join(directory, `clone-temp-${index}.wav`);
      await writeFile(tempWav, rawAudio);

      await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
        '-i', tempWav, '-ar', String(AUDIO_SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', audioPath], { signal });
      await rm(tempWav, { force: true });

      const seconds = await this.duration(audioPath, signal);
      // The clone service spreads words by length over the whole clip, including
      // silence. Re-time them onto detected speech so captions follow the voice.
      const voiced = await this.voicedIntervals(audioPath, seconds, signal);
      const captions = alignEstimatedCaptions(parseWordCaptions(result.captions), voiced);
      return { audioPath, captions, seconds, voiced };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    }
  }

  /**
   * One narration take. With `fitSeconds` (source-video voice-over) the take is trimmed to its
   * voiced span, placed after a short lead-in and tempo-fitted into the clip (0.94–1.25x) so it
   * is neither cut off by the clip end nor left with a long dead tail.
   */
  async synthesizePreview(text: string, voice: VietnameseVoice, outputDirectory: string,
    signal?: AbortSignal, fitSeconds?: number): Promise<{ audioPath: string; durationInSeconds: number; tempo?: number; voiceFallback?: VoiceFallback }> {
    this.validateVoice(voice);
    const narration = this.validateText(text, 1500);
    if (fitSeconds !== undefined && !(Number.isFinite(fitSeconds) && fitSeconds > 1)) throw new Error('Invalid narration fit duration');
    return this.withCloneFallback(voice, signal, (selected) => this.previewWith(narration, selected, outputDirectory, signal, fitSeconds));
  }

  private async previewWith(narration: string, voice: VietnameseVoice, outputDirectory: string,
    signal?: AbortSignal, fitSeconds?: number): Promise<{ audioPath: string; durationInSeconds: number; tempo?: number }> {
    const directory = await this.workspace(outputDirectory);
    try {
      const scene = await this.rawScene(narration, voice, directory, 0, signal);
      const audioPath = join(directory, 'preview.wav');
      if (fitSeconds) {
        const first = scene.voiced[0]?.startMs ?? 0;
        const last = scene.voiced[scene.voiced.length - 1]?.endMs ?? scene.seconds * 1000;
        const start = Math.max(0, first / 1000 - SPEECH_LEAD_PAD);
        const end = Math.min(scene.seconds, last / 1000 + SPEECH_TAIL_PAD);
        const speech = end - start >= 0.1 ? end - start : scene.seconds;
        const room = fitSeconds - PREVIEW_LEAD_SECONDS - PREVIEW_TAIL_SECONDS;
        const tempo = Math.min(MAX_TEMPO, Math.max(PREVIEW_MIN_TEMPO, speech / room));
        await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', scene.audioPath, '-af',
          `atrim=start=${start.toFixed(4)}:end=${(start + speech).toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse,atempo=${tempo.toFixed(4)},adelay=${Math.round(PREVIEW_LEAD_SECONDS * 1000)}`,
          '-ar', String(AUDIO_SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', audioPath], { signal });
        await Promise.all([scene.audioPath, join(directory, 'raw-0.mp3')].map((file) => rm(file, { force: true })));
        return { audioPath, durationInSeconds: await this.duration(audioPath, signal), tempo };
      }
      await rename(scene.audioPath, audioPath);
      await Promise.all(['raw-0.mp3'].map((file) => rm(join(directory, file), { force: true })));
      return { audioPath, durationInSeconds: scene.seconds };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async synthesizeVideo(scenes: Array<{ voiceText: string }>, voice: VietnameseVoice,
    targetDuration: 15 | 30 | 60, outputDirectory: string, signal?: AbortSignal): Promise<VideoSpeech> {
    this.validateVoice(voice);
    if (![15, 30, 60].includes(targetDuration)) throw new Error('Video duration must be 15, 30, or 60 seconds');
    if (!Array.isArray(scenes) || scenes.length < 1 || scenes.length > 12) throw new Error('Expected 1–12 scenes');
    const texts = scenes.map((scene) => this.validateText(scene?.voiceText));
    if (texts.join('').length > 10000) throw new Error('Total narration exceeds 10000 characters');
    return this.withCloneFallback(voice, signal, (selected) => this.videoWith(texts, selected, targetDuration, outputDirectory, signal));
  }

  private async videoWith(texts: string[], voice: VietnameseVoice, targetDuration: 15 | 30 | 60,
    outputDirectory: string, signal?: AbortSignal): Promise<VideoSpeech> {
    const directory = await this.workspace(outputDirectory);
    try {
      // Scenes are synthesized concurrently: clone requests queue on the GPU server while
      // earlier clips are resampled/silence-scanned; Edge voices are network-bound.
      const raw = await mapLimit(texts, 4, (text, index) => this.rawScene(text, voice, directory, index, signal));
      // Trim each clip to its detected speech (small breath pads) so scene joins do
      // not stack the voice engine's leading/trailing silence.
      const spans = raw.map((scene) => {
        const first = scene.voiced[0]?.startMs ?? 0;
        const last = scene.voiced[scene.voiced.length - 1]?.endMs ?? scene.seconds * 1000;
        const start = Math.max(0, first / 1000 - SPEECH_LEAD_PAD);
        const end = Math.min(scene.seconds, last / 1000 + SPEECH_TAIL_PAD);
        return end - start >= 0.1 ? { start, end } : { start: 0, end: scene.seconds };
      });
      const durationInFrames = secondsToFrames(targetDuration);
      const plan = planContinuousTimeline(spans.map((span) => span.end - span.start), targetDuration);
      const { tempo, frames } = plan;
      const captions: WordCaption[] = [];
      const sceneTimings: SceneTiming[] = [];
      let startFrame = 0;
      await mapLimit(raw, 4, async (scene, index) => {
        const output = join(directory, `scene-${index}.wav`);
        // Integral samples per frame (48000 / 30) gives exact video/audio length.
        const samples = frames[index] * AUDIO_SAMPLE_RATE / VIDEO_FPS;
        const { start, end } = spans[index];
        await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
          '-i', scene.audioPath, '-af',
          `atrim=start=${start.toFixed(4)}:end=${end.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse,atempo=${tempo},apad,atrim=end_sample=${samples}`,
          '-ar', String(AUDIO_SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', output], { signal });
      });
      for (let index = 0; index < raw.length; index++) {
        const { start } = spans[index];
        const startMs = startFrame / VIDEO_FPS * 1000;
        const endMs = (startFrame + frames[index]) / VIDEO_FPS * 1000;
        for (const caption of raw[index].captions) {
          const transformed = {
            text: caption.text,
            startMs: Math.min(endMs, startMs + Math.max(0, caption.startMs - start * 1000) / tempo),
            endMs: Math.min(endMs, startMs + Math.max(0, caption.endMs - start * 1000) / tempo),
          };
          if (transformed.endMs > transformed.startMs) captions.push(transformed);
        }
        sceneTimings.push({ sceneIndex: index, startFrame, durationInFrames: frames[index] });
        startFrame += frames[index];
      }
      if (startFrame !== durationInFrames) throw new Error('Scene timeline does not match the requested duration');
      // Fixed generated basenames ensure the concat file cannot contain path directives.
      const concatPath = join(directory, 'concat.txt');
      await writeFile(concatPath, raw.map((_, index) => `file 'scene-${index}.wav'`).join('\n'));
      const audioPath = join(directory, 'narration.wav');
      await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'concat', '-safe', '1', '-i', concatPath, '-c:a', 'pcm_s16le', audioPath], { signal });
      const measuredSeconds = await this.duration(audioPath, signal);
      if (Math.abs(measuredSeconds - targetDuration) > 1 / AUDIO_SAMPLE_RATE) {
        throw new Error('Generated audio does not match the requested frame duration');
      }
      const vttPath = join(directory, 'narration.vtt');
      await writeFile(vttPath, captionsToVtt(captions), 'utf8');
      await Promise.all(raw.flatMap((_, index) => [`raw-${index}.mp3`, `raw-${index}.wav`, `scene-${index}.wav`])
        .concat('concat.txt').map((file) => rm(join(directory, file), { force: true })));
      return { audioPath, vttPath, durationInSeconds: measuredSeconds, durationInFrames, sceneTimings, captions };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
}
