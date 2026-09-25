import React from 'react';
import {
  TrendingUp,
  Briefcase,
  Percent,
  Target,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle,
  Clock
} from 'lucide-react';
import type { KpiSummaryData } from '../../types';

interface KpiHeaderStripProps {
  data: KpiSummaryData | null;
}

export const KpiHeaderStrip: React.FC<KpiHeaderStripProps> = ({ data }) => {
  if (!data) return null;

  // Format currency in billion VND
  const formatBillion = (amount: number) => {
    return `${(amount / 1_000_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Tỷ ₫`;
  };

  const revenueVariance = data.totalNetRevenue - data.targetRevenue;
  const isTargetAchieved = data.targetAchievementPct >= 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* KPI 1: Tổng doanh thu thuần */}
      <div className="titanium-panel rounded-xl p-5 border border-cyan-500/20 relative overflow-hidden group hover:border-cyan-500/40 transition-all shadow-titanium-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-titanium-400">
            Tổng Doanh Thu Thuần
          </span>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold text-titanium-50 tracking-tight font-sans">
            {formatBillion(data.totalNetRevenue)}
          </div>
          <div className="mt-1 flex items-center space-x-1.5 text-xs">
            <span className="inline-flex items-center text-emerald-400 font-semibold font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +{((revenueVariance / data.targetRevenue) * 100).toFixed(1)}%
            </span>
            <span className="text-titanium-400 font-mono">
              vs Target {formatBillion(data.targetRevenue)}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-2.5 border-t border-titanium-800/80 flex items-center justify-between text-[11px] text-titanium-400">
          <span>Chiết khấu: {(data.totalDiscounts / 1_000_000).toFixed(0)} Tr</span>
          <span className="text-cyan-400 font-mono">100% Real DWH</span>
        </div>
      </div>

      {/* KPI 2: Tổng số hợp đồng / deals */}
      <div className="titanium-panel rounded-xl p-5 border border-violet-500/20 relative overflow-hidden group hover:border-violet-500/40 transition-all shadow-titanium-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-titanium-400">
            Tổng Số Hợp Đồng (Deals)
          </span>
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 group-hover:scale-105 transition-transform">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold text-titanium-50 tracking-tight font-sans">
            {data.totalDeals} <span className="text-base font-normal text-titanium-400">Hợp đồng</span>
          </div>
          <div className="mt-1 flex items-center space-x-1.5 text-xs text-titanium-300">
            <span className="inline-flex items-center text-emerald-400 font-medium font-mono">
              <CheckCircle className="w-3 h-3 mr-1 inline" /> 15 Đã thanh toán
            </span>
            <span className="text-titanium-600">•</span>
            <span className="inline-flex items-center text-amber-400 font-medium font-mono">
              <Clock className="w-3 h-3 mr-1 inline" /> 1 Đang duyệt
            </span>
          </div>
        </div>

        <div className="mt-4 pt-2.5 border-t border-titanium-800/80 flex items-center justify-between text-[11px] text-titanium-400">
          <span>Giá trị HĐ: {formatBillion(data.totalContractValue)}</span>
          <span className="text-violet-400 font-mono">0 Huỷ / Nợ xấu</span>
        </div>
      </div>

      {/* KPI 3: Tỷ suất lợi nhuận bình quân */}
      <div className="titanium-panel rounded-xl p-5 border border-emerald-500/20 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-titanium-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-titanium-400">
            Tỷ Suất Lợi Nhuận BQ
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Percent className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold text-emerald-400 tracking-tight font-sans">
            {data.avgGrossMarginPct.toFixed(2)}%
          </div>
          <div className="mt-1 flex items-center space-x-1.5 text-xs text-titanium-400 font-mono">
            <span>Gross Profit:</span>
            <span className="text-emerald-300 font-semibold">{formatBillion(data.totalGrossProfit)}</span>
          </div>
        </div>

        <div className="mt-4 pt-2.5 border-t border-titanium-800/80 flex items-center justify-between text-[11px] text-titanium-400">
          <span>Giá vốn COGS: {formatBillion(data.totalCogs)}</span>
          <span className="text-emerald-400 font-mono">Vượt trần biên độ</span>
        </div>
      </div>

      {/* KPI 4: Tỷ lệ hoàn thành mục tiêu */}
      <div className="titanium-panel rounded-xl p-5 border border-amber-500/20 relative overflow-hidden group hover:border-amber-500/40 transition-all shadow-titanium-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-titanium-400">
            Hoàn Thành Mục Tiêu Q3
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
            <Target className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold text-titanium-50 tracking-tight font-sans flex items-baseline space-x-2">
            <span>{data.targetAchievementPct.toFixed(1)}%</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Vượt chỉ tiêu
            </span>
          </div>
          <div className="mt-2 w-full bg-titanium-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isTargetAchieved
                  ? 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                  : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(data.targetAchievementPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 pt-2.5 border-t border-titanium-800/80 flex items-center justify-between text-[11px] text-titanium-400">
          <span>Chênh lệch: +{formatBillion(revenueVariance)}</span>
          <span className="text-amber-400 font-mono">Tháng 9/2026</span>
        </div>
      </div>
    </div>
  );
};
