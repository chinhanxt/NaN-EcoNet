'use client';
import { FC, useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useAiVideoJobStatus } from './ai-video-studio.state';
import { PIPELINE_STEPS, describeStudioError, formatElapsed, useStudioProgress } from './ai-video-studio.progress';
import { AiWaitStream } from '@gitroom/frontend/components/ui/ai.wait.stream';
import { SOURCE_STEPS, describeSourceError, useSourceProgress, useSourceVideoStatus } from './source-video.state';

type JobKind = 'idea' | 'source';
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const SOURCE_TOOLS = /sourceVideo|editVideoClip|approveSourceVideo|cancelSourceVideo/i;
const VIDEO_TOOLS = /aiVideo|AiVideo|sourceVideo|editVideoClip/i;

/** Video jobs an assistant message started or reported (job ids from its text and tool calls), newest kind guess first. */
export const agentMessageJobs = (text: string, toolNames: string[], toolArgs: string): { jobId: string; kind: JobKind }[] => {
  const mentionsVideo = toolNames.some((name) => VIDEO_TOOLS.test(name)) || /video|clip/i.test(text);
  if (!mentionsVideo) return [];
  const kind: JobKind = toolNames.some((name) => SOURCE_TOOLS.test(name)) || /video gốc|video nguồn|source video|clip/i.test(text) ? 'source' : 'idea';
  const ids = [...new Set(`${text}\n${toolArgs}`.match(UUID) || [])].map((id) => id.toLowerCase());
  return ids.slice(0, 3).map((jobId) => ({ jobId, kind }));
};

const useRequest = () => {
  const fetch = useFetch();
  return useCallback(async <T,>(url: string): Promise<T> => {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw Object.assign(new Error(data?.message || 'Không thể kết nối máy chủ.'), { status: response.status });
    return data;
  }, [fetch]);
};

const Card: FC<{
  title: string; label: string; percent: number; status: string; elapsed: number; eta?: string;
  steps?: readonly string[]; step?: number; error?: { text: string; detail?: string }; videoUrl?: string; note?: string;
}> = ({ title, label, percent, status, elapsed, eta, steps, step = 0, error, videoUrl, note }) => {
  const done = status === 'completed', failed = status === 'failed' || status === 'cancelled';
  return (
    <div role="status" className="mt-1 max-w-[520px] rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className={`shrink-0 font-mono text-[11px] ${failed ? 'text-red-500' : 'text-textColor/60'}`}>
          {done ? '100%' : failed ? (status === 'cancelled' ? 'Đã huỷ' : 'Lỗi') : `${percent}% · ${formatElapsed(elapsed)}${eta ? ` · còn ~${eta}` : ''}`}
        </span>
      </div>
      <p className="mt-1 text-xs text-textColor/70">{failed && error ? error.text : label}</p>
      {!failed && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-500/10" role="progressbar" aria-valuenow={done ? 100 : percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${done ? 100 : Math.max(2, percent)}%` }} />
        </div>
      )}
      {steps && !failed && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {steps.map((name, index) => (
            <span key={name} className={`rounded-full px-2 py-0.5 text-[10px] ${done || index < step ? 'bg-emerald-500 text-white' : index === step ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-textColor/5 text-textColor/50'}`}>{name}</span>
          ))}
        </div>
      )}
      {note && <p className="mt-2 text-xs text-textColor/70">{note}</p>}
      {failed && error?.detail && <p className="mt-1 text-[11px] text-textColor/50">{error.detail}</p>}
      {done && videoUrl && <video src={videoUrl} controls preload="metadata" className="mt-3 max-h-[360px] w-full rounded-xl bg-black" />}
    </div>
  );
};

