'use client';

import { useEffect, useRef, useState } from 'react';

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['completed', 'failed', 'cancelled']);

/** idea = one-shot idea→video job, render = render of a reviewed storyboard, storyboard = storyboard-only job (script + scene images, no render). */
export type StudioJobKind = 'idea' | 'render' | 'storyboard';

export interface StudioProgressInput {
  status: string;
  stage?: string;
  progress: number;
}

export const SCENES_BY_DURATION: Record<number, number> = { 15: 4, 30: 6, 60: 11 };

// Stage order with its share of a typical idea job (live 15s run ≈ 9.5 min).
const PIPELINE: Array<[string, number]> = [
  ['queued', 0.02], ['generating-storyboard', 0.28], ['generating-images', 0.25],
  ['downloading-images', 0.02], ['synthesizing-voice', 0.08], ['bundling', 0.07],
  ['rendering', 0.18], ['verifying-video', 0.05], ['saving-media', 0.05],
];
const IDEA_SECONDS_4_SCENES = 570;
const RENDER_FROM = 3;
const STORYBOARD_UNTIL = 3;

export const PIPELINE_STEPS: Array<{ key: string; label: string; kinds: StudioJobKind[] }> = [
  { key: 'generating-storyboard', label: 'Kịch bản', kinds: ['idea', 'storyboard'] },
  { key: 'generating-images', label: 'Ảnh cảnh', kinds: ['idea', 'storyboard'] },
  { key: 'synthesizing-voice', label: 'Giọng đọc', kinds: ['idea', 'render'] },
  { key: 'rendering', label: 'Dựng video', kinds: ['idea', 'render'] },
  { key: 'verifying-video', label: 'Kiểm tra & lưu', kinds: ['idea', 'render'] },
];

const LABELS: Record<string, string> = {
  queued: 'Đang chờ đến lượt xử lý',
  'generating-storyboard': 'AI đang viết kịch bản và kiểm chứng dữ kiện',
  'generating-images': 'Đang vẽ ảnh minh họa cho từng cảnh',
  'downloading-images': 'Đang chuẩn bị hình ảnh',
  'synthesizing-voice': 'Đang tạo giọng đọc tiếng Việt',
  bundling: 'Đang chuẩn bị bộ dựng video',
  rendering: 'Đang dựng video',
  'verifying-video': 'Đang kiểm tra chất lượng video',
  'saving-media': 'Đang lưu vào kho media',
  cancelling: 'Đang hủy tác vụ',
  interrupted: 'Tác vụ bị gián đoạn',
  completed: 'Video đã sẵn sàng',
  failed: 'Tạo video chưa thành công',
  cancelled: 'Đã hủy tác vụ',
};

/** "generating-images:2/6" → { key: 'generating-images', done: 2, total: 6 }. */
export const parseStage = (stage = '') => {
  const [key, count] = stage.split(':');
  const match = count?.match(/^(\d+)\/(\d+)$/);
  return { key, done: match ? Number(match[1]) : undefined, total: match ? Number(match[2]) : undefined };
};

export const stageIndex = (key: string) => {
  const index = PIPELINE.findIndex(([name]) => name === key);
  return index;
};

/** Step in PIPELINE_STEPS the stage belongs to (downloading/bundling/saving merge into neighbours). */
export const stepOfStage = (key: string) => {
  const map: Record<string, string> = {
    queued: 'generating-storyboard', 'downloading-images': 'synthesizing-voice', bundling: 'rendering', 'saving-media': 'verifying-video',
  };
  return PIPELINE_STEPS.findIndex((step) => step.key === (map[key] || key));
};

export const stageLabel = (job: StudioProgressInput) => {
  const { key, done, total } = parseStage(job.stage);
  if (job.status === 'cancelled') return LABELS.cancelled;
  if (job.status === 'failed') return key === 'interrupted' ? LABELS.interrupted : LABELS.failed;
  if (job.status === 'completed') return LABELS.completed;
  if (key === 'generating-images' && total) return `${LABELS[key]} · xong ${done}/${total}`;
  if (key === 'rendering') return `${LABELS.rendering} · ${Math.max(0, Math.min(100, Math.round((job.progress - 40) * 2)))}%`;
  return LABELS[key] || LABELS[job.status] || 'Đang xử lý video';
};

