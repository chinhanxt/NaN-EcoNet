import React from 'react';
import { Trophy, TrendingUp, Users, ArrowUpRight, ShieldCheck, Building2 } from 'lucide-react';

export interface LeaderboardItem {
  rank: number;
  id: string;
  name: string;
  subtitle?: string;
  category?: string;
  primaryValue: number;
  secondaryValue?: string | number;
  percentage?: number;
  badge?: string;
  status?: 'top_performer' | 'growing' | 'stable' | 'at_risk';
}

export interface DynamicLeaderboardTableProps {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  totalVolume?: number;
  items: LeaderboardItem[];
  metricLabel?: string;
}

export const DynamicLeaderboardTable: React.FC<DynamicLeaderboardTableProps> = ({
  title,
  subtitle,
  periodLabel = 'Tháng 09/2026',
  totalVolume,
  items = [],
  metricLabel = 'Doanh thu thuần'
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

  const maxValue = items.length > 0 ? Math.max(...items.map((i) => i.primaryValue)) : 1;

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs ring-2 ring-amber-100">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-6 h-6 rounded-full bg-slate-400 text-white font-black text-xs flex items-center justify-center shadow-xs ring-2 ring-slate-100">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-6 h-6 rounded-full bg-amber-700/80 text-white font-black text-xs flex items-center justify-center shadow-xs ring-2 ring-amber-100">
          3
        </span>
      );
    }
    return (
      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
        {rank}
      </span>
    );
  };

  return (
    <div className="w-full my-2 border border-slate-200/90 rounded-2xl bg-white shadow-2xs overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Trophy size={15} strokeWidth={2.4} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Bảng xếp hạng hiệu suất
            </span>
            <h4 className="text-sm font-black text-slate-950 tracking-tight leading-tight">
              {title}
            </h4>
          </div>
        </div>

        {periodLabel && (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60">
            {periodLabel}
          </span>
        )}
      </div>

      {/* Subheader info if available */}
      {(subtitle || totalVolume !== undefined) && (
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/30 border-b border-slate-100/70 flex items-center justify-between text-xs text-slate-500">
          <span>{subtitle || 'Dữ liệu được cập nhật từ hệ thống DWH'}</span>
          {totalVolume !== undefined && (
            <span className="font-bold text-slate-800">
              Tổng giá trị: <span className="font-black text-indigo-700">{formatVND(totalVolume)}</span>
            </span>
          )}
        </div>
      )}

      {/* Table List */}
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const ratio = Math.min(100, Math.max(8, (item.primaryValue / (maxValue || 1)) * 100));

          return (
            <div
              key={item.id || item.rank}
              className="p-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Left: Rank & Entity Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">{getRankBadge(item.rank)}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {item.name}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <span className="text-[11px] text-slate-400 block truncate font-medium">
                      {item.subtitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Metrics & In-cell Progress Bar */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-9 sm:pl-0">
                <div className="w-24 sm:w-32 hidden sm:block">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.rank === 1
                          ? 'bg-amber-500'
                          : item.rank === 2
                          ? 'bg-slate-500'
                          : item.rank === 3
                          ? 'bg-amber-700'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs sm:text-sm font-black text-slate-950 block tabular-nums">
                    {formatVND(item.primaryValue)}
                  </span>
                  {item.percentage !== undefined ? (
                    <span className="text-[10px] font-bold text-slate-400">
                      {item.percentage}% tổng số
                    </span>
                  ) : item.secondaryValue ? (
                    <span className="text-[10px] font-medium text-slate-400">
                      {item.secondaryValue}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            Không có dữ liệu xếp hạng trong kỳ này.
          </div>
        )}
      </div>

      {/* Footer Audit */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Xác thực từ PostgreSQL DWH</span>
        </span>
        <span className="font-semibold text-slate-500">
          {items.length} thực thể dẫn đầu
        </span>
      </div>
    </div>
  );
};
