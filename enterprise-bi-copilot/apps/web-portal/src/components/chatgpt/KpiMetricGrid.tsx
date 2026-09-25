import React from 'react';
import { ArrowUpRightSvg, ArrowDownRightSvg } from './SvgIcons';
import { DollarSign, TrendingUp, Percent, Briefcase } from 'lucide-react';

export interface MetricItem {
  id: string;
  title: string;
  value: string;
  subValue?: string;
  changePct: number;
  changeLabel: string;
  trendDirection: 'up' | 'down' | 'neutral';
  isPositive: boolean;
  history?: number[];
  category?: 'revenue' | 'growth' | 'margin' | 'deals';
}

export interface KpiMetricGridProps {
  metrics?: MetricItem[];
}

/**
 * Micro Sparkline SVG Component (Zero extra dependencies, crisp bold vector stroke)
 */
const MiniSparkline: React.FC<{ data?: number[]; isPositive: boolean; id: string }> = ({ 
  data, 
  isPositive 
}) => {
  const pointsData = data && data.length >= 2 ? data : [14, 16, 15, 18, 20, 23, 26];

  const min = Math.min(...pointsData);
  const max = Math.max(...pointsData);
  const range = max - min === 0 ? 1 : max - min;
  const width = 64;
  const height = 24;
  const padding = 2;

  const points = pointsData.map((val, idx) => {
    const x = (idx / (pointsData.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((val - min) / range) * (height - padding * 2) - padding;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = points.join(' ');
  const strokeColor = isPositive ? '#059669' : '#DC2626';

  return (
    <div className="w-[64px] h-[24px] shrink-0 select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylineStr}
        />
      </svg>
    </div>
  );
};

// Chuẩn hóa tiêu đề siêu ngắn gọn, chống rớt hàng 100%
const formatKpiTitle = (raw: string) => {
  if (/doanh thu thuần|net rev/i.test(raw)) return 'Doanh Thu Thuần';
  if (/tăng trưởng|growth|yoy/i.test(raw)) return 'Tăng Trưởng YoY';
  if (/biên lợi nhuận|margin/i.test(raw)) return 'Biên Lợi Nhuận';
  if (/hợp đồng|deals/i.test(raw)) return 'Hợp Đồng Ký Kết';
  return raw.replace(/\(.*?\)/g, '').trim().slice(0, 18);
};

export const KpiMetricGrid: React.FC<KpiMetricGridProps> = ({
  metrics = [
    {
      id: 'net-revenue',
      title: 'Doanh Thu Thuần',
      value: '28.45 Tỷ',
      subValue: 'Chỉ tiêu: 25.00 Tỷ',
      changePct: 13.8,
      changeLabel: 'vượt chỉ tiêu Q3',
      trendDirection: 'up',
      isPositive: true,
      history: [18.2, 19.5, 21.0, 22.4, 24.1, 26.8, 28.45],
      category: 'revenue'
    },
    {
      id: 'yoy-growth',
      title: 'Tăng Trưởng YoY',
      value: '+24.6%',
      subValue: 'Cùng kỳ: 22.8 Tỷ',
      changePct: 5.2,
      changeLabel: 'tăng tốc vs Q2',
      trendDirection: 'up',
      isPositive: true,
      history: [12.0, 14.5, 16.2, 18.0, 20.1, 22.8, 24.6],
      category: 'growth'
    },
    {
      id: 'gross-margin',
      title: 'Biên Lợi Nhuận',
      value: '42.8%',
      subValue: 'Chuẩn ngành: 40.0%',
      changePct: -1.2,
      changeLabel: 'áp lực COGS',
      trendDirection: 'down',
      isPositive: false,
      history: [45.1, 44.8, 44.2, 43.6, 43.1, 42.9, 42.8],
      category: 'margin'
    },
    {
      id: 'deals-closed',
      title: 'Hợp Đồng Ký Kết',
      value: '142 Deals',
      subValue: 'TB: 200 Triệu / Deal',
      changePct: 8.4,
      changeLabel: 'vượt kế hoạch tháng',
      trendDirection: 'up',
      isPositive: true,
      history: [95, 102, 110, 118, 125, 134, 142],
      category: 'deals'
    }
  ]
}) => {
  const getCategoryIcon = (category?: MetricItem['category']) => {
    switch (category) {
      case 'revenue':
        return <DollarSign className="w-3.5 h-3.5 stroke-[2.2] text-slate-900" />;
      case 'growth':
        return <TrendingUp className="w-3.5 h-3.5 stroke-[2.2] text-slate-900" />;
      case 'margin':
        return <Percent className="w-3.5 h-3.5 stroke-[2.2] text-slate-900" />;
      case 'deals':
      default:
        return <Briefcase className="w-3.5 h-3.5 stroke-[2.2] text-slate-900" />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full my-2 font-sans">
      {metrics.map((metric) => {
        const isUp = metric.trendDirection === 'up';
        const displayTitle = formatKpiTitle(metric.title);
        return (
          <div
            key={metric.id}
            className="flex flex-col justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-slate-900 transition-all duration-150 relative overflow-hidden group"
          >
            {/* Top row: Label & Icon (Strict Zero Wrap) */}
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap truncate">
                {displayTitle}
              </span>
              <div className="p-1 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
                {getCategoryIcon(metric.category)}
              </div>
            </div>

            {/* Middle row: Big Bold Value + Sparkline */}
            <div className="flex items-end justify-between gap-2 my-1">
              <div className="min-w-0">
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 tabular-nums whitespace-nowrap">
                  {metric.value}
                </div>
                {metric.subValue && (
                  <div className="text-[11px] font-semibold text-slate-400 mt-0.5 whitespace-nowrap truncate">
                    {metric.subValue}
                  </div>
                )}
              </div>
              <MiniSparkline data={metric.history} isPositive={metric.isPositive} id={metric.id} />
            </div>

            {/* Bottom row: Delta badge */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums whitespace-nowrap ${
                  metric.isPositive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {isUp ? (
                  <ArrowUpRightSvg size={12} className="stroke-[2.5]" />
                ) : (
                  <ArrowDownRightSvg size={12} className="stroke-[2.5]" />
                )}
                <span>{metric.changePct > 0 ? `+${metric.changePct}%` : `${metric.changePct}%`}</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap truncate">
                {metric.changeLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
