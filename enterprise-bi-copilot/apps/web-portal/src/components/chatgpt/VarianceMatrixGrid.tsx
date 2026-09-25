import * as React from "react";
import {
  ArrowUpRightSvg,
  CheckSvg
} from "./SvgIcons";
import { AlertCircle } from "lucide-react";

export type VarianceStatus = "EXCEEDED" | "ON_TRACK" | "AT_RISK";

export interface BudgetItemVariance {
  id: string;
  categoryCode: string;
  categoryName: string;
  plannedBillionVnd: number;  // Kế hoạch (Excel) - Tỷ VND
  actualBillionVnd: number;   // Thực tế (PostgreSQL) - Tỷ VND
}

interface ComputedBudgetItem extends BudgetItemVariance {
  varianceBillionVnd: number;
  achievementRate: number;
  status: VarianceStatus;
}

const computeRow = (item: BudgetItemVariance): ComputedBudgetItem => {
  const variance = item.actualBillionVnd - item.plannedBillionVnd;
  const rate = item.plannedBillionVnd > 0 ? (item.actualBillionVnd / item.plannedBillionVnd) * 100 : 0;

  let status: VarianceStatus = "ON_TRACK";
  if (rate >= 105) {
    status = "EXCEEDED";
  } else if (rate < 90) {
    status = "AT_RISK";
  }

  return {
    ...item,
    varianceBillionVnd: variance,
    achievementRate: rate,
    status,
  };
};

const badgeStyles: Record<VarianceStatus, { label: string; class: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  EXCEEDED: {
    label: "VƯỢT CHỈ TIÊU",
    icon: ArrowUpRightSvg,
    class: "bg-emerald-50 text-emerald-800 border-emerald-300",
  },
  ON_TRACK: {
    label: "ĐẠT TIẾN ĐỘ",
    icon: CheckSvg,
    class: "bg-slate-100 text-slate-800 border-slate-300",
  },
  AT_RISK: {
    label: "CẢNH BÁO RỦI RO",
    icon: ({ className }) => <AlertCircle className={`w-3 h-3 ${className}`} />,
    class: "bg-rose-50 text-rose-800 border-rose-300",
  },
};

export function VarianceMatrixGrid({ items }: { items: BudgetItemVariance[] }) {
  const computedData = React.useMemo(() => items.map(computeRow), [items]);

  const totals = React.useMemo(() => {
    const planned = computedData.reduce((acc, row) => acc + row.plannedBillionVnd, 0);
    const actual = computedData.reduce((acc, row) => acc + row.actualBillionVnd, 0);
    const variance = actual - planned;
    const rate = planned > 0 ? (actual / planned) * 100 : 0;
    return { planned, actual, variance, rate };
  }, [computedData]);

  return (
    <div className="w-full space-y-2.5 font-sans text-xs my-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-0.5">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-950 tracking-tight whitespace-nowrap">
            Ma Trận Đối Soát Ngân Sách Thực Tế vs Kế Hoạch
          </h3>
          <p className="text-slate-500 text-xs font-semibold whitespace-nowrap">
            Nguồn: Dự toán Excel 2026 vs DWH PostgreSQL 16
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-700 font-bold">&gt; 105% (Vượt)</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-slate-700 font-bold">90 - 105% (Đạt)</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-slate-700 font-bold">&lt; 90% (Rủi ro)</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-extrabold uppercase tracking-wider">
                <th className="py-2.5 px-3.5 whitespace-nowrap">Khoản Mục Doanh Thu</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Kế Hoạch (Excel)</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Thực Tế (DWH)</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Chênh Lệch (+/-)</th>
                <th className="py-2.5 px-3.5 text-left w-36 whitespace-nowrap">% Hoàn Thành</th>
                <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Đánh Giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {computedData.map((row) => {
                const isPositive = row.varianceBillionVnd >= 0;
                const badge = badgeStyles[row.status];
                const BadgeIcon = badge.icon;
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="font-extrabold text-slate-950">
                        {row.categoryName}
                      </div>
                      <div className="text-[10px] font-mono font-bold text-slate-400">
                        {row.categoryCode}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-600 font-bold whitespace-nowrap">
                      {row.plannedBillionVnd.toFixed(2)} tỷ
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-950 font-black whitespace-nowrap">
                      {row.actualBillionVnd.toFixed(2)} tỷ
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-right font-mono tabular-nums font-black whitespace-nowrap ${
                        isPositive
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {row.varianceBillionVnd.toFixed(2)} tỷ
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="w-12 font-mono font-bold text-right tabular-nums text-slate-900 text-[11px]">
                          {row.achievementRate.toFixed(1)}%
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden min-w-[50px]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              row.status === "EXCEEDED"
                                ? "bg-emerald-500"
                                : row.status === "AT_RISK"
                                ? "bg-rose-500"
                                : "bg-slate-900"
                            }`}
                            style={{ width: `${Math.min(row.achievementRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${badge.class}`}
                      >
                        <BadgeIcon size={11} className="shrink-0" />
                        <span>{badge.label}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary Sticky Footer */}
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-black text-slate-950">
                <td className="py-2.5 px-3.5 uppercase tracking-wider text-xs whitespace-nowrap">
                  Tổng Cộng Đối Soát
                </td>
                <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                  {totals.planned.toFixed(2)} tỷ
                </td>
                <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                  {totals.actual.toFixed(2)} tỷ
                </td>
                <td
                  className={`py-2.5 px-3.5 text-right font-mono tabular-nums text-xs whitespace-nowrap ${
                    totals.variance >= 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {totals.variance >= 0 ? "+" : ""}
                  {totals.variance.toFixed(2)} tỷ
                </td>
                <td className="py-2.5 px-3.5 whitespace-nowrap">
                  <span className="font-mono tabular-nums text-xs font-black">
                    {totals.rate.toFixed(1)}% TB
                  </span>
                </td>
                <td className="py-2.5 px-3.5 text-center text-xs text-slate-500 font-bold whitespace-nowrap">
                  Khớp DWH 100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
