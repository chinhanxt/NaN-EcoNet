'use client';
import React, {useEffect, useState} from 'react';
import {useFetch} from '@gitroom/helpers/utils/custom.fetch';
import {isVideoPath} from '@gitroom/helpers/utils/media.kind';
import {videoWarningsVi} from './video-warning.vi';
import {SOURCE_STEPS, SourceStudioClip, SourceStudioClipContent, SourceStudioMedia, SourceStudioPlan, describeSourceError, useSourceProgress, useSourceVideoStudio} from './source-video.state';
import {formatElapsed} from './ai-video-studio.progress';
import {AiWaitStream} from '@gitroom/frontend/components/ui/ai.wait.stream';
const field='w-full rounded-xl border border-newBgLineColor bg-newBgColorInner px-3 py-2 text-sm text-textColor disabled:opacity-50';
const action='rounded-xl border border-newBgLineColor px-4 py-2 text-sm hover:bg-boxHover disabled:opacity-50';
const primary='rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50';
/** Design brief the engine turns into timed punch-in/zoom effects on the clip's key moments. */
const AUTO_ZOOM_BRIEF='Tự động punch-in/zoom nhẹ vào 2–4 ý quan trọng nhất (số liệu, bước chính, từ khóa), mỗi lần 1–3 giây; không che phụ đề hay khuôn mặt.';
const stages:Record<string,string>={queued:'Đang chờ', 'downloading-source':'Đang tải video nguồn', 'synthesizing-narration':'Đang tạo giọng đọc',transcribing:'Đang nhận diện lời nói',analyzing:'Đang chọn nội dung',rendering:'Đang dựng clip','verifying-clips':'Đang kiểm tra video','saving-media':'Đang lưu vào kho media',completed:'Đã hoàn tất',failed:'Xử lý thất bại',cancelled:'Đã hủy',awaiting_approval:'Chờ bạn duyệt các đoạn',approved:'Đã duyệt, chuẩn bị xuất',cancelling:'Đang hủy','selecting-moments':'Đang chọn khoảnh khắc nổi bật','writing-content':'Đang viết tiêu đề & caption','planning-layout':'Đang lên bố cục khung hình',cutting:'Đang cắt đoạn video',reframing:'Đang căn khung theo nhân vật',hook:'Đang thêm hook mở đầu',captions:'Đang tạo phụ đề',encoding:'Đang xuất file video',publishing:'Đang đăng bài',prepare:'Đang chuẩn bị video nguồn',analyze:'Đang phân tích video',render:'Đang dựng clip',verify:'Đang kiểm tra video',publish:'Đang lưu vào kho media',probing:'Đang đọc thông tin video','detecting-scenes':'Đang phát hiện cảnh','analysis-checkpoint-restored':'Đang khôi phục kết quả phân tích','planning-cuts':'Đang lên phương án cắt','writing-hook':'Đang viết hook mở đầu','reading-screen':'Đang đọc nội dung màn hình','planning-effects':'Đang lên hiệu ứng','saving-plan':'Đang lưu kế hoạch dựng','aligning-narration':'Đang căn phụ đề theo giọng đọc','applying-effects':'Đang áp dụng hiệu ứng','mixing-audio':'Đang trộn âm thanh','render-checkpoint-restored':'Đang khôi phục clip đã dựng',rendered:'Đã dựng xong clip','planning-motion':'Đang dựng chuyển động',finalizing:'Đang hoàn tất','repairing-transcript':'Đang hiệu đính lời thoại','hook-captions':'Đang ghép hook và phụ đề'};
export const SourceVideoStudioModal=({onChange,close}:{onChange:(media:{id:string;path:string}[],postText?:string)=>void;close:()=>void})=>{
  const studio=useSourceVideoStudio();
  const [sourceMode,setSourceMode]=useState<'upload'|'media'|'url'>('upload');
  const [source,setSource]=useState<SourceStudioMedia>();
  const [url,setUrl]=useState('');
  const [operation,setOperation]=useState<'clips'|'edit'>('clips');
  const [ratio,setRatio]=useState('9:16');
  const [layout,setLayout]=useState('auto');
  const [count,setCount]=useState(3),[min,setMin]=useState(30),[max,setMax]=useState(60);
  const [captions,setCaptions]=useState(true),[captionStyle,setCaptionStyle]=useState('karaoke');
  const [hook,setHook]=useState(''),[hookEnabled,setHookEnabled]=useState(false),[hookStyle,setHookStyle]=useState('pill');
  const [audio,setAudio]=useState('keep'),[voice,setVoice]=useState('Thuyết Minh'),[narration,setNarration]=useState(''),[bgm,setBgm]=useState('');
  const [brief,setBrief]=useState(''),[prompt,setPrompt]=useState('');
  // Auto zoom on key points: on by default for 'auto' (the studio default) and slide/screen recordings;
  // off for speaker-cut/general/wide, where an extra crop easily cuts faces. The user can override either way.
  const [autoZoomChoice,setAutoZoom]=useState<boolean>();
  const autoZoom=autoZoomChoice??(layout==='auto'||layout==='screencast');
  const [segments,setSegments]=useState('');
  const [reviewBeforeRender,setReviewBeforeRender]=useState(true),[motion,setMotion]=useState(false),[theme,setTheme]=useState('clean'),[transition,setTransition]=useState('fade'),[lowerThird,setLowerThird]=useState('');
  const [effect,setEffect]=useState(''),[effectStart,setEffectStart]=useState(0),[effectEnd,setEffectEnd]=useState(3),[effectStrength,setEffectStrength]=useState(0.1);
  const [manualCrop,setManualCrop]=useState(false),[cropScene,setCropScene]=useState(0),[cropCenter,setCropCenter]=useState(0.5);
  const [reviewClips,setReviewClips]=useState<SourceStudioPlan['clips']>([]);
  useEffect(()=>{if(studio.job?.plan)setReviewClips(studio.job.plan.clips);},[studio.job?.jobId,studio.job?.plan?.planVersion]);
  const [chosen,setChosen]=useState<string[]>([]),[editing,setEditing]=useState<SourceStudioClip>();
  const [localError,setLocalError]=useState('');
  const disabled=!!studio.busy || studio.active;
  const settings=()=>{
    const parsedSegments=segments.trim()?segments.split(',').map(part=>{
      const [startSeconds,endSeconds]=part.trim().split('-').map(Number);
      if(!Number.isFinite(startSeconds)||!Number.isFinite(endSeconds)||endSeconds<=startSeconds)throw new Error('Nhập đoạn theo dạng 4-22, 30-45 (giây nguồn).');
      return {startSeconds,endSeconds};
    }):undefined;
    return {operation,aspectRatio:ratio,layout,reviewBeforeRender,motionDesign:{enabled:motion,theme,transitions:transition,lowerThird:lowerThird||undefined},selection:{count,minSeconds:min,maxSeconds:max,prompt},
      segments:parsedSegments,captions:{enabled:captions,style:captionStyle},hook:{enabled:hookEnabled,text:hook||undefined,style:hookStyle},
      audio:{mode:audio,voice,narrationText:narration||undefined,bgmMediaId:bgm||undefined},designBrief:[brief.trim(),autoZoom?AUTO_ZOOM_BRIEF:''].filter(Boolean).join('\n').slice(0,4000)||undefined,
      cropOverrides:manualCrop?{[String(cropScene)]:cropCenter}:undefined,effects:effect?[{type:effect,start:effectStart,end:effectEnd,strength:effectStrength}]:undefined};
  };
  const submit=()=>{
    setLocalError('');
    try{const input=settings();setChosen([]);if(editing){void studio.revise(editing.clipId,input);setEditing(undefined);}else void studio.start({...input,...(sourceMode==='url'?{sourceUrl:url}:{mediaId:source?.id})});}
    catch(e){setLocalError(e instanceof Error?e.message:'Cấu hình không hợp lệ.');}
  };
  const loadClip=(clip:SourceStudioClip)=>{setEditing(clip);setOperation('edit');setRatio(clip.aspectRatio);setSegments(clip.segments.map(s=>`${s.startSeconds}-${s.endSeconds}`).join(', '));};
  const finished=studio.job?.status==='completed';
  return <div role="dialog" aria-modal="true" aria-label="Studio video nguồn" className="whitespace-normal text-textColor">
    <header className="mb-5 border-b border-newBgLineColor pb-4"><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">VIDEO CÓ SẴN · {ratio}</span><h2 className="mt-3 text-lg font-semibold">Biến video của bạn thành nội dung mới</h2><p className="mt-1 text-sm text-textColor/60">Chọn khoảnh khắc, chỉnh bố cục và phụ đề. Giữ âm thanh gốc mặc định.</p></header>
    {(localError||studio.error)&&<p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{localError||describeSourceError(studio.error).text}</p>}
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-2 text-sm font-semibold">Video nguồn</legend>
      <div className="flex flex-wrap gap-2">{([['upload','Tải video'],['media','Kho media'],['url','Dán URL']] as const).map(([mode,label])=><button key={mode} type="button" aria-pressed={sourceMode===mode} className={`${action} ${sourceMode===mode?'border-emerald-500 bg-emerald-500/10 text-emerald-500':''}`} onClick={()=>setSourceMode(mode)}>{label}</button>)}</div>
      {sourceMode==='upload'&&<label className="block rounded-xl border border-dashed border-emerald-500/40 p-4 text-sm">Video MP4 / MOV / WebM · tối đa 1 GB<input aria-label="Tải video nguồn" type="file" accept="video/*" className="mt-2 block w-full text-xs" onChange={e=>{const file=e.target.files?.[0];if(file)void studio.upload(file,setSource);e.target.value='';}}/></label>}
      {sourceMode==='media'&&<select aria-label="Chọn video từ kho media" className={field} value={source?.id||''} onChange={e=>setSource(studio.media.find(m=>m.id===e.target.value))}><option value="">Chọn video…</option>{studio.media.filter(m=>isVideoPath(m.path)).map(m=><option value={m.id} key={m.id}>{m.originalName||m.id}</option>)}</select>}
      {sourceMode==='url'&&<input aria-label="URL video nguồn" className={field} type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…/video.mp4"/>}
      {sourceMode!=='url'&&source&&<video controls playsInline preload="metadata" src={source.path} className="mx-auto max-h-48 rounded-xl" aria-label="Xem video nguồn"/>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs">Mục tiêu<select className={field} value={operation} onChange={e=>setOperation(e.target.value as 'clips'|'edit')}><option value="clips">Chọn nhiều clip nổi bật</option><option value="edit">Chỉnh video / các đoạn chỉ định</option></select></label>
        <label className="text-xs">Tỉ lệ khung hình<select className={field} value={ratio} onChange={e=>setRatio(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select></label>
        <label className="text-xs">Bố cục<select className={field} value={layout} onChange={e=>setLayout(e.target.value)}>{[['auto','Tự động'],['general','Theo nhân vật'],['screencast','Slide + người nói'],['wide','Giữ toàn khung'],['speaker-cut','Theo người đang nói']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
        <label className="text-xs">Đoạn theo giây nguồn<input className={field} value={segments} onChange={e=>setSegments(e.target.value)} placeholder="4-22, 30-45 · bỏ trống để AI chọn"/></label>
      </div>
      {operation==='clips'&&<div className="grid grid-cols-3 gap-3">{[['Số clip',count,setCount,1,10],['Tối thiểu (s)',min,setMin,10,180],['Tối đa (s)',max,setMax,10,180]].map(([label,value,set,low,high])=><label key={String(label)} className="text-xs">{String(label)}<input type="number" className={field} value={Number(value)} min={Number(low)} max={Number(high)} onChange={e=>(set as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))}/></label>)}</div>}
      <label className="block text-xs">Nội dung muốn chọn<input className={field} maxLength={2000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ví dụ: các đoạn giải thích rõ, giữ slide và mặt giảng viên"/></label>
      <div className="grid gap-4 md:grid-cols-2"><div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={captions} onChange={e=>setCaptions(e.target.checked)}/>Phụ đề từ lời nói</label><select aria-label="Phong cách phụ đề" className={`${field} mt-2`} value={captionStyle} onChange={e=>setCaptionStyle(e.target.value)}>{['karaoke','classic','neon','pop','box'].map(s=><option key={s}>{s}</option>)}</select></div><div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hookEnabled} onChange={e=>setHookEnabled(e.target.checked)}/>Thêm hook bám nội dung</label><input className={`${field} mt-2`} aria-label="Nội dung hook" value={hook} maxLength={300} onChange={e=>setHook(e.target.value)} placeholder="Bỏ trống để AI đề xuất"/><select aria-label="Phong cách hook" className={`${field} mt-2`} value={hookStyle} onChange={e=>setHookStyle(e.target.value)}>{['pill','classic','dark','yellow','red','outline','outline_yellow'].map(s=><option key={s}>{s}</option>)}</select></div></div>
      <details className="rounded-xl border border-newBgLineColor p-4"><summary className="cursor-pointer text-sm font-semibold">Âm thanh, thiết kế và tinh chỉnh</summary><div className="mt-3 space-y-3">
        <label className="block text-xs">Âm thanh<select className={field} value={audio} onChange={e=>setAudio(e.target.value)}><option value="keep">Giữ tiếng gốc</option><option value="mute">Tắt âm thanh</option><option value="mix-narration">Trộn giọng đọc với tiếng gốc</option><option value="replace-narration">Thay tiếng gốc bằng giọng đọc</option></select></label>
        {audio.includes('narration')&&<><label className="block text-xs">Giọng đọc<select className={field} value={voice} onChange={e=>setVoice(e.target.value)}>{['Thuyết Minh','Chị gái','Giọng dạy','HTH','Adam','vi-VN-HoaiMyNeural','vi-VN-NamMinhNeural'].map(v=><option key={v}>{v}</option>)}</select></label><textarea aria-label="Nội dung giọng đọc" className={field} maxLength={1500} rows={3} value={narration} onChange={e=>setNarration(e.target.value)} placeholder="Nhập lời thuyết minh…"/></>}
        <label className="block text-xs">Nhạc nền từ kho media<select className={field} value={bgm} onChange={e=>setBgm(e.target.value)}><option value="">Không thêm nhạc</option>{studio.media.filter(m=>/\.(mp3|wav|m4a|ogg)(\?|$)/i.test(m.path)).map(m=><option key={m.id} value={m.id}>{m.originalName||m.id}</option>)}</select></label>
        <textarea aria-label="Yêu cầu thiết kế và hiệu ứng" className={field} value={brief} maxLength={4000} rows={3} onChange={e=>setBrief(e.target.value)} placeholder="Ví dụ: punch-in nhẹ ở ý quan trọng, màu sáng hơn, giữ slide rõ…"/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoZoom} onChange={e=>setAutoZoom(e.target.checked)}/>Tự zoom vào ý quan trọng</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)}/>Thiết kế chuyển động và bảng tên</label>
        {motion&&<div className="grid gap-3 md:grid-cols-2"><label className="text-xs">Phong cách<select className={field} value={theme} onChange={e=>setTheme(e.target.value)}><option value="clean">Rõ ràng</option><option value="bold">Nổi bật</option><option value="minimal">Tối giản</option></select></label><label className="text-xs">Chuyển cảnh<select className={field} value={transition} onChange={e=>setTransition(e.target.value)}><option value="none">Không thêm</option><option value="fade">Mờ dần</option><option value="slide">Trượt nhẹ</option></select></label><input className={field} aria-label="Nội dung bảng tên" value={lowerThird} maxLength={300} onChange={e=>setLowerThird(e.target.value)} placeholder="Tên người nói hoặc thương hiệu…"/></div>}
        <label className="block text-xs">Hiệu ứng nhấn mạnh<select className={field} value={effect} onChange={e=>setEffect(e.target.value)}>{[['','Theo yêu cầu thiết kế'],['punch_in','Phóng gần nhẹ'],['zoom_in','Zoom chậm'],['zoom_pulse','Zoom theo nhịp'],['color_pop','Tăng màu'],['bw_moment','Đen trắng'],['flash','Chớp sáng'],['vignette','Tối viền']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
        {effect&&<div className="grid grid-cols-3 gap-3"><label className="text-xs">Bắt đầu (s)<input type="number" min={0} className={field} value={effectStart} onChange={e=>setEffectStart(Number(e.target.value))}/></label><label className="text-xs">Kết thúc (s)<input type="number" min={0.1} className={field} value={effectEnd} onChange={e=>setEffectEnd(Number(e.target.value))}/></label><label className="text-xs">Mức độ<input type="range" min={0} max={1} step={0.01} className="mt-3 w-full accent-emerald-500" value={effectStrength} onChange={e=>setEffectStrength(Number(e.target.value))}/></label></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manualCrop} onChange={e=>setManualCrop(e.target.checked)}/>Chỉnh tâm khung theo cảnh</label>
        {manualCrop&&<div className="grid gap-3 md:grid-cols-2"><label className="text-xs">Số cảnh (bắt đầu từ 0)<input type="number" min={0} max={99999} className={field} value={cropScene} onChange={e=>setCropScene(Number(e.target.value))}/></label><label className="text-xs">Tâm khung: {Math.round(cropCenter*100)}%<input type="range" min={0} max={1} step={0.01} className="mt-3 w-full accent-emerald-500" value={cropCenter} onChange={e=>setCropCenter(Number(e.target.value))}/></label></div>}
      </div></details>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewBeforeRender} onChange={e=>setReviewBeforeRender(e.target.checked)}/>Duyệt các đoạn AI chọn trước khi xuất video</label>
      <button type="button" className={`${primary} w-full`} disabled={disabled||(!editing && !(sourceMode==='url'?url.trim():source?.id))} onClick={submit}>{studio.busy?'Đang xử lý…':editing?'Phân tích phiên bản chỉnh sửa':reviewBeforeRender?'Phân tích & đề xuất clip':'Phân tích & xuất video'}</button>
      {editing&&<button type="button" className={action} onClick={()=>setEditing(undefined)}>Bỏ chỉnh clip {editing.title}</button>}
    </fieldset>
    {['start','revise','retry','approve'].includes(studio.busy)&&!studio.active&&<AiWaitStream kind="video" title={studio.busy==='approve'?'Đang gửi duyệt & bắt đầu xuất':'Đang khởi tạo xử lý video'} label="Đang gửi yêu cầu…" expectedSeconds={15} compact className="mt-5"/>}
    {studio.job&&<section aria-live="polite" className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"><SourceProgress studio={studio}/>{studio.active&&<button type="button" className={`${action} mt-3`} disabled={!!studio.busy} onClick={()=>void studio.cancel()}>Hủy xử lý</button>}{videoWarningsVi(studio.job.warnings).map(w=><p key={w} className="mt-2 text-xs text-textColor/60">{w}</p>)}</section>}
    {studio.job?.status==='awaiting_approval'&&studio.job.stage!=='approved'&&studio.job.plan&&<section className="mt-5 space-y-4 rounded-xl border border-emerald-500/30 p-4"><h3 className="font-semibold">Duyệt kế hoạch cắt video</h3><p className="text-xs text-textColor/60">Chọn clip muốn xuất, chỉnh tiêu đề và các đoạn theo giây của video nguồn. Hook do AI chọn chỉ hiển thị để tham khảo.</p>{studio.job.plan.clips.map(original=>{const clip=reviewClips.find(c=>c.clipId===original.clipId);return <article key={original.clipId} className="space-y-2 rounded-lg border border-newBgLineColor p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!clip} onChange={e=>setReviewClips(current=>e.target.checked?[...current,original]:current.filter(c=>c.clipId!==original.clipId))}/>{original.title} · {original.aspectRatio}</label>{clip&&<><input className={field} aria-label="Tiêu đề clip đề xuất" value={clip.title} maxLength={300} onChange={e=>setReviewClips(current=>current.map(c=>c.clipId===clip.clipId?{...c,title:e.target.value}:c))}/>{clip.segments.map((segment,index)=><div key={index} className="grid grid-cols-2 gap-3"><label className="text-xs">Từ giây<input type="number" className={field} min={0} step={0.1} value={segment.startSeconds} onChange={e=>setReviewClips(current=>current.map(c=>c.clipId===clip.clipId?{...c,segments:c.segments.map((s,i)=>i===index?{...s,startSeconds:Number(e.target.value)}:s)}:c))}/></label><label className="text-xs">Đến giây<input type="number" className={field} min={0.1} step={0.1} value={segment.endSeconds} onChange={e=>setReviewClips(current=>current.map(c=>c.clipId===clip.clipId?{...c,segments:c.segments.map((s,i)=>i===index?{...s,endSeconds:Number(e.target.value)}:s)}:c))}/></label></div>)}</>}{original.content?<SourceClipContent content={original.content}/>:clip?.hook?.text&&<p className="text-xs text-textColor/60">Hook: {clip.hook.text}</p>}</article>})}<button type="button" className={primary} disabled={!!studio.busy||!reviewClips.length} onClick={()=>void studio.approve(reviewClips)}>Duyệt & xuất {reviewClips.length} clip</button></section>}
    {finished&&<section className="mt-5 space-y-4"><h3 className="font-semibold">Clip đã lưu vào kho media</h3><div className="grid gap-4 md:grid-cols-2">{studio.job!.clips.map(clip=><article key={clip.clipId} className="rounded-xl border border-newBgLineColor p-3"><video src={clip.media.path} controls playsInline preload="metadata" className="mx-auto max-h-72 rounded-lg"/><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(clip.clipId)} onChange={e=>setChosen(current=>e.target.checked?[...current,clip.clipId]:current.filter(id=>id!==clip.clipId))}/>{clip.title} · {Math.round(clip.durationSeconds)}s</label>{clip.content?.title&&<p className="mt-2 text-sm font-semibold">{clip.content.title}</p>}{clip.content?.selectionRationale&&<p className="mt-1 text-xs text-textColor/60">Lý do chọn: {clip.content.selectionRationale}</p>}<div className="mt-3 flex gap-2"><a className={action} href={clip.media.path} download target="_blank" rel="noreferrer">Tải MP4</a><button type="button" className={action} onClick={()=>loadClip(clip)}>Chỉnh clip</button></div></article>)}</div><div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={!chosen.length} onClick={()=>{const selected=studio.job!.clips.filter(c=>chosen.includes(c.clipId));onChange(selected.map(({media:{id,path}})=>({id,path})),selected.find(c=>c.content?.postText?.trim())?.content?.postText);close();}}>Đính kèm {chosen.length} clip vào Agent</button><SourceDownload jobId={studio.job!.jobId} kind="download-all" label="Tải tất cả ZIP"/><SourceDownload jobId={studio.job!.jobId} kind="transcript" label="Tải transcript"/></div></section>}
    <details className="mt-5 rounded-xl border border-newBgLineColor p-4"><summary className="cursor-pointer text-sm">Lịch sử dự án</summary><div className="mt-3 space-y-2">{studio.history.length===0&&<p className="text-xs text-textColor/50">Chưa có dự án.</p>}{studio.history.map(job=><button type="button" className={`${action} block w-full text-left`} key={job.jobId} onClick={()=>{studio.setJobId(job.jobId);setEditing(undefined);setChosen([]);}}>{job.clips?.[0]?.title||job.projectId.slice(0,8)} · v{job.revision} · {stages[job.stage]||job.status}</button>)}</div></details>
  </div>;
};

const pct=(value?:number)=>typeof value==='number'?String(Math.round(value*10)/10):'–';
const SourceClipContent=({content}:{content:SourceStudioClipContent})=>{
  const [copied,setCopied]=useState(false);
  const decision=content.grounding?.hookDecision;
  const pattern=typeof decision?.pattern==='string'?decision.pattern:decision?.pattern?.template||decision?.pattern?.category;
  const tags=(content.hashtags||[]).map(t=>t.startsWith('#')?t:`#${t}`);
  const caption=[content.postText?.trim(),tags.filter(t=>!content.postText?.includes(t)).join(' ')].filter(Boolean).join('\n\n');
  const copy=async()=>{try{await navigator.clipboard.writeText(caption);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setCopied(false);}};
  return <div className="space-y-2 rounded-lg bg-emerald-500/5 p-3 text-xs">
    {content.title&&<p className="text-sm font-semibold">{content.title}</p>}
    {content.hook&&<p><span className="font-semibold text-emerald-500">Hook: </span>{content.hook}</p>}
    {!!decision?.candidates?.length&&<details className="rounded-lg border border-newBgLineColor px-3 py-2"><summary className="cursor-pointer font-medium">3 phương án hook{pattern?` · Mẫu: ${pattern}`:''}{decision.contentKind?` · ${decision.contentKind}`:''}</summary><ul className="mt-2 space-y-2">{decision.candidates.map((c,i)=>{const id=c.pattern_id??c.patternId;const picked=c.text===content.hook;const sc={...c,...c.scores};return <li key={i} className={`rounded-lg p-2 ${picked?'border border-emerald-500/40 bg-emerald-500/10':'bg-newBgColorInner'}`}><p className="text-sm">{c.text}{picked&&<span className="ms-2 text-emerald-500">✓ Đã chọn</span>}</p><p className="mt-1 text-textColor/60">Tò mò {pct(sc.curiosity)} · Cụ thể {pct(sc.specificity)} · Trung thực {pct(sc.truthfulness)} · Phù hợp {pct(sc.fit)}{id!=null?` · Mẫu #${id}`:''}</p></li>;})}</ul></details>}
    {caption&&<div><div className="flex items-center justify-between gap-2"><span className="font-semibold">Caption đăng bài</span><button type="button" className="rounded-lg border border-newBgLineColor px-2 py-1 hover:bg-boxHover" onClick={()=>void copy()}>{copied?'Đã sao chép':'Sao chép'}</button></div><p className="mt-1 whitespace-pre-wrap text-textColor/80">{caption}</p></div>}
    {content.narration?.text&&<p><span className="font-semibold">Lời thuyết minh: </span>{content.narration.text}</p>}
    {content.selectionRationale&&<p className="text-textColor/60">Lý do chọn: {content.selectionRationale}</p>}
    {videoWarningsVi(content.warnings).map(w=><p key={w} className="text-amber-500">{w}</p>)}
  </div>;
};

const SourceProgress=({studio}:{studio:ReturnType<typeof useSourceVideoStudio>})=>{
  const job=studio.job!,progress=useSourceProgress(job)!,failure=job.status==='failed'?describeSourceError(job.error):undefined;
  const running=studio.active&&job.status!=='awaiting_approval';
  return <>
    {running?<AiWaitStream key={`${job.jobId}-${job.revision}`} kind="video" title={job.revision>1?'AI đang dựng phiên bản chỉnh sửa':'AI đang xử lý video'} percent={progress.percent}
      label={`${stages[job.stage]||'Đang xử lý video'} · Phiên bản ${job.revision}${progress.eta?` · ${progress.eta}`:''}`} steps={[...SOURCE_STEPS]} step={progress.step}/>
    :<>
    <ol aria-label="Các bước xử lý" className="mb-3 flex flex-wrap items-center gap-2 text-xs">{SOURCE_STEPS.map((label,index)=><li key={label} aria-current={index===progress.step?'step':undefined} className={`rounded-full px-3 py-1 ${index<progress.step?'bg-emerald-500/20 text-emerald-600':index===progress.step?(failure?'bg-red-500/15 text-red-500':'bg-emerald-600 text-white'):'bg-newBgLineColor/40 text-textColor/50'}`}>{index+1}. {label}</li>)}</ol>
    <p className="text-sm">{stages[job.stage]||'Đang xử lý video'} · {progress.percent}% · Phiên bản {job.revision}</p>
    <progress className="mt-3 h-2 w-full accent-emerald-500" max={100} value={progress.percent}/>
    </>}
    {studio.active&&job.status!=='awaiting_approval'&&<p className="mt-2 text-xs text-textColor/60">Đã chạy {formatElapsed(progress.elapsed)}{progress.eta?` · ${progress.eta}`:''}{studio.disconnected?' · Đang kết nối lại…':''}</p>}
    {(failure||job.status==='cancelled')&&<div role={failure?'alert':undefined} className={`mt-3 space-y-2 rounded-xl p-3 text-sm ${failure?'bg-red-500/10 text-red-500':'bg-newBgLineColor/30'}`}>{failure?<p>{failure.text}</p>:<p>Tác vụ đã được hủy.</p>}{failure?.detail&&<details className="text-xs text-textColor/60"><summary className="cursor-pointer">Chi tiết kỹ thuật</summary><p className="mt-1 break-words">{failure.detail}</p></details>}{studio.canRetry&&<button type="button" className={action} disabled={!!studio.busy} onClick={()=>void studio.retry()}>{studio.busy==='retry'?'Đang tạo lại…':'Thử lại với cùng cấu hình'}</button>}</div>}
  </>;
};
const SourceDownload=({jobId,kind,label}:{jobId:string;kind:'download-all'|'transcript';label:string})=>{
  const fetch=useFetch();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const download=async()=>{
    setBusy(true);setError('');
    try{
      const response=await fetch(`/ai-video/source-jobs/${jobId}/${kind}`);
      if(!response.ok)throw new Error('Không tải được tệp.');
      const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`${jobId}.${kind==='transcript'?'json':'zip'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
    }catch(e){setError(e instanceof Error?e.message:'Không tải được tệp.');}finally{setBusy(false);}
  };
  return <span><button type="button" className={action} disabled={busy} onClick={()=>void download()}>{busy?'Đang tải…':label}</button>{error&&<span role="alert" className="block text-xs text-red-500">{error}</span>}</span>;
};
