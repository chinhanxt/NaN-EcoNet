import { Button } from '@gitroom/react/form/button';
import { FC, useCallback, useState, useEffect } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';

const styleList = [
  { value: 'Realistic', key: 'style_realistic', label: 'Realistic' },
  { value: 'Cartoon', key: 'style_cartoon', label: 'Cartoon' },
  { value: 'Anime', key: 'style_anime', label: 'Anime' },
  { value: 'Fantasy', key: 'style_fantasy', label: 'Fantasy' },
  { value: 'Abstract', key: 'style_abstract', label: 'Abstract' },
  { value: 'Pixel Art', key: 'style_pixel_art', label: 'Pixel Art' },
  { value: 'Sketch', key: 'style_sketch', label: 'Sketch' },
  { value: 'Watercolor', key: 'style_watercolor', label: 'Watercolor' },
  { value: 'Minimalist', key: 'style_minimalist', label: 'Minimalist' },
  { value: 'Cyberpunk', key: 'style_cyberpunk', label: 'Cyberpunk' },
  { value: 'Monochromatic', key: 'style_monochromatic', label: 'Monochromatic' },
  { value: 'Surreal', key: 'style_surreal', label: 'Surreal' },
  { value: 'Pop Art', key: 'style_pop_art', label: 'Pop Art' },
  { value: 'Fantasy Realism', key: 'style_fantasy_realism', label: 'Fantasy Realism' },
];

const ratioList = [
  { value: '1:1', key: 'ratio_square', label: '1:1 (Square)' },
  { value: '16:9', key: 'ratio_landscape', label: '16:9 (Landscape)' },
  { value: '9:16', key: 'ratio_portrait_reels', label: '9:16 (Portrait Reels/TikTok)' },
  { value: '4:3', key: 'ratio_standard_landscape', label: '4:3 (Landscape)' },
  { value: '3:4', key: 'ratio_portrait', label: '3:4 (Portrait)' },
];

