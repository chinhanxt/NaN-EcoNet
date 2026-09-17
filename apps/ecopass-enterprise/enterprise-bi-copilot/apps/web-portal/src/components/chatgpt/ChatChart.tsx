import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3 } from 'lucide-react';
import type { ChartConfig, ExecutionAuditStamp } from '@enterprise/shared-types';

interface ChatChartProps {
  chartConfig?: ChartConfig;
  records: any[];
  audit?: ExecutionAuditStamp;
  varianceData?: any;
}

// Clean date formatting helper: converts "2026-08-31T17:00:00.000Z" -> "31/08"
const formatAxisDate = (raw: string | Date | undefined): string => {
  if (!raw) return '';
  const str = String(raw).trim();
  const datePart = str.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return str;
};

export const ChatChart: React.FC<ChatChartProps> = ({
  chartConfig,
  records,
}) => {
  const chartRef = useRef<ReactECharts>(null);

  // Format currency helper
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

  // ECharts Configuration
  const option = useMemo(() => {
    if (!records || records.length === 0) return {};

    const isDepartment = records[0]?.actual_revenue !== undefined && records[0]?.target_revenue !== undefined;

    if (isDepartment) {
      const categories = records.map((r: any) => r.dept_name || r.departmentName || r.dept_code);
      const actuals = records.map((r: any) => Number(r.actual_revenue || r.actualRevenue || 0));
      const targets = records.map((r: any) => Number(r.target_revenue || r.targetRevenue || 0));
      const achievements = records.map((r: any) => Number(r.achievement_pct || r.achievementPct || r.target_achievement_pct || 0));

      return {
        backgroundColor: '#FFFFFF',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#0F172A',
          borderColor: '#1E293B',
          borderWidth: 1,
          padding: [10, 14],
          textStyle: { color: '#F8FAFC', fontSize: 12 },
          formatter: (params: any[]) => {
            let res = `<div style="font-weight: 800; font-size: 12px; margin-bottom: 6px; color: #F8FAFC;">${params[0]?.name}</div>`;
            params.forEach(p => {
              const isPct = p.seriesName.includes('%');
              const val = isPct ? `${p.value}%` : formatVND(p.value);
              res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:4px;font-size:11px;color:#CBD5E1;">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <span style="width:7px;height:7px;border-radius:50%;background:${p.color};"></span>
                  ${p.seriesName}
                </span>
                <b style="color:#FFFFFF;font-weight:700;">${val}</b>
              </div>`;
            });
            return res;
          }
        },
        legend: {
          right: 12,
          top: 0,
          icon: 'circle',
          itemWidth: 8,
          itemHeight: 8,
          itemGap: 14,
          data: ['Thực tế', 'Kế hoạch', '% Đạt mục tiêu'],
          textStyle: { color: '#64748B', fontSize: 11, fontWeight: '700' }
        },
        grid: {
          top: 36,
          left: '2%',
          right: '2%',
          bottom: 24,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: '#E2E8F0' } },
          axisTick: { show: false },
          axisLabel: { color: '#64748B', fontSize: 11, fontWeight: '600', interval: 0 }
        },
        yAxis: [
          {
            type: 'value',
            splitLine: { lineStyle: { color: '#F8FAFC', type: 'dashed' } },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
              color: '#94A3B8',
              fontSize: 11,
              fontWeight: '600',
              formatter: (v: number) => {
                if (v === 0) return '0';
                if (v >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
                if (v >= 1e6) return `${(v / 1e6).toFixed(0)} tr`;
                return `${v}`;
              }
            }
          },
          {
            type: 'value',
            min: 0,
            max: 100,
            splitLine: { show: false },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', formatter: '{value}%' }
          }
        ],
        series: [
          {
            name: 'Thực tế',
            type: 'bar',
            data: actuals,
            barMaxWidth: 20,
            itemStyle: { color: '#0F172A', borderRadius: [4, 4, 0, 0] },
            emphasis: { itemStyle: { color: '#334155' } }
          },
          {
            name: 'Kế hoạch',
            type: 'bar',
            data: targets,
            barMaxWidth: 20,
            itemStyle: { color: '#CBD5E1', borderRadius: [4, 4, 0, 0] },
            emphasis: { itemStyle: { color: '#94A3B8' } }
          },
          {
            name: '% Đạt mục tiêu',
            type: 'line',
            yAxisIndex: 1,
            data: achievements,
            symbol: 'circle',
            symbolSize: 5,
            itemStyle: { color: '#10B981' },
            lineStyle: { width: 2.2, color: '#10B981' }
          }
        ]
      };
    }

    // Default: Daily Revenue & Gross Margin Trend
    const categories = records.map((r: any) => formatAxisDate(r.transaction_date || r.date));
    const netRevenues = records.map((r: any) => Number(r.total_net_revenue || r.net_revenue || 0));
    const margins = records.map((r: any) => Number(r.gross_margin_pct || 0));

    return {
      backgroundColor: '#FFFFFF',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: '#CBD5E1', type: 'dashed' } },
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: '#F8FAFC', fontSize: 12 },
        formatter: (params: any[]) => {
          const dateName = params[0]?.name || '';
          let res = `<div style="font-weight: 800; font-size: 12px; margin-bottom: 6px; color: #F8FAFC;">Ngày ${dateName}/2026</div>`;
          params.forEach(p => {
            const isPct = p.seriesName.includes('%');
            const val = isPct ? `${p.value}%` : formatVND(p.value);
            res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:4px;font-size:11px;color:#CBD5E1;">
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="width:7px;height:7px;border-radius:50%;background:${p.color};"></span>
                ${p.seriesName}
              </span>
              <b style="color:#FFFFFF;font-weight:700;">${val}</b>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        right: 12,
        top: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
        data: ['Doanh thu thuần', 'Biên lợi nhuận gộp (%)'],
        textStyle: { color: '#64748B', fontSize: 11, fontWeight: '700' }
      },
      grid: {
        top: 36,
        left: '2%',
        right: '2%',
        bottom: 24,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748B',
          fontSize: 11,
          fontWeight: '600',
          interval: 'auto',
          margin: 12
        }
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: '#F8FAFC', type: 'dashed' } },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#94A3B8',
            fontSize: 11,
            fontWeight: '600',
            formatter: (v: number) => {
              if (v === 0) return '0';
              if (v >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
              if (v >= 1e6) return `${(v / 1e6).toFixed(0)} tr`;
              return `${v}`;
            }
          }
        },
        {
          type: 'value',
          min: 0,
          max: 100,
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', formatter: '{value}%' }
        }
      ],
      series: [
        {
          name: 'Doanh thu thuần',
          type: 'bar',
          data: netRevenues,
          barMaxWidth: 20,
          itemStyle: {
            color: '#0F172A',
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: { color: '#334155' }
          }
        },
        {
          name: 'Biên lợi nhuận gộp (%)',
          type: 'line',
          yAxisIndex: 1,
          data: margins,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#10B981' },
          lineStyle: { width: 2.2, color: '#10B981' }
        }
      ]
    };
  }, [records, chartConfig]);

  // Compute summary stats
  const totalRev = useMemo(() => {
    return records.reduce((sum: number, r: any) => {
      return sum + Number(r.total_net_revenue || r.actual_revenue || r.net_revenue || 0);
    }, 0);
  }, [records]);

  return (
    <div className="w-full my-2 border border-slate-200/90 rounded-2xl bg-white shadow-2xs overflow-hidden font-sans">
      {/* Clean Minimalist Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-950 text-white flex items-center justify-center shrink-0">
            <BarChart3 size={15} strokeWidth={2.4} />
          </div>
          <h4 className="text-sm font-black text-slate-950 tracking-tight whitespace-nowrap">
            {chartConfig?.title || 'Biểu đồ phân tích doanh thu'}
          </h4>
        </div>

        {totalRev > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng:</span>
            <span className="text-xs font-black text-slate-950 font-mono">
              {formatVND(totalRev)}
            </span>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="p-3 pt-4">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '300px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};

