import { BadGatewayException, Injectable, Logger, OnModuleDestroy, UnprocessableEntityException } from '@nestjs/common';
import { readFile, mkdtemp, writeFile, rm, chmod, mkdir, rename } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { dirname, join } from 'path';
import { assertAiVideoAssetUrl, readLocalVideoAsset } from '../video.asset';
import { memAvailableBytes, resolveWorkspaceArtifact } from '../runtime.path';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { DESIGN_EDIT_ROLE, DESIGN_EDIT_SKILLS, DESIGN_MAX_REFERENCE_IMAGES, DesignEditInput, designEditEffort, designEditNeedsScreenshot, designEditPrompt, designEditSchema, sanitizeDesignEdit } from './design.edit';
import { DesignEditCache, designEditCacheKey } from './design-edit.cache';

export type AgyAspectRatio =
  | 'auto'
  | '9:16'
  | '16:9'
  | '1:1'
  | '3:4'
  | '4:3'
  | '2:3'
  | '3:2'
  | '21:9';

export interface AgyMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    signal?: AbortSignal
  ) => Promise<unknown>;
}
export interface AgyMcpEvent {
  type: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  message?: string;
  errors?: unknown[];
  receipt?: Record<string, unknown>;
}
export interface AgyAnalysisRequest {
  onEvent?: (event: AgyMcpEvent) => void | Promise<void>;
  prompt: string;
  schema: Record<string, unknown>;
  frames?: { path: string; timestampSeconds: number }[];
  role?: string;
  nativeReview?: boolean;
  skills?: string[];
  onAttempt?: () => void;
}
// Social post/caption writing: copywriting craft only. video-retention-scriptwriting is for video
// scripts (storyboard/content-writer), never captions. The caption role runs at a lower default
// effort in the runner (AGY_MCP_EFFORT_CAPTION_WRITER overrides it).
export const CAPTION_ROLE = 'caption-writer';
export const CAPTION_SKILLS = ['copywriting', 'viral-copywriting-master'];
// Short constrained text tasks (classification, extraction, thread split, voice rewrite): no skills, low effort.
export const TEXT_EDIT_ROLE = 'text-editor';
/** Sample images the user attached for "make one like this"; more only dilutes the model's attention. */
export const MAX_REFERENCE_IMAGES = 4;
export const referenceImageRules = (count: number) => `REFERENCE IMAGES (${count}, attached by the user as samples to follow): `
  + 'view every reference image (read_frame + native view_file) BEFORE writing the generate_image prompt. '
  + 'Follow them: keep their layout and composition, visual style, color palette, typography/presentation style, framing and level of detail; '
  + 'replace only the subject and content with what the request asks for. Never copy their brand names, logos, people or text unless the request says so. '
  + 'Describe the reference layout and style concretely in the generate_image prompt (the image model does not see this conversation). '
  + 'Where the ART DIRECTION below conflicts with the references, the references win for layout and style; the request wins for subject.';
const CAPTION_REQUEST = /viết\s*(bài|caption|status|post|nội dung)|bài\s*đăng|đăng\s*bài|caption|hashtag|\b(write|draft)\b[^.?!]{0,40}\b(post|caption|tweet|thread)\b/i;
// Business post layout for every caption-writer job. The model writes the title in plain capitals;
// boldTitle() styles it in code, so the model never invents Unicode look-alike characters.
export const CAPTION_FORMAT = `FORMAT (Vietnamese business social post). Follow it unless the request explicitly asks for something else (for example one short sentence, no emoji, no hashtags, no list, or a character limit): explicit request wording always wins over this format.
1. Title line: one emoji, then the TITLE IN PLAIN CAPITAL LETTERS, then one emoji. Use ordinary letters only; never Unicode bold/italic or other styled characters.
2. Blank line, then an opening of 1-2 short sentences.
3. Blank line, then 3-5 bullet lines, each starting with ✅ (or one emoji that fits the topic), one short line each.
4. Blank line, then one call-to-action sentence ending with an emoji.
5. Blank line, then 3-6 hashtags on the last line: no diacritics, CamelCase (for example #HocTapXanh #HUTECH).
Keep the whole post under 1200 characters.`;

// Mathematical Sans-Serif Bold A-Z, a-z, 0-9.
const boldChar = (c: string) => {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d5d4 + code - 65);
  if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d5ee + code - 97);
  if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + code - 48);
  return c;
};
/** Bold one line: only unaccented A-Z, a-z, 0-9. Vietnamese accented letters (À, Ộ, Đ, Ư...) stay
 * as written, like the user's sample: bold base + combining marks renders badly on Facebook. */
export function boldText(text: string): string {
  return [...text.normalize('NFC')].map(boldChar).join('');
}
const isTitle = (line: string) => {
  const letters = [...line.normalize('NFC')].filter((c) => /\p{L}/u.test(c));
  return !line.trim().startsWith('#') && letters.length >= 3 && line.length <= 160 &&
    letters.filter((c) => c === c.toLocaleUpperCase('vi') && c !== c.toLocaleLowerCase('vi')).length >= letters.length * 0.8;
};
/** Bold the post's title line: the first capitalised line among the first three nonempty lines (an
 * emoji frame is fine; a chat answer may lead with one sentence). Bodies, hashtags and plain
 * sentence answers are left untouched. */
export function boldTitle(post: string): string {
  const lines = post.split('\n');
  const index = lines.map((line, i) => [line, i] as const).filter(([line]) => line.trim()).slice(0, 3)
    .find(([line]) => isTitle(line))?.[1];
  if (index === undefined) return post;
  lines[index] = boldText(lines[index]);
  return lines.join('\n');
}
/** boldTitle for streamed text: per text block, holds text only until the title line is found or the first
 * three nonempty lines have passed, so the streamed post reads exactly like boldTitle(full post). */
function titleBolder(forward: (delta: string, block: string) => void) {
  const blocks = new Map<string, { pending: string; seen: number; done: boolean }>();
  const flush = (except?: string) => {
    for (const [block, state] of blocks) {
      if (block === except || !state.pending) continue;
      forward(!state.done && isTitle(state.pending) ? boldText(state.pending) : state.pending, block);
      state.pending = ''; state.done = true;
    }
  };
  const write = (delta: string, block: string) => {
    flush(block);
    const state = blocks.get(block) ?? { pending: '', seen: 0, done: false };
    blocks.set(block, state);
    if (state.done) { forward(delta, block); return; }
    state.pending += delta;
    let newline: number;
    while (!state.done && (newline = state.pending.indexOf('\n')) >= 0) {
      const line = state.pending.slice(0, newline);
      state.pending = state.pending.slice(newline + 1);
      const title = !!line.trim() && isTitle(line);
      forward((title ? boldText(line) : line) + '\n', block);
      if (title || (line.trim() && ++state.seen >= 3)) state.done = true;
    }
    if (state.done && state.pending) { forward(state.pending, block); state.pending = ''; }
  };
  return { write, flush: () => flush() };
}
const captionSchema = {
  type: 'object',
  properties: { content: { type: 'string', minLength: 1, maxLength: 3000 } },
  required: ['content'],
  additionalProperties: false,
};
const contentSchema = {
  type: 'object',
  properties: { content: { type: 'string', minLength: 1 } },
  required: ['content'],
  additionalProperties: false,
};

