'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Clean } from '@blueprintjs/icons';
import { SectionTab } from 'polotno/side-panel';
import { getImageSize } from 'polotno/utils/image';
import { ImagesGrid } from 'polotno/side-panel/images-grid';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { clsx } from 'clsx';
import { AiWaitStream } from '@gitroom/frontend/components/ui/ai.wait.stream';
import { readNdjson } from '@gitroom/helpers/utils/read.ndjson';

const RATIO_OPTIONS = [
  { value: 'auto', label: 'Tự động' },
  { value: '1:1', label: '1:1 Vuông' },
  { value: '16:9', label: '16:9 Ngang' },
  { value: '9:16', label: '9:16 Dọc' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

const STYLE_OPTIONS = [
  { value: 'no_style', label: 'Tự nhiên' },
  { value: 'photorealistic', label: 'Chân thực' },
  { value: 'cinematic', label: 'Điện ảnh' },
  { value: '3d_render', label: '3D Render' },
  { value: 'anime', label: 'Anime' },
  { value: 'vintage', label: 'Cổ điển' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
];

const GenerateTab = observer(({ store }: any) => {
  const [promptText, setPromptText] = useState('');
  const [ratio, setRatio] = useState('auto');
  const [style, setStyle] = useState('no_style');
  const [image, setImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Images per request (backend fans out one AGY job per image, max 6); a batch is not auto-inserted.
  const [count, setCount] = useState(1);
  const [batchInfo, setBatchInfo] = useState<{ made: number; failed: number } | null>(null);

  const { billingEnabled } = useVariables();
  const fetch = useFetch();
  const toast = useToaster();
  const t = useT();

  const loadCredits = useCallback(async () => {
    if (!billingEnabled) {
      return { credits: 1000 };
    }
    try {
      return (await fetch(`/copilot/credits`, { method: 'GET' })).json();
    } catch {
      return { credits: 1000 };
    }
  }, [billingEnabled, fetch]);

  const { data, mutate } = useSWR('copilot-credits', loadCredits);

  // Timer during generation; progress is the real share of images received (set by the stream).
  useEffect(() => {
    let timer: any;

    if (loading) {
      setProgress(0);
      setSeconds(0);
      const startTime = Date.now();

      timer = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }

    return () => {
      clearInterval(timer);
    };
  }, [loading]);

  const getBestAspectRatio = useCallback(() => {
    const w = store?.activePage?.width || store?.width || 540;
    const h = store?.activePage?.height || store?.height || 675;
    const r = w / h;
    if (Math.abs(r - 1.0) < 0.15) return '1:1';
    if (r >= 1.45) return '16:9';
    if (r >= 1.15) return '4:3';
    if (r <= 0.65) return '9:16';
    if (r <= 0.85) return '3:4';
    return '1:1';
  }, [store?.activePage?.width, store?.activePage?.height, store?.width, store?.height]);

  const addImageToCanvas = async (src: string, asBackground = false) => {
    try {
      if (asBackground) {
        if (store.activePage?.set) {
          store.activePage.set({ background: src });
          toast.show('Đã đặt làm hình nền trang!', 'success');
        }
        return;
      }

      const { width, height } = await getImageSize(src);
      const pageWidth = store.activePage?.width || store.width || 540;
      const pageHeight = store.activePage?.height || store.height || 675;

      const maxWidth = pageWidth * 0.85;
      const maxHeight = pageHeight * 0.85;
      let finalW = width;
      let finalH = height;

      if (finalW > maxWidth || finalH > maxHeight) {
        const scale = Math.min(maxWidth / finalW, maxHeight / finalH);
        finalW = Math.round(finalW * scale);
        finalH = Math.round(finalH * scale);
      }

      const x = Math.round((pageWidth - finalW) / 2);
      const y = Math.round((pageHeight - finalH) / 2);

      store.activePage?.addElement({
        type: 'image',
        src,
        width: finalW,
        height: finalH,
        x,
        y,
      });
      toast.show('Đã thêm ảnh vào thiết kế!', 'success');
    } catch (err: any) {
      toast.show(err?.message || 'Không thể chèn ảnh vào trang', 'warning');
    }
  };

  const handleGenerate = async () => {
    if (billingEnabled && data?.credits <= 0) {
      window.open('/billing', '_blank');
      return;
    }
    if (!promptText.trim()) {
      toast.show(t('please_enter_image_description', 'Vui lòng nhập mô tả hình ảnh'), 'warning');
      return;
    }

    setLoading(true);
    setError(null);
    setBatchInfo(null);
    if (count > 1) setImage(null);

    const targetRatio = ratio === 'auto' ? getBestAspectRatio() : ratio;
    const fullPrompt =
      style && style !== 'no_style'
        ? `\n<!-- description -->\n${promptText.trim()}\n<!-- /description -->\n\n<!-- style -->\n${style}\n<!-- /style -->\n`
        : promptText.trim();

    try {
      // 1. Stream /media/generate-image-with-prompt/stream (each image is saved to media storage and shown as it is ready)
      let res = await fetch('/media/generate-image-with-prompt/stream', {
        method: 'POST',
        body: JSON.stringify({
          prompt: fullPrompt,
          aspect_ratio: targetRatio,
          ...(count > 1 ? { count } : {}),
        }),
      });

      if (res.ok && res.body) {
        const made: string[] = [];
        let total = count;
        let failed = 0;
        let lastError = '';
        for await (const event of readNdjson(res.body.getReader())) {
          if (event?.type === 'start') {
            total = Math.max(1, Number(event.count) || count);
          } else if (event?.type === 'image' && event.media?.path) {
            const src: string = event.media.path;
            made.push(src);
            setProgress(Math.round(((made.length + failed) / total) * 100));
            setHistory((prev) => [src, ...prev.filter((p) => p !== src)]);
            if (count > 1) {
              // Several variations: each one joins the grid below to click or drag onto the canvas.
              setBatchInfo({ made: made.length, failed });
            } else {
              setImage(src);
              // Automatically add to canvas
              await addImageToCanvas(src);
            }
          } else if (event?.type === 'error') {
            lastError = event.message || '';
            if (typeof event.index !== 'number') break;
            failed++;
            setProgress(Math.round(((made.length + failed) / total) * 100));
            if (count > 1) setBatchInfo({ made: made.length, failed });
          }
        }
        mutate();
        if (!made.length) {
          throw new Error(lastError || 'Không nhận được dữ liệu hình ảnh từ máy chủ');
        }
        setProgress(100);
        return;
      }

      // 2. Fallback to /media/generate-image if needed
      if (!res.ok) {
        res = await fetch('/media/generate-image', {
          method: 'POST',
          body: JSON.stringify({
            prompt: promptText.trim(),
            aspect_ratio: targetRatio,
          }),
        });
      }

      if (!res.ok) {
        throw new Error(`Tạo ảnh thất bại (Mã lỗi: ${res.status})`);
      }

      const resData = await res.json();
      const outputSrc = resData.path || resData.output;
      if (!outputSrc) {
        throw new Error('Không nhận được dữ liệu hình ảnh từ máy chủ');
      }

      setProgress(100);
      const batch: string[] = count > 1 && Array.isArray(resData.images)
        ? resData.images.map((item: { path?: string }) => item?.path).filter(Boolean)
        : [];
      if (batch.length) {
        // Several variations: show them all in the grid below to click or drag onto the canvas.
        setImage(null);
        setBatchInfo({ made: batch.length, failed: Math.max(0, Number(resData.failed) || 0) });
        setHistory((prev) => [...batch, ...prev.filter((p) => !batch.includes(p))]);
        mutate();
        return;
      }
      setImage(outputSrc);
      setHistory((prev) => [outputSrc, ...prev.filter((p) => p !== outputSrc)]);
      mutate();

      // Automatically add to canvas
      await addImageToCanvas(outputSrc);
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra trong quá trình tạo ảnh');
      toast.show(err?.message || 'Lỗi tạo ảnh', 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-6">
      {/* Title - Clean without credits count */}
      <div className="text-[15px] font-bold text-gray-900 border-b pb-2">
        {t('generate_image_with_ai', 'Tạo hình ảnh bằng AI')}
      </div>

      {/* Prompt input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-semibold text-gray-700">
          Mô tả hình ảnh
        </label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Nhập mô tả hình ảnh bạn muốn tạo..."
          rows={3}
          disabled={loading}
          className="w-full p-2.5 text-[13px] border border-gray-300 rounded-[6px] focus:outline-none focus:border-[#059669] resize-none text-gray-800 placeholder-gray-400 bg-white leading-relaxed disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleGenerate();
            }
          }}
        />
      </div>

      {/* Aspect Ratio */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[12px] font-semibold text-gray-700">
            Tỉ lệ khung hình
          </label>
          <span className="text-[11px] text-gray-400">
            {ratio === 'auto' ? `Gợi ý: ${getBestAspectRatio()}` : ratio}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {RATIO_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={loading}
              onClick={() => setRatio(r.value)}
              className={clsx(
                'h-[28px] text-[11px] font-medium rounded-[5px] border transition-all duration-150 flex items-center justify-center',
                ratio === r.value
                  ? 'bg-[#059669] text-white border-[#059669] shadow-sm font-semibold'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#059669]/50'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-semibold text-gray-700">
          Phong cách
        </label>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={loading}
              onClick={() => setStyle(s.value)}
              className={clsx(
                'px-2.5 h-[26px] text-[11px] font-medium rounded-full border transition-all duration-150 flex items-center justify-center',
                style === s.value
                  ? 'bg-[#059669] text-white border-[#059669] shadow-sm font-semibold'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#059669]/50'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Number of images */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-semibold text-gray-700">
          Số lượng ảnh
        </label>
        <div className="grid grid-cols-6 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <button
              key={value}
              type="button"
              disabled={loading}
              onClick={() => setCount(value)}
              className={clsx(
                'h-[28px] text-[11px] font-medium rounded-[5px] border transition-all duration-150 flex items-center justify-center',
                count === value
                  ? 'bg-[#059669] text-white border-[#059669] shadow-sm font-semibold'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#059669]/50'
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Progress & Status while generating */}
      {loading && (
        <AiWaitStream
          kind="image"
          title={count > 1 ? `Đang tạo ${count} ảnh AI` : 'Đang tạo ảnh AI'}
          percent={count > 1 ? progress : undefined}
          ratio={(ratio === 'auto' ? getBestAspectRatio() : ratio).replace(':', ' / ')}
          steps={['Phân tích ý tưởng & phong cách', 'Thiết lập bố cục & ánh sáng', 'Kết xuất ảnh', 'Chèn vào thiết kế']}
          fullWidth
        />
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-2.5 text-[12px] bg-red-50 border border-red-200 text-red-700 rounded-[6px] flex justify-between items-center">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleGenerate}
            className="text-red-800 underline font-semibold ml-2 hover:text-red-900"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleGenerate}
        loading={loading}
        disabled={loading}
        className="w-full !bg-[#059669] hover:!bg-[#047857] text-white font-medium rounded-[6px] h-[38px] shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? (count > 1 ? `Đang tạo ảnh (${progress}%)...` : 'Đang tạo ảnh...') : t('generate_image', 'Tạo ảnh')}
      </Button>

      {/* Generated Result Preview */}
      {image && !loading && (
        <div className="flex flex-col gap-2 p-2.5 border border-gray-200 rounded-[8px] bg-gray-50/50 mt-1">
          <div className="relative rounded-[6px] overflow-hidden max-h-[180px] bg-gray-100 flex items-center justify-center border">
            <img
              src={image}
              alt="AI Generated"
              className="max-h-[180px] w-auto object-contain rounded-[6px]"
            />
          </div>

          <div className="text-[11px] text-emerald-700 font-medium text-center">
            ✓ Đã tự động chèn vào khung vẽ
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => addImageToCanvas(image, false)}
              className="h-[28px] text-[11px] font-medium bg-white border border-gray-300 text-gray-700 rounded-[4px] hover:bg-gray-100 flex items-center justify-center gap-1 shadow-2xs"
            >
              + Thêm vào trang
            </button>
            <button
              type="button"
              onClick={() => addImageToCanvas(image, true)}
              className="h-[28px] text-[11px] font-medium bg-white border border-gray-300 text-gray-700 rounded-[4px] hover:bg-gray-100 flex items-center justify-center gap-1 shadow-2xs"
            >
              🖼️ Đặt làm nền
            </button>
          </div>
        </div>
      )}

      {/* Session History Grid (also shows every image of a multi-image batch) */}
      {(history.length > 1 || (!!batchInfo && history.length > 0)) && (
        <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t">
          {batchInfo && (
            <div className="text-[11px] text-emerald-700 font-medium">
              ✓ Đã tạo {loading ? `${batchInfo.made}/${count}` : batchInfo.made} ảnh — bấm hoặc kéo ảnh vào khung vẽ.
              {batchInfo.failed > 0 && <span className="text-red-600"> {batchInfo.failed} ảnh lỗi.</span>}
            </div>
          )}
          <div className="text-[12px] font-semibold text-gray-700">
            Ảnh đã tạo gần đây ({history.length})
          </div>
          <ImagesGrid
            shadowEnabled={false}
            images={history}
            getPreview={(item: string) => item}
            isLoading={loading}
            onSelect={async (item: string, pos: any, element: any) => {
              const src = item;
              if (element && element.type === 'svg' && element.contentEditable) {
                element.set({ maskSrc: src });
                return;
              }
              if (element && element.type === 'image' && element.contentEditable) {
                element.set({ src: src });
                return;
              }
              const { width, height } = await getImageSize(src);
              const x = (pos?.x || store.width / 2) - width / 2;
              const y = (pos?.y || store.height / 2) - height / 2;
              store.activePage?.addElement({
                type: 'image',
                src: src,
                width,
                height,
                x,
                y,
              });
            }}
            rowsNumber={2}
          />
        </div>
      )}
    </div>
  );
});

const PictureGeneratorPanel = observer(({ store }: any) => {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '14px',
      }}
    >
      <GenerateTab store={store} />
    </div>
  );
});

// define the custom section
export const PictureGeneratorSection = {
  name: 'picture-generator-ai',
  Tab: (props: any) => {
    const t = useT();
    return (
      <SectionTab name={t('ai_image_tab', 'Ảnh AI')} {...props}>
        <Clean />
      </SectionTab>
    );
  },
  Panel: PictureGeneratorPanel,
};
