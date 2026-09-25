import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Maximize2, Download, BarChart2, TrendingUp, Filter } from 'lucide-react';
import type { DailyTrendRow, ChartRenderOptions } from '../../types';

interface RevenueEChartProps {
  data: DailyTrendRow[];
  renderOptions?: ChartRenderOptions;
  onFilterChange?: (options: ChartRenderOptions) => void;
}

export const RevenueEChart: React.FC<RevenueEChartProps> = ({
  data,
  renderOptions = { chartType: 'combination', metricHighlight: 'all' },
  onFilterChange
}) => {
  const chartRef = useRef<ReactECharts>(null);

  // Format currency in millions or billions VND
  const formatCurrencyVND = (val: number) => {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(2)} Tỷ ₫`;
    }
    return `${(val / 1_000_000).toFixed(0)} Tr ₫`;
  };

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const dates = data.map(d => {
      const parts = d.transaction_date.split('-');
      return `${parts[2]}/${parts[1]}`;
    });

    const netRevenues = data.map(d => parseFloat(d.total_net_revenue || '0'));
    const grossMargins = data.map(d => parseFloat(d.gross_margin_pct || '0'));
    const totalDeals = data.map(d => parseInt(String(d.total_deals || '0'), 10));

    // Determine series based on chartType and metricHighlight
    const seriesList: any[] = [];

    // Series 1: Gross/Net Revenue Bar
    if (renderOptions.chartType === 'combination' || renderOptions.chartType === 'bar') {
      seriesList.push({
        name: 'Doanh thu thuần',
        type: 'bar',
        yAxisIndex: 0,
        barMaxWidth: 32,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#22D3EE' }, // Cyan light
            { offset: 0.7, color: '#0891B2' }, // Cyan deep
            { offset: 1, color: '#0E7490' }, // Teal
          ]),
          shadowColor: 'rgba(6, 182, 212, 0.25)',
          shadowBlur: 8,
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#67E8F9' },
              { offset: 1, color: '#06B6D4' },
            ]),
            shadowBlur: 14,
            shadowColor: 'rgba(6, 182, 212, 0.45)',
          }
        },
        data: netRevenues
      });
    }

    // Series 2: Gross Profit Margin Line
    if (renderOptions.chartType === 'combination' || renderOptions.chartType === 'line') {
      seriesList.push({
        name: 'Biên lợi nhuận gộp (%)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#10B981', // Emerald
          borderColor: '#064E3B',
          borderWidth: 2,
          shadowColor: 'rgba(16, 185, 129, 0.5)',
          shadowBlur: 10,
        },
        lineStyle: {
          width: 3.5,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#34D399' },
            { offset: 1, color: '#10B981' }
          ]),
          shadowColor: 'rgba(16, 185, 129, 0.35)',
          shadowBlur: 8,
        },
        areaStyle: renderOptions.chartType === 'line' ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.25)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.0)' }
          ])
        } : undefined,
        data: grossMargins
      });
    }

    return {
      backgroundColor: 'transparent',
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#64748B',
            width: 1,
            type: 'dashed'
          },
          label: {
            backgroundColor: '#0F172A',
            color: '#38BDF8',
            borderColor: '#334155',
            borderWidth: 1,
          }
        },
        backgroundColor: 'rgba(11, 15, 23, 0.95)',
        borderColor: 'rgba(6, 182, 212, 0.4)',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#E2E8F0',
          fontFamily: 'Inter, monospace',
        },
        extraCssText: 'box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); border-radius: 10px;',
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const row = data[idx];
          const dateStr = row.transaction_date;
          const netRev = parseFloat(row.total_net_revenue || '0');
          const cogs = parseFloat(row.total_cogs || '0');
          const grossProfit = parseFloat(row.total_gross_profit || '0');
          const margin = parseFloat(row.gross_margin_pct || '0');
          const deals = row.total_deals;

          return `
            <div style="font-family: Inter, sans-serif; min-width: 220px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(51, 65, 85, 0.7); padding-bottom: 6px; margin-bottom: 8px;">
                <span style="font-weight: 700; color: #F1F5F9; font-size: 13px;">Ngày ${dateStr}</span>
                <span style="font-size: 11px; background: rgba(6, 182, 212, 0.15); color: #38BDF8; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${deals} Hợp đồng</span>
              </div>
              <div style="font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94A3B8;">Doanh thu thuần:</span>
                  <span style="color: #38BDF8; font-weight: 700; font-family: monospace;">${formatCurrencyVND(netRev)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94A3B8;">Giá vốn COGS:</span>
                  <span style="color: #F87171; font-weight: 600; font-family: monospace;">${formatCurrencyVND(cogs)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #94A3B8;">Lợi nhuận gộp:</span>
                  <span style="color: #34D399; font-weight: 700; font-family: monospace;">${formatCurrencyVND(grossProfit)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(51, 65, 85, 0.6); padding-top: 5px; margin-top: 3px;">
                  <span style="color: #CBD5E1; font-weight: 600;">Biên lợi nhuận gộp:</span>
                  <span style="color: #10B981; font-weight: 800; font-size: 13px; font-family: monospace;">${margin.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          `;
        }
      },
      legend: {
        data: ['Doanh thu thuần', 'Biên lợi nhuận gộp (%)'],
        top: 6,
        textStyle: {
          color: '#CBD5E1',
          fontSize: 12,
          fontFamily: 'Inter, sans-serif'
        },
        itemGap: 24,
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '15%',
        top: '14%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: {
          lineStyle: { color: '#253248' }
        },
        axisLabel: {
          color: '#94A3B8',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace'
        },
        axisTick: {
          alignWithLabel: true,
          lineStyle: { color: '#253248' }
        }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Doanh thu (VND)',
          nameTextStyle: {
            color: '#64748B',
            fontSize: 11,
            align: 'right',
            padding: [0, 8, 4, 0]
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(37, 50, 72, 0.5)',
              type: 'dashed'
            }
          },
          axisLine: { show: false },
          axisLabel: {
            color: '#64748B',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            formatter: (val: number) => {
              if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
              if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
              return `${val}`;
            }
          }
        },
        {
          type: 'value',
          name: 'Biên lợi nhuận (%)',
          min: 0,
          max: 100,
          interval: 25,
          nameTextStyle: {
            color: '#10B981',
            fontSize: 11,
            align: 'left',
            padding: [0, 0, 4, 8]
          },
          splitLine: { show: false },
          axisLine: { show: false },
          axisLabel: {
            color: '#10B981',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            formatter: '{value}%'
          }
        }
      ],
      dataZoom: [
        {
          type: 'slider',
          show: true,
          xAxisIndex: [0],
          bottom: 4,
          height: 20,
          borderColor: '#1E293B',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          fillerColor: 'rgba(6, 182, 212, 0.15)',
          handleIcon: 'path://M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
          handleSize: '110%',
          handleStyle: {
            color: '#22D3EE',
            shadowBlur: 4,
            shadowColor: 'rgba(0, 0, 0, 0.6)',
          },
          textStyle: {
            color: '#64748B',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10
          },
          start: 0,
          end: 100
        },
        {
          type: 'inside',
          xAxisIndex: [0],
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true
        }
      ],
      series: seriesList
    };
  }, [data, renderOptions]);

  const setChartMode = (type: 'combination' | 'bar' | 'line') => {
    if (onFilterChange) {
      onFilterChange({
        ...renderOptions,
        chartType: type
      });
    }
  };

  return (
    <div className="titanium-panel rounded-xl p-5 border border-titanium-700/80 shadow-titanium-card relative">
      {/* Chart Top Controls */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-2 border-b border-titanium-800 gap-3">
        <div>
          <h2 className="text-sm font-bold text-titanium-100 flex items-center space-x-2 uppercase tracking-wide">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <span>BIẾN THIÊN DOANH THU & BIÊN LỢI NHUẬN THÁNG 9/2026</span>
          </h2>
          <p className="text-xs text-titanium-400 font-mono mt-0.5">
            Cột Doanh thu thuần (VND) kết hợp Đường Biên lợi nhuận gộp (%) • Zoom & Pan Enabled
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-titanium-900 border border-titanium-700/80 text-xs">
          <button
            onClick={() => setChartMode('combination')}
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${
              renderOptions.chartType === 'combination'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Kết hợp (Bar + Line)
          </button>
          <button
            onClick={() => setChartMode('bar')}
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${
              renderOptions.chartType === 'bar'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Chỉ Doanh thu (Bar)
          </button>
          <button
            onClick={() => setChartMode('line')}
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${
              renderOptions.chartType === 'line'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Chỉ Biên LN (Line)
          </button>
        </div>
      </div>

      {/* Main ECharts Canvas */}
      <div className="w-full h-[360px]">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
        />
      </div>

      {/* Footer Instructions / Info */}
      <div className="mt-2 pt-2 border-t border-titanium-800/80 flex items-center justify-between text-[11px] text-titanium-400 font-mono">
        <span className="flex items-center space-x-1 text-titanium-500">
          <span>* Lăn chuột trên biểu đồ để phóng to/thu nhỏ (Zoom), kéo thả thanh trượt dưới đáy để Pan.</span>
        </span>
        <span className="text-cyan-400/80">Apache ECharts 5.5 • Verified</span>
      </div>
    </div>
  );
};