// Process-wide AGY scheduler shared by chat, storyboard and source-video workers. Every
// AGY CLI job is a bootstrap + agent (~250-300 MB RSS), so admission is bounded by a
// global cap, a per-kind cap and a MemAvailable floor (checked across processes via
// /proc/meminfo). With AGY_MCP_PROVIDER_URLS (one AGYXT proxy per account) each job is
// pinned to the least-busy provider and a rate-limited provider cools down.
export type AgyJobKind = 'image' | 'content' | 'analysis' | 'chat';
const clampInt = (value: unknown, fallback: number, max: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(max, n) : fallback;
};
export function agyProviderUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const list = (env.AGY_MCP_PROVIDER_URLS || '').split(',').map((url) => url.trim()).filter(Boolean);
  if (list.length) return [...new Set(list)];
  const single = env.AGY_MCP_PROVIDER_URL || env.CLOUD_CODE_URL;
  return single ? [single] : [];
}
export function agyLimits(env: NodeJS.ProcessEnv = process.env) {
  const providers = agyProviderUrls(env).length;
  // Without a proxy every job shares one native OAuth account: stay conservative.
  const defaults = providers > 1
    ? { global: 4, image: 4, content: 2, analysis: 2, chat: 2 }
    : providers === 1
      ? { global: 3, image: 3, content: 2, analysis: 1, chat: 1 }
      : { global: 2, image: 2, content: 1, analysis: 1, chat: 1 };
  const global = clampInt(env.AGY_MCP_MAX_CONCURRENCY, defaults.global, 6);
  const kind = (name: AgyJobKind) => Math.min(global, clampInt(env[`AGY_MCP_${name.toUpperCase()}_CONCURRENCY`], defaults[name], 6));
  return {
    global,
    kinds: { image: kind('image'), content: kind('content'), analysis: kind('analysis'), chat: kind('chat') } as Record<AgyJobKind, number>,
    minFreeMb: clampInt(env.AGY_MCP_MIN_FREE_MB, 4096, 65536),
    jobRssMb: clampInt(env.AGY_MCP_JOB_RSS_MB, 400, 8192),
    // How long a granted job is assumed not to have allocated its working memory yet.
    warmupMs: clampInt(env.AGY_MCP_JOB_WARMUP_MS, 30000, 600000),
  };
}
const memAvailableMb = () => memAvailableBytes() / 1048576;
interface AgySlot { release: () => void; providerUrl?: string }
interface AgyWaiter { kind: AgyJobKind; wake: () => void }
const agySlots = {
  active: 0,
  byKind: new Map<AgyJobKind, number>(),
  byProvider: new Map<string, number>(),
  cooldown: new Map<string, number>(),
  waiting: [] as AgyWaiter[],
  // Granted slots whose CLI may not have allocated yet: slot token -> reservation expiry.
  reservations: new Map<object, number>(),
  hedges: 0,
  // Grant sequence per provider: ties on in-flight count go to the least recently used account.
  grants: 0,
  lastGrant: new Map<string, number>(),
  timer: undefined as ReturnType<typeof setTimeout> | undefined,
  // Last cooldown reason / task error per provider, for the operator snapshot only.
  info: new Map<string, { reason?: string; lastError?: string; lastErrorAt?: number }>(),
};
export function agyMarkProviderLimited(url: string | undefined, ms = 300000, reason = 'quota-or-rate-limit') {
  if (!url) return;
  agySlots.cooldown.set(url, Math.max(agySlots.cooldown.get(url) || 0, Date.now() + ms));
  agySlots.info.set(url, { ...agySlots.info.get(url), reason });
  agyWritePoolState();
}
/** Operator view of the provider pool (no credentials): see scripts/nan-video-smoke.sh. */
export function agyPoolSnapshot(now = Date.now()) {
  return {
    updatedAt: new Date(now).toISOString(), pid: process.pid, app: /apps\/([a-z0-9-]+)\//.exec(process.argv[1] || '')?.[1] || null, activeJobs: agySlots.active, waiting: agySlots.waiting.length,
    providers: agyProviderUrls().map((url) => {
      let safe = url;
      try { const parsed = new URL(url); parsed.username = ''; parsed.password = ''; parsed.search = ''; safe = parsed.toString(); } catch { safe = 'invalid-url'; }
      const until = agySlots.cooldown.get(url) || 0, info = agySlots.info.get(url) || {};
      return { url: safe, active: until <= now, cooldownUntil: until > now ? new Date(until).toISOString() : null,
        reason: until > now ? info.reason || null : null, lastError: info.lastError || null,
        lastErrorAt: info.lastErrorAt ? new Date(info.lastErrorAt).toISOString() : null, inFlight: agySlots.byProvider.get(url) || 0 };
    }),
  };
}
const poolState = { lastWrite: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined };
/** One file per app (backend, orchestrator): each process owns its own in-memory pool state. */
export function agyPoolStateFile(env: NodeJS.ProcessEnv = process.env, script = process.argv[1] || '') {
  const app = /apps\/([a-z0-9-]+)\//.exec(script)?.[1];
  // Outside an app process (tests, scripts) nothing is written unless a file is configured.
  if (env.AGY_POOL_STATE_FILE) return env.AGY_POOL_STATE_FILE;
  return app ? join(env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'nan-team', `agy-pool-state-${app}.json`) : undefined;
}
/** Throttled (<=1 per 5 s) atomic snapshot write; a pending timer flushes the latest state. */
export function agyWritePoolState(minIntervalMs = 5000) {
  if (poolState.timer) return;
  const wait = Math.max(0, poolState.lastWrite + minIntervalMs - Date.now());
  poolState.timer = setTimeout(() => {
    poolState.timer = undefined; poolState.lastWrite = Date.now();
    const file = agyPoolStateFile();
    if (!file) return;
    const temporary = `${file}.${process.pid}.tmp`;
    void mkdir(dirname(file), { recursive: true, mode: 0o700 })
      .then(() => writeFile(temporary, JSON.stringify(agyPoolSnapshot(), null, 1) + '\n', { mode: 0o600 }))
      .then(() => rename(temporary, file))
      .catch(() => { /* Operator snapshot only: never affects jobs. */ });
  }, wait);
  poolState.timer.unref?.();
}
/** Cooldown for a quota-exhausted account: the provider's reset hint ("reset after 39m47s"), clamped to 1 min-6 h; 5 min when absent. */
export function agyQuotaCooldownMs(text: unknown): number {
  const match = /reset(?:s)? after\s+((?:[\d.]+[hms])+)|quotaResetDelay\\?"?\s*:\s*\\?"((?:[\d.]+[hms])+)/i.exec(String(text ?? '')) ||
    /^([\d.]+[hms][\d.hms]*)$/i.exec(String(text ?? '').trim());
  const spec = match ? (match[1] || match[2]) : '';
  let ms = 0;
  for (const [, value, unit] of spec.matchAll(/([\d.]+)([hms])/gi)) ms += Number(value) * ({ h: 3600000, m: 60000, s: 1000 } as Record<string, number>)[unit.toLowerCase()];
  return Number.isFinite(ms) && ms > 0 ? Math.min(6 * 3600000, Math.max(60000, Math.round(ms))) : 300000;
}
/** Providers not cooling down after a quota/rate-limit failure. */
export function agyReadyProviders(now = Date.now()): string[] {
  return agyProviderUrls().filter((url) => (agySlots.cooldown.get(url) || 0) <= now);
}
function agyQuotaFailure(error: unknown, receipt?: Record<string, unknown>): boolean {
  if ((error as { category?: unknown })?.category === 'provider-quota' || receipt?.failureCategory === 'provider-quota') return true;
  const native = Array.isArray(receipt?.nativeToolErrors) ? (receipt?.nativeToolErrors as { category?: string }[]) : [];
  return native.some((item) => item?.category === 'quota-or-rate-limit');
}
function admissible(kind: AgyJobKind): boolean {
  const limits = agyLimits();
  if (agySlots.active >= limits.global) return false;
  if ((agySlots.byKind.get(kind) || 0) >= limits.kinds[kind]) return false;
  // The first job always runs; extra parallel jobs need headroom above the floor for
  // themselves plus every granted job that has not yet allocated its working memory.
  if (agySlots.active === 0) return true;
  return memoryAdmissible();
}
function memoryAdmissible(): boolean {
  const limits = agyLimits();
  const now = Date.now();
  let reserved = 0;
  for (const [token, until] of agySlots.reservations) {
    if (until > now) reserved++;
    else agySlots.reservations.delete(token);
  }
  return memAvailableMb() - (reserved + 1) * limits.jobRssMb >= limits.minFreeMb;
}
function pickProvider(exclude?: Set<string>): string | undefined {
  const urls = agyProviderUrls();
  if (urls.length <= 1) return urls[0];
  const now = Date.now();
  const ready = urls.filter((url) => (agySlots.cooldown.get(url) || 0) <= now);
  // A reroute/hedge avoids the account that just failed or stalled, when another one is usable.
  const fresh = (ready.length ? ready : urls).filter((url) => !exclude?.has(url));
  const pool = fresh.length ? fresh : ready.length ? ready : urls;
  // Least busy first; among equally busy accounts the least recently used one, so serialized jobs
  // (RAM-gated to one at a time) spread over the pool instead of draining the first account's quota.
  const busy = (url: string) => agySlots.byProvider.get(url) || 0, used = (url: string) => agySlots.lastGrant.get(url) ?? -1;
  return pool.reduce((best, url) => (busy(url) < busy(best) || (busy(url) === busy(best) && used(url) < used(best)) ? url : best));
}
function grantAgySlot(kind: AgyJobKind, exclude?: Set<string>): AgySlot {
  agySlots.active++;
  agySlots.byKind.set(kind, (agySlots.byKind.get(kind) || 0) + 1);
  const providerUrl = pickProvider(exclude);
  if (providerUrl) {
    agySlots.byProvider.set(providerUrl, (agySlots.byProvider.get(providerUrl) || 0) + 1);
    agySlots.lastGrant.set(providerUrl, ++agySlots.grants);
  }
  agyWritePoolState();
  const token = {};
  agySlots.reservations.set(token, Date.now() + agyLimits().warmupMs);
  let released = false;
  return {
    providerUrl,
    release: () => {
      if (released) return;
      released = true;
      agySlots.reservations.delete(token);
      agySlots.active--;
      agySlots.byKind.set(kind, (agySlots.byKind.get(kind) || 1) - 1);
      if (providerUrl) agySlots.byProvider.set(providerUrl, (agySlots.byProvider.get(providerUrl) || 1) - 1);
      agyWritePoolState();
      pumpAgySlots();
    },
  };
}
function pumpAgySlots() {
  for (let index = 0; index < agySlots.waiting.length;) {
    const waiter = agySlots.waiting[index];
    if (admissible(waiter.kind)) { agySlots.waiting.splice(index, 1); waiter.wake(); }
    else index++;
  }
  // Memory-blocked waiters are re-checked even when no job finishes in this process.
  if (agySlots.waiting.length && !agySlots.timer) {
    agySlots.timer = setTimeout(() => { agySlots.timer = undefined; pumpAgySlots(); }, 2000);
    agySlots.timer.unref?.();
  }
}
// Synchronous when a slot is free, so an idle service starts the job in the same tick.
// `hedge` slots (capped by AGY_MCP_MAX_IMAGE_HEDGES and checked against RAM by the caller) may
// exceed the global/kind caps so a stalled image can be hedged even when all image slots are busy.
function acquireAgySlot(kind: AgyJobKind, signal: AbortSignal, exclude?: Set<string>, hedge = false): AgySlot | Promise<AgySlot> {
  signal.throwIfAborted();
  if (hedge || (!agySlots.waiting.some((waiter) => waiter.kind === kind) && admissible(kind))) return grantAgySlot(kind, exclude);
  return new Promise((resolve, reject) => {
    const waiter: AgyWaiter = { kind, wake: () => { signal.removeEventListener('abort', cancel); resolve(grantAgySlot(kind, exclude)); } };
    const cancel = () => {
      const index = agySlots.waiting.indexOf(waiter);
      if (index >= 0) agySlots.waiting.splice(index, 1);
      reject(signal.reason);
    };
    agySlots.waiting.push(waiter);
    signal.addEventListener('abort', cancel, { once: true });
    pumpAgySlots();
  });
}