const expectedTotal = (kind: StudioJobKind, scenes: number) => {
  const idea = IDEA_SECONDS_4_SCENES * (0.5 + 0.5 * Math.max(1, scenes) / 4);
  const weights = kind === 'render' ? PIPELINE.slice(RENDER_FROM) : kind === 'storyboard' ? PIPELINE.slice(0, STORYBOARD_UNTIL) : PIPELINE;
  // A render without prefetched narration synthesizes the whole voice-over itself.
  return idea * weights.reduce((sum, [, weight]) => sum + weight, 0) * (kind === 'render' ? 1.25 : 1);
};

/** Fraction of the stage finished: exact counters where the backend reports them, otherwise a time-based ease-out. */
const withinStage = (key: string, job: StudioProgressInput, stageSeconds: number, expectedSeconds: number, done?: number, total?: number) => {
  const eased = Math.min(0.92, 1 - Math.exp(-1.6 * stageSeconds / Math.max(1, expectedSeconds)));
  if (key === 'generating-images' && total) return Math.max(Math.min(1, (done || 0) / total), Math.min(eased, ((done || 0) + 0.9) / total));
  if (key === 'rendering') return Math.max(0, Math.min(1, (job.progress - 40) / 50));
  if (key === 'bundling') return Math.max(eased, Math.max(0, Math.min(1, (job.progress - 30) / 10)));
  return eased;
};

export const formatEta = (seconds: number) => {
  if (seconds < 45) return 'Sắp xong';
  if (seconds < 90) return 'Còn khoảng 1 phút';
  return `Còn khoảng ${Math.round(seconds / 60)} phút`;
};

export const formatElapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * Smooth, never-decreasing progress and an ETA for the studio job. Re-renders once per second
 * while the job is active so the bar keeps moving between status polls.
 */
export const useStudioProgress = (job: StudioProgressInput | undefined, kind: StudioJobKind | undefined, scenes: number, jobKey?: string) => {
  const active = !!job && !!kind && !TERMINAL_STATUSES.has(job.status);
  const [now, setNow] = useState(() => Date.now());
  const memory = useRef({ key: '', startedAt: 0, stage: '', stageAt: 0, percent: 0, eta: 0, etaAt: 0 });

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  if (!job || !kind) { memory.current.key = ''; return undefined; }
  const state = memory.current;
  const current = Date.now();
  if (state.key !== jobKey) Object.assign(state, { key: jobKey, startedAt: current, stage: '', stageAt: current, percent: 0, eta: 0, etaAt: 0 });
  const { key, done, total } = parseStage(job.stage);
  if (key !== state.stage && stageIndex(key) >= 0) { state.stage = key; state.stageAt = current; }
  const elapsed = (current - state.startedAt) / 1000;
  const totalSeconds = expectedTotal(kind, scenes);

  if (job.status === 'completed') state.percent = 100;
  else if (active) {
    const pipeline = kind === 'render' ? PIPELINE.slice(RENDER_FROM) : kind === 'storyboard' ? PIPELINE.slice(0, STORYBOARD_UNTIL) : PIPELINE;
    const weightSum = pipeline.reduce((sum, [, weight]) => sum + weight, 0);
    const position = pipeline.findIndex(([name]) => name === state.stage);
    const stageSeconds = (current - state.stageAt) / 1000;
    if (position >= 0) {
      const before = pipeline.slice(0, position).reduce((sum, [, weight]) => sum + weight, 0);
      const [name, weight] = pipeline[position];
      const fraction = (before + weight * withinStage(name, job, stageSeconds, weight / weightSum * totalSeconds, done, total)) / weightSum;
      state.percent = Math.max(state.percent, Math.min(99, fraction * 100));
    }
  }

  let eta = '';
  if (active) {
    const fraction = state.percent / 100;
    const model = totalSeconds * (1 - fraction);
    // Blend the typical duration with the pace observed so far once enough of the job is done.
    const observed = fraction > 0.08 ? elapsed / fraction * (1 - fraction) : model;
    const weight = Math.min(0.7, fraction);
    const target = Math.max(15, (1 - weight) * model + weight * observed);
    const step = state.etaAt ? (current - state.etaAt) / 1000 : 0;
    state.eta = !state.eta ? target : Math.max(15, Math.min(state.eta - step + 0.25 * (target - state.eta + step), state.eta - step + 60));
    state.etaAt = current;
    eta = formatEta(state.eta);
  }
  void now;
  return { percent: Math.round(state.percent), label: stageLabel(job), eta, elapsed, step: stepOfStage(state.stage || key) };
};

