import React, { useState } from 'react';
import { 
  CheckCircle, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { CopySvg, CheckSvg } from './SvgIcons';

export interface InsightPoint {
  title: string;
  description: string;
  metricHighlight?: string;
  sentiment?: 'positive' | 'warning' | 'neutral';
}

export interface ExecutiveBriefingCardProps {
  memorandumId?: string;
  title: string;
  categoryTag?: string;
  timestamp?: string;
  confidenceScore?: number;
  aiModel?: string;
  summaryText: string;
  insights: InsightPoint[];
  actionItems: string[];
  verifiedSources?: string[];
  onExportPdf?: () => void;
  onAskFollowup?: (question: string) => void;
}

export const ExecutiveBriefingCard: React.FC<ExecutiveBriefingCardProps> = ({
  memorandumId = 'MEMO-2026-Q3-09',
  title = 'Bản Nhận Định Chiến Lược: Hiệu Năng Kinh Doanh & Biên Lợi Nhuận',
  categoryTag = 'Chiến Lược C-Suite',
  timestamp = '20/09/2026 20:30',
  confidenceScore = 98.5,
  aiModel = 'Antigravity Gemini (Proxy 8899)',
  summaryText,
  insights,
  actionItems,
  onExportPdf,
  onAskFollowup
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const fullContent = `${title}\n${summaryText}\n\nNhận định:\n${insights.map(i => `- ${i.title}: ${i.description}`).join('\n')}\n\nĐề xuất:\n${actionItems.map(a => `- ${a}`).join('\n')}`;
    navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden my-3.5 font-sans">
      {/* Top Memorandum Header */}
      <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-950 text-white whitespace-nowrap">
              Executive Memo
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-200 text-slate-900 border border-slate-300 whitespace-nowrap">
              {categoryTag}
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-400 whitespace-nowrap">
              #{memorandumId}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight whitespace-nowrap">
            {title}
          </h2>
        </div>

        {/* AI & Confidence Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-emerald-800 whitespace-nowrap">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 stroke-[2.2]" />
              <span>{confidenceScore}% Xác Thực</span>
            </div>
            <span className="text-[10px] text-slate-400 block font-mono font-bold whitespace-nowrap">
              {aiModel}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl border border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer btn-tactile"
            title="Sao chép nội dung"
          >
            {copied ? <CheckSvg size={14} className="text-emerald-600" /> : <CopySvg size={14} />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* Executive Summary Block */}
        <div className="bg-slate-50 border-l-4 border-slate-950 p-4 rounded-r-xl">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1 whitespace-nowrap">
            Tóm Tắt Cốt Lõi (Executive Abstract)
          </span>
          <p className="text-sm font-semibold text-slate-900 leading-relaxed">
            {summaryText}
          </p>
        </div>

        {/* Section 1: Deep Strategic Insights */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-slate-950 stroke-[2.2]" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 whitespace-nowrap">
              Nhận Định Chiến Lược C-Suite
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((item, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-950 transition-all flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-black text-slate-950 whitespace-nowrap">
                      {item.title}
                    </span>
                    {item.metricHighlight && (
                      <span className="font-mono text-xs font-black text-white bg-slate-950 px-2 py-0.5 rounded whitespace-nowrap">
                        {item.metricHighlight}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Action Items */}
        {actionItems && actionItems.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-black uppercase tracking-wider text-slate-900 whitespace-nowrap">
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Hành Động Khuyến Nghị</span>
            </div>
            <div className="space-y-1.5">
              {actionItems.map((action, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0 mt-1.5" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
