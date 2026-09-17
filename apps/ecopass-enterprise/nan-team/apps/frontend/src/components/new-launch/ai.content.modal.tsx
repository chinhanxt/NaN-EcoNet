'use client';

import React, { FC, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Button } from '@gitroom/react/form/button';

// --- Standardized SVG Icons ---

export const SparklesIcon: FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
  </svg>
);

const TrendingIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const ShoppingBagIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const BookOpenIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const AwardIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

const SmileIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </svg>
);

const ZapIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const HashIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </svg>
);

const MegaphoneIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m3 11 18-5v12L3 13v-2z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const ImageIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

const CopyIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const RefreshCwIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

const CheckIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ClockIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// --- Style & Length Definitions ---

const STYLES = [
  { value: 'engaging', label: 'Hấp dẫn', icon: TrendingIcon },
  { value: 'sales', label: 'Bán hàng', icon: ShoppingBagIcon },
  { value: 'storytelling', label: 'Kể chuyện', icon: BookOpenIcon },
  { value: 'professional', label: 'Chuyên gia', icon: AwardIcon },
  { value: 'humorous', label: 'Hài hước', icon: SmileIcon },
  { value: 'concise', label: 'Ngắn gọn', icon: ZapIcon },
];

const LENGTHS = [
  { value: 'short', label: 'Ngắn', desc: '~80 từ' },
  { value: 'medium', label: 'Vừa', desc: '~200 từ' },
  { value: 'long', label: 'Dài', desc: '~400 từ' },
];

