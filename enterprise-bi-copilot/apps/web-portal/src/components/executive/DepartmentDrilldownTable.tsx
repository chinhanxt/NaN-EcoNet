import React, { useState, useMemo } from 'react';
import {
  Building2,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronRight
} from 'lucide-react';
import type { DepartmentRow, TransactionRow } from '../../types';

interface DepartmentDrilldownTableProps {
  departmentData: DepartmentRow[];
  transactionData: TransactionRow[];
}

export const DepartmentDrilldownTable: React.FC<DepartmentDrilldownTableProps> = ({
  departmentData,
  transactionData
}) => {
  const [activeTab, setActiveTab] = useState<'departments' | 'transactions'>('departments');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Format currency in VND
  const formatVND = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val || '0') : val;
    if (isNaN(num)) return '0 ₫';
    return `${num.toLocaleString('vi-VN')} ₫`;
  };

  const formatShortVND = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val || '0') : val;
    if (isNaN(num)) return '0 ₫';
    if (Math.abs(num) >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)} Tỷ ₫`;
    }
    return `${(num / 1_000_000).toFixed(0)} Tr ₫`;
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactionData.filter(tx => {
      const matchSearch =
        tx.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.product_category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.transaction_code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept =
        deptFilter === 'ALL' ||
        tx.department_code === deptFilter ||
        (tx.department_name && tx.department_name.includes(deptFilter));

      return matchSearch && matchDept;
    });
  }, [transactionData, searchTerm, deptFilter]);

  return (
    <div className="titanium-panel rounded-xl border border-titanium-700/80 shadow-titanium-card overflow-hidden">
      {/* Header and Tab Selector */}
      <div className="p-5 border-b border-titanium-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-titanium-100 flex items-center space-x-2 uppercase tracking-wide">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>PHÂN TÍCH CHI TIẾT & ĐỐI SOÁT DRILL-DOWN</span>
          </h2>
          <p className="text-xs text-titanium-400 font-mono mt-0.5">
            Dữ liệu đối soát phòng ban và 100% hợp đồng phát sinh trong kỳ Tháng 9/2026
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center space-x-1 p-1 rounded-lg bg-titanium-900 border border-titanium-700/80 text-xs font-mono">
          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-semibold ${
              activeTab === 'departments'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Hiệu Suất Phòng Ban ({departmentData.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-semibold ${
              activeTab === 'transactions'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Sổ Cái Hợp Đồng ({transactionData.length} Deals)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Department Performance */}
      {activeTab === 'departments' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-titanium-900/90 text-titanium-400 font-mono uppercase text-[11px] border-b border-titanium-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Mã PB</th>
                <th className="py-3 px-4 font-semibold">Tên Phòng Ban</th>
                <th className="py-3 px-4 font-semibold text-right">Doanh Thu Thực Tế</th>
                <th className="py-3 px-4 font-semibold text-right">Mục Tiêu Target</th>
                <th className="py-3 px-4 font-semibold text-right">Chênh Lệch (Variance)</th>
                <th className="py-3 px-4 font-semibold text-center">% Hoàn Thành</th>
                <th className="py-3 px-4 font-semibold">Tiến Độ Kế Hoạch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-850/80 font-sans">
              {departmentData.map((dept, idx) => {
                const actual = parseFloat(dept.actual_revenue || '0');
                const target = parseFloat(dept.target_revenue || '0');
                const variance = parseFloat(dept.variance_amount || '0');
                const pct = dept.target_achievement_pct ? parseFloat(dept.target_achievement_pct) : null;
                const isOver = variance >= 0;

                return (
                  <tr
                    key={dept.dept_code || idx}
                    className="hover:bg-titanium-850/60 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                      {dept.dept_code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-titanium-100">
                      {dept.dept_name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-titanium-100">
                      {formatShortVND(actual)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-titanium-400">
                      {target > 0 ? formatShortVND(target) : 'Chưa giao'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {target > 0 ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isOver
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isOver ? <TrendingUp className="w-3 h-3 mr-1 inline" /> : <TrendingDown className="w-3 h-3 mr-1 inline" />}
                          {isOver ? '+' : ''}{formatShortVND(variance)}
                        </span>
                      ) : (
                        <span className="text-titanium-500">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">
                      {pct !== null ? (
                        <span
                          className={`px-2 py-0.5 rounded ${
                            pct >= 100
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : pct >= 80
                              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          }`}
                        >
                          {pct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-titanium-500">N/A</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 w-40">
                      {pct !== null ? (
                        <div className="w-full bg-titanium-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              pct >= 100
                                ? 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                                : pct >= 80
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] text-titanium-500 font-mono">Không có budget</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Transaction Details */}
      {activeTab === 'transactions' && (
        <div>
          {/* Sub-bar for filtering transactions */}
          <div className="p-3 bg-titanium-900/60 border-b border-titanium-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-titanium-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên khách hàng, mã hợp đồng, dịch vụ..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-titanium-950 border border-titanium-700/80 text-titanium-200 placeholder-titanium-500 text-xs focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center space-x-2 font-mono text-xs">
              <span className="text-titanium-400">Lọc theo Khối:</span>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-titanium-950 border border-titanium-700/80 text-titanium-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="ALL">Tất cả khối ({transactionData.length})</option>
                <option value="ENT-TECH">Enterprise Technology</option>
                <option value="B2B-SALES">B2B Corporate Sales</option>
                <option value="SUP-LOG">Supply Chain Logistics</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-titanium-900 text-titanium-400 font-mono uppercase text-[11px] border-b border-titanium-800 z-10">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Mã GD</th>
                  <th className="py-2.5 px-3 font-semibold">Ngày</th>
                  <th className="py-2.5 px-3 font-semibold">Khách Hàng & Giải Pháp</th>
                  <th className="py-2.5 px-3 font-semibold">Khối PB</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Doanh Thu Thuần</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Giá Vốn COGS</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Lợi Nhuận Gộp</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Biên LN</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-850 font-sans">
                {filteredTransactions.map(tx => {
                  const netRev = parseFloat(tx.net_revenue || '0');
                  const cogs = parseFloat(tx.cogs_amount || '0');
                  const grossProfit = parseFloat(tx.gross_profit || '0');
                  const marginPct = netRev > 0 ? ((grossProfit / netRev) * 100).toFixed(1) : '0';
                  const isPaid = tx.payment_status === 'PAID';

                  return (
                    <tr
                      key={tx.id || tx.transaction_code}
                      className="hover:bg-titanium-850/60 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-cyan-400">
                        {tx.transaction_code}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-titanium-400 whitespace-nowrap">
                        {tx.transaction_date}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-titanium-100">{tx.client_name}</div>
                        <div className="text-[11px] text-titanium-400">{tx.product_category}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-titanium-300">
                        {tx.department_name || tx.department_code || 'B2B'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-titanium-100">
                        {formatShortVND(netRev)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                        {formatShortVND(cogs)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400">
                        {formatShortVND(grossProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-titanium-200">
                        {marginPct}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                              PAID
                            </>
                          ) : (
                            <>
                              <Clock className="w-2.5 h-2.5 mr-1" />
                              PENDING
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
