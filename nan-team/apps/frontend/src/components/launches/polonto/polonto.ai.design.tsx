'use client';

import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Draw } from '@blueprintjs/icons';
import { SectionTab } from 'polotno/side-panel';
import { getImageSize } from 'polotno/utils/image';
import { useMediaPaste } from '@gitroom/frontend/components/media/use.media.paste';
import { extractPalette, fitTexts, gradientElement, harmonize, Palette } from '@gitroom/frontend/components/launches/polonto/polonto.ai.style';
import { AiCanvasDirector, PageBox, isPlaceholderSrc, placeholderSrc, posterSketch, prefersReducedMotion } from '@gitroom/frontend/components/launches/polonto/polonto.ai.cursor';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { clsx } from 'clsx';

const QUICK_PROMPTS = [
  'Sắp xếp layout cân đối',
  'Làm thiết kế chuyên nghiệp hơn',
  'Đổi tông màu xanh lá',
  'Tiêu đề nổi bật hơn',
  'Xóa nền ảnh đang chọn',
];

/** Fields sent per element; anything else (filters, crop...) stays out of the AI context. */
const ELEMENT_FIELDS = ['id', 'type', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'text', 'fontFamily',
  'fontSize', 'fontWeight', 'fill', 'align', 'src'] as const;
const MAX_ELEMENTS = 80;
// 1024 px JPEG q0.8 is enough for the model to judge layout and keeps upload + AGY frame small.
const SCREENSHOT_LONG_EDGE = 1024;

/**
 * One edit operation from POST /media/ai-design-edit. Accepted aliases: `op` or `type` for the kind,
 * `props`/`attrs` for attributes, `element` for an added element, `direction`/`to` for reorder.
 */
type DesignOp = {
  op?: string; type?: string; id?: string;
  props?: Record<string, any>; attrs?: Record<string, any>; element?: Record<string, any>;
  direction?: 'up' | 'down' | 'top' | 'bottom'; to?: 'up' | 'down' | 'top' | 'bottom';
  background?: string; value?: string; prompt?: string;
};

const serializeElements = (page: any) =>
  (page?.children || []).slice(0, MAX_ELEMENTS).map((element: any, zIndex: number) => {
    const out: Record<string, any> = { zIndex };
    for (const key of ELEMENT_FIELDS) {
      const value = element?.[key];
      if (value === undefined || value === null || value === '') continue;
      // Inline data URLs are huge and useless to the model; the screenshot shows the pixels.
      if (key === 'src' && typeof value === 'string' && value.startsWith('data:')) continue;
      // Compact prompt JSON: 2-decimal numbers, long text cut (the screenshot shows the rest).
      out[key] = typeof value === 'number' ? Math.round(value * 100) / 100
        : key === 'text' && typeof value === 'string' && value.length > 300 ? `${value.slice(0, 300)}…` : value;
    }
    return out;
  });

/** Picks only plain attributes: an op must never replace ids, types or children. */
const safeProps = (props: Record<string, any> | undefined) => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(props || {})) {
    if (['id', 'type', 'children', 'custom'].includes(key) || typeof value === 'function') continue;
    out[key] = value;
  }
  return out;
};

/** One chat turn. `snapshot` (design JSON before this AI turn applied ops) lives in memory only. */
type ChatMessage = {
  id: string; role: 'user' | 'assistant'; text: string;
  applied?: number; total?: number; undone?: boolean; error?: boolean;
  // Image(s) of this turn that could not be made: short reason + the prompt to retry with.
  imageError?: string; imagePrompt?: string;
  // Failed turn that can be sent again ("Thử lại"); a turn that painted a background can be re-laid over it.
  retryText?: string; realign?: boolean;
  // The automatic "__undo__" request is part of the history but not shown as a user bubble.
  hidden?: boolean;
  // Reference images the user pasted/dropped with this turn (media library paths).
  images?: string[];
  snapshot?: any;
};
const UNDO_INSTRUCTION = '__undo__';
const MAX_REFERENCE_IMAGES = 4;
const REFERENCE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const HISTORY_TURNS = 20;
const chatKey = (pageId?: string) => (pageId ? `nan-polotno-ai-design:${pageId}` : undefined);
const loadChat = (pageId?: string): ChatMessage[] => {
  const key = chatKey(pageId);
  if (!key) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};
const saveChat = (pageId: string | undefined, messages: ChatMessage[]) => {
  const key = chatKey(pageId);
  if (!key) return;
  try {
    // Snapshots can be large (inline images): only the text conversation is persisted.
    window.localStorage.setItem(key, JSON.stringify(messages.slice(-60).map(({ snapshot, ...rest }) => rest)));
  } catch { /* storage full or blocked: the chat still works in memory */ }
};
/** Loading card steps: analysing the page, laying out, drawing images, applying edits. */
type Phase = 'analyzing' | 'layout' | 'image' | 'finishing';
const PHASE_LABEL: Record<Phase, string> = {
  analyzing: 'Đang phân tích…', layout: 'Đang dàn bố cục…', image: 'Đang tạo ảnh…', finishing: 'Đang hoàn thiện…',
};
/** Client-side cap per image; a stalled generation must not hold the whole design. */
const IMAGE_TIMEOUT_MS = 90_000;
/** At most this many image generations run at once (the AGY image pool is small). */
const MAX_PARALLEL_IMAGES = 2;
const imageFailureText = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/image-refused|refus|policy|safety/i.test(message)) return 'nội dung bị từ chối (có thể do nhân vật/thương hiệu có bản quyền)';
  if (/timeout|quá thời gian/i.test(message)) return 'quá thời gian chờ (90 giây)';
  return message || 'lỗi không rõ';
};
/** Network failure, 5xx or a client timeout: the backend is not answering (it may have been restarted). */
const SERVER_DOWN = 'Máy chủ không phản hồi, thử lại';
const isServerDown = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return error instanceof TypeError || /timeout|failed to fetch|network|mã 5\d\d|\(5\d\d\)/i.test(message);
};
/** Client cap for one AI layout request. */
const DESIGN_TIMEOUT_MS = 90_000;
type Zone = { x: number; y: number; width: number; height: number };
/**
 * Fixed layout zones agreed BEFORE the image and the layout are made in parallel: text on top, subject in
 * the middle, CTA at the bottom (landscape: text left, subject right). The image prompt keeps the text zone plain.
 */
