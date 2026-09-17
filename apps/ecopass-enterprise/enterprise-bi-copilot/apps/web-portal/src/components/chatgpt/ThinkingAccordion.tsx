import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, CheckCircle2 } from 'lucide-react';

interface ThinkingAccordionProps {
  durationSec?: number;
  steps?: string[];
  defaultOpen?: boolean;
}

const DEFAULT_STEPS = [
  'Nhận diện cú pháp truy vấn tự nhiên & cấu hình vai trò điều hành C-Suite',
  'Kiểm toán bảo mật AST: Thẩm tra cấu trúc SQL và bảo chứng Row-Level Security',
  'Truy vấn MCP PostgreSQL 16 DWH: Đồng bộ dữ liệu thực tế Tháng 9/2026',
  'Đối soát ma trận kế hoạch ngân sách và tính toán chỉ số chênh lệch',
  'Tổng hợp nhận định tài chính & cấu hình trực quan hóa hoàn tất'
];

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({
  durationSec = 1.6,
  steps = DEFAULT_STEPS,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="w-full mb-3 rounded-xl border border-slate-200/90 bg-slate-50/70 overflow-hidden font-sans text-xs transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2 flex items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Brain className="w-3.5 h-3.5 text-slate-900 stroke-[2.2]" />
          <span>Đã suy nghĩ trong <strong className="font-mono text-slate-950 font-bold">{durationSec.toFixed(1)}s</strong></span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 font-bold uppercase tracking-wider">
            {steps.length} bước
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-400 hover:text-slate-700">
          <span className="text-[11px] font-medium">{isOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3 pt-1 border-t border-slate-200/60 bg-white/60 space-y-1.5 text-slate-600 animate-in fade-in duration-200">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-[11px] font-medium text-slate-700">{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
