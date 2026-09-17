import React from 'react';
import {
  Calendar,
  Layers,
  RefreshCw,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  BarChart3,
  UserCheck
} from 'lucide-react';
import { ConnectionStatusIndicator } from '../common/ConnectionStatusIndicator';
import type { UserRole } from '../../types';

interface ExecutiveHeaderProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const ExecutiveHeader: React.FC<ExecutiveHeaderProps> = ({
  role,
  onRoleChange,
  onRefresh,
  isRefreshing
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-titanium-800 bg-titanium-950/90 backdrop-blur-xl px-6 py-3.5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Brand & Copilot Identity */}
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-slate-800 to-titanium-900 border border-cyan-500/40 shadow-titanium-glow">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-titanium-950 animate-pulse"></span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-extrabold tracking-tight text-titanium-100 font-sans">
                ENTERPRISE <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">EXECUTIVE COPILOT</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-titanium-800/80 text-cyan-400 border border-cyan-500/30">
                C-SUITE v2.6
              </span>
            </div>
            <p className="text-xs text-titanium-400 font-mono flex items-center space-x-2">
              <span>Hệ thống Trợ lý Điều hành Chiến lược Doanh nghiệp</span>
              <span className="text-titanium-600">•</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 inline" />
                <span>Zero-Mock Discipline Enforced</span>
              </span>
            </p>
          </div>
        </div>

        {/* Center/Right: Context Badges & Actions */}
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Fiscal Period Selector Badge */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-titanium-900 border border-titanium-700/70 text-xs font-mono text-titanium-200">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Kỳ Tài chính:</span>
            <span className="text-cyan-300 font-semibold">Tháng 9/2026 (Actual)</span>
          </div>

          {/* Role Switcher (Executive vs Employee RLS preview) */}
          <div className="flex items-center rounded-lg bg-titanium-900/90 border border-titanium-700/80 p-0.5 text-xs font-mono">
            <button
              onClick={() => onRoleChange('executive')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                role === 'executive'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm'
                  : 'text-titanium-400 hover:text-titanium-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>C-Suite (Executive)</span>
            </button>
            <button
              onClick={() => onRoleChange('employee')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                role === 'employee'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm'
                  : 'text-titanium-400 hover:text-titanium-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Phòng ban (RLS)</span>
            </button>
          </div>

          {/* Realtime Live Pulse */}
          <ConnectionStatusIndicator role={role} />

          {/* Refresh Action Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-titanium-850 hover:bg-titanium-800 text-titanium-200 border border-titanium-700 text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
            title="Đồng bộ lại toàn bộ dữ liệu từ DWH Replica"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Đồng bộ DWH</span>
          </button>
        </div>
      </div>
    </header>
  );
};
