'use client';
import { FC, useEffect, useRef, useState } from 'react';

export type AiWaitKind = 'image' | 'video' | 'caption' | 'edit';

const DEFAULT_STEPS: Record<AiWaitKind, string[]> = {
  image: ['Đọc yêu cầu và ảnh mẫu', 'Chọn bố cục theo framework ảnh', 'Phác thảo khối và ánh sáng', 'Vẽ chi tiết', 'Lưu vào kho media'],
  video: ['Viết kịch bản', 'Vẽ ảnh từng cảnh', 'Thu giọng đọc', 'Dựng video', 'Kiểm tra và lưu'],
  caption: ['Đọc nội dung', 'Chọn hook mở đầu', 'Viết thân bài', 'Thêm CTA và hashtag'],
  edit: ['Phân tích nội dung hiện tại', 'Lên phương án chỉnh', 'Áp dụng thay đổi', 'Hoàn tất'],
};
const DEFAULT_SECONDS: Record<AiWaitKind, number> = { image: 35, video: 180, caption: 15, edit: 25 };
const TITLES: Record<AiWaitKind, string> = { image: 'AI đang tạo ảnh', video: 'AI đang tạo video', caption: 'AI đang viết caption', edit: 'AI đang chỉnh sửa' };

/** Elapsed seconds since mount, ticking every 200 ms. */
const useElapsed = () => {
  const start = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((Date.now() - start.current) / 1000), 200);
    return () => clearInterval(timer);
  }, []);
  return elapsed;
};

/** Streaming text lines that type in one after another, looping (caption / edit preview). */
const StreamLines: FC<{ elapsed: number }> = ({ elapsed }) => {
  const widths = [92, 78, 85, 60, 88, 70];
  const typed = (elapsed * 55) % (widths.reduce((sum, width) => sum + width, 0) + 120);
  let left = typed;
  return (
    <div className="mt-3 flex flex-col gap-2" aria-hidden>
      {widths.map((width, index) => {
        const shown = Math.max(0, Math.min(width, left));
        left -= width;
        const active = shown > 0 && shown < width;
        return (
          <div key={index} className="flex h-2.5 items-center">
            <div className="relative h-2.5 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500/40 to-teal-400/30 transition-[width] duration-200" style={{ width: `${shown}%` }}>
              <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </div>
            {active && <span className="ms-0.5 h-3 w-[2px] animate-pulse bg-emerald-500" />}
          </div>
        );
      })}
    </div>
  );
};

/** A canvas that is "drawn": grid cells reveal in a sweep with a scan line (image / edit). */
const DrawCanvas: FC<{ elapsed: number; ratio?: string }> = ({ elapsed, ratio = '4 / 3' }) => {
  const cols = 8, rows = 6, total = cols * rows;
  const revealed = Math.floor((elapsed * 4) % (total + 10));
  const scan = (elapsed * 30) % 100;
  return (
    <div className="relative mt-3 w-full overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5" style={{ aspectRatio: ratio, maxHeight: 220 }} aria-hidden>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: total }, (_, index) => {
          const order = (index % cols) + Math.floor(index / cols) * 2;
          const on = order < revealed;
          const hue = 150 + ((index * 37) % 40);
          return <div key={index} className="transition-opacity duration-500" style={{ opacity: on ? 0.55 : 0, background: `hsl(${hue} 55% ${45 + ((index * 13) % 25)}%)` }} />;
        })}
      </div>
      <div className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-white/50 to-transparent mix-blend-overlay" style={{ top: `calc(${scan}% - 16px)` }} />
      <div className="absolute inset-0 backdrop-blur-[6px]" />
    </div>
  );
};

/** Filmstrip of scene frames lighting up in turn (video). */
const Filmstrip: FC<{ elapsed: number }> = ({ elapsed }) => {
  const active = Math.floor(elapsed / 1.2) % 6;
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className={`relative h-14 flex-1 overflow-hidden rounded-md border transition-colors duration-500 ${index <= active ? 'border-emerald-500/50 bg-emerald-500/20' : 'border-textColor/10 bg-textColor/5'}`}>
          {index === active && <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
        </div>
      ))}
    </div>
  );
};

/**
 * Streaming "AI is working" panel for any wait (image, video, caption, edit): a live visual, the current
 * step, elapsed time and a progress bar. `percent` is the real progress when known; otherwise it eases
 * toward 95% over the expected duration.
 */
export const AiWaitStream: FC<{
  kind: AiWaitKind; title?: string; steps?: string[]; expectedSeconds?: number; percent?: number;
  label?: string; ratio?: string; compact?: boolean; fullWidth?: boolean; step?: number; className?: string;
}> = ({ kind, title, steps, expectedSeconds, percent, label, ratio, compact, fullWidth, step: realStep, className = '' }) => {
  const elapsed = useElapsed();
  const list = steps?.length ? steps : DEFAULT_STEPS[kind];
  const seconds = expectedSeconds || DEFAULT_SECONDS[kind];
  const estimated = Math.round(95 * (1 - Math.exp(-elapsed / (seconds / 2.2))));
  const shown = Math.max(1, Math.min(100, Math.round(percent ?? estimated)));
  // The real pipeline step when the caller knows it; otherwise derived from the percent.
  const step = Math.min(list.length - 1, Math.max(0, realStep ?? Math.floor((shown / 100) * list.length)));
  return (
    <div role="status" aria-live="polite" className={`w-full ${fullWidth ? '' : 'max-w-[520px]'} rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5" aria-hidden>
            <span className="inline-block w-1 rounded-full bg-emerald-500 animate-eq-1" />
            <span className="inline-block w-1 rounded-full bg-emerald-400 animate-eq-2" />
            <span className="inline-block w-1 rounded-full bg-teal-500 animate-eq-3" />
          </div>
          <p className="text-sm font-semibold">{title || TITLES[kind]}…</p>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-textColor/60">{shown}% · {elapsed.toFixed(0)}s</span>
      </div>
      <p className="mt-1 text-xs text-textColor/70">{label || list[step]}</p>
      {!compact && (kind === 'caption' ? <StreamLines elapsed={elapsed} />
        : kind === 'video' ? <Filmstrip elapsed={elapsed} />
        : <DrawCanvas elapsed={elapsed} ratio={ratio} />)}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-500/10" role="progressbar" aria-valuenow={shown} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${shown}%` }} />
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {list.map((name, index) => (
            <span key={name} className={`rounded-full px-2 py-0.5 text-[10px] ${index < step ? 'bg-emerald-500 text-white' : index === step ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-textColor/5 text-textColor/50'}`}>{name}</span>
          ))}
        </div>
      )}
    </div>
  );
};