const layoutZones = (width: number, height: number): { text: Zone; subject: Zone; cta: Zone; promptHint: string } => {
  if (width > height * 1.1) {
    return {
      text: { x: width * 0.05, y: height * 0.1, width: width * 0.42, height: height * 0.6 },
      subject: { x: width * 0.5, y: height * 0.05, width: width * 0.47, height: height * 0.9 },
      cta: { x: width * 0.05, y: height * 0.76, width: width * 0.3, height: height * 0.14 },
      promptHint: 'ảnh nền ngang, chủ thể nằm ở nửa phải (50–95% chiều rộng), nửa trái là nền trơn/tối đơn giản để đặt chữ',
    };
  }
  return {
    text: { x: width * 0.06, y: height * 0.03, width: width * 0.88, height: height * 0.35 },
    subject: { x: 0, y: height * 0.38, width, height: height * 0.44 },
    cta: { x: width * 0.06, y: height * 0.82, width: width * 0.88, height: height * 0.13 },
    promptHint: `ảnh nền ${height > width * 1.1 ? 'dọc' : 'vuông'}, chủ thể nằm ở khoảng 40–80% chiều cao, phần trên 0–38% là nền trơn/tối đơn giản để đặt chữ`,
  };
};

/** Runs `run` with its own abort signal tied to `parent`, aborted after `ms`. */
const withTimeout = async <T,>(parent: AbortSignal, ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const local = new AbortController();
  const onAbort = () => local.abort();
  parent.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; local.abort(); }, ms);
  try {
    return await run(local.signal);
  } catch (error) {
    throw timedOut ? new Error('timeout') : error;
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', onAbort);
  }
};

