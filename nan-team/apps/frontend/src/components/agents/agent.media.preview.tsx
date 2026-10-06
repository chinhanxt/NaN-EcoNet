'use client';
import { FC, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isVideoPath } from '@gitroom/helpers/utils/media.kind';

const MEDIA_URL = /(?:https?:\/\/[^\s<>"'`)\]]+|\/uploads\/[^\s<>"'`)\]]+)/gi;
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v)(\?|#|$)/i;

/** Image/video links in an assistant message (uploads or direct media files), at most 8, in order. */
export const agentMessageMedia = (text: string): string[] =>
  [...new Set((text.match(MEDIA_URL) || []).map((url) => url.replace(/[.,;:!?]+$/, '')))]
    .filter((url) => MEDIA_EXT.test(url) || url.includes('/uploads/'))
    .slice(0, 8);

const Popup: FC<{ urls: string[]; index: number; onIndex: (index: number) => void; onClose: () => void }> = ({ urls, index, onIndex, onClose }) => {
  const url = urls[index];
  const move = useCallback((step: number) => onIndex((index + step + urls.length) % urls.length), [index, urls.length, onIndex]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight' && urls.length > 1) move(1);
      else if (event.key === 'ArrowLeft' && urls.length > 1) move(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose, move, urls.length]);
  const button = 'flex h-10 items-center justify-center rounded-full bg-white/10 px-4 text-sm text-white hover:bg-white/20';
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Xem sản phẩm" className="fixed inset-0 z-[2147483000] flex flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 p-4" onClick={(event) => event.stopPropagation()}>
        <span className="text-sm text-white/70">{urls.length > 1 ? `${index + 1}/${urls.length}` : ''}</span>
        <div className="flex gap-2">
          <a className={button} href={url} target="_blank" rel="noreferrer">Mở tab mới</a>
          <a className={button} href={url} download>Tải về</a>
          <button type="button" className={button} onClick={onClose} aria-label="Đóng">✕</button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        {isVideoPath(url)
          ? <video key={url} src={url} controls autoPlay className="max-h-full max-w-full rounded-xl bg-black" onClick={(event) => event.stopPropagation()} />
          : <img key={url} src={url} alt="" className="max-h-full max-w-full rounded-xl object-contain" onClick={(event) => event.stopPropagation()} />}
        {urls.length > 1 && (
          <>
            <button type="button" aria-label="Trước" className={`${button} absolute start-4 top-1/2 -translate-y-1/2`} onClick={(event) => { event.stopPropagation(); move(-1); }}>‹</button>
            <button type="button" aria-label="Sau" className={`${button} absolute end-4 top-1/2 -translate-y-1/2`} onClick={(event) => { event.stopPropagation(); move(1); }}>›</button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

/** Thumbnails of the images/videos an assistant message produced; a click opens them in a popup viewer. */
export const AgentMediaPreview: FC<{ urls: string[]; align?: 'start' | 'end' }> = ({ urls, align = 'start' }) => {
  const [open, setOpen] = useState<number>();
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const shown = urls.filter((url) => !broken.has(url));
  if (!shown.length) return null;
  const fail = (url: string) => setBroken((value) => new Set(value).add(url));
  return (
    <>
      <div className={`mt-1 grid gap-2 ${align === 'end' ? 'ms-auto w-full max-w-[360px]' : 'max-w-[520px]'} ${shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {shown.map((url, index) => (
          <button key={url} type="button" onClick={() => setOpen(index)} aria-label="Xem sản phẩm"
            className="group relative overflow-hidden rounded-2xl bg-textColor/5 shadow-sm ring-1 ring-textColor/10 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-500/60">
            {isVideoPath(url)
              ? <video src={`${url}#t=0.1`} preload="metadata" muted playsInline onError={() => fail(url)}
                  className={`w-full object-cover ${shown.length === 1 ? 'max-h-[360px]' : 'aspect-square'}`} />
              : <img src={url} alt="" loading="lazy" onError={() => fail(url)}
                  className={`w-full object-cover transition group-hover:scale-[1.02] ${shown.length === 1 ? 'max-h-[360px]' : 'aspect-square'}`} />}
            {isVideoPath(url) && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl text-white">▶</span>
              </span>
            )}
          </button>
        ))}
      </div>
      {open !== undefined && <Popup urls={shown} index={Math.min(open, shown.length - 1)} onIndex={setOpen} onClose={() => setOpen(undefined)} />}
    </>
  );
};