export const AiContentModal: FC<{
  close: () => void;
  editor: any;
  pictures?: any[];
  currentValue?: string;
  onUpdateContent?: (content: string) => void;
}> = ({ close, editor, pictures = [], currentValue = '', onUpdateContent }) => {
  const fetch = useFetch();
  const toaster = useToaster();

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('engaging');
  const [length, setLength] = useState('medium');
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCta, setIncludeCta] = useState(true);
  const [useVision, setUseVision] = useState(pictures.length > 0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [generatedText, setGeneratedText] = useState('');
  const [insertMode, setInsertMode] = useState<'replace' | 'append'>('replace');

  // Timer
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      setSeconds(0);
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const hasPictures = Boolean(pictures && pictures.length > 0);
  const isHinhanhInPrompt = prompt.includes('#hinhanh');

  // Toggle or Insert #hinhanh command into prompt
  const handleHinhanhClick = () => {
    if (!hasPictures) {
      toaster.show('Chưa có ảnh trong bài viết. Vui lòng thêm ảnh vào bài trước!', 'warning');
      return;
    }

    if (isHinhanhInPrompt) {
      // Toggle off
      setPrompt((prev) =>
        prev
          .replace(/#hinhanh/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      );
      setUseVision(false);
    } else {
      // Add #hinhanh to prompt
      setPrompt((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} #hinhanh` : '#hinhanh';
      });
      setUseVision(true);
    }
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    const isVisionNeeded = hasPictures && (prompt.includes('#hinhanh') || useVision);

    if (!trimmed && !isVisionNeeded) {
      toaster.show('Vui lòng nhập chủ đề bài viết hoặc đính kèm ảnh', 'warning');
      return;
    }

    setIsGenerating(true);
    setGeneratedText('');

    const imageUrls = isVisionNeeded
      ? pictures
          .map((p) => p?.path || p?.url || '')
          .filter(Boolean)
      : [];

    try {
      const res = await fetch('/posts/generate-content', {
        method: 'POST',
        body: JSON.stringify({
          prompt: trimmed || 'Hãy phân tích bức ảnh và viết bài đăng cuốn hút #hinhanh',
          image_urls: imageUrls,
          style,
          length,
          include_emojis: includeEmojis,
          include_hashtags: includeHashtags,
          include_cta: includeCta,
        }),
      });

      if (!res.ok) {
        throw new Error(`Máy chủ phản hồi lỗi: ${res.status}`);
      }

      const data = await res.json();
      if (!data?.content) {
        throw new Error('Không nhận được nội dung từ AI');
      }

      setGeneratedText(data.content);
      toaster.show('Đã tạo xong nội dung bài đăng!', 'success');
    } catch (e: any) {
      toaster.show(e?.message || 'Có lỗi khi tạo nội dung', 'warning');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!generatedText) return;

    const formattedHtml = generatedText
      .split(/\n\n+/)
      .map((p) => `<p>${p.split('\n').join('<br>')}</p>`)
      .join('');

    if (editor) {
      if (insertMode === 'replace') {
        editor.commands.setContent(formattedHtml);
      } else {
        editor.commands.focus('end');
        editor.commands.insertContent(formattedHtml);
      }
      onUpdateContent?.(editor.getHTML());
    }

    toaster.show('Đã chèn nội dung vào bài viết!', 'success');
    close();
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    toaster.show('Đã sao chép nội dung!', 'success');
  };

  return (
    <div className="flex flex-col gap-3.5 text-inputText text-[13px]">
      {/* Prompt Textarea */}
      <div className="relative flex flex-col gap-1.5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ý tưởng hoặc chủ đề bài viết... (dùng #hinhanh để AI quan sát ảnh)"
          rows={3}
          disabled={isGenerating}
          className="w-full p-3 text-[13px] border border-fifth rounded-[8px] focus:outline-none focus:border-[#059669] bg-input text-inputText placeholder-gray-500 resize-none leading-relaxed transition-colors"
        />

        {/* Action Button #hinhanh row directly below prompt */}
        <div className="flex items-center justify-between px-0.5">
          <button
            type="button"
            onClick={handleHinhanhClick}
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 h-[28px] rounded-[6px] text-[11px] font-medium border transition-all select-none',
              hasPictures
                ? isHinhanhInPrompt
                  ? 'bg-[#059669] text-white border-[#059669] shadow-xs font-semibold cursor-pointer'
                  : 'bg-[#059669]/15 text-[#10B981] border-[#059669]/40 hover:bg-[#059669]/25 cursor-pointer'
                : 'bg-newColColor text-gray-500 border-newBgLineColor opacity-50 cursor-not-allowed'
            )}
            title={
              hasPictures
                ? isHinhanhInPrompt
                  ? 'Bấm để bỏ lệnh #hinhanh'
                  : 'Bấm để thêm #hinhanh vào prompt'
                : 'Chưa có ảnh trong bài viết'
            }
          >
            <ImageIcon className={clsx('w-3.5 h-3.5', hasPictures ? (isHinhanhInPrompt ? 'text-white' : 'text-[#10B981]') : 'text-gray-500')} />
            <span>#hinhanh</span>
            {hasPictures && (
              <span
                className={clsx(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                  isHinhanhInPrompt
                    ? 'bg-white/20 text-white'
                    : 'bg-[#059669]/20 text-[#10B981]'
                )}
              >
                {pictures.length}
              </span>
            )}
          </button>

          {/* Attached Images preview */}
          {hasPictures && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <span className="text-[11px] text-gray-400">
                {isHinhanhInPrompt ? 'Đang quan sát ảnh:' : 'Ảnh bài viết:'}
              </span>
              {pictures.map((p, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    'w-7 h-7 rounded-[4px] overflow-hidden border shrink-0 relative bg-black/20 transition-all',
                    isHinhanhInPrompt
                      ? 'border-[#059669] shadow-xs'
                      : 'border-newBgLineColor opacity-60'
                  )}
                >
                  <img
                    src={p.path || p.url}
                    alt="Attached"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Style Chips (6 items, clean SVG icons, no emoji) */}
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => {
            const Icon = s.icon;
            const isSelected = style === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={isGenerating}
                onClick={() => setStyle(s.value)}
                className={clsx(
                  'h-[32px] px-2 text-[12px] font-medium rounded-[6px] border transition-all flex items-center justify-center gap-1.5 truncate select-none',
                  isSelected
                    ? 'bg-[#059669] text-white border-[#059669] shadow-sm font-semibold'
                    : 'bg-newColColor border-newBgLineColor text-inputText/80 hover:border-[#059669]/50 hover:text-inputText'
                )}
              >
                <Icon className={clsx('w-3.5 h-3.5 shrink-0', isSelected ? 'text-white' : 'text-gray-400')} />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Length & Toggles in one streamlined row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-newBgLineColor">
        {/* Length Segmented Control */}
        <div className="inline-flex p-0.5 rounded-[6px] bg-newColColor border border-newBgLineColor">
          {LENGTHS.map((l) => {
            const isSelected = length === l.value;
            return (
              <button
                key={l.value}
                type="button"
                disabled={isGenerating}
                onClick={() => setLength(l.value)}
                className={clsx(
                  'h-[26px] px-2.5 text-[11px] rounded-[4px] font-medium transition-all flex items-center gap-1 select-none',
                  isSelected
                    ? 'bg-[#059669] text-white font-semibold shadow-xs'
                    : 'text-gray-400 hover:text-inputText'
                )}
              >
                <span>{l.label}</span>
                <span className={clsx('text-[10px]', isSelected ? 'text-white/75' : 'text-gray-500')}>
                  {l.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Option Toggle Pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIncludeEmojis(!includeEmojis)}
            className={clsx(
              'h-[26px] px-2 text-[11px] rounded-[4px] border transition-all inline-flex items-center gap-1 select-none',
              includeEmojis
                ? 'bg-[#059669]/15 text-[#10B981] border-[#059669]/40 font-medium'
                : 'bg-newColColor border-newBgLineColor text-gray-500'
            )}
          >
            <SmileIcon className="w-3 h-3" />
            <span>Emoji</span>
          </button>

          <button
            type="button"
            onClick={() => setIncludeHashtags(!includeHashtags)}
            className={clsx(
              'h-[26px] px-2 text-[11px] rounded-[4px] border transition-all inline-flex items-center gap-1 select-none',
              includeHashtags
                ? 'bg-[#059669]/15 text-[#10B981] border-[#059669]/40 font-medium'
                : 'bg-newColColor border-newBgLineColor text-gray-500'
            )}
          >
            <HashIcon className="w-3 h-3" />
            <span>Hashtag</span>
          </button>

          <button
            type="button"
            onClick={() => setIncludeCta(!includeCta)}
            className={clsx(
              'h-[26px] px-2 text-[11px] rounded-[4px] border transition-all inline-flex items-center gap-1 select-none',
              includeCta
                ? 'bg-[#059669]/15 text-[#10B981] border-[#059669]/40 font-medium'
                : 'bg-newColColor border-newBgLineColor text-gray-500'
            )}
          >
            <MegaphoneIcon className="w-3 h-3" />
            <span>CTA</span>
          </button>
        </div>
      </div>

      {/* Generating Progress State */}
      {isGenerating && (
        <div className="p-2.5 bg-[#059669]/10 border border-[#059669]/30 rounded-[8px] flex items-center justify-between text-[12px] text-[#10B981]">
          <span className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            {useVision ? 'Đang phân tích ảnh & sáng tạo bài...' : 'Đang sáng tạo nội dung...'}
          </span>
          <span className="font-mono flex items-center gap-1 text-[11px]">
            <ClockIcon className="w-3.5 h-3.5" />
            {seconds}s
          </span>
        </div>
      )}

      {/* Generated Result Preview */}
      {generatedText && !isGenerating && (
        <div className="flex flex-col gap-2 p-3 bg-newColColor/50 border border-[#059669]/40 rounded-[8px]">
          <div className="flex justify-between items-center text-[12px]">
            <span className="font-medium text-[#10B981] flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5" />
              Kết quả AI
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInsertMode('replace')}
                className={clsx(
                  'px-2 py-0.5 text-[11px] rounded transition-all select-none',
                  insertMode === 'replace'
                    ? 'bg-[#059669] text-white font-medium'
                    : 'text-gray-400 hover:text-inputText'
                )}
              >
                Ghi đè
              </button>
              <button
                type="button"
                onClick={() => setInsertMode('append')}
                className={clsx(
                  'px-2 py-0.5 text-[11px] rounded transition-all select-none',
                  insertMode === 'append'
                    ? 'bg-[#059669] text-white font-medium'
                    : 'text-gray-400 hover:text-inputText'
                )}
              >
                Nối thêm
              </button>
            </div>
          </div>
          <textarea
            value={generatedText}
            onChange={(e) => setGeneratedText(e.target.value)}
            rows={5}
            className="w-full p-2.5 text-[13px] border border-fifth rounded-[6px] bg-input text-inputText focus:outline-none focus:border-[#059669] leading-relaxed resize-y"
          />
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              onClick={handleApply}
              className="flex-1 !bg-[#059669] hover:!bg-[#047857] text-white font-medium h-[32px] !text-[12px] flex items-center justify-center gap-1.5"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              <span>Chèn vào bài</span>
            </Button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 h-[32px] text-[12px] bg-newColColor border border-newBgLineColor rounded-[6px] hover:border-gray-500 font-medium text-inputText flex items-center gap-1.5 transition-colors"
            >
              <CopyIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>Sao chép</span>
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="px-3 h-[32px] text-[12px] bg-newColColor border border-newBgLineColor rounded-[6px] hover:border-[#059669] font-medium text-[#10B981] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCwIcon className="w-3.5 h-3.5" />
              <span>Tạo lại</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Trigger Button when no result */}
      {!generatedText && (
        <Button
          type="button"
          loading={isGenerating}
          disabled={isGenerating}
          onClick={handleGenerate}
          className="w-full !bg-[#059669] hover:!bg-[#047857] text-white font-medium h-[36px] !text-[13px] flex items-center justify-center gap-2 mt-1 rounded-[6px]"
        >
          <SparklesIcon className="w-4 h-4" />
          <span>{isGenerating ? 'Đang viết bài...' : 'Tạo nội dung'}</span>
        </Button>
      )}
    </div>
  );
};

export const AiContentButton: FC<{
  editor: any;
  pictures?: any[];
  currentValue?: string;
  onUpdateContent?: (content: string) => void;
}> = (props) => {
  const modals = useModals();

  const handleOpen = useCallback(() => {
    modals.openModal({
      title: 'Tạo nội dung AI',
      size: 560,
      children: (close) => (
        <AiContentModal
          close={close}
          editor={props.editor}
          pictures={props.pictures}
          currentValue={props.currentValue}
          onUpdateContent={props.onUpdateContent}
        />
      ),
    });
  }, [modals, props.editor, props.pictures, props.currentValue, props.onUpdateContent]);

  return (
    <button
      type="button"
      data-tooltip-id="tooltip"
      data-tooltip-content="AI viết bài (#hinhanh)"
      onClick={handleOpen}
      className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-[4px] bg-newColColor hover:bg-[#059669]/10 text-inputText hover:text-[#10B981] border border-newBgLineColor hover:border-[#059669]/50 text-[12px] font-medium transition-all cursor-pointer select-none"
    >
      <SparklesIcon className="w-3.5 h-3.5 text-[#10B981]" />
      <span>AI viết bài</span>
    </button>
  );
};
