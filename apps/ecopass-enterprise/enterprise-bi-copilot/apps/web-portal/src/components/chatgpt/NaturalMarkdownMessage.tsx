import React, { useState } from 'react';
import { 
  CopilotAiSvg, 
  CopySvg, 
  CheckSvg, 
  ThumbsUpSvg, 
  ThumbsDownSvg
} from './SvgIcons';
import { ThinkingAccordion } from './ThinkingAccordion';

interface NaturalMarkdownMessageProps {
  content: string;
  modelName: string;
  thinkingDurationSec?: number;
  thinkingSteps?: string[];
}

export const NaturalMarkdownMessage: React.FC<NaturalMarkdownMessageProps> = ({
  content,
  modelName,
  thinkingDurationSec = 1.4,
  thinkingSteps
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render markdown lines cleanly
  const renderFormattedContent = (rawText: string) => {
    const lines = rawText.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="my-2 space-y-1.5 list-disc list-inside text-slate-800 font-medium">
            {listItems}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Empty line -> line break
      if (!trimmed) {
        flushList();
        elements.push(<div key={`space-${idx}`} className="h-2" />);
        return;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(
          <h4 key={`h4-${idx}`} className="text-sm font-black text-slate-950 mt-3 mb-1 tracking-tight">
            {formatInline(trimmed.replace('### ', ''))}
          </h4>
        );
        return;
      }
      if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <h3 key={`h3-${idx}`} className="text-base font-black text-slate-950 mt-3.5 mb-1.5 tracking-tight">
            {formatInline(trimmed.replace('## ', ''))}
          </h3>
        );
        return;
      }
      if (trimmed.startsWith('# ')) {
        flushList();
        elements.push(
          <h2 key={`h2-${idx}`} className="text-lg font-black text-slate-950 mt-4 mb-2 tracking-tight">
            {formatInline(trimmed.replace('# ', ''))}
          </h2>
        );
        return;
      }

      // Bullet items (* or -)
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const itemText = trimmed.replace(/^[\*\-]\s+/, '');
        listItems.push(
          <li key={`li-${idx}`} className="text-sm leading-relaxed font-medium">
            {formatInline(itemText)}
          </li>
        );
        return;
      }

      // Numbered items (1. 2. etc)
      if (/^\d+\.\s+/.test(trimmed)) {
        flushList();
        const itemText = trimmed.replace(/^\d+\.\s+/, '');
        elements.push(
          <div key={`num-${idx}`} className="flex gap-2 my-1 text-sm leading-relaxed text-slate-800 font-medium">
            <span className="font-bold text-slate-950 shrink-0 font-mono">{trimmed.match(/^\d+\./)?.[0]}</span>
            <span>{formatInline(itemText)}</span>
          </div>
        );
        return;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${idx}`} className="text-sm leading-relaxed text-slate-800 font-medium my-1">
          {formatInline(trimmed)}
        </p>
      );
    });

    flushList();
    return elements;
  };

  // Format bold (**text**), inline code (`code`), etc.
  const formatInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={`b-${match.index}`} className="font-bold text-slate-950">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={`c-${match.index}`} className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono font-bold text-slate-900 border border-slate-200">
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="w-full flex gap-3 sm:gap-4 items-start py-2 group font-sans">
      {/* Standard SVG Copilot Avatar */}
      <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs border border-slate-900">
        <CopilotAiSvg size={18} className="text-white" />
      </div>

      {/* Message Content Container */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-950 tracking-tight whitespace-nowrap">
            Copilot Trợ Lý
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            {modelName}
          </span>
        </div>

        {/* Content Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <ThinkingAccordion durationSec={thinkingDurationSec} steps={thinkingSteps} />
          {renderFormattedContent(content)}
        </div>

        {/* Standard SVG Action Buttons (Copy, Feedback) */}
        <div className="flex items-center gap-1 pt-1 text-slate-400">
          <button
            onClick={handleCopy}
            title={copied ? 'Đã sao chép' : 'Sao chép nội dung'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? <CheckSvg size={14} className="text-emerald-600" /> : <CopySvg size={14} />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          <button
            onClick={() => setFeedback(feedback === 'liked' ? null : 'liked')}
            title="Hài lòng"
            className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
              feedback === 'liked' ? 'text-slate-950 bg-slate-100' : 'text-slate-400'
            }`}
          >
            <ThumbsUpSvg size={14} />
          </button>

          <button
            onClick={() => setFeedback(feedback === 'disliked' ? null : 'disliked')}
            title="Chưa hài lòng"
            className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
              feedback === 'disliked' ? 'text-slate-950 bg-slate-100' : 'text-slate-400'
            }`}
          >
            <ThumbsDownSvg size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
