'use client';

import React, { useState } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { SourceVideoStudioModal } from './source-video-studio.modal';
import { StudioMedia, StudioVoice, useAiVideoStudio } from './ai-video-studio.state';
import { AiVideoIdeaPreview, AiVideoStoryboard, studioAction, studioInput, studioPrimary } from './ai-video-studio.storyboard';
import { videoWarningsVi } from './video-warning.vi';
import { PIPELINE_STEPS, SCENES_BY_DURATION, describeStudioError, formatElapsed, parseStage, useStudioProgress } from './ai-video-studio.progress';
import { AiWaitStream } from '@gitroom/frontend/components/ui/ai.wait.stream';

export const AiVideoStudioModal = ({ initialTopic = '', onChange, close }: {
  initialTopic?: string;
  onChange: (media: StudioMedia) => void;
  close: () => void;
}) => {
  const studio = useAiVideoStudio(initialTopic);
  const [attached, setAttached] = useState(false);
  const [useSeed, setUseSeed] = useState(false);
  const { storyboard, job, busy, error, activeJobId, jobKind } = studio;
  const disabled = !!busy || !!activeJobId;
  const complete = job?.status === 'completed' && job.media;
  // Storyboard jobs show the same live preview as idea jobs: script first, then each scene image.
  const ideaJob = (jobKind === 'idea' || jobKind === 'storyboard') && job ? job : undefined;
  const ideaStage = parseStage(ideaJob?.stage).key;
  const step = complete || (activeJobId && !(ideaJob && ['queued', 'generating-storyboard', 'generating-images'].includes(ideaStage))) ? 2 : storyboard || ideaJob ? 1 : 0;
  const sceneCount = ideaJob?.preview?.scenes.length || storyboard?.scenes.length || SCENES_BY_DURATION[studio.targetDuration];
  const progress = useStudioProgress(job, jobKind, sceneCount, job?.jobId);
  const failure = job && ['failed', 'cancelled'].includes(job.status) ? job : undefined;
  const failureMessage = failure ? describeStudioError(failure.status === 'cancelled' ? 'cancelled' : failure.error) : undefined;
  const actionError = error ? describeStudioError(error) : undefined;

  return (
    <div role="dialog" aria-modal="true" aria-label="AI Video Studio" className="whitespace-normal text-textColor">
      <header className="mb-6 border-b border-newBgLineColor pb-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-500">
            VIDEO {studio.aspectRatio === '9:16' ? 'DỌC 9:16' : studio.aspectRatio === '16:9' ? 'NGANG 16:9' : 'VUÔNG 1:1'}
          </span>
          <span className="text-textColor/60">
            {studio.aspectRatio === '16:9' ? '1920 × 1080' : studio.aspectRatio === '1:1' ? '1080 × 1080' : '1080 × 1920'} · 30 FPS · Giọng AI Expressive
          </span>
        </div>
        <p className="mt-3 text-sm text-textColor/70">Biến ý tưởng thành video đa khung hình (9:16, 16:9, 1:1) với giọng đọc truyền cảm xúc và phụ đề động.</p>
        <ol className="mt-5 flex flex-wrap gap-4 text-xs" aria-label="Các bước tạo video">
          {['Ý tưởng', 'Storyboard', 'Xuất video'].map((label, index) => (
            <li key={label} aria-current={step === index ? 'step' : undefined} className={`flex items-center gap-2 ${step === index ? 'font-semibold text-emerald-500' : 'text-textColor/50'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step === index ? 'bg-emerald-500/15' : 'bg-newColColor'}`}>{index + 1}</span>{label}
            </li>
          ))}
        </ol>
      </header>

      {actionError && <div role="alert" className="mb-5 break-words rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-500">{actionError.text}{actionError.detail && <span className="mt-1 block text-xs text-red-500/70">Chi tiết: {actionError.detail}</span>}</div>}

      {!storyboard && !ideaJob && <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="studio-topic">Bạn muốn kể câu chuyện gì?</label>
            <textarea id="studio-topic" autoFocus rows={4} maxLength={2000} className={studioInput} disabled={disabled} value={studio.topic} onChange={(event) => studio.setTopic(event.target.value)} placeholder="Ví dụ: Một buổi sáng xanh ở Sài Gòn, với 3 thói quen nhỏ giúp ngày mới nhẹ nhàng hơn…" />
          </div>
          <fieldset disabled={disabled}>
            <legend className="mb-2 text-sm font-semibold">Tỉ lệ khung hình</legend>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['9:16', 'Dọc (Shorts, TikTok)', '1080×1920'],
                ['16:9', 'Ngang (YouTube, Web)', '1920×1080'],
                ['1:1', 'Vuông (Feed, Insta)', '1080×1080'],
              ] as const).map(([ratio, label, res]) => (
                <button
                  key={ratio}
                  type="button"
                  aria-pressed={studio.aspectRatio === ratio}
                  onClick={() => studio.setAspectRatio(ratio)}
                  className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${
                    studio.aspectRatio === ratio
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold shadow-sm'
                      : 'border-newBgLineColor hover:bg-boxHover'
                  }`}
                >
                  <span className="block text-base font-bold">{ratio}</span>
                  <span className="text-[11px] block">{label}</span>
                  <span className="text-[10px] text-textColor/50 block">{res}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={disabled}>
            <legend className="mb-2 text-sm font-semibold">Thời lượng mục tiêu</legend>
            <div className="grid grid-cols-3 gap-2">
              {([[15, 'Hook nhanh'], [30, 'TikTok / Reels'], [60, 'Kể chuyện']] as const).map(([seconds, label]) => (
                <button key={seconds} type="button" aria-pressed={studio.targetDuration === seconds} onClick={() => studio.setTargetDuration(seconds)} className={`rounded-xl border px-2 py-3 text-center transition-colors ${studio.targetDuration === seconds ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-newBgLineColor hover:bg-boxHover'}`}>
                  <span className="block text-lg font-bold">{seconds}s</span><span className="text-[11px]">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="studio-voice">Giọng đọc tiếng Việt (Voice Clone AI & Chuẩn)</label>
            <select id="studio-voice" className={studioInput} disabled={disabled} value={studio.voice} onChange={(event) => studio.setVoice(event.target.value as StudioVoice)}>
              <optgroup label="🌟 Giọng đọc AI Truyền cảm (OmniVoice Clone - Đề xuất)">
                <option value="Thuyết Minh">⭐ Thuyết Minh · Truyền cảm, chuyên nghiệp</option>
                <option value="Chị gái">⭐ Chị gái · Ngọt ngào, tự nhiên</option>
                <option value="Giọng dạy">⭐ Giọng dạy · Bài giảng, cuốn hút</option>
                <option value="HTH">⭐ HTH · Nữ kể chuyện, ấm áp</option>
                <option value="Adam">⭐ Adam · Nam truyền cảm, điện ảnh</option>
              </optgroup>
              <optgroup label="Giọng đọc Tiêu chuẩn (Edge-TTS)">
                <option value="vi-VN-HoaiMyNeural">Hoài My · Nữ chuẩn</option>
                <option value="vi-VN-NamMinhNeural">Nam Minh · Nam chuẩn</option>
              </optgroup>
            </select>
          </div>
          <div className="rounded-xl border border-newBgLineColor p-4">
            <p className="text-sm font-semibold">Ảnh mồi <span className="font-normal text-textColor/50">· không bắt buộc</span></p>
            <p className="mt-1 text-xs leading-relaxed text-textColor/60">Dùng ảnh của bạn để giữ nhân vật, màu sắc và phong cách giữa các cảnh.</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!useSeed} disabled={disabled} onChange={(event) => { setUseSeed(!event.target.checked); if (event.target.checked) studio.setSeed(undefined); }} />Để AI tự vẽ toàn bộ ảnh
            </label>
            {useSeed && <div>
            <label htmlFor="studio-seed" className="mt-3 block text-xs text-textColor/60">Tải ảnh JPG, PNG, WebP, GIF · tối đa 20 MB</label>
            <input id="studio-seed" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} className="mt-2 w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/10 file:px-3 file:py-2 file:text-emerald-500" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void studio.uploadSeed(file);
              event.target.value = '';
            }} />
            </div>}
            {busy === 'upload' && <p role="status" className="mt-2 text-xs text-emerald-500">Đang tải ảnh lên…</p>}
            {studio.seed && <div className="mt-3 flex items-center gap-3"><img src={studio.seed.path} alt="Ảnh mồi đã tải lên" className="h-16 w-16 rounded-lg object-cover" /><button type="button" disabled={disabled} onClick={() => studio.setSeed(undefined)} className="text-xs text-textColor/60 underline">Bỏ ảnh mồi</button></div>}
          </div>
          <button type="button" disabled={disabled || !studio.topic.trim() || (useSeed && !studio.seed)} className={`${studioPrimary} w-full`} onClick={() => void studio.generate()}>{busy === 'storyboard' ? 'Đang tạo kịch bản & sinh ảnh…' : '✦ Tạo kịch bản & sinh ảnh'}</button>
          <button type="button" disabled={disabled || !studio.topic.trim() || (useSeed && !studio.seed)} className={`${studioAction} w-full`} onClick={() => void studio.generateVideo()}>{busy === 'idea' ? 'Đang gửi yêu cầu…' : '⚡ Tạo video ngay (tự động, xem trước từng cảnh)'}</button>
          <p className="text-xs leading-relaxed text-textColor/60">“Tạo kịch bản” cho phép duyệt và sửa từng cảnh trước khi xuất. “Tạo video ngay” chạy trọn quy trình, hiển thị kịch bản và ảnh ngay khi xong; video {studio.targetDuration}s thường mất khoảng {Math.round(9.5 * (0.5 + 0.5 * SCENES_BY_DURATION[studio.targetDuration] / 4))} phút.</p>
          {busy === 'storyboard' && !activeJobId && <AiWaitStream kind="video" title="Đang khởi tạo kịch bản" label="Đang gửi yêu cầu…" expectedSeconds={15} compact />}
          {busy === 'idea' && !activeJobId && <AiWaitStream kind="video" title="Đang khởi tạo video AI" label="Đang gửi yêu cầu…" expectedSeconds={15} compact />}
        </div>
        <aside className="hidden rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5 md:block">
          <div className={`mx-auto flex ${studio.aspectRatio === '16:9' ? 'aspect-video' : studio.aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[9/16]'} max-h-72 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400/40 via-emerald-600/30 to-emerald-400/30 p-4 transition-all duration-300`}>
            <span className="mb-auto text-xs font-semibold text-emerald-500">AI VIDEO STUDIO · {studio.aspectRatio}</span>
            <span className="mb-2 text-xl font-bold leading-tight">Câu chuyện của bạn.<br /><span className="text-emerald-500">Sống động hơn.</span></span>
            <div className="h-1 w-2/3 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-textColor/60">Khung hình {studio.aspectRatio}. Duyệt và chỉnh từng cảnh trước khi xuất MP4. Video hoàn tất sẽ được lưu vào kho media.</p>
        </aside>
      </div>}

      {storyboard && !complete && <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{storyboard.title}</h2><p className="mt-1 text-xs text-textColor/60">{storyboard.scenes.length} cảnh · {studio.targetDuration} giây · Khung {studio.aspectRatio} · Giọng {studio.voice}</p></div>
          <button type="button" className={studioAction} disabled={disabled} onClick={() => studio.setStoryboard(undefined)}>Chỉnh cấu hình</button>
        </div>
        {storyboard.visualDna && <details className="rounded-xl border border-newBgLineColor px-4 py-3"><summary className="cursor-pointer text-xs font-medium">Phong cách hình ảnh chung ({studio.aspectRatio})</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-textColor/60">{storyboard.visualDna}</p></details>}
        {storyboard.hook?.chosen && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs"><p><span className="font-semibold text-emerald-500">Hook mở đầu: </span>{storyboard.hook.chosen}</p>{(storyboard.hook.pattern?.template || storyboard.hook.pattern?.category) && <p className="mt-1 text-textColor/60">Mẫu: {storyboard.hook.pattern?.template || storyboard.hook.pattern?.category}{storyboard.hook.kind ? ` · ${storyboard.hook.kind}` : ''}</p>}{!!storyboard.hook.candidates?.length && <details className="mt-2"><summary className="cursor-pointer font-medium">Các phương án hook đã chấm điểm</summary><ul className="mt-2 space-y-2">{storyboard.hook.candidates.map((candidate, index) => <li key={index} className={`rounded-lg p-2 ${candidate.text === storyboard.hook?.chosen ? 'border border-emerald-500/40 bg-emerald-500/10' : 'bg-newBgColor'}`}><p className="text-sm">{candidate.text}</p><p className="mt-1 text-textColor/60">Tò mò {candidate.scores?.curiosity ?? '–'} · Cụ thể {candidate.scores?.specificity ?? '–'} · Trung thực {candidate.scores?.truthfulness ?? '–'} · Phù hợp {candidate.scores?.fit ?? '–'}{candidate.patternId != null ? ` · Mẫu #${candidate.patternId}` : ''}</p></li>)}</ul></details>}</div>}
        {!!storyboard.grounding?.facts?.length && <details className="rounded-xl border border-newBgLineColor px-4 py-3"><summary className="cursor-pointer text-xs font-medium">Dữ kiện AI tự kiểm, chưa xác minh nguồn ({storyboard.grounding.facts.length})</summary><ul className="mt-2 space-y-2 text-xs">{storyboard.grounding.facts.map((fact, index) => <li key={index}><p>{fact.claim}</p><p className="text-textColor/60">{fact.verified ? 'Nguồn' : 'Theo AI (chưa xác minh)'}: {fact.basis}</p></li>)}</ul></details>}
        <AiVideoStoryboard scenes={storyboard.scenes} busy={busy} disabled={disabled} audio={studio.audio} editScene={studio.editScene} regenerate={(index) => void studio.regenerate(index)} previewVoice={(index) => void studio.previewVoice(index)} />
        {!activeJobId && !failure && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-500/5 p-4"><p className="text-xs text-textColor/60">Xuất MP4 {studio.aspectRatio} với chuyển động ảnh Ken Burns, giọng đọc {studio.voice} và phụ đề động.</p><button type="button" disabled={disabled} className={studioPrimary} onClick={() => void studio.render()}>{busy === 'render' ? 'Đang bắt đầu…' : 'Xuất video MP4'}</button></div>}
        {busy === 'render' && !activeJobId && <AiWaitStream kind="video" title="Đang khởi tạo bản dựng video" label="Đang gửi kịch bản sang bộ dựng…" expectedSeconds={15} compact />}
      </div>}

      {ideaJob && !complete && <AiVideoIdeaPreview preview={ideaJob.preview} sceneCount={sceneCount} aspectRatio={studio.aspectRatio}
        drawing={!!activeJobId && ['queued', 'generating-storyboard', 'generating-images'].includes(ideaStage) && !!ideaJob.preview} failed={!!failure} />}

      {job && !complete && progress && <section aria-live="polite" className="mt-5 space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5">
        {failure ? <p className="text-sm font-semibold">{progress.label}</p>
          : <AiWaitStream key={job.jobId} kind="video" title={jobKind === 'render' ? 'AI đang xuất video' : jobKind === 'storyboard' ? 'AI đang viết kịch bản & vẽ ảnh' : 'AI đang tạo video'} percent={progress.percent}
            label={`${progress.label}${progress.eta ? ` · ${progress.eta}` : ''}`}
            steps={PIPELINE_STEPS.filter((item) => jobKind && item.kinds.includes(jobKind)).map((item) => item.label)}
              step={PIPELINE_STEPS.filter((item) => jobKind && item.kinds.includes(jobKind)).findIndex((item) => item.key === PIPELINE_STEPS[progress.step]?.key)} />}
        {activeJobId && <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-textColor/60">Đã chạy {formatElapsed(progress.elapsed)} · {progress.eta}. {studio.reconnecting ? 'Đang kết nối lại để cập nhật tiến độ…' : jobKind === 'storyboard' ? 'Storyboard sẽ mở để duyệt khi vẽ xong các cảnh.' : 'Video sẽ tự lưu vào kho media khi hoàn tất.'}</p>
          <button type="button" disabled={!!busy || parseStage(job.stage).key === 'saving-media' || parseStage(job.stage).key === 'cancelling'} className={`${studioAction} !py-2 !text-xs`} onClick={() => void studio.cancel()}>{busy === 'cancel' || parseStage(job.stage).key === 'cancelling' ? 'Đang hủy…' : 'Hủy tác vụ'}</button>
        </div>}
        {failure && failureMessage && <div role="alert" className="space-y-3">
          <p className={`break-words text-sm ${failure.status === 'cancelled' ? 'text-textColor/80' : 'text-red-500'}`}>{failureMessage.text}</p>
          {failureMessage.detail && <p className="break-words text-xs text-textColor/50">Chi tiết: {failureMessage.detail}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} className={`${studioPrimary} !py-2 !text-xs`} onClick={() => void studio.retry()}>
              {busy === 'retry' ? 'Đang thử lại…' : (jobKind === 'idea' || jobKind === 'storyboard') && failure.resumable ? (failure.status === 'cancelled' ? 'Tiếp tục từ phần đã lưu' : 'Thử lại (giữ kịch bản & ảnh đã có)') : 'Thử lại'}
            </button>
            {(jobKind === 'idea' || jobKind === 'storyboard') && <button type="button" disabled={!!busy} className={`${studioAction} !py-2 !text-xs`} onClick={studio.resetJob}>Chỉnh cấu hình</button>}
          </div>
        </div>}
      </section>}

      {complete && <section className="space-y-5">
        <div><h2 className="text-lg font-semibold">Video đã sẵn sàng</h2><p className="mt-1 text-sm text-textColor/60">{storyboard?.title || ideaJob?.preview?.title} · {studio.targetDuration} giây · Khung {studio.aspectRatio}</p></div>
        <video src={complete.path} controls playsInline preload="metadata" className={`mx-auto max-h-[55vh] w-full ${studio.aspectRatio === '16:9' ? 'max-w-[560px]' : studio.aspectRatio === '1:1' ? 'max-w-[420px]' : 'max-w-[310px]'} rounded-2xl bg-black`} aria-label="Video AI đã hoàn tất" />
        {videoWarningsVi(job?.warnings).map((warning) => <p key={warning} role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-600">{warning}</p>)}
        <p className="text-center text-xs text-textColor/60">Đã lưu vào kho media. Đính kèm video để tiếp tục soạn bài đăng trong Agent.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href={complete.path} download target="_blank" rel="noreferrer" className={studioAction}>Tải video MP4</a>
          <button type="button" disabled={attached} className={studioPrimary} onClick={() => { if (!attached) { setAttached(true); onChange({ id: complete.id, path: complete.path }); close(); } }}>Đính kèm vào bài đăng Agent</button>
        </div>
      </section>}
    </div>
  );
};

export const AiVideoStudioButton = ({ value = '', onChange, onPostText }: {
  value?: string; onChange: (media: StudioMedia | StudioMedia[]) => void; onPostText?: (text: string) => void;
}) => {
  const modals = useModals();
  return <button type="button" title="Tạo video dọc với AI Video Studio" className="flex h-[32px] shrink-0 items-center gap-1.5 rounded-[8px] border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-[12px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20" onClick={() => modals.openModal({
    title: 'AI Video Studio', size: 'min(900px, calc(100vw - 24px))', maxSize: '900px', top: '24px',
    askClose: false, closeOnClickOutside: false, closeOnEscape: true,
    children: (close) => <VideoStudioChooser initialTopic={value} onChange={onChange} onPostText={onPostText} close={close} />,
  })}><span aria-hidden="true">✦</span> Tạo Video AI</button>;
};

const VideoStudioChooser = ({ initialTopic, onChange, onPostText, close }: {
  initialTopic: string; onChange: (media: StudioMedia | StudioMedia[]) => void; onPostText?: (text: string) => void; close: () => void;
}) => {
  const [mode, setMode] = useState<'idea' | 'source'>('idea');
  return <div>
    <div role="tablist" aria-label="Nguồn tạo video" className="mb-5 flex gap-2">
      {([['idea', 'Tạo từ ý tưởng'], ['source', 'Chỉnh video có sẵn']] as const).map(([key, label]) =>
        <button key={key} type="button" role="tab" aria-selected={mode === key}
          className={mode === key ? studioPrimary : studioAction} onClick={() => setMode(key)}>{label}</button>)}
    </div>
    {mode === 'idea' ? <AiVideoStudioModal initialTopic={initialTopic} onChange={onChange} close={close} />
      : <SourceVideoStudioModal close={close} onChange={(media, postText) => {
        onChange(media);
        if (postText) onPostText?.(postText);
      }} />}
  </div>;
};