// Transient failures only: quota/rate limit, unreachable provider, upstream 5xx or
// timeouts inside native tools, and the job deadline. Auth, permission, invalid
// input, schema/content failures and cancellations are final.
const TRANSIENT_NATIVE = /\b5\d\d\b|timed? ?out|timeout|deadline|unavailable|overloaded|internal error|connection reset|econnreset|socket hang up/i;
// Image fail-fast/stall aborts (runner) are rerouted to another account without backoff.
const IMAGE_REROUTE = ['image-upstream-transient', 'image-stalled'];
export function agyRetryable(error: unknown, receipt?: Record<string, unknown>): boolean {
  const category = (error as { category?: unknown })?.category;
  if (category === 'provider-unreachable' || category === 'provider-quota' || IMAGE_REROUTE.includes(String(category))) return true;
  if (typeof category === 'string' && category !== 'process-failed') return false;
  const native = Array.isArray(receipt?.nativeToolErrors) ? (receipt?.nativeToolErrors as { category?: string; message?: string }[]) : [];
  if (native.some((item) => ['authentication', 'permission', 'invalid-tool-input'].includes(String(item?.category)))) return false;
  if (native.some((item) => item?.category === 'quota-or-rate-limit' || (item?.category === 'native-tool-failed' && TRANSIENT_NATIVE.test(String(item?.message || ''))))) return true;
  const message = error instanceof Error ? error.message : '';
  return receipt?.failureCategory === 'cancelled-or-deadline' || /AGY job deadline exceeded/i.test(message);
}

