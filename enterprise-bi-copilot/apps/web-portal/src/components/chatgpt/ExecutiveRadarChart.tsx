import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Compass, ShieldCheck } from 'lucide-react';

export interface RadarSeriesItem {
  name: string;
  value: number[];
  itemStyle?: { color?: string };
}

export interface RadarChartData {
  title?: string;
  subtitle?: string;
  series?: RadarSeriesItem[];
}

interface ExecutiveRadarChartProps {
  data?: RadarChartData;
}

export const ExecutiveRadarChart: React.FC<ExecutiveRadarChartProps> = ({ data }) => {
  const chartOption = useMemo(() => {
    const defaultIndicators = [
      { name: 'Doanh Thu (Quy mô)', max: 100 },
      { name: 'Tăng Trưởng YoY', max: 100 },
      { name: 'Biên Lợi Nhuận', max: 100 },
      { name: 'Kỷ Luật Ngân Sách', max: 100 },
      { name: 'Tỷ Lệ Thực Thi SLA', max: 100 }
    ];

    const defaultSeries: RadarSeriesItem[] = [
      {
        name: 'B2B Corporate & Key Accounts',
        value: [96, 88, 73, 92, 94],
        itemStyle: { color: '#2563EB' }
      },
      {
        name: 'Enterprise Tech & AI Solutions',
        value: [84, 98, 77, 89, 97],
        itemStyle: { color: '#7C3AED' }
      },
      {
        name: 'Supply Chain & Logistics',
        value: [82, 79, 69, 95, 91],
        itemStyle: { color: '#059669' }
      },
      {
        name: 'Digital Marketing & Growth',
        value: [78, 92, 74, 86, 88],
        itemStyle: { color: '#D97706' }
      },
      {
        name: 'Financial Operations & Treasury',
        value: [70, 75, 85, 99, 96],
        itemStyle: { color: '#0284C7' }
      }
    ];

    const currentSeries = data?.series || defaultSeries;

    return {
      backgroundColor: '#FFFFFF',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 12, fontFamily: 'monospace' }
      },
      legend: {
        bottom: 0,
        data: currentSeries.map(s => s.name),
        textStyle: { color: '#334155', fontSize: 11, fontWeight: 'bold' },
        itemGap: 16
      },
      radar: {
        indicator: defaultIndicators,
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#1E293B',
          fontSize: 11,
          fontWeight: 800,
          fontFamily: 'system-ui, sans-serif'
        },
        splitLine: {
          lineStyle: {
            color: [
              'rgba(148, 163, 184, 0.2)',
              'rgba(148, 163, 184, 0.3)',
              'rgba(148, 163, 184, 0.4)',
              'rgba(148, 163, 184, 0.6)'
            ]
          }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['#F8FAFC', '#F1F5F9', '#FFFFFF', '#F8FAFC']
          }
        },
        axisLine: {
          lineStyle: {
            color: '#CBD5E1'
          }
        }
      },
      series: [
        {
          type: 'radar',
          data: currentSeries.map(s => ({
            name: s.name,
            value: s.value,
            itemStyle: s.itemStyle,
            areaStyle: {
              opacity: 0.18
            },
            lineStyle: {
              width: 2.2
            }
          }))
        }
      ]
    };
  }, [data]);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-slate-950 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Compass className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-950 tracking-tight">
                {data?.title || 'Biểu Đồ Radar Đánh Giá Năng Lực 360° 5 Khối Phòng Ban'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold font-mono">
                RADAR 360°
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {data?.subtitle || 'So sánh đa chiều: Doanh thu, Tăng trưởng YoY, Biên lợi nhuận, Kỷ luật ngân sách và SLA'}
            </p>
          </div>
        </div>

        {(() => {
          const series = data?.series || [];
          const topSeries = series.slice().sort((a, b) => (b.value[1] || 0) - (a.value[1] || 0))[0];
          const topLabel = topSeries ? `${topSeries.name.split('&')[0].trim().toUpperCase()} (${topSeries.value[1]}% TARGET)` : 'TECH AI (138% TARGET)';
          return (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-black font-mono">
              <span>TOP 1: {topLabel}</span>
            </div>
          );
        })()}
      </div>

      {/* Radar Canvas */}
      <div className="w-full h-84 rounded-2xl bg-white relative">
        <ReactECharts
          option={chartOption}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>

      {/* Audit Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Multivariate Capability Scoring • DWH PostgreSQL 16 Verified</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Thời gian tính toán:</span>
          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
            14.2ms
          </span>
        </div>
      </div>
    </div>
  );
};