/** Readable Vietnamese message for backend/transport errors; unknown messages keep the original as detail. */
export const describeStudioError = (message?: string): { text: string; detail?: string } => {
  const raw = (message || '').trim();
  const rules: Array<[RegExp, string]> = [
    [/cancell?ed/i, 'Tác vụ đã được hủy.'],
    [/exceeded 20 minute timeout/i, 'Tác vụ chạy quá 20 phút nên đã dừng. Bấm “Thử lại” để tiếp tục từ kịch bản và ảnh đã lưu.'],
    [/Backend restarted|Backend shutting down|shutting down/i, 'Máy chủ vừa khởi động lại trong lúc tạo video. Bấm “Thử lại” để tiếp tục từ phần đã lưu.'],
    [/queue is full/i, 'Hàng đợi video đang đầy (tối đa 2 video cùng lúc cho mỗi tổ chức). Hãy đợi video đang chạy hoàn tất rồi thử lại.'],
    [/storyboard failed validation|no validated storyboard/i, 'AI chưa viết được kịch bản đạt yêu cầu sau 3 lần thử. Hãy thử lại hoặc diễn đạt ý tưởng cụ thể hơn.'],
    [/TTS|voice|speech|Voice Clone/i, 'Không tạo được giọng đọc. Hãy thử lại hoặc chọn giọng Edge-TTS (Hoài My / Nam Minh).'],
    [/image/i, 'Chưa vẽ được đủ ảnh cho các cảnh. Bấm “Thử lại” để vẽ tiếp các ảnh còn thiếu.'],
    [/Only a failed/i, 'Chỉ có thể tiếp tục một tác vụ đã dừng hoặc thất bại.'],
    [/No saved storyboard/i, 'Tác vụ này chưa lưu kịch bản nên sẽ tạo lại từ đầu.'],
    [/Resume requires the original/i, 'Cấu hình đã thay đổi so với lần tạo trước nên không thể tiếp tục; hãy tạo mới.'],
    [/verify|duration|resolution|ffprobe/i, 'Video dựng xong nhưng chưa qua bước kiểm tra chất lượng. Hãy thử lại.'],
    [/render|remotion|chromium|bundle/i, 'Bước dựng video gặp lỗi. Hãy thử lại.'],
    [/AGY|MCP|gateway|upstream|ECONNREFUSED|fetch failed|timed? ?out/i, 'Dịch vụ AI tạm thời không phản hồi. Hãy thử lại sau ít phút.'],
    [/Failed to fetch|NetworkError|network/i, 'Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.'],
  ];
  return describeError(raw, rules, 'Tạo video chưa thành công. Hãy thử lại.');
};

/** First matching rule wins; messages already in Vietnamese pass through, unknown ones keep the original as detail. */
export const describeError = (message: string | undefined, rules: Array<[RegExp, string]>, fallback: string): { text: string; detail?: string } => {
  const raw = (message || '').trim();
  if (!raw) return { text: fallback };
  if (/[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i.test(raw)) return { text: raw };
  const rule = rules.find(([pattern]) => pattern.test(raw));
  return { text: rule ? rule[1] : fallback, detail: raw };
};

/** Status poll interval: fast while images/render progress moves, slow during long AI stages, off when finished. */
export const studioPollInterval = (job?: StudioProgressInput) => {
  if (!job) return 2500;
  if (TERMINAL_STATUSES.has(job.status)) return 0;
  const { key } = parseStage(job.stage);
  if (key === 'queued') return 5000;
  if (key === 'generating-storyboard') return 4000;
  if (key === 'generating-images' || key === 'rendering' || key === 'saving-media' || key === 'cancelling') return 2000;
  return 3000;
};
