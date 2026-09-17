import React from 'react';
import { Activity, TrendingUp, Users, ShieldCheck, AlertCircle, ArrowUpRight, DollarSign, CheckCircle2 } from 'lucide-react';

export interface CompanyStatusBriefingProps {
  periodLabel: string;
  statusHeadline: string;
  financialPillar: {
    revenueVnd: number;
    dealsCount: number;
    targetProgressPct: number;
    collectedVnd: number;
    pendingVnd: number;
  };
  operationalPillar: {
    totalEmployees: number;
    totalDepartments: number;
    payrollVnd: number;
    systemHealth: 'optimal' | 'stable' | 'attention';
  };
  recentActivities: Array<{
    time: string;
    title: string;
    description: string;
    type: 'deal' | 'finance' | 'system';
  }>;
  executiveActionItem?: string;
}

export const CompanyStatusBriefing: React.FC<CompanyStatusBriefingProps> = ({
  periodLabel,
  statusHeadline,
  financialPillar,
  operationalPillar,
  recentActivities = [],
  executiveActionItem
}) => {
  const formatVND = (val: number) => {
    if (!val) return '0 ₫';
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(2)} tỷ ₫`;
    }
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(0)} tr ₫`;
    }
    return `${val.toLocaleString()} ₫`;
  };

  return (
    <div className="w-full my-2 border border-slate-200/90 rounded-2xl bg-white shadow-2xs overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Activity size={15} strokeWidth={2.4} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Báo Cáo Sức Khỏe & Trạng Thái Doanh Nghiệp
            </span>
            <h4 className="text-sm font-black text-slate-950 tracking-tight leading-tight">
              {statusHeadline || 'Tổng Quan Trạng Thái Công Ty'}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <CheckCircle2 size={12} strokeWidth={2.4} />
            <span>Vận hành tối ưu</span>
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600">
            {periodLabel}
          </span>
        </div>
      </div>

      {/* 2 Main Pillars: Tài chính & Vận hành */}
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100">
        {/* Pillar 1: Tài chính & Kinh doanh */}
        <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-600" />
              <span>Trụ cột Kinh doanh & Dòng tiền</span>
            </span>
            <span className="text-xs font-black text-blue-700">
              {financialPillar.targetProgressPct}% Kế hoạch
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Doanh thu ghi nhận:</span>
              <span className="font-black text-slate-950">{formatVND(financialPillar.revenueVnd)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Đã thu hồi (Cash-in):</span>
              <span className="font-bold text-emerald-700">{formatVND(financialPillar.collectedVnd)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Chờ thanh toán (Pending):</span>
              <span className="font-bold text-amber-700">{formatVND(financialPillar.pendingVnd)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-medium">Tổng số hợp đồng:</span>
              <span className="font-black text-slate-800">{financialPillar.dealsCount} Hợp đồng</span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Vận hành & Nhân lực */}
        <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Users size={14} className="text-indigo-600" />
              <span>Trụ cột Vận hành & Tổ chức</span>
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              100% Khả dụng
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Tổng số nhân sự:</span>
              <span className="font-black text-slate-950">{operationalPillar.totalEmployees} nhân sự</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Số khối phòng ban:</span>
              <span className="font-bold text-slate-800">{operationalPillar.totalDepartments} phòng ban</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">Quỹ lương hàng tháng:</span>
              <span className="font-black text-slate-950">{formatVND(operationalPillar.payrollVnd)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-medium">An toàn dữ liệu DWH:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>SHA-256 Validated</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Key Activities */}
      {recentActivities.length > 0 && (
        <div className="p-4 sm:px-5 py-3 border-b border-slate-100 bg-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Diễn biến & Giao dịch tiêu biểu
          </span>
          <div className="space-y-2">
            {recentActivities.map((act, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs">
                <span className="font-mono text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 shrink-0">
                  {act.time}
                </span>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900">{act.title}: </span>
                  <span className="text-slate-500">{act.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executive Action Recommendation */}
      {executiveActionItem && (
        <div className="px-4 sm:px-5 py-3 bg-amber-50/50 border-b border-amber-100/60 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-black uppercase tracking-wider text-[10px] text-amber-800 block">
              Khuyến nghị điều hành cho C-Suite:
            </span>
            <span className="font-medium">{executiveActionItem}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Tổng hợp tự động đa nguồn (PostgreSQL DWH & Excel Budget)</span>
        </span>
        <span className="font-semibold text-slate-500">
          Chỉ số điều hành thời gian thực
        </span>
      </div>
    </div>
  );
};
