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

  // Timer & progress bar during generation
  useEffect(() => {
    let timer: any;
    let progressTimer: any;

    if (loading) {
      setProgress(5);
      setSeconds(0);
      const startTime = Date.now();

      timer = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      progressTimer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed <= 28) {
          setProgress(Math.min(95, Math.floor(5 + (elapsed / 28) * 90)));
        }
      }, 400);
    }

    return () => {
      clearInterval(timer);
      clearInterval(progressTimer);
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

    const targetRatio = ratio === 'auto' ? getBestAspectRatio() : ratio;
    const fullPrompt =
      style && style !== 'no_style'
        ? `\n<!-- description -->\n${promptText.trim()}\n<!-- /description -->\n\n<!-- style -->\n${style}\n<!-- /style -->\n`
        : promptText.trim();

    try {
      // 1. Try /media/generate-image-with-prompt (saves to media storage & returns URL)
      let res = await fetch('/media/generate-image-with-prompt', {
        method: 'POST',
        body: JSON.stringify({
          prompt: fullPrompt,
          aspect_ratio: targetRatio,
        }),
      });

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

      {/* Progress & Status while generating */}
      {loading && (
        <div className="flex flex-col gap-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-[8px]">
          <div className="flex justify-between items-center text-[12px]">
            <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Đang tạo ảnh AI...
            </span>
            <span className="font-mono text-emerald-700 font-bold">
              {progress}%
            </span>
          </div>

          <div className="w-full bg-emerald-200/60 h-[7px] rounded-full overflow-hidden">
            <div
              className="bg-[#059669] h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(5,150,105,0.4)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] text-emerald-700">
            <span>
              {progress < 25 && 'Phân tích ý tưởng & phong cách...'}
              {progress >= 25 && progress < 60 && 'Thiết lập bố cục & ánh sáng studio...'}
              {progress >= 60 && progress < 90 && 'Đang kết xuất ảnh qua Antigravity...'}
              {progress >= 90 && 'Hoàn tất & chèn vào thiết kế...'}
            </span>
            <span className="font-mono text-gray-500">⏱️ {seconds}s</span>
          </div>
        </div>
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
        {loading ? `Đang tạo ảnh (${progress}%)...` : t('generate_image', 'Tạo ảnh')}
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

      {/* Session History Grid */}
      {history.length > 1 && (
        <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t">
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