const PHASE_PROGRESS: Record<Phase, string> = { analyzing: '25%', layout: '50%', image: '75%', finishing: '92%' };
const RATIOS: [string, number][] = [['1:1', 1], ['16:9', 16 / 9], ['9:16', 9 / 16], ['4:3', 4 / 3], ['3:4', 3 / 4]];
const nearestRatio = (width: number, height: number) =>
  RATIOS.reduce((best, item) => Math.abs(item[1] - width / height) < Math.abs(best[1] - width / height) ? item : best)[0];

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DesignTab = observer(({ store }: any) => {
  const fetch = useFetch();
  const toast = useToaster();
  const pageId: string | undefined = store.activePage?.id;
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [imageCount, setImageCount] = useState({ done: 0, total: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat(pageId));
  // Latest messages for async callbacks (the request reads history after awaits).
  const messagesRef = useRef(messages);
  // "Hủy": aborts the screenshot upload, the AI request and any image generation still in flight.
  const controller = useRef<AbortController | null>(null);
  const directorRef = useRef<AiCanvasDirector | null>(null);
  // Colours of the last AI background picture: drives local harmonizing and is sent with later turns.
  const paletteRef = useRef<Palette | null>(null);
  // Debug (localStorage.nanAiOverlayDebug = '1'): window.__nanAiOverlayDemo() shows the drawing overlay
  // without calling the AI; window.__nanAiOverlayStop() removes it.
  useEffect(() => {
    let debug = false;
    try { debug = window.localStorage.getItem('nanAiOverlayDebug') === '1'; } catch { /* storage blocked */ }
    if (!debug) return;
    const target = window as any;
    target.__nanAiOverlayDemo = () => {
      directorRef.current?.cancel();
      const director = new AiCanvasDirector(store);
      directorRef.current = director;
      director.sketch(posterSketch(store.activePage?.width || 540, store.activePage?.height || 675));
      return true;
    };
    target.__nanAiOverlayStop = () => { directorRef.current?.cancel(); directorRef.current = null; };
    return () => { delete target.__nanAiOverlayDemo; delete target.__nanAiOverlayStop; };
  }, [store]);

  // Unmount: the overlay always goes. If the whole editor closed (no Polotno page left) the AI request is
  // aborted too; switching side-panel tabs keeps it running (its reply is still saved to the chat).
  useEffect(() => () => {
    directorRef.current?.cancel();
    setTimeout(() => {
      if (!document.querySelector('.polotno-page-container')) controller.current?.abort();
    }, 0);
  }, []);
  const listEnd = useRef<HTMLDivElement>(null);
  // Images pasted (Ctrl+V) or dropped on the chat input, sent as referenceImages with the next turn.
  const [references, setReferences] = useState<string[]>([]);
  const [uploadingRefs, setUploadingRefs] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputArea = useRef<HTMLDivElement>(null);
  const addReferences = async (files: File[]) => {
    const images = files.filter((file) => REFERENCE_TYPES.includes(file.type));
    if (images.length < files.length) toast.show('Chỉ nhận ảnh PNG/JPG/GIF/WebP làm ảnh tham chiếu', 'warning');
    const room = MAX_REFERENCE_IMAGES - references.length - uploadingRefs;
    if (images.length > room) toast.show(`Tối đa ${MAX_REFERENCE_IMAGES} ảnh mỗi lượt`, 'warning');
    await Promise.all(images.slice(0, Math.max(0, room)).map(async (file) => {
      if (file.size > 30 * 1024 * 1024) { toast.show('Ảnh quá lớn, tối đa 30MB.', 'warning'); return; }
      setUploadingRefs((count) => count + 1);
      try {
        const form = new FormData();
        form.append('file', file, file.name && file.name !== 'image.png' ? file.name : `ai-design-ref-${Date.now()}.${file.type.split('/')[1] || 'png'}`);
        const response = await fetch('/media/upload-simple', { method: 'POST', body: form });
        const saved = response.ok ? await response.json().catch(() => null) : null;
        if (!saved?.path) throw new Error('upload failed');
        setReferences((current) => current.length < MAX_REFERENCE_IMAGES ? [...current, saved.path] : current);
      } catch {
        toast.show('Không tải lên được ảnh tham chiếu. Vui lòng thử lại.', 'warning');
      } finally {
        setUploadingRefs((count) => count - 1);
      }
    }));
  };
  useMediaPaste(inputArea, loading ? undefined : addReferences, setDragging);

  const update = (next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
    saveChat(pageId, next);
  };

  // The conversation belongs to the design page being edited.
  useEffect(() => {
    const restored = loadChat(pageId);
    messagesRef.current = restored;
    setMessages(restored);
  }, [pageId]);

  useEffect(() => { listEnd.current?.scrollIntoView({ block: 'end' }); }, [messages.length, loading]);

  /** Current page as a JPEG (~1280 px long edge) uploaded to the media library; returns its path. */
  const uploadScreenshot = async (page: any, signal: AbortSignal) => {
    const longEdge = Math.max(page?.width || 540, page?.height || 675);
    const pixelRatio = Math.min(3, Math.max(0.5, SCREENSHOT_LONG_EDGE / longEdge));
    const dataUrl: string = await store.toDataURL({ pageId: page?.id, pixelRatio, mimeType: 'image/jpeg', quality: 0.85 });
    const blob = await (await window.fetch(dataUrl)).blob();
    const form = new FormData();
    form.append('file', blob, `ai-design-${Date.now()}.jpg`);
    const response = await fetch('/media/upload-simple', { method: 'POST', body: form, signal });
    const saved = response.ok ? await response.json().catch(() => null) : null;
    if (!saved?.path) throw new Error('Không tải được ảnh chụp thiết kế lên máy chủ');
    return saved.path as string;
  };

  /** Cut-out PNG of an image already in the media library (POST /media/remove-background). */
  const removeBackground = async (path: string) => {
    const response = await fetch('/media/remove-background', {
      method: 'POST', signal: controller.current?.signal, body: JSON.stringify({ path }),
    });
    const image = response.ok ? await response.json().catch(() => null) : null;
    if (!image?.path) throw new Error('remove background failed');
    return image.path as string;
  };

  const generateImage = async (prompt: string, aspectRatio?: string, signal?: AbortSignal) => {
    const response = await fetch('/media/generate-image-with-prompt', {
      method: 'POST', signal: signal || controller.current?.signal, body: JSON.stringify({ prompt, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) }),
    });
    const image = await response.json().catch(() => null);
    // Keep the backend reason (e.g. "image-refused") for the chat bubble.
    if (!response.ok || !image?.path) throw new Error(image?.message || image?.error || image?.code || `mã ${response.status}`);
    return image.path as string;
  };

  /** Applies one op; returns false when it cannot be applied (unknown element, bad op...). */
  const applyOp = async (page: any, op: DesignOp): Promise<boolean> => {
    const kind = op.op || op.type;
    const element = op.id ? store.getElementById(op.id) : undefined;
    switch (kind) {
      case 'update': {
        const props = safeProps(op.props || op.attrs);
        if (!element || !Object.keys(props).length) return false;
        element.set(props);
        return true;
      }
      case 'add': {
        const attrs = op.element || op.props || op.attrs || {};
        // E's contract: {op:'add', type:'text'|'figure', props}; `type` may also sit inside the attrs.
        const elementType = attrs.type || (op.op ? op.type : undefined);
        if (!elementType) return false;
        // Gradient overlay (E's op): a Polotno SVG element holding a linearGradient.
        if (elementType === 'gradient') return !!page.addElement(gradientElement(safeProps(attrs)));
        page.addElement({ ...safeProps(attrs), type: elementType });
        return true;
      }
      case 'remove':
        if (!element) return false;
        store.deleteElements([element.id]);
        return true;
      case 'reorder': {
        const direction = op.direction || op.to;
        if (!element || !direction) return false;
        if (direction === 'up') element.moveUp();
        else if (direction === 'down') element.moveDown();
        else if (direction === 'top') element.moveTop();
        else if (direction === 'bottom') element.moveBottom();
        else return false;
        return true;
      }
      case 'background': {
        const background = op.background || op.value || op.props?.background;
        if (!background) return false;
        page.set({ background });
        return true;
      }
      case 'generateImage': {
        if (!op.prompt) return false;
        const attrs = safeProps(op.element || op.props || op.attrs);
        const src = await generateImage(op.prompt, attrs.aspectRatio || attrs.aspect_ratio);
        if (element) {
          element.set({ src });
          return true;
        }
        const width = attrs.width || page.width * 0.6, height = attrs.height || page.height * 0.6;
        page.addElement({ type: 'image', x: (page.width - width) / 2, y: (page.height - height) / 2, ...attrs, width, height, src });
        return true;
      }
      default:
        return false;
    }
  };

  /** Sends one turn (user text, or the automatic "__undo__" follow-up) and applies the returned ops. */
  /** Polotno relative crop that makes a picture COVER its element box (centred, no distortion). */
  const coverCrop = async (element: any, src: string) => {
    const size = await getImageSize(src).catch(() => null);
    if (!size?.width || !size?.height || !element.width || !element.height) return {};
    const imageRatio = size.width / size.height, boxRatio = element.width / element.height;
    return imageRatio > boxRatio
      ? { cropX: (1 - boxRatio / imageRatio) / 2, cropY: 0, cropWidth: boxRatio / imageRatio, cropHeight: 1 }
      : { cropX: 0, cropY: (1 - imageRatio / boxRatio) / 2, cropWidth: 1, cropHeight: imageRatio / boxRatio };
  };

  /** Applies one AI plan: instant edits first, then images/cut-outs (≤2 at once, 90 s each) behind placeholders. */
  const applyOps = async (page: any, ops: DesignOp[], abort: AbortController, afterInstant?: () => void) => {
    const outcome = { applied: 0, imageError: '', imagePrompt: '' };
    const isImage = (op: DesignOp) => (op.op || op.type) === 'generateImage' && !!op.prompt;
    const isCutout = (op: DesignOp) => (op.op || op.type) === 'removeBackground' && !!op.id;
    const isSlow = (op: DesignOp) => isImage(op) || isCutout(op);
    setPhase('finishing');
    for (const op of ops.filter((op) => !isSlow(op))) {
      if (abort.signal.aborted) break;
      try { if (await applyOp(page, op)) outcome.applied += 1; } catch { /* skip the op that failed */ }
    }
    afterInstant?.();
    const jobs = ops.filter(isSlow).flatMap((op) => {
      const attrs = safeProps(op.element || op.props || op.attrs);
      const existing = op.id ? store.getElementById(op.id) : undefined;
      if (isCutout(op)) {
        // Background removal keeps the element's box; only its src changes to the cut-out PNG.
        const src = existing?.type === 'image' ? String(existing.src || '') : '';
        return src && !src.startsWith('data:')
          ? [{ op, attrs, element: existing, placeholder: false, opacity: existing.opacity ?? 1, cutout: src }]
          : [];
      }
      if (existing) return [{ op, attrs, element: existing, placeholder: false, opacity: existing.opacity ?? 1, cutout: '' }];
      const width = attrs.width || page.width * 0.6, height = attrs.height || page.height * 0.6;
      const box = { x: (page.width - width) / 2, y: (page.height - height) / 2, ...attrs, width, height };
      // Placeholder drawn at the box's own aspect ratio (centred glyph); never cover-cropped.
      const element = page.addElement({ ...box, type: 'image', src: placeholderSrc(box.width, box.height) });
      // A poster background (≥90% of the page) sits under the text and shapes.
      if (element && width * height >= 0.9 * page.width * page.height) element.moveBottom?.();
      return element ? [{ op, attrs: box, element, placeholder: true, opacity: attrs.opacity ?? 1, cutout: '' }] : [];
    });
    if (!jobs.length || abort.signal.aborted) return outcome;
    setPhase('image');
    setImageCount({ done: 0, total: jobs.length });
    // Canvas "shimmer": placeholders breathe until their image arrives.
    let dim = false;
    const pulse = setInterval(() => {
      dim = !dim;
      jobs.forEach((job) => { try { job.element.set({ opacity: dim ? 0.45 : 0.9 }); } catch { /* removed */ } });
    }, 600);
    const work = (job: typeof jobs[number]): Promise<string> => job.cutout
      ? withTimeout(abort.signal, IMAGE_TIMEOUT_MS, () => removeBackground(job.cutout))
      : withTimeout(abort.signal, IMAGE_TIMEOUT_MS, (signal) => generateImage(job.op.prompt!,
          job.attrs.aspectRatio || job.attrs.aspect_ratio || nearestRatio(job.element.width, job.element.height), signal));
    const results: PromiseSettledResult<string>[] = new Array(jobs.length);
    const queue = jobs.map((job, index) => ({ job, index }));
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        try { results[next.index] = { status: 'fulfilled', value: await work(next.job) }; }
        catch (reason) { results[next.index] = { status: 'rejected', reason }; }
        setImageCount((count) => ({ ...count, done: count.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_IMAGES, jobs.length) }, worker));
    clearInterval(pulse);
    setPhase('finishing');
    for (const [index, result] of results.entries()) {
      const job = jobs[index];
      try {
        if (result.status === 'fulfilled' && !abort.signal.aborted) {
          // The op's frame stays as planned and the picture covers it; a cut-out keeps its original crop.
          const crop = job.cutout ? {} : await coverCrop(job.element, result.value);
          job.element.set({ src: result.value, opacity: job.opacity, ...crop });
          // A new full-page background: take its palette and harmonize the design to it.
          if (job.placeholder && (job.element.width || 0) * (job.element.height || 0) >= 0.9 * page.width * page.height) {
            const palette = await extractPalette(result.value);
            if (palette && !abort.signal.aborted) { paletteRef.current = palette; harmonize(page, palette); }
          }
          outcome.applied += 1;
        } else if (job.placeholder) {
          store.deleteElements([job.element.id]);
          if (result.status === 'rejected' && !abort.signal.aborted && !outcome.imageError) {
            outcome.imageError = imageFailureText(result.reason);
            outcome.imagePrompt = job.op.prompt || '';
          }
        } else {
          job.element.set({ opacity: job.opacity });
        }
      } catch { /* element gone: nothing to fill */ }
    }
    return outcome;
  };

  /**
   * Sends one turn (user text, or the automatic "__undo__" follow-up).
   * Blank page: PHASE 1 paints the background picture first (cover, full page), then PHASE 2 asks the
   * AI to lay text over the REAL image it can see (`phase: 'layout-over-image'`). A page with content
   * keeps the single screenshot → ai-design-edit pass. Every phase sits in one undo step.
   */
  /**
   * Sends one turn (user text, or the automatic "__undo__" follow-up).
   * Blank page: the background image and the AI layout run IN PARALLEL against fixed layout zones
   * (`phase: 'layout-zones'`); text lands as soon as the layout is ready (above the image placeholder),
   * the picture fills in when it is drawn. `options.phase = 'layout-over-image'` re-lays text over the
   * real picture ("Căn chỉnh lại theo ảnh"). Every request has a 90 s client timeout; one undo step per turn.
   */
  const send = async (text: string, options: { phase?: 'layout-over-image'; label?: string } = {}) => {
    const page = store.activePage;
    const trimmed = text.trim();
    if (!trimmed || !page || loading) return;
    const undoTurn = trimmed === UNDO_INSTRUCTION;
    const history = messagesRef.current.filter((message) => !message.error).slice(-HISTORY_TURNS)
      .map((message) => ({ role: message.role, text: message.text, undone: !!message.undone }));
    const referenceImages = undoTurn ? [] : references.slice(0, MAX_REFERENCE_IMAGES);
    const selectedIds: string[] = (store.selectedElements || []).map((element: any) => element.id).filter(Boolean);
    const userMessage: ChatMessage = { id: newId(), role: 'user', text: options.label || trimmed, ...(undoTurn ? { hidden: true } : {}),
      ...(referenceImages.length ? { images: referenceImages } : {}) };
    update([...messagesRef.current, userMessage]);
    if (!undoTurn && !options.phase) { setInstruction(''); setReferences([]); }
    setLoading(true);
    // With reference images the user most likely wants THEIR picture used, so no background is painted.
    const blank = !undoTurn && !options.phase && !referenceImages.length && !(page.children?.length);
    setPhase(blank ? 'layout' : 'analyzing');
    setImageCount({ done: 0, total: 0 });
    const abort = new AbortController();
    controller.current = abort;
    // While the AI works (its ops only arrive at the end) a cursor sketches the coming layout on the canvas.
    const director = new AiCanvasDirector(store);
    directorRef.current = director;
    abort.signal.addEventListener('abort', () => director.cancel());
    const boxOf = (element: any): PageBox => ({ x: element.x || 0, y: element.y || 0, width: element.width || 40, height: element.height || 24 });
    const existing: any[] = page.children || [];
    const focus = existing.filter((element) => selectedIds.includes(element.id));
    const texts = existing.filter((element) => element.type === 'text');
    director.sketch(existing.length && !blank
      ? (focus.length ? focus : texts.length ? texts : existing).slice(0, 6)
          .map((element: any): PageBox => ({ ...boxOf(element), kind: element.type === 'text' ? 'text' : element.type === 'image' ? 'image' : 'frame' }))
      : posterSketch(page.width, page.height));
    const started = Date.now();
    setSeconds(0);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      // The model is still thinking after ~8 s: it is laying the design out.
      if (elapsed >= 8) setPhase((current) => (current === 'analyzing' ? 'layout' : current));
    }, 1000);

    const before = store.toJSON();
    const turn = { applied: 0, total: 0, imageError: '', imagePrompt: '', reply: '', painted: false, failure: null as any };

    /** One ai-design-edit call (90 s cap) → ops applied at once; sketch blocks morph onto the result. */
    const layout = async (extra: Record<string, any>, screenshot: string) => {
      const data = await withTimeout(abort.signal, DESIGN_TIMEOUT_MS, async (signal) => {
        const response = await fetch('/media/ai-design-edit', {
          method: 'POST',
          signal,
          body: JSON.stringify({
            instruction: trimmed,
            history,
            screenshot,
            ...extra,
            ...(referenceImages.length ? { referenceImages } : {}),
            // What the user has selected on the canvas ("this image", "ảnh đang chọn").
            ...(selectedIds.length ? { selectedIds } : {}),
            ...(paletteRef.current ? { palette: paletteRef.current } : {}),
            page: { width: page.width, height: page.height, background: page.background },
            elements: serializeElements(page),
          }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body) throw new Error(body?.message || `AI thiết kế thất bại (mã ${response.status})`);
        return body;
      });
      if (abort.signal.aborted) return;
      const ops: DesignOp[] = Array.isArray(data.operations) ? data.operations : Array.isArray(data.ops) ? data.ops : [];
      turn.reply = String(data.reply || data.summary || '');
      turn.total += ops.length;
      const beforeIds = new Set<string>((page.children || []).map((element: any) => element.id));
      const changedIds = new Set(ops.map((op) => op.id).filter(Boolean) as string[]);
      const result = await applyOps(page, ops, abort, () => {
        // Text that ran out of its zone / into the next element shrinks (≥60%); the headline keeps ≤2 lines.
        const touched = (page.children || []).filter((element: any) => element.type === 'text'
          && (!beforeIds.has(element.id) || changedIds.has(element.id)));
        // zones is sent as [{name,x,y,width,height}]: text must stay inside the text/CTA boxes.
        const zones = Array.isArray(extra.zones)
          ? extra.zones.filter((zone: any) => zone.name === 'text' || zone.name === 'cta') : [];
        fitTexts(page, touched, zones);
        // Real edit landed: sketch blocks morph onto the new/changed elements; new text fades in quickly.
        const added = (page.children || []).filter((element: any) => !beforeIds.has(element.id));
        const changed = (page.children || []).filter((element: any) => beforeIds.has(element.id) && changedIds.has(element.id));
        const targets = [...added, ...changed].filter((element: any) => !isPlaceholderSrc(element.src))
          .sort((a: any, b: any) => (a.y || 0) - (b.y || 0));
        director.land(targets.map(boxOf));
        if (!prefersReducedMotion()) {
          added.filter((element: any) => element.type !== 'image').forEach((element: any) => {
            const target = element.opacity ?? 1, start = performance.now();
            element.set({ opacity: 0 });
            const step = (now: number) => {
              const t = Math.min(1, (now - start) / 260);
              try { element.set({ opacity: target * t }); } catch { return; }
              if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          });
        }
      });
      turn.applied += result.applied;
      if (!turn.imageError && result.imageError) { turn.imageError = result.imageError; turn.imagePrompt = result.imagePrompt; }
    };

    /** Background picture behind a breathing placeholder (90 s cap); cover-cropped when it arrives. */
    const paintBackground = async (prompt: string) => {
      const placeholder = page.addElement({ type: 'image', src: placeholderSrc(page.width, page.height), x: 0, y: 0, width: page.width, height: page.height });
      placeholder?.moveBottom?.();
      let dim = false;
      const pulse = setInterval(() => { dim = !dim; try { placeholder?.set({ opacity: dim ? 0.45 : 0.9 }); } catch { /* removed */ } }, 600);
      turn.total += 1;
      try {
        const src = await withTimeout(abort.signal, IMAGE_TIMEOUT_MS, (signal) =>
          generateImage(prompt, nearestRatio(page.width, page.height), signal));
        clearInterval(pulse);
        placeholder.set({ src, opacity: 1, ...(await coverCrop(placeholder, src)) });
        // Palette of the real picture: the layout is recoloured to match it once both are on the page.
        const palette = await extractPalette(src);
        if (palette) paletteRef.current = palette;
        placeholder.moveBottom?.();
        turn.applied += 1;
        turn.painted = true;
      } catch (error) {
        clearInterval(pulse);
        if (placeholder) store.deleteElements([placeholder.id]);
        if (abort.signal.aborted) return;
        turn.imageError = isServerDown(error) ? SERVER_DOWN : imageFailureText(error);
        turn.imagePrompt = prompt;
      }
    };

    const run = async () => {
      try {
        if (blank) {
          // Image and layout in parallel against the same zones: total ≈ max(image, layout), not their sum.
          const zones = layoutZones(page.width, page.height);
          const prompt = `${trimmed}; ${zones.promptHint}, không chữ, không logo`;
          const image = paintBackground(prompt);
          const zoneBoxes = (['text', 'subject', 'cta'] as const).map((name) => ({
            name,
            x: Math.round(zones[name].x),
            y: Math.round(zones[name].y),
            width: Math.max(1, Math.round(zones[name].width)),
            height: Math.max(1, Math.round(zones[name].height)),
          }));
          const hasText = () => (page.children || []).some((element: any) => element.type === 'text');
          // A poster without text is a failed turn: one automatic retry, then a visible error (never a silent "done").
          const layoutText = async () => {
            for (let attempt = 0; attempt < 2 && !abort.signal.aborted; attempt++) {
              try {
                await layout({ phase: 'layout-zones', zones: zoneBoxes }, '');
                if (abort.signal.aborted || hasText()) return;
                if (attempt) throw new Error('AI chưa tạo được chữ cho thiết kế, hãy bấm Thử lại');
              } catch (failure) {
                if (attempt || abort.signal.aborted) throw failure;
              }
            }
          };
          const text = layoutText()
            .then(() => { if (!abort.signal.aborted && !turn.painted) setPhase('image'); })
            .catch((failure) => { turn.failure = failure; });
          await Promise.all([image, text]);
          // Both landed: recolour overlays/CTA/text from the picture (same transaction, no extra AI call).
          if (turn.painted && paletteRef.current && !abort.signal.aborted) harmonize(page, paletteRef.current);
          return;
        }
        // A page with content (or "Căn chỉnh lại theo ảnh"): the AI looks at the page as it is now.
        const screenshot = page.children?.length
          ? await withTimeout(abort.signal, DESIGN_TIMEOUT_MS, (signal) => uploadScreenshot(page, signal)) : '';
        if (abort.signal.aborted) return;
        await layout(options.phase ? { phase: options.phase } : {}, screenshot);
      } catch (failure) {
        // Kept, not thrown: a painted background must stay undoable even if the layout pass fails.
        turn.failure = failure;
      }
    };
    try {
      // One undo step for the whole turn when Polotno's history supports transactions.
      if (typeof store.history?.transaction === 'function') await store.history.transaction(run);
      else await run();
      if (abort.signal.aborted && !turn.applied) {
        // Cancelled before anything landed: drop the unanswered user turn so the history stays consistent.
        update(messagesRef.current.filter((message) => message.id !== userMessage.id));
        if (!undoTurn && !options.phase) { setInstruction(trimmed); setReferences(referenceImages); }
        return;
      }
      const failed = turn.failure && !abort.signal.aborted;
      const reason = failed ? (isServerDown(turn.failure) ? SERVER_DOWN : turn.failure?.message || 'Có lỗi xảy ra khi AI chỉnh thiết kế') : '';
      update([...messagesRef.current, {
        id: newId(), role: 'assistant', ...(failed && !turn.applied ? { error: true } : {}),
        text: failed
          ? (turn.applied ? 'Đã đặt ảnh nền, nhưng chưa dàn được bố cục: ' : '') + reason
          : abort.signal.aborted && turn.painted && !turn.reply
          ? 'Đã đặt ảnh nền, đã dừng trước khi dàn bố cục.'
          : turn.reply || (turn.total ? 'Đã chỉnh thiết kế.' : 'Mình chưa thấy cần thay đổi gì.'),
        ...(turn.total ? { applied: turn.applied, total: turn.total } : {}), ...(turn.applied ? { snapshot: before } : {}),
        ...(turn.imageError ? { imageError: turn.imageError, imagePrompt: turn.imagePrompt } : {}),
        ...(failed && !undoTurn ? { retryText: trimmed } : {}),
        ...(turn.painted ? { realign: true } : {}),
      }]);
    } finally {
      clearInterval(timer);
      director.dispose();
      if (directorRef.current === director) directorRef.current = null;
      if (controller.current === abort) controller.current = null;
      setLoading(false);
    }
  };

  /** Restores the design from before that AI turn, marks it (and later edits) undone, then asks the AI to follow up. */
  const undo = async (messageId: string) => {
    const index = messagesRef.current.findIndex((message) => message.id === messageId);
    const target = messagesRef.current[index];
    if (!target?.snapshot || loading) return;
    store.loadJSON(target.snapshot, true);
    // Edits after this turn were built on top of it, so they are gone too.
    update(messagesRef.current.map((message, position) => position >= index && message.role === 'assistant' && message.applied
      ? { ...message, undone: true, snapshot: undefined } : message));
    toast.show('Đã hoàn tác thay đổi của AI', 'success');
    await send(UNDO_INSTRUCTION);
  };

  const visible = messages.filter((message) => !message.hidden);

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="text-[15px] font-bold text-gray-900">AI thiết kế</div>
        <button
          type="button"
          disabled={loading || !messages.length}
          onClick={() => update([])}
          className="h-[26px] px-2.5 text-[11px] font-medium bg-white border border-gray-300 text-gray-700 rounded-[4px] hover:bg-gray-100 disabled:opacity-50"
        >
          Cuộc trò chuyện mới
        </button>
      </div>

      <div className="flex-1 min-h-[160px] overflow-y-auto flex flex-col gap-2 pe-1">
        {!visible.length && (
          <div className="text-[12px] text-gray-500 leading-relaxed">
            Mô tả điều bạn muốn chỉnh trên thiết kế này. AI nhớ cuộc trò chuyện, nên bạn có thể yêu cầu tiếp (“tiêu đề to hơn nữa”, “đổi lại màu cũ”…).
          </div>
        )}
        {visible.map((message) => (
          <div key={message.id} className={clsx('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={clsx(
                'max-w-[88%] rounded-[10px] px-2.5 py-2 text-[12px] leading-relaxed whitespace-pre-line',
                message.role === 'user'
                  ? 'bg-[#059669] text-white'
                  : message.error
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-gray-100 border border-gray-200 text-gray-800'
              )}
            >
              {!!message.images?.length && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {message.images.map((src) => (
                    <img key={src} src={src} alt="Ảnh tham chiếu" className="w-[44px] h-[44px] object-cover rounded-[4px] border border-white/40" />
                  ))}
                </div>
              )}
              {message.text}
              {message.role === 'assistant' && (!!message.retryText || (!!message.realign && !message.undone)) && (
                <div className="mt-1.5 flex flex-wrap justify-end gap-1.5 text-[11px]">
                  {!!message.retryText && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => send(message.retryText!)}
                      className="h-[22px] px-2 font-medium bg-white border border-gray-300 text-gray-700 rounded-[4px] hover:bg-gray-100 disabled:opacity-50"
                    >
                      ↻ Thử lại
                    </button>
                  )}
                  {!!message.realign && !message.undone && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => send('Căn chỉnh lại tiêu đề, chữ và nút cho hợp với ảnh nền thật: đặt vào vùng trống, màu chữ tương phản, thêm lớp phủ nếu cần.',
                        { phase: 'layout-over-image', label: 'Căn chỉnh lại theo ảnh' })}
                      className="h-[22px] px-2 font-medium bg-white border border-gray-300 text-gray-700 rounded-[4px] hover:bg-gray-100 disabled:opacity-50"
                    >
                      Căn chỉnh lại theo ảnh
                    </button>
                  )}
                </div>
              )}
              {message.role === 'assistant' && !!message.imageError && (
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-red-600">
                  <span>Không tạo được ảnh: {message.imageError}</span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => send(`Chỉ tạo lại ảnh (giữ nguyên chữ và bố cục), dùng một mô tả khác an toàn hơn, không dùng nhân vật hay thương hiệu có bản quyền. Ảnh cũ: ${message.imagePrompt || ''}`)}
                    className="shrink-0 h-[22px] px-2 font-medium bg-white border border-red-200 text-red-700 rounded-[4px] hover:bg-red-50 disabled:opacity-50"
                  >
                    Thử ảnh khác
                  </button>
                </div>
              )}
              {message.role === 'assistant' && !!message.total && (
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                  <span className={message.undone ? 'text-gray-400 line-through' : 'text-emerald-700 font-medium'}>
                    ✓ {message.applied} thay đổi
                  </span>
                  {message.undone ? (
                    <span className="text-gray-500">Đã hoàn tác</span>
                  ) : message.snapshot ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => undo(message.id)}
                      className="h-[22px] px-2 font-medium bg-white border border-gray-300 text-gray-700 rounded-[4px] hover:bg-gray-100 disabled:opacity-50"
                    >
                      ↶ Hoàn tác
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div role="status" aria-live="polite" className="flex items-center gap-2.5 p-2 rounded-[10px] border border-emerald-200 bg-white">
            <style>{`@keyframes nanAiSpin{to{transform:rotate(360deg)}}@keyframes nanAiShimmer{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}`}</style>
            <div className="relative w-7 h-7 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg,#34d399,#059669,#a7f3d0,#34d399)', animation: 'nanAiSpin 1.6s linear infinite' }} />
              <div className="absolute inset-[3px] rounded-full bg-white" />
              <div className="absolute inset-[9px] rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-emerald-800 truncate">{phase === 'image' && imageCount.total > 1
                  ? `Đang tạo ảnh ${Math.min(imageCount.done + 1, imageCount.total)}/${imageCount.total}`
                  : PHASE_LABEL[phase]}</span>
                <span className="text-[10px] text-gray-400 tabular-nums">{seconds}s</span>
              </div>
              <div className="relative h-[3px] rounded-full bg-emerald-100 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/70 transition-all duration-700" style={{ width: PHASE_PROGRESS[phase] }} />
                <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/90 to-transparent" style={{ animation: 'nanAiShimmer 1.4s ease-in-out infinite' }} />
              </div>
            </div>
            <button
              type="button"
              aria-label="Hủy"
              title="Hủy"
              onClick={() => controller.current?.abort()}
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l8 8M9 1l-8 8" /></svg>
            </button>
          </div>
        )}
        <div ref={listEnd} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => send(prompt)}
            className="px-2.5 h-[24px] text-[11px] font-medium rounded-full border bg-gray-50 text-gray-600 border-gray-200 hover:border-[#059669]/50 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
      <div
        ref={inputArea}
        className={clsx('flex flex-col gap-1.5 rounded-[8px]', dragging && 'outline-dashed outline-2 outline-emerald-500/60')}
      >
      {(references.length > 0 || uploadingRefs > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {references.map((src) => (
            <div key={src} className="relative w-[48px] h-[48px]">
              <img src={src} alt="Ảnh tham chiếu" className="w-full h-full object-cover rounded-[6px] border border-gray-200" />
              <button
                type="button"
                aria-label="Bỏ ảnh"
                onClick={() => setReferences((current) => current.filter((item) => item !== src))}
                className="absolute -top-1.5 -end-1.5 w-[18px] h-[18px] rounded-full bg-gray-700 text-white text-[11px] leading-none flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
          {uploadingRefs > 0 && (
            <div className="w-[48px] h-[48px] rounded-[6px] border border-dashed border-emerald-300 bg-emerald-50 flex items-center justify-center">
              <span className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
      <div className="flex gap-1.5 items-end">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Nhắn cho AI thiết kế… (dán/kéo ảnh vào đây; Enter để gửi)"
          rows={2}
          disabled={loading}
          className="flex-1 p-2 text-[13px] border border-gray-300 rounded-[6px] focus:outline-none focus:border-[#059669] resize-none text-gray-800 placeholder-gray-400 bg-white leading-relaxed disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!uploadingRefs) send(instruction);
            }
          }}
        />
        <Button
          onClick={() => send(instruction)}
          disabled={loading || !instruction.trim() || uploadingRefs > 0}
          className="!bg-[#059669] hover:!bg-[#047857] text-white font-medium rounded-[6px] h-[38px] px-3"
        >
          Gửi
        </Button>
      </div>
      </div>
    </div>
  );
});

const DesignPanel = observer(({ store }: any) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '14px' }}>
    <DesignTab store={store} />
  </div>
));

export const AiDesignSection = {
  name: 'ai-design',
  Tab: (props: any) => (
    <SectionTab name="AI thiết kế" {...props}>
      <Draw />
    </SectionTab>
  ),
  Panel: DesignPanel,
};
