import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Database, ShieldCheck, Cpu } from 'lucide-react';
import { CopilotAiSvg } from './SvgIcons';

const THINKING_STEPS = [
  { text: 'Phân tích ý định truy vấn & kiểm toán bảo mật AST...', icon: ShieldCheck },
  { text: 'Kết nối PostgreSQL 16 DWH qua giao thức MCP (Port 5435)...', icon: Database },
  { text: 'Đối soát số liệu thực tế với sổ kế hoạch KeHoach_NganSach_Q3_2026.xlsx...', icon: Cpu },
  { text: 'Mô hình nơ-ron tổng hợp nhận định C-Suite & cấu hình trực quan hóa...', icon: Brain }
];

export const ThinkingIndicator: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0.2);

  useEffect(() => {
    // Step progression every 450ms
    const stepTimer = setInterval(() => {
      setStepIndex((prev) => (prev < THINKING_STEPS.length - 1 ? prev + 1 : prev));
    }, 450);

    // Elapsed counter every 100ms
    const elapsedTimer = setInterval(() => {
      setElapsed((prev) => Math.round((prev + 0.1) * 10) / 10);
    }, 100);

    return () => {
      clearInterval(stepTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  const CurrentIcon = THINKING_STEPS[stepIndex].icon;

  return (
    <div className="flex gap-3.5 justify-start w-full font-sans animate-in fade-in duration-300">
      <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0 mt-0.5 border border-slate-900 shadow-xs relative">
        <CopilotAiSvg size={17} className="text-white" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
      </div>

      <div className="flex flex-col gap-2 max-w-xl">
        {/* Main Thinking Pill */}
        <div className="inline-flex items-center gap-2.5 py-2 px-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-2xs">
          <div className="w-5 h-5 rounded-lg bg-slate-900/10 text-slate-800 flex items-center justify-center shrink-0">
            <CurrentIcon className="w-3.5 h-3.5 animate-pulse" />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="font-bold text-slate-950">Suy nghĩ ({elapsed.toFixed(1)}s):</span>
            <span className="transition-all duration-300 text-slate-600 animate-in fade-in">
              {THINKING_STEPS[stepIndex].text}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>

        {/* Micro Step Trace */}
        <div className="flex items-center gap-1.5 pl-2">
          {THINKING_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx <= stepIndex ? 'w-6 bg-slate-950' : 'w-2 bg-slate-200'
              }`}
            />
          ))}
          <span className="text-[10px] font-mono text-slate-400 font-bold ml-1">
            {stepIndex + 1}/{THINKING_STEPS.length}
          </span>
        </div>
      </div>
    </div>
  );
};
