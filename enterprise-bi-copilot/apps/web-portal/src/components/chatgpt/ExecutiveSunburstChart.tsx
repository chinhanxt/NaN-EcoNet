import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { PieChart, ShieldCheck } from 'lucide-react';

export interface SunburstNode {
  name: string;
  value?: number;
  itemStyle?: { color?: string };
  children?: SunburstNode[];
}

export interface SunburstChartData {
  title?: string;
  subtitle?: string;
  data?: SunburstNode[];
}

interface ExecutiveSunburstChartProps {
  data?: SunburstChartData;
}

export const ExecutiveSunburstChart: React.FC<ExecutiveSunburstChartProps> = ({ data }) => {
  const chartOption = useMemo(() => {
    const defaultData: SunburstNode[] = [
      {
        name: 'Cloud ERP & Apps\n(16.10B)',
        itemStyle: { color: '#2563EB' },
        children: [
          { name: 'Cloud ERP SaaS', value: 8.50, itemStyle: { color: '#3B82F6' } },
          { name: 'Omnichannel CRM', value: 4.20, itemStyle: { color: '#60A5FA' } },
          { name: 'Analytics Suite', value: 3.40, itemStyle: { color: '#93C5FD' } }
        ]
      },
      {
        name: 'Supply Chain IoT\n(7.35B)',
        itemStyle: { color: '#059669' },
        children: [
          { name: 'Terminal Dispatch Hub', value: 3.20, itemStyle: { color: '#10B981' } },
          { name: 'Cold-chain Telematics', value: 2.30, itemStyle: { color: '#34D399' } },
          { name: 'Dynamic Route AI', value: 1.85, itemStyle: { color: '#6EE7B7' } }
        ]
      },
      {
        name: 'AI & Core Tech\n(6.33B)',
        itemStyle: { color: '#7C3AED' },
        children: [
          { name: 'Autonomous Agent Mesh', value: 2.45, itemStyle: { color: '#8B5CF6' } },
          { name: 'Custom LLM Copilot', value: 1.85, itemStyle: { color: '#A78BFA' } },
          { name: 'Zero-Trust Gateway', value: 1.15, itemStyle: { color: '#C4B5FD' } },
          { name: 'MCP Data Hub', value: 0.88, itemStyle: { color: '#DDD6FE' } }
        ]
      },
      {
        name: 'Digital Growth\n(6.00B)',
        itemStyle: { color: '#D97706' },
        children: [
          { name: 'MarTech CDP', value: 2.80, itemStyle: { color: '#F59E0B' } },
          { name: 'Ad Campaign AI', value: 1.90, itemStyle: { color: '#FBBF24' } },
          { name: 'Loyalty Engine', value: 1.30, itemStyle: { color: '#FDE68A' } }
        ]
      }
    ];

    return {
      backgroundColor: '#FFFFFF',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 12, fontFamily: 'monospace' },
        formatter: (params: any) => {
          return `<b>${params.name.replace('\n', ' ')}</b><br/>Doanh thu: <b>${params.value ? params.value.toFixed(2) + ' tỷ ₫' : ''}</b>`;
        }
      },
      series: {
        type: 'sunburst',
        data: data?.data || defaultData,
        radius: [0, '92%'],
        sort: undefined,
        emphasis: {
          focus: 'ancestor'
        },
        levels: [
          {},
          {
            r0: '15%',
            r: '45%',
            itemStyle: {
              borderWidth: 2,
              borderColor: '#FFFFFF'
            },
            label: {
              rotate: 'tangential',
              fontSize: 10,
              fontWeight: 800,
              color: '#FFFFFF'
            }
          },
          {
            r0: '45%',
            r: '88%',
            label: {
              align: 'right',
              fontSize: 10,
              fontWeight: 700,
              color: '#1E293B'
            },
            itemStyle: {
              borderWidth: 2,
              borderColor: '#FFFFFF'
            }
          }
        ]
      }
    };
  }, [data]);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-slate-950 text-white flex items-center justify-center shrink-0 shadow-xs">
            <PieChart className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-950 tracking-tight">
                {data?.title || 'Cơ Cấu Danh Mục Sản Phẩm & Thị Phần Giải Pháp (Sunburst)'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold font-mono">
                SUNBURST
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {data?.subtitle || 'Phân rã 2 tầng: Nhóm giải pháp chiến lược ➔ Từng sản phẩm chi tiết Q3/2026'}
            </p>
          </div>
        </div>

        {(() => {
          const items = data?.data || [];
          let topItem: any = null;
          let totalVal = 0;
          items.forEach(it => {
            const catVal = (it.children || []).reduce((s: number, c: any) => s + (c.value || 0), 0) || it.value || 0;
            totalVal += catVal;
            if (!topItem || catVal > topItem.val) {
              topItem = { name: it.name.split('\n')[0], val: catVal };
            }
          });
          const topPct = (topItem && totalVal > 0) ? ((topItem.val / totalVal) * 100).toFixed(1) : '32.2';
          const topLabel = topItem ? `${topItem.name} (${topPct}%)` : 'Cloud ERP (32.2%)';
          return (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-blue-50 rounded-xl border border-blue-200 text-right">
                <span className="text-[10px] text-blue-600 block font-bold">Top Trụ Cột</span>
                <span className="text-xs font-black text-blue-800 font-mono">{topLabel}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Sunburst Canvas */}
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
          <span>Product Hierarchy Tree • PostgreSQL 16 DWH Category Aggregated</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Độ trễ tính toán:</span>
          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
            11.9ms
          </span>
        </div>
      </div>
    </div>
  );
};
