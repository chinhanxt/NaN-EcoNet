import React, { useState, useMemo } from "react";
import {
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Clock,
  AlertTriangle
} from "lucide-react";
import { CheckSvg } from "./SvgIcons";

export type ContractStatus = "PAID" | "PENDING" | "OVERDUE";
export type ContractType = "ENTERPRISE" | "SME" | "GOVERNMENT";

export interface ContractRecord {
  id: string;
  contractCode: string;
  clientName: string;
  type: ContractType;
  revenueVnd: number;
  signedDate: string;
  status: ContractStatus;
}

const statusConfig: Record<
  ContractStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; style: string }
> = {
  PAID: {
    label: "Đã Tất Toán",
    icon: ({ className }) => <CheckSvg size={12} className={className} />,
    style: "bg-emerald-50 text-emerald-800 border-emerald-300",
  },
  PENDING: {
    label: "Chờ Xử Lý",
    icon: ({ className }) => <Clock className={`w-3 h-3 ${className}`} />,
    style: "bg-slate-100 text-slate-800 border-slate-300",
  },
  OVERDUE: {
    label: "Quá Hạn",
    icon: ({ className }) => <AlertTriangle className={`w-3 h-3 ${className}`} />,
    style: "bg-rose-50 text-rose-800 border-rose-300",
  },
};

const formatVND = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
};

export function InteractiveDataTable({ data = [] }: { data?: ContractRecord[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ContractStatus>>(new Set());
  const [sortField, setSortField] = useState<keyof ContractRecord>("revenueVnd");
  const [sortAsc, setSortAsc] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 8;

  // Toggle filter pill
  const toggleStatus = (st: ContractStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
    setPageIndex(0);
  };

  // Toggle sort
  const handleSort = (field: keyof ContractRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filtered & Sorted records
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (selectedStatuses.size > 0 && !selectedStatuses.has(item.status)) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesCode = item.contractCode.toLowerCase().includes(term);
        const matchesClient = item.clientName.toLowerCase().includes(term);
        const matchesType = item.type.toLowerCase().includes(term);
        return matchesCode || matchesClient || matchesType;
      }
      return true;
    });
  }, [data, searchTerm, selectedStatuses]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortField, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pageIndex, pageSize]);

  return (
    <div className="w-full space-y-3 font-sans text-sm my-2">
      {/* Top Controls Toolbar: Search & Faceted Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã HĐ, đối tác..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-white text-slate-950 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 transition placeholder-slate-400 shadow-2xs"
            />
          </div>

          {/* Quick Status Filter Pills */}
          <div className="flex items-center gap-1.5">
            {(["PAID", "PENDING", "OVERDUE"] as ContractStatus[]).map((st) => {
              const active = selectedStatuses.has(st);
              return (
                <button
                  key={st}
                  onClick={() => toggleStatus(st)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer whitespace-nowrap btn-tactile ${
                    active
                      ? "bg-slate-950 text-white border-slate-950 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:border-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {statusConfig[st].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-bold whitespace-nowrap">
          Tổng cộng:{" "}
          <span className="font-black text-slate-950 font-mono">
            {sortedData.length}
          </span>{" "}
          Hợp Đồng
        </div>
      </div>

      {/* Main Table View */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4 select-none whitespace-nowrap">
                  <button
                    onClick={() => handleSort("contractCode")}
                    className="flex items-center gap-1 hover:text-slate-950 font-extrabold cursor-pointer"
                  >
                    <span>Mã Hợp Đồng</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3 px-4 select-none whitespace-nowrap">
                  <button
                    onClick={() => handleSort("clientName")}
                    className="flex items-center gap-1 hover:text-slate-950 font-extrabold cursor-pointer"
                  >
                    <span>Khách Hàng / Đối Tác</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3 px-4 select-none whitespace-nowrap">Phân Loại</th>
                <th className="py-3 px-4 select-none text-right whitespace-nowrap">
                  <button
                    onClick={() => handleSort("revenueVnd")}
                    className="flex items-center gap-1 hover:text-slate-950 font-extrabold ml-auto cursor-pointer"
                  >
                    <span>Doanh Thu</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3 px-4 select-none whitespace-nowrap">
                  <button
                    onClick={() => handleSort("signedDate")}
                    className="flex items-center gap-1 hover:text-slate-950 font-extrabold cursor-pointer"
                  >
                    <span>Ngày Ký</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="py-3 px-4 select-none whitespace-nowrap">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentPageRows.length > 0 ? (
                currentPageRows.map((row) => {
                  const conf = statusConfig[row.status] || statusConfig.PENDING;
                  const Icon = conf.icon;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-950 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
                          <span>{row.contractCode}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 max-w-[220px] truncate whitespace-nowrap">
                        {row.clientName}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black tabular-nums text-slate-950 whitespace-nowrap">
                        {formatVND(row.revenueVnd)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {row.signedDate}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${conf.style}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{conf.label}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="h-24 text-center text-slate-500 font-semibold">
                    Không tìm thấy hợp đồng nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Trang</span>
            <span className="font-mono font-bold text-slate-950">
              {pageIndex + 1} / {pageCount}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageIndex(0)}
              disabled={pageIndex === 0}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageIndex >= pageCount - 1}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              onClick={() => setPageIndex(pageCount - 1)}
              disabled={pageIndex >= pageCount - 1}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang cuối"
            >
              <ChevronsRight className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
