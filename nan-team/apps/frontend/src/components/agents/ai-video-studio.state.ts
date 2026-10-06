'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { StudioJobKind, studioPollInterval, TERMINAL_STATUSES } from './ai-video-studio.progress';

export type StudioVoice =
  | 'vi-VN-HoaiMyNeural'
  | 'vi-VN-NamMinhNeural'
  | 'Thuyết Minh'
  | 'Chị gái'
  | 'Giọng dạy'
  | 'HTH'
  | 'Adam';

export type StudioAspectRatio = '9:16' | '16:9' | '1:1';

export interface StudioScene {
  sceneIndex: number;
  voiceText: string;
  imagePrompt: string;
  keywordHighlight: string;
  imageUrl: string;
}
export interface StudioStoryboard {
  theme?: {style?:string;subtitleStyle?:string;primaryColor?:string;accentColor?:string;showBadge?:boolean;showProgressBar?:boolean};
  title: string;
  visualDna: string;
  scenes: StudioScene[];
  grounding?: { facts?: Array<{ claim: string; basis: string; verified?: boolean }> } | null;
  hook?: {
    kind?: string; chosen?: string; chosenPatternId?: number | null;
    pattern?: { category?: string; template?: string } | null;
    candidates?: Array<{ text: string; patternId?: number; scores?: { curiosity?: number; specificity?: number; truthfulness?: number; fit?: number } }>;
  } | null;
}
export interface StudioMedia { id: string; path: string }
export interface StudioPreview {
  title: string; hook?: string; facts: Array<{ claim: string; basis: string; verified?: boolean }>;
  scenes: Array<{ sceneIndex: number; voiceText: string; keywordHighlight: string; imageUrl?: string }>;
}
export interface StudioJob {
  jobId: string;
  status: string;
  progress: number;
  stage?: string;
  media?: StudioMedia;
  error?: string;
  preview?: StudioPreview;
  resumable?: boolean;
  warnings?: string[];
  /** Final result of a storyboard-only job, which completes without media. */
  storyboard?: StudioStoryboard;
}
interface IdeaRequest { topic: string; targetDuration: 15 | 30 | 60; voice: StudioVoice; aspectRatio: StudioAspectRatio; seedImageUrl?: string }

/**
 * The last idea job per organisation, so reopening the studio reconnects to a job that kept running
 * (or just finished) after the dialog was closed. Browser storage may be unavailable: every access is guarded.
 */
const REMEMBERED_JOB_TTL_MS = 6 * 3600_000;
interface RememberedJob { jobId: string; request: IdeaRequest; savedAt: number }
const rememberedJobKey = (orgId?: string) => orgId ? `nan-ai-video-idea-job:${orgId}` : undefined;
const readRememberedJob = (orgId?: string): RememberedJob | undefined => {
  const key = rememberedJobKey(orgId);
  if (!key) return undefined;
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null') as RememberedJob | null;
    if (!value?.jobId || !value.request?.topic || Date.now() - value.savedAt > REMEMBERED_JOB_TTL_MS) return undefined;
    return value;
  } catch { return undefined; }
};
const writeRememberedJob = (orgId: string | undefined, value: RememberedJob | undefined) => {
  const key = rememberedJobKey(orgId);
  if (!key) return;
  try {
    if (value) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  } catch { /* storage blocked: reconnecting is a convenience only */ }
};

/** Normalizes backend states: cancel ends as failed+cancelled, and completion waits for the saved media. */
const normalizeJob = (next: StudioJob): StudioJob => {
  const job = { ...next, progress: Math.max(0, Math.min(100, Number(next.progress) || 0)) };
  if (job.stage === 'cancelled' || (job.status === 'failed' && /cancell?ed/i.test(job.error || ''))) job.status = 'cancelled';
  if (job.status === 'completed' && !job.storyboard && (!job.media?.id || !job.media?.path)) { job.status = 'rendering'; job.stage = 'saving-media'; }
  return job;
};

