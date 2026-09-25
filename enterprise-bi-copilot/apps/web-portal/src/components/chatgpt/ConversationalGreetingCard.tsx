import React from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  FileSpreadsheet, 
  Layers, 
  Server
} from 'lucide-react';
import { ArrowUpRightSvg, CopilotAiSvg } from './SvgIcons';

export interface ConversationalGreetingCardProps {
  greetingTitle?: string;
  greetingText?: string;
  onActionClick?: (prompt: string) => void;
}

export const ConversationalGreetingCard: React.FC<ConversationalGreetingCardProps> = ({
  greetingTitle = 'Chào Bạn! Tôi Là Copilot Điều Hành Doanh Nghiệp',
  greetingText = 'Hệ thống đã đồng bộ dữ liệu thời gian thực từ Data Warehouse PostgreSQL 16. Bạn muốn tra cứu nhanh số liệu nào?',
  onActionClick
}) => {
  const quickActions = [
    {
      title: 'Biến Thiên Doanh Thu',
      desc: 'Xu hướng ngày & biên LN Tháng 9',
      prompt: 'Vẽ biểu đồ biến thiên doanh thu tháng 9',
      icon: TrendingUp
    },
    {
      title: 'Hiệu Quả 5 Khối',
      desc: 'So sánh KPI thực tế vs chỉ tiêu Q3',
      prompt: 'Hiệu quả kinh doanh các phòng ban Q3/2026',
      icon: BarChart3
    },
    {
      title: 'Đối Soát Ngân Sách',
      desc: 'Kế hoạch Excel vs PostgreSQL',
      prompt: 'Đối soát ngân sách excel',
      icon: FileSpreadsheet
    },
    {
      title: 'Danh Sách Hợp Đồng',
      desc: '16 hợp đồng DWH thực tế',
      prompt: 'Cho tôi xem danh sách hợp đồng',
      icon: Layers
    }
  ];

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs my-2 font-sans">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <CopilotAiSvg size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-950 text-white whitespace-nowrap">
                Real AI Active
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-800 font-bold whitespace-nowrap bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                DWH Live 14ms
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-950 mt-1 whitespace-nowrap">
              {greetingTitle}
            </h3>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-bold text-slate-500 whitespace-nowrap">
          <Server className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
          <span>PostgreSQL 16 • 4 MCP Tools</span>
        </div>
      </div>

      {/* Greeting message text */}
      <p className="text-sm font-semibold text-slate-700 mt-3 leading-relaxed">
        {greetingText}
      </p>

      {/* 4 Quick Action Cards (Zero line wrapping) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {quickActions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <button
              key={idx}
              onClick={() => onActionClick?.(act.prompt)}
              className="flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-900 transition-all text-left cursor-pointer group shadow-2xs btn-tactile"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-slate-200 text-slate-900 group-hover:bg-slate-950 group-hover:text-white transition-colors">
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                </div>
                <ArrowUpRightSvg size={14} className="text-slate-400 group-hover:text-slate-950 transition-colors" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-950 whitespace-nowrap">
                  {act.title}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 mt-0.5 whitespace-nowrap truncate">
                  {act.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