const AiImageModal: FC<{
  close: () => void;
  setLoading: (loading: boolean) => void;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const { close, setLoading, onChange } = props;
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const setLocked = useLaunchStore((p) => p.setLocked);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(styleList[0].value);
  const [ratio, setRatio] = useState('1:1');

  // Progress states
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<{
    id: string;
    path: string;
  } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Timer & progress simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && !generatedResult && !genError) {
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setSeconds(Math.floor(elapsed));

        if (elapsed < 5) {
          setProgress(Math.min(25, Math.floor(5 + (elapsed / 5) * 20)));
        } else if (elapsed < 14) {
          setProgress(Math.min(60, Math.floor(25 + ((elapsed - 5) / 9) * 35)));
        } else if (elapsed < 24) {
          setProgress(Math.min(90, Math.floor(60 + ((elapsed - 14) / 10) * 30)));
        } else {
          setProgress(Math.min(96, Math.floor(90 + Math.min(6, (elapsed - 24) * 0.5))));
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generatedResult, genError]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      toaster.show(
        t('please_type_your_prompt', 'Please enter your prompt'),
        'warning'
      );
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setSeconds(0);
    setGenError(null);
    setGeneratedResult(null);
    setLoading(true);
    setLocked(true);

    try {
      const res = await fetch('/media/generate-image-with-prompt', {
        method: 'POST',
        body: JSON.stringify({
          prompt: `
<!-- description -->
${prompt}
<!-- /description -->

<!-- style -->
${style}
<!-- /style -->

`,
          aspect_ratio: ratio,
        }),
      });

      if (!res.ok) {
        throw new Error(`Image generation failed (${res.status})`);
      }

      const image = await res.json();
      if (image && image.path) {
        setProgress(100);
        setGeneratedResult(image);
        setTimeout(() => {
          onChange(image);
          close();
          setLocked(false);
          setLoading(false);
        }, 1800);
      } else {
        throw new Error(t('invalid_image_data_server', 'Invalid image data received from server'));
      }
    } catch (e: any) {
      setGenError(e?.message || t('image_generation_issue', 'An error occurred during image generation'));
      setLocked(false);
      setLoading(false);
    }
  }, [prompt, style, ratio, onChange, close, setLoading, setLocked, t, toaster, fetch]);

  if (isGenerating) {
    return (
      <div className="flex flex-col gap-[20px] py-[8px]">
        {/* Header with status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <div className="w-[38px] h-[38px] rounded-full bg-[#059669]/20 flex items-center justify-center text-[#10B981] animate-pulse">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="text-[15px] font-[700] text-inputText">
                {generatedResult
                  ? t('artwork_completed', 'Artwork completed!')
                  : genError
                  ? t('image_generation_issue', 'Image generation encountered an issue')
                  : t('generating_artwork', 'Generating artwork...')}
              </div>
              <div className="text-[12px] text-gray-400 font-mono flex items-center gap-[6px]">
                <span className="flex items-center gap-[4px]">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {seconds}s
                </span>
                <span>•</span>
                <span>{t('estimated_time', 'Est: ~25s')}</span>
                <span>•</span>
                <span>{t('ratio', 'Ratio')}: {ratio}</span>
              </div>
            </div>
          </div>
          <div className="text-[28px] font-black text-[#10B981] tracking-tight">
            {progress}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-newBgLineColor h-[10px] rounded-full overflow-hidden relative shadow-inner">
          <div
            className="bg-gradient-to-r from-[#059669] via-[#10B981] to-[#34D399] h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Result Preview or Stages */}
        {generatedResult ? (
          <div className="flex flex-col items-center gap-[12px] p-[12px] bg-newColColor/50 rounded-[10px] border border-[#059669]/30">
            <div className="relative rounded-[8px] overflow-hidden max-h-[220px] shadow-lg border border-newBgLineColor">
              <img
                src={generatedResult.path}
                alt="AI Generated"
                className="max-h-[220px] w-auto object-contain rounded-[8px]"
              />
            </div>
            <div className="text-[13px] text-[#10B981] font-[600] flex items-center gap-[6px]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{t('saved_to_media_inserting', 'Saved to Media! Inserting into post...')}</span>
            </div>
            <Button
              type="button"
              onClick={() => {
                onChange(generatedResult);
                close();
                setLocked(false);
                setLoading(false);
              }}
              className="w-full !bg-[#059669] hover:!bg-[#047857]"
            >
              {t('insert_into_post_now', 'Insert into post now')}
            </Button>
          </div>
        ) : genError ? (
          <div className="flex flex-col gap-[12px] p-[16px] bg-red-500/10 rounded-[10px] border border-red-500/30">
            <div className="text-[13px] text-red-400 font-[500]">{genError}</div>
            <Button
              type="button"
              onClick={() => {
                setIsGenerating(false);
                setGenError(null);
              }}
              className="!bg-red-600 hover:!bg-red-700"
            >
              {t('retry', 'Retry')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[10px] bg-newColColor/30 p-[14px] rounded-[10px] border border-newBgLineColor">
            {/* Step 1 */}
            <div className="flex items-center gap-[10px] text-[13px]">
              <div
                className={clsx(
                  'w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold',
                  progress >= 25
                    ? 'bg-[#059669] text-white'
                    : 'bg-newColColor border border-newBgLineColor text-gray-400'
                )}
              >
                {progress >= 25 ? '✓' : '1'}
              </div>
              <span
                className={
                  progress >= 25
                    ? 'text-inputText font-[500]'
                    : 'text-gray-400'
                }
              >
                {t('ai_step_1', 'AI Art Director analyzing prompt & template matching')}
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-[10px] text-[13px]">
              <div
                className={clsx(
                  'w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold',
                  progress >= 60
                    ? 'bg-[#059669] text-white'
                    : progress >= 25
                    ? 'bg-[#059669]/30 text-[#10B981] animate-pulse'
                    : 'bg-newColColor border border-newBgLineColor text-gray-400'
                )}
              >
                {progress >= 60 ? '✓' : '2'}
              </div>
              <span
                className={
                  progress >= 60
                    ? 'text-inputText font-[500]'
                    : progress >= 25
                    ? 'text-[#10B981] font-[600]'
                    : 'text-gray-400'
                }
              >
                {t('ai_step_2', 'Compiling Master Prompt (Studio lighting & composition)')}
              </span>
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-[10px] text-[13px]">
              <div
                className={clsx(
                  'w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold',
                  progress >= 90
                    ? 'bg-[#059669] text-white'
                    : progress >= 60
                    ? 'bg-[#059669]/30 text-[#10B981] animate-pulse'
                    : 'bg-newColColor border border-newBgLineColor text-gray-400'
                )}
              >
                {progress >= 90 ? '✓' : '3'}
              </div>
              <span
                className={
                  progress >= 90
                    ? 'text-inputText font-[500]'
                    : progress >= 60
                    ? 'text-[#10B981] font-[600]'
                    : 'text-gray-400'
                }
              >
                {t('ai_step_3', 'Rendering ultra-clear 300 DPI image via Antigravity Engine')}
              </span>
            </div>

            {/* Step 4 */}
            <div className="flex items-center gap-[10px] text-[13px]">
              <div
                className={clsx(
                  'w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold',
                  progress >= 100
                    ? 'bg-[#059669] text-white'
                    : progress >= 90
                    ? 'bg-[#059669]/30 text-[#10B981] animate-pulse'
                    : 'bg-newColColor border border-newBgLineColor text-gray-400'
                )}
              >
                {progress >= 100 ? '✓' : '4'}
              </div>
              <span
                className={
                  progress >= 100
                    ? 'text-inputText font-[500]'
                    : progress >= 90
                    ? 'text-[#10B981] font-[600]'
                    : 'text-gray-400'
                }
              >
                {t('ai_step_4', 'Optimizing file size & syncing to post')}
              </span>
            </div>
          </div>
        )}

        {/* Minimize option */}
        {!generatedResult && !genError && (
          <div className="flex justify-between items-center text-[12px] pt-[4px]">
            <span className="text-gray-400 italic">
              {t('image_generation_time_hint', 'Image generation usually takes around 25-30 seconds')}
            </span>
            <button
              type="button"
              onClick={() => close()}
              className="text-[#10B981] hover:underline font-[500]"
            >
              {t('hide_popup_continue_background', 'Hide popup (continue in background)')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[6px]">
        <div className="text-[14px] font-[600]">{t('prompt', 'Prompt')}</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('describe_the_image_you_want_to_generate', 'Describe the image you want to generate...')}
          className="bg-input min-h-[120px] p-[14px] outline-none border-fifth border rounded-[8px] text-inputText placeholder-inputText"
        />
      </div>

      <div className="flex flex-col gap-[6px]">
        <div className="text-[14px] font-[600]">{t('aspect_ratio', 'Aspect Ratio')}</div>
        <div className="flex flex-wrap gap-[8px]">
          {ratioList.map((r) => (
            <div
              key={r.value}
              onClick={() => setRatio(r.value)}
              className={clsx(
                'cursor-pointer rounded-[6px] px-[12px] h-[30px] flex items-center text-[12px] border transition-all duration-150',
                ratio === r.value
                  ? 'bg-[#059669] border-[#059669] text-white font-[600] shadow-[0_2px_8px_rgba(5,150,105,0.3)]'
                  : 'bg-newColColor border-newBgLineColor hover:border-[#059669]/50'
              )}
            >
              {t(r.key, r.label)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[6px]">
        <div className="text-[14px] font-[600]">{t('style', 'Style')}</div>
        <div className="flex flex-wrap gap-[8px]">
          {styleList.map((p) => (
            <div
              key={p.value}
              onClick={() => setStyle(p.value)}
              className={clsx(
                'cursor-pointer rounded-[6px] px-[12px] h-[32px] flex items-center text-[13px] border transition-all duration-150',
                style === p.value
                  ? 'bg-[#059669] border-[#059669] text-white font-[600] shadow-[0_2px_8px_rgba(5,150,105,0.3)]'
                  : 'bg-newColColor border-newBgLineColor hover:border-[#059669]/50'
              )}
            >
              {t(p.key, p.label)}
            </div>
          ))}
        </div>
      </div>
      <div className="flex">
        <Button type="button" onClick={generate} className="flex-1 !bg-[#059669] hover:!bg-[#047857]">
          {t('generate', 'Generate')}
        </Button>
      </div>
    </div>
  );
};

export const AiImage: FC<{
  value: string;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const t = useT();
  const { onChange } = props;
  const [loading, setLoading] = useState(false);
  const modals = useModals();

  const openImageModal = useCallback(() => {
    if (loading) {
      return;
    }
    modals.openModal({
      title: t('generate_ai_image', 'Generate AI Image'),
      size: 580,
      children: (close) => (
        <AiImageModal
          close={close}
          setLoading={setLoading}
          onChange={onChange}
        />
      ),
    });
  }, [loading, onChange]);

  return (
    <>
      <div
        className={clsx(
          'cursor-pointer rounded-[4px] px-[10px] h-[30px] flex items-center text-[12px] border bg-newColColor border-newBgLineColor transition-all select-none',
          loading && 'opacity-70 pointer-events-none'
        )}
        onClick={openImageModal}
      >
        <div className="flex items-center gap-[6px]">
          {loading ? (
            <>
              <div className="w-[14px] h-[14px] border-[2px] border-[#10B981]/20 border-t-[#10B981] rounded-full animate-spin flex-shrink-0" />
              <span className="text-[#10B981] font-medium">{t('generating_ai_image', 'Generating...')}</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span>{t('generate_ai_image', 'Generate AI Image')}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AiImage;