/** Polls one studio job; the interval adapts to the stage and stops once the job is finished. */
export const useAiVideoJobStatus = (jobId: string | undefined, request: <T>(url: string) => Promise<T>) =>
  useSWR<StudioJob>(jobId ? ['/ai-video/status', jobId] : null,
    async ([, id]: [string, string]) => {
      const next = await request<StudioJob>(`/ai-video/status/${encodeURIComponent(id)}`);
      if (!next?.jobId || typeof next.status !== 'string') throw new Error('Chưa nhận được trạng thái hợp lệ. Đang thử lại…');
      return normalizeJob(next);
    },
    // refreshInterval must keep one identity: SWR restarts its polling timer whenever it changes, and the
    // studio re-renders every second (progress tick), so an inline arrow cancelled every 2-5s poll.
    { refreshInterval: studioPollInterval, revalidateOnFocus: true, dedupingInterval: 1000, errorRetryInterval: 4000 });

export const useAiVideoStudio = (initialTopic: string) => {
  const fetch = useFetch();
  const orgId = useUser()?.orgId;
  const [topic, setTopic] = useState(initialTopic);
  const [targetDuration, setTargetDuration] = useState<15 | 30 | 60>(30);
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>('9:16');
  const [voice, setVoice] = useState<StudioVoice>('Thuyết Minh');
  const [seed, setSeed] = useState<StudioMedia>();
  const [storyboard, setStoryboard] = useState<StudioStoryboard>();
  const [jobId, setJobId] = useState<string>();
  const [jobKind, setJobKind] = useState<StudioJobKind>();
  const [ideaRequest, setIdeaRequest] = useState<IdeaRequest>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [audio, setAudio] = useState<{ index: number; url: string; seconds: number }>();
  const controllers = useRef(new Set<AbortController>());
  const mounted = useRef(true);
  const locked = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllers.current.forEach((controller) => controller.abort());
      controllers.current.clear();
    };
  }, []);

  const request = useCallback(async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (controller.signal.aborted || !mounted.current) throw new DOMException('Aborted', 'AbortError');
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted || !mounted.current) throw new DOMException('Aborted', 'AbortError');
      if (!response.ok) {
        const message = data?.message || data?.error;
        throw new Error(Array.isArray(message) ? message.join(', ') : message || `Yêu cầu thất bại (${response.status}). Vui lòng thử lại.`);
      }
      if (!data) throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.');
      return data as T;
    } finally {
      controllers.current.delete(controller);
    }
  }, [fetch]);

  const run = async (label: string, action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(label);
    setError('');
    try { await action(); }
    catch (failure) {
      if (mounted.current && !(failure instanceof DOMException && failure.name === 'AbortError')) {
        setError(failure instanceof Error ? failure.message : 'Không thể hoàn tất. Vui lòng thử lại.');
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy('');
    }
  };

  // Reopened studio: reconnect to the organisation's last idea job if the backend still knows it.
  useEffect(() => {
    const remembered = readRememberedJob(orgId);
    if (!remembered) return;
    let active = true;
    request<StudioJob>(`/ai-video/status/${encodeURIComponent(remembered.jobId)}`).then((found) => {
      if (!active || !found?.jobId || locked.current) return;
      const body = remembered.request;
      setTopic(body.topic); setTargetDuration(body.targetDuration); setVoice(body.voice); setAspectRatio(body.aspectRatio);
      setIdeaRequest(body); setJobKind('idea'); setJobId(found.jobId);
    }, (failure) => {
      if (active && !(failure instanceof DOMException)) writeRememberedJob(orgId, undefined);
    });
    return () => { active = false; };
    // Runs once per organisation; request is stable for the hook's lifetime.
  }, [orgId]);

  useEffect(() => {
    if (jobKind === 'idea' && jobId && ideaRequest) writeRememberedJob(orgId, { jobId, request: ideaRequest, savedAt: Date.now() });
  }, [orgId, jobKind, jobId, ideaRequest]);

  const status = useAiVideoJobStatus(jobId, request);
  const job: StudioJob | undefined = jobId ? (status.data?.jobId === jobId ? status.data : { jobId, status: 'queued', progress: 0, stage: 'queued' }) : undefined;
  const activeJobId = job && !TERMINAL_STATUSES.has(job.status) ? job.jobId : undefined;
  // Transient poll failures while the job runs are shown softly; the poll keeps retrying.
  const reconnecting = !!activeJobId && !!status.error && !(status.error instanceof DOMException);

  const startJob = (id: string, kind: StudioJobKind) => {
    setAudio(undefined);
    setJobKind(kind);
    setJobId(id);
  };

  const uploadSeed = (file: File) => run('upload', async () => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      throw new Error('Chọn ảnh JPG, PNG, WebP hoặc GIF tối đa 20 MB.');
    }
    const form = new FormData();
    form.append('file', file);
    const media = await request<StudioMedia>('/media/upload-simple', { method: 'POST', body: form });
    if (!media.id || !media.path) throw new Error('Ảnh chưa được lưu. Vui lòng tải lên lại.');
    setSeed(media);
  });

  const startStoryboard = async (body: IdeaRequest, resumeJobId?: string) => {
    const result = await request<{ jobId: string }>('/ai-video/generate-storyboard-job', {
      method: 'POST', body: JSON.stringify({ ...body, ...(resumeJobId ? { resumeJobId } : {}) }),
    });
    if (!result.jobId) throw new Error('Máy chủ chưa nhận tác vụ tạo storyboard. Vui lòng thử lại.');
    startJob(result.jobId, 'storyboard');
  };

  /** Storyboard for review runs as a backend job: the script, then each scene image, appear as they finish. */
  const generate = () => run('storyboard', async () => {
    if (!topic.trim()) throw new Error('Nhập ý tưởng cho video trước khi tạo storyboard.');
    const body: IdeaRequest = { topic: topic.trim(), targetDuration, voice, aspectRatio, ...(seed?.path ? { seedImageUrl: seed.path } : {}) };
    setStoryboard(undefined);
    setIdeaRequest(body);
    await startStoryboard(body);
  });

  // A finished storyboard job hands its result to the editable review step.
  const finishedStoryboard = jobKind === 'storyboard' && job?.status === 'completed' ? job.storyboard : undefined;
  useEffect(() => {
    if (!finishedStoryboard) return;
    if (!finishedStoryboard.title || !Array.isArray(finishedStoryboard.scenes) || !finishedStoryboard.scenes.length || finishedStoryboard.scenes.some((scene) =>
      typeof scene.voiceText !== 'string' || typeof scene.imagePrompt !== 'string' || typeof scene.imageUrl !== 'string'
    )) setError('Storyboard chưa đầy đủ. Vui lòng tạo lại.');
    else setStoryboard(finishedStoryboard);
    setAudio(undefined);
    setJobId(undefined);
    setJobKind(undefined);
  }, [finishedStoryboard]);

  const startIdea = async (body: IdeaRequest, resumeJobId?: string) => {
    const result = await request<{ jobId: string }>('/ai-video/generate', {
      method: 'POST', body: JSON.stringify({ ...body, ...(resumeJobId ? { resumeJobId } : {}) }),
    });
    if (!result.jobId) throw new Error('Máy chủ chưa nhận tác vụ tạo video. Vui lòng thử lại.');
    startJob(result.jobId, 'idea');
  };

  /** One-shot idea→video: script, images, voice and render run as one backend job with live preview. */
  const generateVideo = () => run('idea', async () => {
    if (!topic.trim()) throw new Error('Nhập ý tưởng cho video trước khi tạo.');
    const body: IdeaRequest = { topic: topic.trim(), targetDuration, voice, aspectRatio, ...(seed?.path ? { seedImageUrl: seed.path } : {}) };
    setStoryboard(undefined);
    setIdeaRequest(body);
    await startIdea(body);
  });

  /** Retries a failed/cancelled job: idea jobs resume from the saved script and images when possible. */
  const retry = () => run('retry', async () => {
    if ((jobKind === 'idea' || jobKind === 'storyboard') && ideaRequest) {
      const start = jobKind === 'idea' ? startIdea : startStoryboard;
      if (job?.resumable) {
        try { await start(ideaRequest, job.jobId); return; }
        catch (failure) {
          if (!(failure instanceof Error) || !/No saved storyboard|Only a failed|Resume requires/i.test(failure.message)) throw failure;
        }
      }
      await start(ideaRequest);
      return;
    }
    if (jobKind === 'render') await doRender();
  });

  const resetJob = () => { setJobId(undefined); setJobKind(undefined); setError(''); writeRememberedJob(orgId, undefined); };

  const editScene = (index: number, patch: Partial<StudioScene>) => {
    setStoryboard((current) => current && ({ ...current, scenes: current.scenes.map((scene, i) => i === index ? { ...scene, ...patch } : scene) }));
    if ('voiceText' in patch) setAudio(undefined);
  };

  const regenerate = (index: number) => run(`image-${index}`, async () => {
    const scene = storyboard?.scenes[index];
    if (!scene?.imagePrompt.trim()) throw new Error('Nhập mô tả ảnh trước khi vẽ lại.');
    const result = await request<{ imageUrl: string }>('/ai-video/regenerate-image', {
      method: 'POST', body: JSON.stringify({ imagePrompt: scene.imagePrompt, visualDna: storyboard?.visualDna, aspectRatio }),
    });
    if (!result.imageUrl) throw new Error('Chưa nhận được ảnh mới. Vui lòng thử lại.');
    editScene(index, { imageUrl: result.imageUrl });
  });

  const previewVoice = (index: number) => run(`voice-${index}`, async () => {
    const text = storyboard?.scenes[index]?.voiceText.trim();
    if (!text) throw new Error('Nhập lời thoại trước khi nghe thử.');
    setAudio(undefined);
    const result = await request<{ audioUrl: string; durationInSeconds: number }>('/ai-video/preview-voice', {
      method: 'POST', body: JSON.stringify({ text, voice }),
    });
    if (!result.audioUrl) throw new Error('Chưa nhận được âm thanh. Vui lòng thử lại.');
    setAudio({ index, url: result.audioUrl, seconds: result.durationInSeconds });
  });

  const doRender = async () => {
    if (!storyboard || storyboard.scenes.some((scene) => !scene.voiceText.trim() || !scene.imageUrl || !scene.imagePrompt.trim())) {
      throw new Error('Mỗi cảnh cần có ảnh, mô tả ảnh và lời thoại trước khi render.');
    }
    const result = await request<{ jobId: string }>('/ai-video/render', {
      method: 'POST', body: JSON.stringify({ title: storyboard.title, scenes: storyboard.scenes, targetDuration, voice, aspectRatio, ...(storyboard.theme ? {theme:storyboard.theme} : {}) }),
    });
    if (!result.jobId) throw new Error('Máy chủ chưa nhận tác vụ render. Vui lòng thử lại.');
    startJob(result.jobId, 'render');
  };
  const render = () => run('render', doRender);

  const cancel = () => run('cancel', async () => {
    if (!activeJobId) return;
    const next = await request<StudioJob>(`/ai-video/${encodeURIComponent(activeJobId)}`, { method: 'DELETE' });
    await status.mutate(next?.jobId ? normalizeJob(next) : undefined, { revalidate: true });
  });

  return { topic, setTopic, targetDuration, setTargetDuration, aspectRatio, setAspectRatio, voice,
    setVoice: (value: StudioVoice) => { setVoice(value); setAudio(undefined); },
    seed, setSeed, storyboard, setStoryboard, job, busy, error, audio,
    activeJobId, jobKind, reconnecting, uploadSeed, generate, generateVideo, retry, resetJob, editScene, regenerate, previewVoice, render, cancel };
};