const IdeaJobCard: FC<{ jobId: string; onMissing: () => void }> = ({ jobId, onMissing }) => {
  const request = useRequest();
  const { data, error } = useAiVideoJobStatus(jobId, request);
  const progress = useStudioProgress(data, 'idea', 6, jobId);
  if ((error as any)?.status === 404) { onMissing(); return null; }
  if (!data || !progress) return <AiWaitStream kind="video" title="Tạo video AI" label="Đang lấy tiến trình…" percent={1} className="mt-1" />;
  if (!['completed', 'failed', 'cancelled'].includes(data.status))
    return <AiWaitStream kind="video" title="Tạo video AI" percent={progress.percent} label={`${progress.label}${progress.eta ? ` · còn ~${progress.eta}` : ''}`}
      steps={PIPELINE_STEPS.map((step) => step.label)} step={Math.max(0, progress.step)} className="mt-1" />;
  return (
    <Card title="Tạo video AI" label={progress.label} percent={progress.percent} status={data.status} elapsed={progress.elapsed}
      eta={progress.eta} steps={PIPELINE_STEPS.map((step) => step.label)} step={Math.max(0, progress.step)}
      error={data.status === 'failed' || data.status === 'cancelled' ? describeStudioError(data.error) : undefined}
      videoUrl={data.media?.path} />
  );
};

const SourceJobCard: FC<{ jobId: string; onMissing: () => void }> = ({ jobId, onMissing }) => {
  const request = useRequest();
  const orgId = useUser()?.orgId;
  const { data, error } = useSourceVideoStatus(jobId, request, orgId);
  const progress = useSourceProgress(data);
  if ((error as any)?.status === 404) { onMissing(); return null; }
  if (!data || !progress) return <AiWaitStream kind="video" title="Chỉnh video" label="Đang lấy tiến trình…" percent={1} className="mt-1" />;
  if (!['completed', 'failed', 'cancelled', 'awaiting_approval'].includes(data.status))
    return <AiWaitStream kind="video" title="Chỉnh video từ video gốc" percent={progress.percent} label={`${data.stage || data.status}${progress.eta ? ` · còn ~${progress.eta}` : ''}`}
      steps={[...SOURCE_STEPS]} step={progress.step} className="mt-1" />;
  const clip = data.clips?.[0]?.media?.path;
  return (
    <Card title="Chỉnh video từ video gốc" label={data.status === 'awaiting_approval' ? 'Đã có kế hoạch cắt, đang chờ bạn duyệt' : data.stage || data.status}
      percent={progress.percent} status={data.status} elapsed={progress.elapsed} eta={progress.eta} steps={SOURCE_STEPS} step={progress.step}
      error={data.status === 'failed' || data.status === 'cancelled' ? describeSourceError(data.error) : undefined}
      note={data.status === 'awaiting_approval' ? 'Trả lời "duyệt" trong chat để bắt đầu render.' : data.status === 'completed' && data.clips.length > 1 ? `${data.clips.length} clip đã lưu vào kho media.` : undefined}
      videoUrl={clip} />
  );
};

/** One live card per video job: polls the job, falls back to the other job type when the id is not found there. */
const JobCard: FC<{ jobId: string; kind: JobKind }> = ({ jobId, kind }) => {
  // The guessed job type first, then the other one; neither knows the id → no card.
  const order: JobKind[] = kind === 'idea' ? ['idea', 'source'] : ['source', 'idea'];
  const [attempt, setAttempt] = useState(0);
  // Called while the child renders a 404: the switch happens on the next tick.
  const current = order[attempt];
  // Re-renders of the same 404 advance at most one step.
  const missing = useCallback(() => { setTimeout(() => setAttempt((value) => (value === attempt ? value + 1 : value)), 0); }, [attempt]);
  if (!current) return null;
  return current === 'idea' ? <IdeaJobCard key="idea" jobId={jobId} onMissing={missing} /> : <SourceJobCard key="source" jobId={jobId} onMissing={missing} />;
};

export const AgentJobProgress: FC<{ jobs: { jobId: string; kind: JobKind }[] }> = ({ jobs }) => (
  <>{jobs.map((job) => <JobCard key={job.jobId} {...job} />)}</>
);

