import React from 'react';
import { Calendar, ArrowUpRight, ArrowDownRight, Minus, FileText, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

export interface SingleDaySpotlightProps {
  dateLabel: string;
  primaryMetric: {
    label: string;
    value: number;
    unit: string;
    deltaPercent?: number;
    trend?: 'up' | 'down' | 'neutral';
  };
  subMetrics: Array<{
    label: string;
    value: string;
    change?: string;
  }>;
  transactions?: Array<{
    code: string;
    client: string;
    product: string;
    value: number;
    discount: number;
    netRevenue: number;
    status: string;
  }>;
  hourlySparkline?: number[];
}

export const SingleDaySpotlight: React.FC<SingleDaySpotlightProps> = ({
  dateLabel,
  primaryMetric,
  subMetrics,
  transactions = [],
  hourlySparkline = [200, 350, 480, 650, 890, 1100]
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

  // Sparkline calculations
  const min = Math.min(...hourlySparkline);
  const max = Math.max(...hourlySparkline);
  const range = max - min || 1;
  const width = 140;
  const height = 36;

  const points = hourlySparkline
    .map((val, i) => {
      const x = (i / (hourlySparkline.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="w-full my-2 border border-slate-200/90 rounded-2xl bg-white shadow-2xs overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-950 text-white flex items-center justify-center shrink-0">
            <Calendar size={15} strokeWidth={2.4} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Báo cáo doanh thu theo ngày
            </span>
            <h4 className="text-sm font-black text-slate-950 tracking-tight leading-tight">
              {dateLabel}
            </h4>
          </div>
        </div>

        {primaryMetric.deltaPercent !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
            {primaryMetric.trend === 'down' ? (
              <ArrowDownRight size={14} strokeWidth={2.4} />
            ) : primaryMetric.trend === 'neutral' ? (
              <Minus size={14} strokeWidth={2.4} />
            ) : (
              <ArrowUpRight size={14} strokeWidth={2.4} />
            )}
            <span>
              {primaryMetric.deltaPercent > 0 ? `+${primaryMetric.deltaPercent}%` : `${primaryMetric.deltaPercent}%`}
            </span>
          </span>
        )}
      </div>

      {/* Hero Metric & Sparkline */}
      <div className="p-4 sm:p-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-500 block">
            {primaryMetric.label}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight tabular-nums mt-0.5">
            {formatVND(primaryMetric.value)}
          </div>
        </div>

        {/* Mini Sparkline Curve */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Xung lực tích lũy
          </span>
          <svg width={width} height={height} className="overflow-visible">
            <polyline
              fill="none"
              stroke="#0F172A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>

      {/* Sub-Metrics Grid */}
      <div className="px-4 sm:px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {subMetrics.map((item, idx) => (
          <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
              {item.label}
            </span>
            <div className="text-sm font-black text-slate-950 tabular-nums mt-0.5 whitespace-nowrap">
              {item.value}
            </div>
            {item.change && (
              <span className="text-[10px] font-semibold text-slate-400 mt-0.5 whitespace-nowrap">
                {item.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Transaction Records List in that Specific Day */}
      {transactions.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-500" />
              <span>Giao dịch phát sinh trong ngày ({transactions.length})</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
              DWH Verified
            </span>
          </div>

          <div className="space-y-2">
            {transactions.map((tx, idx) => (
              <div
                key={idx}
                className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {tx.code}
                    </span>
                    <span className="text-xs font-black text-slate-950">
                      {tx.client}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    <Tag size={11} className="text-slate-400" />
                    <span>{tx.product}</span>
                    {tx.discount > 0 && (
                      <span className="text-amber-600 font-semibold">
                        • Giảm giá: {formatVND(tx.discount)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-black text-slate-950 tabular-nums">
                      {formatVND(tx.netRevenue)}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Doanh thu thuần
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    tx.status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : tx.status === 'PENDING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {tx.status === 'PAID' ? 'Đã thu' : tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
