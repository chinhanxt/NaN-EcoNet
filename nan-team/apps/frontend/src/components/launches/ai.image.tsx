import { Button } from '@gitroom/react/form/button';
import { FC, useCallback, useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AiWaitStream } from '@gitroom/frontend/components/ui/ai.wait.stream';
import { readNdjson } from '@gitroom/helpers/utils/read.ndjson';

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

type AiImageMedia = { id: string; path: string };
/** Images per request (backend fans out one AGY job per image, max 6). */
const countList = [1, 2, 3, 4, 5, 6];

const AiImageModal: FC<{
  close: () => void;
  setLoading: (loading: boolean) => void;
  onChange: (params: AiImageMedia | AiImageMedia[]) => void;
}> = (props) => {
  const { close, setLoading, onChange } = props;
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const setLocked = useLaunchStore((p) => p.setLocked);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(styleList[0].value);
  const [ratio, setRatio] = useState('1:1');
  const [count, setCount] = useState(1);
  // count > 1: every returned image, the ones ticked for insertion, and how many failed
  const [batch, setBatch] = useState<AiImageMedia[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [failed, setFailed] = useState(0);
  // "Hide popup (continue in background)": nobody can pick, so every variation is inserted.
  const hidden = useRef(false);

  // Progress states
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<{
    id: string;
    path: string;
  } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // True while the NDJSON stream is open (images still arriving).
  const [streaming, setStreaming] = useState(false);

  // Elapsed timer; progress is the real share of images received (set by the stream).
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && !generatedResult && !genError) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTime) / 1000));
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
    setProgress(0);
    setSeconds(0);
    setGenError(null);
    setGeneratedResult(null);
    setBatch(count > 1 ? [] : null);
    setChosen([]);
    setFailed(0);
    setStreaming(true);
    setLoading(true);
    setLocked(true);

    try {
      const res = await fetch('/media/generate-image-with-prompt/stream', {
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
          ...(count > 1 ? { count } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Image generation failed (${res.status})`);
      }

      // One NDJSON event per line: start, image (each saved image as soon as it is ready), error, done.
      const images: AiImageMedia[] = [];
      let total = count;
      let errors = 0;
      let lastError = '';
      for await (const event of readNdjson(res.body.getReader())) {
        if (event?.type === 'start') {
          total = Math.max(1, Number(event.count) || count);
        } else if (event?.type === 'image' && event.media?.id && event.media?.path) {
          const media: AiImageMedia = event.media;
          images.push(media);
          setProgress(Math.round(((images.length + errors) / total) * 100));
          if (count > 1) {
            setBatch([...images]);
            setChosen((current) => [...current, media.id]);
          }
        } else if (event?.type === 'error') {
          lastError = event.message || '';
          if (typeof event.index !== 'number') break;
          errors++;
          setFailed(errors);
          setProgress(Math.round(((images.length + errors) / total) * 100));
        }
      }
      setStreaming(false);

      if (!images.length) {
        throw new Error(lastError || t('invalid_image_data_server', 'Invalid image data received from server'));
      }
      setProgress(100);
      if (count > 1) {
        setGeneratedResult(images[0]);
        // No auto-insert while the popup is open: the user picks which variations go into the post.
        if (hidden.current) onChange(images);
        setLocked(false);
        setLoading(false);
      } else {
        const image = images[0];
        setGeneratedResult(image);
        setTimeout(() => {
          onChange(image);
          close();
          setLocked(false);
          setLoading(false);
        }, 1800);
      }
    } catch (e: any) {
      setStreaming(false);
      setBatch(null);
      setGenError(e?.message || t('image_generation_issue', 'An error occurred during image generation'));
      setLocked(false);
      setLoading(false);
    }
  }, [prompt, style, ratio, count, onChange, close, setLoading, setLocked, t, toaster, fetch]);

  if (isGenerating) {
    return (
      <div className="flex flex-col gap-[20px] py-[8px]">
        {(generatedResult || genError || !!batch?.length) && (<>
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
        </>)}

        {/* Result Preview or Stages */}
        {batch?.length ? (
          <div className="flex flex-col gap-[12px] p-[12px] bg-newColColor/50 rounded-[10px] border border-[#059669]/30">
            <div className="text-[13px] text-inputText">
              {streaming ? `Đã tạo ${batch.length}/${count} ảnh (đã lưu vào Media), đang tạo tiếp...` : `Đã tạo ${batch.length} ảnh (đã lưu vào Media).`} Bấm vào ảnh để chọn/bỏ chọn.
              {failed > 0 && <span className="text-red-400"> {failed} ảnh lỗi, không tạo được.</span>}
            </div>
            <div className="grid grid-cols-3 gap-[8px]">
              {batch.map((item) => {
                const selected = chosen.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={selected}
                    onClick={() => setChosen((current) => selected ? current.filter((id) => id !== item.id) : [...current, item.id])}
                    className={clsx(
                      'relative rounded-[8px] overflow-hidden border-2 bg-black/40 aspect-square transition-all',
                      selected ? 'border-[#10B981]' : 'border-transparent opacity-60 hover:opacity-90'
                    )}
                  >
                    <img src={item.path} alt="AI Generated" className="w-full h-full object-contain" />
                    {selected && (
                      <span className="absolute top-[4px] end-[4px] w-[20px] h-[20px] rounded-full bg-[#059669] text-white text-[12px] flex items-center justify-center">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              disabled={!chosen.length}
              onClick={() => {
                onChange(batch.filter((item) => chosen.includes(item.id)));
                close();
              }}
              className="w-full !bg-[#059669] hover:!bg-[#047857]"
            >
              {`Chèn ${chosen.length} ảnh vào bài viết`}
            </Button>
          </div>
        ) : generatedResult ? (
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
          <AiWaitStream
            kind="image"
            title={count > 1 ? `AI đang tạo ${count} ảnh` : undefined}
            percent={count > 1 ? progress : undefined}
            ratio={ratio.replace(':', ' / ')}
            steps={['Phân tích prompt và chọn mẫu', 'Biên soạn prompt (ánh sáng, bố cục)', 'Vẽ ảnh độ nét cao', 'Tối ưu file và lưu vào Media']}
            fullWidth
          />
        )}

        {/* Minimize option */}
        {streaming && !generatedResult && !genError && (
          <div className="flex justify-between items-center text-[12px] pt-[4px]">
            <span className="text-gray-400 italic">
              {t('image_generation_time_hint', 'Image generation usually takes around 25-30 seconds')}
            </span>
            <button
              type="button"
              onClick={() => { hidden.current = true; close(); }}
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
      <div className="flex flex-col gap-[6px]">
        <div className="text-[14px] font-[600]">Số lượng ảnh</div>
        <div className="flex flex-wrap gap-[8px]">
          {countList.map((value) => (
            <div
              key={value}
              onClick={() => setCount(value)}
              className={clsx(
                'cursor-pointer rounded-[6px] w-[36px] h-[30px] flex items-center justify-center text-[12px] border transition-all duration-150',
                count === value
                  ? 'bg-[#059669] border-[#059669] text-white font-[600] shadow-[0_2px_8px_rgba(5,150,105,0.3)]'
                  : 'bg-newColColor border-newBgLineColor hover:border-[#059669]/50'
              )}
            >
              {value}
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
  onChange: (params: AiImageMedia | AiImageMedia[]) => void;
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
          'cursor-pointer h-[32px] px-2.5 rounded-[8px] justify-center items-center flex gap-1.5 bg-newColColor hover:bg-boxHover border border-transparent hover:border-newBgLineColor transition-all duration-150 active:scale-[0.98] select-none text-textColor shrink-0',
          loading && 'opacity-70 pointer-events-none'
        )}
        onClick={openImageModal}
        title={t('generate_ai_image', 'Generate AI Image')}
      >
        <div className="flex items-center gap-[6px]">
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-[2px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin flex-shrink-0" />
              <span className="text-emerald-500 text-[12px] font-medium leading-none">
                {t('generating_ai_image', 'Generating...')}
              </span>
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
                className="text-emerald-500 shrink-0"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span className="text-[12px] font-medium leading-none">
                {t('generate_ai_image', 'Tạo ảnh AI')}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AiImage;
