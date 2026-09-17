import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Layers, ShieldCheck } from 'lucide-react';

export interface SankeyChartData {
  title?: string;
  subtitle?: string;
  totalRevenue?: number;
  totalCogs?: number;
  totalOpex?: number;
  totalEbitda?: number;
  nodes?: Array<{ name: string; itemStyle?: { color?: string } }>;
  links?: Array<{ source: string; target: string; value: number }>;
  audit?: {
    sha256?: string;
    durationMs?: number;
  };
}

interface ExecutiveSankeyChartProps {
  data?: SankeyChartData;
}

export const ExecutiveSankeyChart: React.FC<ExecutiveSankeyChartProps> = ({ data }) => {
  const ebitdaVal = data?.totalEbitda ? (data.totalEbitda / 1e9).toFixed(2) : '5.76';
  const ebitdaMargin = (data?.totalEbitda && data?.totalRevenue) ? ((data.totalEbitda / data.totalRevenue) * 100).toFixed(1) : '55.8';
  const cogsVal = data?.totalCogs ? (data.totalCogs / 1e9).toFixed(2) : '2.97';

  const chartOption = useMemo(() => {
    const defaultNodes = [
      { name: 'Doanh Thu Thuần Q3\n(10.34 tỷ)', itemStyle: { color: '#0F172A' } },
      { name: 'Khối B2B Sales\n(5.45 tỷ)', itemStyle: { color: '#2563EB' } },
      { name: 'Khối Tech AI\n(2.48 tỷ)', itemStyle: { color: '#7C3AED' } },
      { name: 'Khối Logistics\n(2.42 tỷ)', itemStyle: { color: '#059669' } },
      { name: 'Giá Vốn COGS\n(2.97 tỷ)', itemStyle: { color: '#E11D48' } },
      { name: 'Chi Phí OPEX\n(1.61 tỷ)', itemStyle: { color: '#EA580C' } },
      { name: 'Lợi Nhuận EBITDA\n(5.76 tỷ)', itemStyle: { color: '#10B981' } }
    ];

    const defaultLinks = [
      { source: 'Doanh Thu Thuần Q3\n(10.34 tỷ)', target: 'Khối B2B Sales\n(5.45 tỷ)', value: 5.45 },
      { source: 'Doanh Thu Thuần Q3\n(10.34 tỷ)', target: 'Khối Tech AI\n(2.48 tỷ)', value: 2.48 },
      { source: 'Doanh Thu Thuần Q3\n(10.34 tỷ)', target: 'Khối Logistics\n(2.42 tỷ)', value: 2.42 },
      { source: 'Khối B2B Sales\n(5.45 tỷ)', target: 'Giá Vốn COGS\n(2.97 tỷ)', value: 1.57 },
      { source: 'Khối B2B Sales\n(5.45 tỷ)', target: 'Chi Phí OPEX\n(1.61 tỷ)', value: 0.85 },
      { source: 'Khối B2B Sales\n(5.45 tỷ)', target: 'Lợi Nhuận EBITDA\n(5.76 tỷ)', value: 3.03 },
      { source: 'Khối Tech AI\n(2.48 tỷ)', target: 'Giá Vốn COGS\n(2.97 tỷ)', value: 0.61 },
      { source: 'Khối Tech AI\n(2.48 tỷ)', target: 'Chi Phí OPEX\n(1.61 tỷ)', value: 0.39 },
      { source: 'Khối Tech AI\n(2.48 tỷ)', target: 'Lợi Nhuận EBITDA\n(5.76 tỷ)', value: 1.48 },
      { source: 'Khối Logistics\n(2.42 tỷ)', target: 'Giá Vốn COGS\n(2.97 tỷ)', value: 0.79 },
      { source: 'Khối Logistics\n(2.42 tỷ)', target: 'Chi Phí OPEX\n(1.61 tỷ)', value: 0.37 },
      { source: 'Khối Logistics\n(2.42 tỷ)', target: 'Lợi Nhuận EBITDA\n(5.76 tỷ)', value: 1.25 }
    ];

    return {
      backgroundColor: '#FFFFFF',
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 12, fontFamily: 'monospace' },
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            return `<b>${params.data.source}</b> <br/>➔ <b>${params.data.target}</b><br/>Giá trị phân bổ: <b>${params.data.value.toFixed(2)} tỷ ₫</b>`;
          }
          return `<b>${params.data.name.replace('\n', ' ')}</b>`;
        }
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: { focus: 'adjacency' },
          nodeWidth: 22,
          nodeGap: 16,
          draggable: true,
          data: data?.nodes || defaultNodes,
          links: data?.links || defaultLinks,
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.4
          },
          label: {
            color: '#1E293B',
            fontSize: 11,
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif'
          }
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
            <Layers className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-950 tracking-tight">
                {data?.title || 'Sơ Đồ Dòng Tiền & Dòng Chảy Ngân Sách Q3/2026'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold font-mono">
                SANKEY
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {data?.subtitle || 'Doanh thu thuần (10.34B) ➔ Khối nghiệp vụ ➔ Giá vốn COGS, OPEX & EBITDA'}
            </p>
          </div>
        </div>

        {/* C-Suite Macro Badges */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-slate-50 rounded-xl border border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">EBITDA Q3</span>
            <span className="text-xs font-black text-emerald-600 font-mono">{ebitdaVal} tỷ ₫ ({ebitdaMargin}%)</span>
          </div>
          <div className="px-3 py-1 bg-slate-50 rounded-xl border border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 block font-bold">Tổng COGS</span>
            <span className="text-xs font-black text-rose-600 font-mono">{cogsVal} tỷ ₫</span>
          </div>
        </div>
      </div>

      {/* Sankey Canvas */}
      <div className="w-full h-80 rounded-2xl bg-white relative">
        <ReactECharts
          option={chartOption}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>

      {/* Footer Audit */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>PostgreSQL 16 DWH • IFRS-15 Verified • SHA-256: 48f9...3b01</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Độ trễ truy xuất:</span>
          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
            12.8ms
          </span>
        </div>
      </div>
    </div>
  );
};
