'use client';

import React from 'react';
import { AiWaitStream } from '@gitroom/frontend/components/ui/ai.wait.stream';
import { StudioAspectRatio, StudioPreview, StudioScene } from './ai-video-studio.state';

export const studioInput = 'w-full rounded-xl border border-newBgLineColor bg-newBgColor px-3 py-2.5 text-sm text-textColor outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60';
export const studioAction = 'rounded-xl border border-newBgLineColor px-4 py-2.5 text-sm font-medium hover:bg-boxHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const studioPrimary = 'rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const AiVideoStoryboard = ({ scenes, busy, disabled, audio, editScene, regenerate, previewVoice }: {
  scenes: StudioScene[];
  busy: string;
  disabled: boolean;
  audio?: { index: number; url: string; seconds: number };
  editScene: (index: number, patch: Partial<StudioScene>) => void;
  regenerate: (index: number) => void;
  previewVoice: (index: number) => void;
}) => (
  <div className="space-y-4">
    {scenes.map((scene, index) => (
      <section key={index} className="overflow-hidden rounded-2xl border border-newBgLineColor bg-newBgColor/40">
        <div className="flex items-center justify-between border-b border-newBgLineColor px-4 py-3">
          <h3 className="text-sm font-semibold">Cảnh {index + 1}</h3>
          <span className="text-xs text-textColor/60">{scene.voiceText.trim().split(/\s+/).filter(Boolean).length} từ</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black/10">
              {scene.imageUrl ? <img src={scene.imageUrl} alt={`Ảnh minh họa cảnh ${index + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-3 text-center text-xs text-textColor/60">Chưa có ảnh. Thử vẽ lại cảnh này.</div>}
              {scene.keywordHighlight && <span className="absolute inset-x-2 bottom-4 break-words rounded-lg bg-black/60 px-2 py-1 text-center text-xs font-bold text-yellow-300">{scene.keywordHighlight}</span>}
            </div>
            {busy === `image-${index}` ? <AiWaitStream kind="image" title="Đang vẽ" compact className="!p-2" /> : (
              <button type="button" disabled={disabled} className={`${studioAction} w-full !px-2 !py-2 !text-xs`} onClick={() => regenerate(index)}>
                ↻ Vẽ lại ảnh
              </button>
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <label className="block text-xs font-medium" htmlFor={`studio-narration-${index}`}>Lời thoại</label>
            <textarea id={`studio-narration-${index}`} rows={3} maxLength={1500} className={studioInput} value={scene.voiceText} disabled={disabled} onChange={(event) => editScene(index, { voiceText: event.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={disabled || !scene.voiceText.trim()} className={`${studioAction} !py-2 !text-xs`} onClick={() => previewVoice(index)}>
                {busy === `voice-${index}` ? 'Đang tạo giọng…' : '▷ Nghe thử giọng đọc'}
              </button>
              {audio?.index === index && <span className="text-xs text-textColor/60">{Number(audio.seconds).toFixed(1)} giây</span>}
            </div>
            {audio?.index === index && <audio key={audio.url} src={audio.url} controls autoPlay className="h-10 w-full" aria-label={`Nghe lời thoại cảnh ${index + 1}`} />}
            <label className="block text-xs font-medium" htmlFor={`studio-keyword-${index}`}>Từ khóa nổi bật trong phụ đề</label>
            <input id={`studio-keyword-${index}`} maxLength={80} className={studioInput} value={scene.keywordHighlight || ''} disabled={disabled} onChange={(event) => editScene(index, { keywordHighlight: event.target.value })} />
            <details className="rounded-xl border border-newBgLineColor p-3">
              <summary className="cursor-pointer text-xs font-medium">Chỉnh mô tả ảnh</summary>
              <label htmlFor={`studio-image-${index}`} className="sr-only">Mô tả ảnh cảnh {index + 1}</label>
              <textarea id={`studio-image-${index}`} rows={3} maxLength={7000} className={`${studioInput} mt-3`} value={scene.imagePrompt} disabled={disabled} onChange={(event) => editScene(index, { imagePrompt: event.target.value })} />
              <p className="mt-2 text-xs text-textColor/60">Bấm “Vẽ lại ảnh” để áp dụng mô tả mới.</p>
            </details>
          </div>
        </div>
      </section>
    ))}
  </div>
);

/** Live idea-job preview: script, hook and facts as soon as they exist, scene images as each one finishes. */
export const AiVideoIdeaPreview = ({ preview, sceneCount, aspectRatio, drawing, failed }: {
  preview?: StudioPreview;
  sceneCount: number;
  aspectRatio: StudioAspectRatio;
  drawing: boolean;
  failed: boolean;
}) => {
  const frame = aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[9/16]';
  const scenes = preview?.scenes.length ? preview.scenes : Array.from({ length: sceneCount }, (_, sceneIndex) => ({ sceneIndex, voiceText: '', keywordHighlight: '', imageUrl: undefined as string | undefined }));
  const ready = scenes.filter((scene) => scene.imageUrl).length;
  return (
    <div className="space-y-4">
      {preview ? <div>
        <h2 className="text-lg font-semibold">{preview.title}</h2>
        <p className="mt-1 text-xs text-textColor/60">{scenes.length} cảnh · {ready}/{scenes.length} ảnh đã xong</p>
      </div> : <div className="space-y-2" aria-hidden="true">
        <div className="h-5 w-2/3 animate-pulse rounded bg-newColColor" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-newColColor" />
      </div>}
      {preview?.hook && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs"><span className="font-semibold text-emerald-500">Hook mở đầu: </span>{preview.hook}</p>}
      {!!preview?.facts.length && <details className="rounded-xl border border-newBgLineColor px-4 py-3">
        <summary className="cursor-pointer text-xs font-medium">Dữ kiện AI tự kiểm, chưa xác minh nguồn ({preview.facts.length})</summary>
        <ul className="mt-2 space-y-2 text-xs">{preview.facts.map((fact, index) => <li key={index}><p>{fact.claim}</p><p className="text-textColor/60">{fact.verified ? 'Nguồn' : 'Theo AI (chưa xác minh)'}: {fact.basis}</p></li>)}</ul>
      </details>}
      <ol className={`grid gap-3 ${aspectRatio === '16:9' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`} aria-label="Các cảnh video">
        {scenes.map((scene, index) => {
          const state = scene.imageUrl ? 'Xong' : !preview ? 'Chờ kịch bản' : drawing ? 'Đang vẽ…' : failed ? 'Chưa có ảnh' : 'Chờ vẽ';
          return (
            <li key={scene.sceneIndex} className="overflow-hidden rounded-xl border border-newBgLineColor bg-newBgColor/40">
              <div className={`relative ${frame} overflow-hidden bg-black/10`}>
                {scene.imageUrl
                  ? <img src={scene.imageUrl} alt={`Ảnh minh họa cảnh ${index + 1}`} className="h-full w-full object-cover" />
                  : <div className={`flex h-full items-center justify-center bg-newColColor text-center text-[11px] text-textColor/60 ${drawing || !preview ? 'animate-pulse' : ''}`}>{state}</div>}
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${scene.imageUrl ? 'bg-emerald-600 text-white' : 'bg-black/60 text-white'}`}>
                  Cảnh {index + 1} · {state}
                </span>
                {scene.keywordHighlight && <span className="absolute inset-x-2 bottom-2 break-words rounded-lg bg-black/60 px-2 py-1 text-center text-[11px] font-bold text-yellow-300">{scene.keywordHighlight}</span>}
              </div>
              {scene.voiceText && <p className="line-clamp-4 p-2 text-[11px] leading-relaxed text-textColor/80">{scene.voiceText}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
