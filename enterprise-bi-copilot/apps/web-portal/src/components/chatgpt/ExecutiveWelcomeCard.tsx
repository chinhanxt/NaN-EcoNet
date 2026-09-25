import React from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  AlertCircle, 
  FileSpreadsheet, 
  Database,
  Layers,
  Inbox,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  ArrowUpRightSvg, 
  CeoPersonaSvg, 
  CfoPersonaSvg, 
  CooPersonaSvg, 
  DoubleDiamondSvg,
  JourneyStageSvg
} from './SvgIcons';

export type ExecutiveRole = 'CEO' | 'CFO' | 'COO';

export interface ExecutiveWelcomeCardProps {
  executiveName?: string;
  currentRole: ExecutiveRole;
  onRoleChange?: (role: ExecutiveRole) => void;
  systemStatus?: {
    isLive: boolean;
    latencyMs: number;
    lastSyncTime: string;
    dwhSource: string;
  };
  onQuickAction?: (promptText: string) => void;
}

export const ExecutiveWelcomeCard: React.FC<ExecutiveWelcomeCardProps> = ({
  executiveName = 'Ban Điều Hành',
  currentRole = 'CEO',
  onRoleChange,
  systemStatus = {
    isLive: true,
    latencyMs: 14,
    lastSyncTime: 'Vừa xong',
    dwhSource: 'PostgreSQL 16 (Port 5435)'
  },
  onQuickAction
}) => {
  const isCEO = currentRole === 'CEO';
  const isCFO = currentRole === 'CFO';
  const isCOO = currentRole === 'COO';

  const actions = isCEO
    ? [
        {
          title: 'Doanh Thu Q3',
          desc: 'Xung lực tăng trưởng',
          prompt: 'Tổng quan doanh thu thuần và deal pipeline Q3/2026',
          icon: TrendingUp
        },
        {
          title: 'Hiệu Quả 5 Khối',
          desc: 'KPI phòng ban Q3',
          prompt: 'Hiệu quả kinh doanh các phòng ban Q3/2026',
          icon: BarChart3
        },
        {
          title: 'Hợp Đồng Thực Tế',
          desc: '16 hợp đồng DWH',
          prompt: 'Cho tôi xem danh sách hợp đồng',
          icon: Layers
        },
        {
          title: 'Cảnh Báo Rủi Ro',
          desc: 'Lệch trần chi phí',
          prompt: 'Cảnh báo rủi ro chi phí vận hành',
          icon: AlertCircle
        }
      ]
    : isCFO
    ? [
        {
          title: 'Đối Soát Ngân Sách',
          desc: 'Excel vs PostgreSQL',
          prompt: 'Đối soát ngân sách excel',
          icon: FileSpreadsheet
        },
        {
          title: 'Chỉ Số KPI Vĩ Mô',
          desc: 'Doanh thu & Biên LN',
          prompt: 'Chỉ số KPI vĩ mô',
          icon: TrendingUp
        },
        {
          title: 'Danh Sách Hợp Đồng',
          desc: 'Công nợ & Tất toán',
          prompt: 'Cho tôi xem danh sách hợp đồng',
          icon: Layers
        },
        {
          title: 'Cấu Trúc Schema',
          desc: 'MCP DWH Catalog',
          prompt: 'Xem schema database',
          icon: Database
        }
      ]
    : [
        {
          title: 'Hộp Thư Đa Kênh',
          desc: 'Telegram, Email & Web',
          prompt: 'Xem trạng thái hàng đợi hỗ trợ đa kênh',
          icon: Inbox
        },
        {
          title: 'Độ Trễ Phản Hồi',
          desc: 'SLA AI vs Nhân sự',
          prompt: 'Thống kê SLA và tỷ lệ bot giải quyết thành công',
          icon: Sparkles
        },
        {
          title: 'Khách Hàng Trọng Tâm',
          desc: 'Ticket phân luồng cấp thiết',
          prompt: 'Danh sách hội thoại đang chờ người tiếp quản',
          icon: AlertCircle
        },
        {
          title: 'Lineage DWH',
          desc: 'Kiểm tra nguồn cấp dữ liệu',
          prompt: 'Xem schema database',
          icon: Database
        }
      ];

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs font-sans">
      {/* Top Bar: Brand, Persona Switcher & Live Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-slate-950 text-white">
              C-Suite Intelligence
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>DWH Live {systemStatus.latencyMs}ms</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200">
              <DoubleDiamondSvg size={13} className="text-slate-700" />
              <span>Double Diamond Framework</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 whitespace-nowrap">
            Trung Tâm Điều Hành Doanh Nghiệp
          </h1>
          <p className="text-xs font-bold text-slate-500">
            PostgreSQL 16 • Zero-Mock • Persona: <span className="text-slate-950 font-black">{isCEO ? 'Tổng Giám Đốc (CEO)' : isCFO ? 'Giám Đốc Tài Chính (CFO)' : 'Giám Đốc Vận Hành (COO)'}</span>
          </p>
        </div>

        {/* Persona Switcher (CEO / CFO / COO) with standardized SVG icons */}
        <div className="flex items-center self-start lg:self-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
          <button
            onClick={() => onRoleChange?.('CEO')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap btn-tactile ${
              isCEO
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CeoPersonaSvg size={14} className={isCEO ? 'text-white' : 'text-slate-500'} />
            <span>CEO</span>
          </button>
          <button
            onClick={() => onRoleChange?.('CFO')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap btn-tactile ${
              isCFO
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CfoPersonaSvg size={14} className={isCFO ? 'text-white' : 'text-slate-500'} />
            <span>CFO</span>
          </button>
          <button
            onClick={() => onRoleChange?.('COO')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap btn-tactile ${
              isCOO
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CooPersonaSvg size={14} className={isCOO ? 'text-white' : 'text-slate-500'} />
            <span>COO</span>
          </button>
        </div>
      </div>

      {/* Journey Mapping Breadcrumbs: Discover -> Define -> Develop -> Deliver */}
      <div className="py-3 px-3.5 my-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider shrink-0 pr-2">
          <JourneyStageSvg size={14} className="text-slate-900" />
          <span>Hành Trình Ra Quyết Định:</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">
          <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900">1. Khảo Sát (DWH)</span>
          <ArrowRight size={12} className="text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900">2. Xác Định Trọng Tâm</span>
          <ArrowRight size={12} className="text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900">3. Phân Tích Đối Soát</span>
          <ArrowRight size={12} className="text-slate-400" />
          <span className="px-2 py-0.5 rounded bg-slate-950 text-white">4. Ký Duyệt & Thực Thi</span>
        </div>
      </div>

      {/* Strategic Actions Grid: 4 Clean Bold Cards, Zero Wrapping */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
            Tác Vụ Chiến Lược 1-Chạm ({currentRole})
          </span>
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            Truy vấn tức thì
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={() => onQuickAction?.(act.prompt)}
                className="group flex flex-col justify-between p-4 rounded-2xl text-left bg-slate-50 hover:bg-slate-950 hover:text-white border border-slate-200 transition-all duration-150 cursor-pointer shadow-2xs btn-tactile"
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="p-2 rounded-xl bg-white text-slate-900 group-hover:bg-slate-800 group-hover:text-white transition-colors border border-slate-200/80">
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <ArrowUpRightSvg size={14} className="text-slate-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>

                <div>
                  <h3 className="text-xs font-black tracking-tight text-slate-950 group-hover:text-white whitespace-nowrap">
                    {act.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-300 mt-0.5 whitespace-nowrap">
                    {act.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