/**
 * Image jobs one request (or one org, see MediaService) may run at the same time
 * (AGY_MCP_REQUEST_IMAGE_CONCURRENCY, default 3): the rest wait, so a 4-6 image batch plus hedges cannot
 * occupy every pool account and starve other users.
 */
export function agyRequestImageConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  return clampInt(env.AGY_MCP_REQUEST_IMAGE_CONCURRENCY, 3, 6);
}
/** Runs `tasks` with at most `limit` in flight; results keep task order (allSettled semantics). */
export async function agySettledLimit<T>(limit: number, tasks: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      try { results[index] = { status: 'fulfilled', value: await tasks[index]() }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
  return results;
}
/** Max images one request may fan out to (AGY_MCP_MAX_IMAGES_PER_REQUEST, default 6, hard cap 12). */
export function agyMaxImagesPerRequest(env: NodeJS.ProcessEnv = process.env): number {
  return clampInt(env.AGY_MCP_MAX_IMAGES_PER_REQUEST, 6, 12);
}
// Per-image composition variants so a fan-out batch does not return near-identical pictures.
const IMAGE_VARIATIONS = [
  '',
  'Variation 2: a different camera angle and closer framing of the main subject.',
  'Variation 3: a wide establishing composition with more of the environment.',
  'Variation 4: an alternative lighting mood and color palette, same subject.',
  'Variation 5: a low-angle or overhead viewpoint with a distinct layout.',
  'Variation 6: a different background setting and props, same subject and style.',
];
/** Variant line for image `index` of a `count`-image batch ('' for a single image or the first one). */
export function agyImageVariation(index: number, count: number): string {
  if (count <= 1 || index <= 0) return '';
  return IMAGE_VARIATIONS[index % IMAGE_VARIATIONS.length] || `Variation ${index + 1}: a distinct composition from the other images.`;
}
export interface AgyImageBatchResult { urls: (string | undefined)[]; errors: { index: number; message: string }[] }

@Injectable()
export class AgyMcpService implements OnModuleDestroy {
  private readonly logger = new Logger(AgyMcpService.name);
  private closing = false;
  private readonly activeTasks = new Map<AbortController, Promise<unknown>>();
  // Storyboard repair attempts resend the same seed image; keep a few recent encodings so each attempt does not re-download it.
  private readonly seedImages = new Map<string, { at: number; image: { data: string; mimeType: string } }>();
  // Pool snapshot heartbeat: a file older than a few minutes means this process stopped writing.
  private readonly poolHeartbeat = setInterval(() => agyWritePoolState(), 60000);
  constructor() { this.poolHeartbeat.unref?.(); agyWritePoolState(); }

  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.poolHeartbeat);
    for (const controller of this.activeTasks.keys()) controller.abort(new Error('AGY service shutting down'));
    // runTask settles only after its owned CLI group, MCP server and temporary
    // auth profile have been closed. Nest must wait before exiting the process.
    await Promise.allSettled([...this.activeTasks.values()]);
  }

  private runner(): {
    readReceipt: (jobId: string) => Promise<Record<string, unknown>>;
    runTask: (
      request: Record<string, unknown>,
      options: Record<string, unknown>
    ) => Promise<{ result: Record<string, unknown> }>;
  } {
    // A deployment can explicitly point at its bundled runner; the default is the
    // repository package used by backend and orchestrator, with no HTTP gateway.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(resolveWorkspaceArtifact(
      'packages/agy-mcp-runner/index.cjs',
      process.env.AGY_MCP_RUNNER_PATH
    ));
  }

  private async run(
    request: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    // A whole-job retry replays the original conversation without earlier tool results, so
    // only pure analysis/content/image jobs are replay-safe. Chat and any request exposing
    // caller tools (which may mutate, e.g. schedule posts) never retry.
    const replaySafe = request.kind !== 'chat' && !(Array.isArray(request.tools) && request.tools.length);
    const retries = replaySafe ? Math.max(0, Math.min(2, Number(process.env.AGY_MCP_RETRIES ?? 2) || 0)) : 0;
    // Accounts that failed/stalled an image in this call; retries and hedges go elsewhere.
    const avoid = new Set<string>();
    // Accounts on which generate_image stalled for this prompt. Two different accounts stalling on the
    // same prompt means the content is being refused (copyright/sensitive), not an account problem.
    const stalls = new Set<string>();
    for (let attempt = 0; ; attempt++) {
      let failedReceipt: Record<string, unknown> | undefined;
      try {
        const onFailed = (receipt: Record<string, unknown>) => { failedReceipt = receipt; };
        return await ((request.kind === 'image' || request.kind === 'content') && replaySafe ? this.runHedged(request, signal, onFailed, avoid, stalls) : this.runOnce(request, signal, onFailed));
      } catch (error) {
        const cause = (error as { cause?: unknown })?.cause ?? error;
        if (this.closing || signal?.aborted) throw error;
        if (request.kind === 'image' && stalls.size >= 2) {
          this.logger.warn(JSON.stringify({ event: 'agy-image-refused', stalledAccounts: stalls.size }));
          throw Object.assign(new UnprocessableEntityException('AI không vẽ được nội dung này (có thể do bản quyền/nhạy cảm) — hãy mô tả khác'), { category: 'image-refused', cause: error });
        }
        const quota = agyQuotaFailure(cause, failedReceipt);
        // Quota/rate limit: reroute at once to an account that is not cooling down; when none is
        // left, fail now with a clear reason instead of burning retries/backoff on exhausted accounts.
        const urls = agyProviderUrls();
        if (quota && urls.length && !agyReadyProviders().length) {
          const now = Date.now();
          const resetMs = Math.min(...urls.map((url) => (agySlots.cooldown.get(url) || now) - now));
          throw new BadGatewayException(`AGY quota exhausted: all ${urls.length} configured AGY account${urls.length > 1 ? 's are' : ' is'} rate-limited or out of quota` +
            (resetMs > 0 ? ` (earliest reset in ~${Math.ceil(resetMs / 60000)} min)` : '') +
            '. Retry later or add another account to AGY_MCP_PROVIDER_URLS.', { cause: error });
        }
        if (attempt >= retries || !agyRetryable(cause, failedReceipt)) throw error;
        const reroute = (quota && urls.length > 1) || IMAGE_REROUTE.includes(String((cause as { category?: unknown })?.category));
        this.logger.warn(JSON.stringify({event: 'agy-task-retry', attempt: attempt + 1, failureCategory: failedReceipt?.failureCategory,
          message: cause instanceof Error ? cause.message : undefined, reroute}));
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, reroute ? 250 : 5000 * (attempt + 1));
          const cancel = () => { clearTimeout(timer); reject(signal?.reason); };
          signal?.addEventListener('abort', cancel, { once: true });
        });
      }
    }
  }

  // One image/content attempt with at most one hedge on another account; the first result wins
  // and the other attempt is aborted. Hedges may exceed the slot caps (at most
  // AGY_MCP_MAX_IMAGE_HEDGES at once, RAM permitting).
  // - image: fail-fast/stall reroute; the hedge starts when native generate_image runs past
  //   AGY_MCP_IMAGE_HEDGE_MS (default 24s; native generate_image successes take 10-22.5s, upstream failures ~60s;
  //   the stall abort, AGY_MCP_IMAGE_STALL_ABORT_MS, defaults to 35s).
  // - content: the hedge starts when the agent has made no job MCP call AGY_MCP_CONTENT_HEDGE_MS
  //   (default 30s) after its slot was granted. A healthy storyboard session calls
  //   get_job_evidence 8-10s in; a stalled provider took 64s, which delayed the whole storyboard.
  private runHedged(
    request: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onFailedReceipt: (receipt: Record<string, unknown>) => void,
    avoid: Set<string>,
    stalls: Set<string> = new Set()
  ): Promise<Record<string, unknown>> {
    const isImage = request.kind === 'image';
    // A rerouted attempt (some account already failed/stalled this job) never hedges: hedging a prompt
    // that keeps stalling only occupies more accounts.
    const rerouted = avoid.size > 0 || stalls.size > 0;
    const hedgeMs = Number(isImage ? process.env.AGY_MCP_IMAGE_HEDGE_MS ?? 24000 : process.env.AGY_MCP_CONTENT_HEDGE_MS ?? 30000);
    const maxHedges = Math.max(0, Number(process.env.AGY_MCP_MAX_IMAGE_HEDGES ?? 2) || 0);
    return new Promise((resolve, reject) => {
      const branches: { abort: AbortController; provider?: string }[] = [];
      let settled = false, running = 0, textOwner: object | undefined;
      const start = (hedge: boolean) => {
        const branch: { abort: AbortController; provider?: string } = { abort: new AbortController() };
        branches.push(branch); running++;
        if (hedge) agySlots.hedges++;
        const branchSignal = signal ? AbortSignal.any([signal, branch.abort.signal]) : branch.abort.signal;
        const canHedge = !hedge && !rerouted && hedgeMs > 0 && agyProviderUrls().length > 1;
        const hedgeNow = () => {
          if (settled || branches.length > 1 || agySlots.hedges >= maxHedges || signal?.aborted || this.closing) return;
          if (!memoryAdmissible()) return;
          this.logger.warn(JSON.stringify({ event: isImage ? 'agy-image-hedge' : 'agy-content-hedge', afterMs: hedgeMs }));
          start(true);
        };
        // Content: any job MCP call (or MCP error) proves the session is alive and cancels the hedge timer.
        let startupTimer: ReturnType<typeof setTimeout> | undefined;
        const alive = () => { if (startupTimer) { clearTimeout(startupTimer); startupTimer = undefined; } };
        const requestOnEvent = request.onEvent as ((event: AgyMcpEvent) => void | Promise<void>) | undefined;
        const requestOnText = request.onText as ((delta: string, block: string) => void) | undefined;
        const branchRequest = isImage || !canHedge ? request : {
          ...request,
          onEvent: (event: AgyMcpEvent) => {
            if (event.type === 'mcp-call' || event.type === 'mcp-error') alive();
            return requestOnEvent?.(event);
          },
          // Live text comes from one branch only: the first that writes owns it until it fails.
          ...(requestOnText ? { onText: (delta: string, block: string) => {
            textOwner ??= branch;
            if (textOwner === branch && !settled) requestOnText(delta, block);
          } } : {}),
        };
        this.runOnce(branchRequest, branchSignal, onFailedReceipt, {
          hedge,
          avoid: new Set([...avoid, ...branches.map((item) => item.provider).filter((url): url is string => !!url)]),
          onProvider: (url) => {
            branch.provider = url;
            if (!isImage && canHedge) { startupTimer = setTimeout(() => { startupTimer = undefined; hedgeNow(); }, hedgeMs); startupTimer.unref?.(); }
          },
          ...(isImage ? { imageStallMs: canHedge ? hedgeMs : undefined, onImageStall: canHedge ? hedgeNow : undefined } : {}),
        }).then((result) => {
          // A losing branch that still published during the winner's settle window: drop its upload.
          if (settled) { if (isImage && typeof result?.url === 'string') void this.removeImage(result.url); return; }
          settled = true;
          for (const other of branches) if (other !== branch) other.abort.abort(new Error(`AGY ${isImage ? 'image' : 'content'} hedge lost`));
          resolve(result);
        }, (error) => {
          const category = String(((error as { cause?: { category?: unknown } })?.cause ?? error as { category?: unknown })?.category);
          if (branch.provider && IMAGE_REROUTE.includes(category)) avoid.add(branch.provider);
          if (branch.provider && category === 'image-stalled') stalls.add(branch.provider);
          if (textOwner === branch) textOwner = undefined;
          if (!settled && --running === 0) { settled = true; reject(error); }
        }).finally(() => { alive(); if (hedge) agySlots.hedges--; });
      };
      start(false);
    });
  }

  private async removeImage(url: string): Promise<void> {
    try { await UploadFactory.createStorage().removeFile(url); }
    catch (error) { this.logger.warn(JSON.stringify({ event: 'agy-image-orphan-remove-failed', url, message: error instanceof Error ? error.message : String(error) })); }
  }

  private async runOnce(
    request: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onFailedReceipt: (receipt: Record<string, unknown>) => void,
    image: { hedge?: boolean; avoid?: Set<string>; onProvider?: (url: string) => void; imageStallMs?: number; onImageStall?: () => void } = {}
  ): Promise<Record<string, unknown>> {
    if (this.closing) throw new Error('AGY service shutting down');
    const shutdown = new AbortController();
    const taskSignal = signal ? AbortSignal.any([signal, shutdown.signal]) : shutdown.signal;
    let release: (() => void) | undefined;
    let providerUrl: string | undefined;
    try {
      const { onAttempt, onEvent: requestOnEvent, ...rest } = request;
      const onEvent = requestOnEvent as
        | ((event: AgyMcpEvent) => void | Promise<void>)
        | undefined;
      // Registered before waiting so shutdown also cancels queued tasks.
      const kind = (['image', 'content', 'analysis', 'chat'].includes(String(rest.kind)) ? rest.kind : 'analysis') as AgyJobKind;
      const pendingSlot = acquireAgySlot(kind, taskSignal, image.avoid, image.hedge);
      let slot: AgySlot;
      if (pendingSlot instanceof Promise) {
        this.activeTasks.set(shutdown, pendingSlot.catch(() => undefined));
        slot = await pendingSlot;
      } else slot = pendingSlot;
      release = slot.release;
      providerUrl = slot.providerUrl;
      if (providerUrl) image.onProvider?.(providerUrl);
      (onAttempt as (() => void) | undefined)?.();
      const task = {
        ...rest,
        onEvent: (event: AgyMcpEvent) => {
          if (event.type === 'receipt')
            this.logger.log(JSON.stringify(event.receipt));
          if (event.type === 'receipt' && event.receipt?.status === 'failed') {
            onFailedReceipt(event.receipt);
            const native = Array.isArray(event.receipt.nativeToolErrors) ? (event.receipt.nativeToolErrors as { category?: string }[]) : [];
            const quota = native.filter((item) => item?.category === 'quota-or-rate-limit') as { message?: string }[];
            if (quota.length) agyMarkProviderLimited(providerUrl, agyQuotaCooldownMs(quota.map((item) => item.message).join('\n')));
          }
          if (event.type === 'mcp-error')
            this.logger.warn(JSON.stringify({event:'agy-mcp-error',name:event.name,message:event.message}));
          if (event.type === 'failure')
            this.logger.warn(JSON.stringify({event:'agy-task-failure',errors:event.errors}));
          return onEvent?.(event);
        },
      };
      const modelRole = kind === 'image' || kind === 'chat' ? kind : rest.role || '';
      const modelKey = `AGY_MCP_MODEL_${String(modelRole).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
      const pending = this.runner().runTask(task, {
        signal: taskSignal,
        providerUrl,
        // Role overrides take precedence over the global model; an unset model
        // leaves the runner's account preference intact. Never mutate process.env.
        model: process.env[modelKey]?.trim() || process.env.AGY_MCP_MODEL?.trim() || undefined,
        // Image reliability: abort on a transient generate_image failure or a stall so run()
        // reroutes to another account (AGY_MCP_IMAGE_FAILFAST=0 restores in-session retry).
        ...(kind === 'image' && process.env.AGY_MCP_IMAGE_FAILFAST !== '0' ? {
          imageFailFast: true,
          imageStallAbortMs: Number(process.env.AGY_MCP_IMAGE_STALL_ABORT_MS ?? 35000) || 0,
          imageStallMs: image.imageStallMs,
          onImageStall: image.onImageStall,
        } : {}),
        publishImage: async (
          filename: string,
          mimeType: string,
          jobSignal?: AbortSignal
        ) => {
          const bytes = await readFile(filename);
          jobSignal?.throwIfAborted();
          const storage = UploadFactory.createStorage();
          const url = await storage.uploadSimple(
            `data:${mimeType};base64,${bytes.toString('base64')}`
          );
          if (jobSignal?.aborted) {
            await storage.removeFile(url);
            jobSignal.throwIfAborted();
          }
          return url;
        },
        removeImage: (url: string) => this.removeImage(url),
      });
      this.activeTasks.set(shutdown, pending);
      const { result } = await pending;
      return result;
    } catch (error) {
      const quotaReset = (error as { category?: unknown; quotaResetAfter?: unknown })?.category === 'provider-quota'
        ? agyQuotaCooldownMs((error as { quotaResetAfter?: unknown }).quotaResetAfter) : 0;
      if (quotaReset) agyMarkProviderLimited(providerUrl, quotaReset);
      if (providerUrl && !taskSignal.aborted) {
        // Truncated, token-like runs redacted: the snapshot is readable by operators.
        const message = (error instanceof Error ? error.message : String(error)).replace(/[A-Za-z0-9_\-.]{32,}/g, '…').slice(0, 200);
        agySlots.info.set(providerUrl, { ...agySlots.info.get(providerUrl), lastError: message, lastErrorAt: Date.now() });
        agyWritePoolState();
      }
      if (taskSignal.aborted) throw error;
      throw new BadGatewayException(
        `Native AGY MCP job failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        { cause: error }
      );
    } finally { release?.(); this.activeTasks.delete(shutdown); }
  }

  async receipt(jobId: string): Promise<Record<string, unknown>> {
    return this.runner().readReceipt(jobId);
  }

  private async loadImage(
    url: string,
    signal?: AbortSignal,
    maxBytes = 30_000_000
  ): Promise<{ data: Buffer; mimeType: string }> {
    signal?.throwIfAborted();
    const safeUrl = assertAiVideoAssetUrl(url);
    const abort = new AbortController();
    const cancel = () => abort.abort(signal?.reason);
    const timer = setTimeout(() => abort.abort(), 30000);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      let data=await readLocalVideoAsset(safeUrl,maxBytes,abort.signal);
      if(data===undefined){
        const response = await fetch(safeUrl, {
          signal: abort.signal,
          redirect: 'error',
        });
        if (!response.ok || !response.body)
          throw new BadGatewayException('Could not load the image');
        const length = Number(response.headers.get('content-length'));
        if (Number.isFinite(length) && length > maxBytes) {
          await response.body.cancel();
          throw new BadGatewayException('Image exceeds size limit');
        }
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > maxBytes)
              throw new BadGatewayException('Image exceeds size limit');
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        data = Buffer.concat(chunks);
      }
      const mimeType = data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'image/png'
        : data[0] === 255 && data[1] === 216 && data[2] === 255
        ? 'image/jpeg'
        : data.toString('ascii', 0, 4) === 'RIFF' &&
          data.toString('ascii', 8, 12) === 'WEBP'
        ? 'image/webp'
        : undefined;
      if (!mimeType) throw new BadGatewayException('Unsupported image format');
      return { data, mimeType };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  private async seedImage(url: string, signal?: AbortSignal) {
    const cached = this.seedImages.get(url);
    if (cached && Date.now() - cached.at < 10 * 60_000) return cached.image;
    const bytes = await this.loadImage(url, signal);
    const image = { data: bytes.data.toString('base64'), mimeType: bytes.mimeType };
    this.seedImages.delete(url);
    this.seedImages.set(url, { at: Date.now(), image });
    // Bounded: seed images can be up to 30 MB each.
    for (const key of this.seedImages.keys()) { if (this.seedImages.size <= 4) break; this.seedImages.delete(key); }
    return image;
  }

  async content(
    prompt: string,
    seedImageUrl?: string,
    signal?: AbortSignal
  ): Promise<string> {
    const seedImage = seedImageUrl ? await this.seedImage(seedImageUrl, signal) : undefined;
    const result = await this.run(
      {
        kind: 'content',
        role: 'content-writer',
        prompt,
        seedImageUrl,
        seedImage,
        schema: contentSchema,
      },
      signal
    );
    return result.content as string;
  }

  /** Social post/caption from a request (optionally grounded in up to 12 stored images). `onText` receives the
   * post as AGY streams it (title already bolded); `block` changes per model response step or attempt. The
   * returned string stays the submitted final post. */
  async caption(prompt:string,imageUrls:string[]=[],signal?:AbortSignal,onText?:(delta:string,block:string)=>void):Promise<string> {
    if(!Array.isArray(imageUrls)||imageUrls.some(url=>typeof url!=='string'))throw new BadGatewayException('Expected configured storage image URLs');
    const bolder=onText?titleBolder(onText):undefined;
    const write=async(frames:{path:string;timestampSeconds:number}[])=>(await this.run({kind:'content',role:CAPTION_ROLE,skills:CAPTION_SKILLS,
      prompt:prompt+'\n'+CAPTION_FORMAT+(frames.length?'\nThese evidence frames are separate attached images ordered by index. Inspect every image using read_frame and native view_file before drafting.':''),
      frames,schema:captionSchema,...(bolder?{onText:bolder.write}:{})},signal)).content as string;
    try { return boldTitle(imageUrls.length?await this.withImageFrames(imageUrls,signal,write):await write([])); }
    finally { bolder?.flush(); }
  }

  /**
   * N images for one request as N independent AGY image jobs started together: the pool scheduler
   * spreads them over accounts (least busy, then least recently used), applies the RAM gate and
   * hedges stalls per image. Each job gets a small composition variant and its own art direction.
   * One failed image never fails the batch; `onImage` reports each image as soon as it is ready.
   * Throws only when every image failed (with the first error) or the caller aborted.
   */
  async imageBatch(
    prompt: string,
    count: number,
    signal?: AbortSignal,
    aspectRatio: AgyAspectRatio = '9:16',
    onImage?: (index: number, url: string) => void | Promise<void>,
    referenceImageUrls: string[] = []
  ): Promise<AgyImageBatchResult> {
    const total = Math.max(1, Math.min(agyMaxImagesPerRequest(), Math.floor(Number(count)) || 1));
    const urls: (string | undefined)[] = new Array(total).fill(undefined);
    // A refused prompt (image-refused) is refused for every variant: stop starting new ones.
    let refused: unknown;
    const outcomes = await agySettledLimit(agyRequestImageConcurrency(), Array.from({ length: total }, (_, index) => async () => {
      signal?.throwIfAborted();
      if (refused) throw refused;
      const variation = agyImageVariation(index, total);
      const url = await this.image(variation ? `${prompt}\n${variation}` : prompt, signal, aspectRatio, referenceImageUrls)
        .catch((error) => { if ((error as { category?: unknown })?.category === 'image-refused') refused = error; throw error; });
      urls[index] = url;
      await onImage?.(index, url);
      return url;
    }));
    signal?.throwIfAborted();
    const errors = outcomes.flatMap((outcome, index) => outcome.status === 'rejected'
      ? [{ index, message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) }] : []);
    if (errors.length === total) throw (outcomes[0] as PromiseRejectedResult).reason;
    return { urls, errors };
  }

  async contentFromImages(prompt:string,imageUrls:string[],signal?:AbortSignal):Promise<string> {
    if(!Array.isArray(imageUrls)||imageUrls.some(url=>typeof url!=='string'))throw new BadGatewayException('Expected configured storage image URLs');
    if(imageUrls.length<=1)return this.content(prompt,imageUrls[0],signal);
    return this.withImageFrames(imageUrls,signal,async frames=>{
      const result=await this.run({kind:'content',role:'content-writer',
        prompt:prompt+'\nThese evidence frames are separate attached images ordered by index. Inspect every image using read_frame and native view_file before drafting.',
        frames,schema:contentSchema},signal);
      return result.content as string;
    });
  }

  /** Stage images as job frames (URLs from upload storage, then `inline` bytes), removed after `action`. */
  private async withImageFrames<T>(imageUrls:string[],signal:AbortSignal|undefined,
    action:(frames:{path:string;timestampSeconds:number}[])=>Promise<T>,
    inline:{data:Buffer;mimeType:string}[]=[]):Promise<T> {
    if(imageUrls.length+inline.length>12)throw new BadGatewayException('Expected at most 12 configured storage image URLs');
    for(const url of imageUrls)assertAiVideoAssetUrl(url);
    signal?.throwIfAborted();
    const root = await mkdtemp(join(tmpdir(), 'postiz-agy-content-images-'));
    await chmod(root, 0o700).catch(async (error) => { await rm(root, { recursive: true, force: true }); throw error; });
    const abort = new AbortController(),
      cancel = () => abort.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const timer = setTimeout(() => abort.abort(), 60000);
    try {
      const frames: { path: string; timestampSeconds: number }[] = [];
      let bytes = 0;
      for (const [index, url] of imageUrls.entries()) {
        const image = await this.loadImage(
          url,
          abort.signal,
          Math.min(30_000_000, 48_000_000 - bytes)
        );
        bytes += image.data.length;
        const filename = join(
          root,
          `image-${index}.${image.mimeType.split('/')[1]}`
        );
        await writeFile(filename, image.data, { mode: 0o600, flag: 'wx' });
        frames.push({ path: filename, timestampSeconds: index });
      }
      for (const image of inline) {
        const index = frames.length;
        const filename = join(root, `image-${index}.${image.mimeType.split('/')[1]}`);
        await writeFile(filename, image.data, { mode: 0o600, flag: 'wx' });
        frames.push({ path: filename, timestampSeconds: index });
      }
      clearTimeout(timer);
      signal?.throwIfAborted();
      return await action(frames);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      await rm(root, { recursive: true, force: true });
    }
  }

  async image(
    prompt: string,
    signal?: AbortSignal,
    aspectRatio: AgyAspectRatio = '9:16',
    referenceImageUrls: string[] = []
  ): Promise<string> {
    if (
      ![
        'auto',
        '9:16',
        '16:9',
        '1:1',
        '3:4',
        '4:3',
        '2:3',
        '3:2',
        '21:9',
      ].includes(aspectRatio)
    )
      throw new BadGatewayException('Unsupported image aspect ratio');
    const references = [...new Set(referenceImageUrls)].slice(0, MAX_REFERENCE_IMAGES);
    const generate = async (frames: { path: string; timestampSeconds: number }[] = []) => (await this.run(
      {
        kind: 'image',
        role: 'visual art director',
        prompt: `${prompt}\n${frames.length ? `${referenceImageRules(frames.length)}\n` : ''}${
          aspectRatio === 'auto'
            ? frames.length ? 'Use the aspect ratio of reference image 0 unless the request names another.' : 'Choose the aspect ratio appropriate for the requested composition.'
            : `Required aspect ratio: ${aspectRatio}.`
        }`,
        frames,
        schema: {
          type: 'object',
          properties: { url: { type: 'string', minLength: 1 } },
          required: ['url'],
          additionalProperties: false,
        },
      },
      signal
    )).url as string;
    // The user's sample images become job frames the image model actually views (read_frame + view_file).
    return references.length ? this.withImageFrames(references, signal, generate) : generate();
  }

  async analyzeJson(
    request: AgyAnalysisRequest,
    signal?: AbortSignal,
    onEvent?: (event: AgyMcpEvent) => void | Promise<void>
  ): Promise<Record<string, unknown>> {
    return this.run(
      {
        ...request,
        onEvent: onEvent || request.onEvent,
        kind: 'analysis',
        // Explicit per request: effect/motion planning never pays for three native specialists.
        nativeReview: request.nativeReview === true,
        // Transcript repair is a constrained token-fix task: copywriting skills only add prompt weight.
        skills: request.skills ?? (request.role === 'asr-repair' ? [] : request.role === 'visual-editor' ? ['ai-product-photography'] : request.role === 'render-reviewer' ? ['ai-social-media-content'] : ['copywriting', 'viral-copywriting-master', 'video-retention-scriptwriting']),
      },
      signal
    );
  }

  /**
   * "AI thiết kế": the model views the page screenshot (frame 0) with the element list and returns
   * sanitized Polotno operations. `screenshot` is an upload-storage URL or decoded PNG/JPEG bytes.
   */
  async designEdit(orgId: string, input: DesignEditInput, screenshot: string | { data: Buffer; mimeType: string }, signal?: AbortSignal) {
    // The same canvas state + instruction sent again within 60 s (double click, retry after a slow
    // network) reuses the result or the job still running. The uploaded screenshot URL changes on every
    // send, so the key is the canvas state the screenshot was rendered from.
    // Scoped by organization: a result is never served to another org with an identical canvas.
    const key = designEditCacheKey(orgId, '', input.instruction, JSON.stringify([input.page, input.elements, input.variants ?? 1, input.history ?? [], input.referenceImages ?? [], input.selectedIds ?? [], input.phase ?? '', input.zones ?? [], input.palette ?? null]));
    return this.designEdits.get(key, () => this.designEditOnce(input, screenshot, signal));
  }
  private readonly designEdits = new DesignEditCache<ReturnType<typeof sanitizeDesignEdit>>();

  private async designEditOnce(input: DesignEditInput, screenshot: string | { data: Buffer; mimeType: string }, signal?: AbortSignal) {
    const ask = async (frames: { path: string; timestampSeconds: number }[]) => this.run({
      kind: 'content', role: DESIGN_EDIT_ROLE, skills: DESIGN_EDIT_SKILLS, effort: designEditEffort(input),
      prompt: designEditPrompt(input), frames, schema: designEditSchema,
    }, signal);
    // Empty page: nothing to look at, so no screenshot download/frame turn; the job is text-only and the
    // runner lets it submit in turn 1 (evidence in the prompt).
    // Frame order the prompt describes: screenshot (when needed) first, then the user's pasted images.
    const references = (input.referenceImages || []).slice(0, DESIGN_MAX_REFERENCE_IMAGES);
    const screenshotFirst = (frames: { path: string; timestampSeconds: number }[]) =>
      ask([frames[frames.length - 1], ...frames.slice(0, -1)].map((frame, index) => ({ ...frame, timestampSeconds: index })));
    const raw = !designEditNeedsScreenshot(input)
      ? references.length ? await this.withImageFrames(references, signal, ask) : await ask([])
      : typeof screenshot === 'string'
      ? await this.withImageFrames([screenshot, ...references], signal, ask)
      : await this.withImageFrames(references, signal, screenshotFirst, [screenshot]);
    return sanitizeDesignEdit(raw, input);
  }

  /** Images attached to the latest user message (AI SDK image parts and [--Media--] Image: lines). */
  static latestUserImages(messages: { role: string; content: unknown }[]): string[] {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    const parts: any[] = Array.isArray(lastUser?.content) ? lastUser!.content as any[] : [{ type: 'text', text: lastUser?.content }];
    const images: string[] = [];
    for (const part of parts) {
      if (part?.type === 'image' && typeof part.image === 'string') images.push(part.image);
      // AI SDK v2 prompt: images arrive as file parts carrying a URL.
      if (part?.type === 'file' && String(part.mediaType || '').startsWith('image/')
        && (part.data instanceof URL || (typeof part.data === 'string' && /^https?:\/\//.test(part.data)))) images.push(String(part.data));
      if (part?.type === 'text' && typeof part.text === 'string') {
        for (const match of part.text.matchAll(/\[--Media--\]([\s\S]*?)\[--Media--\]/g))
          for (const line of match[1].split('\n')) if (line.trim().startsWith('Image: ')) images.push(line.trim().slice(7));
      }
    }
    return [...new Set(images)];
  }

  async chat(request: {
    messages: { role: string; content: unknown }[];
    tools: AgyMcpTool[];
    signal?: AbortSignal;
    onEvent?: (event: AgyMcpEvent) => void | Promise<void>;
    /** Live assistant text as AGY streams it; `block` changes per model response step. The returned
     * string stays the submitted final answer. */
    onText?: (delta: string, block: string) => void;
  }): Promise<string> {
    const lastUser=[...request.messages].reverse().find(message=>message.role==='user');
    const parts=Array.isArray(lastUser?.content)?lastUser.content:[{type:'text',text:lastUser?.content}];
    const images=AgyMcpService.latestUserImages(request.messages);
    const writing=parts.some(part=>part?.type==='text'&&typeof part.text==='string'&&CAPTION_REQUEST.test(part.text));
    // Held title text is released before any tool runs, so streamed text keeps its order around tool calls.
    const bolder=request.onText&&writing?titleBolder(request.onText):undefined;
    const tools=bolder?request.tools.map(tool=>({...tool,execute:(args:Record<string,unknown>,signal?:AbortSignal)=>{bolder.flush();return tool.execute(args,signal);}})):request.tools;
    const onText=bolder?bolder.write:request.onText;
    const invoke=(frames:{path:string;timestampSeconds:number}[]=[])=>this.run({
      kind:'chat',role:'authenticated organization assistant',
      prompt:JSON.stringify(request.messages)+(writing?'\nWhen your answer contains the requested social post, write that post in this layout. '+CAPTION_FORMAT:'')+(frames.length?'\nAttached images are supplied as evidence frames. Inspect every image with read_frame and native view_file before making visual claims.':''),
      // A post/caption request in chat gets the caption copywriting skills; other turns stay lean.
      frames,tools,onEvent:request.onEvent,schema:contentSchema,
      skills:writing?CAPTION_SKILLS:[],
      ...(onText?{onText}:{}),
    },request.signal);
    let result:Record<string,unknown>;
    try { result=images.length?await this.withImageFrames([...new Set(images)],request.signal,invoke):await invoke(); }
    finally { bolder?.flush(); }
    return writing?boldTitle(result.content as string):result.content as string;
  }
}
