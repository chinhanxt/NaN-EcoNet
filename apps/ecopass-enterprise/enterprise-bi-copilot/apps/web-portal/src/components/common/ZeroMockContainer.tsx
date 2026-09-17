import React from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, Terminal, Lock } from 'lucide-react';
import { ShimmerLoading } from './ShimmerLoading';
import { AuditStampBadge } from './AuditStampBadge';
import type { ExecutionAuditStamp } from '../../types';
import type { ApiError } from '../../services/api';

interface ZeroMockContainerProps {
  loading: boolean;
  error: Error | ApiError | null;
  audit?: ExecutionAuditStamp;
  onRetry?: () => void;
  shimmerType?: 'kpi' | 'chart' | 'table' | 'full';
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ZeroMockContainer: React.FC<ZeroMockContainerProps> = ({
  loading,
  error,
  audit,
  onRetry,
  shimmerType = 'chart',
  title,
  subtitle,
  headerAction,
  children,
  className = ''
}) => {
  // 1. Shimmer Loading State
  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {title && (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-titanium-300">
                {title}
              </h3>
              {subtitle && <p className="text-xs text-titanium-500">{subtitle}</p>}
            </div>
            <div className="h-6 w-32 bg-titanium-800/60 rounded animate-pulse"></div>
          </div>
        )}
        <ShimmerLoading type={shimmerType} />
      </div>
    );
  }

  // 2. Transparent Technical Error Banner (Zero-Mock Strict Prohibition)
  if (error) {
    const apiErr = error as ApiError;
    const errorCode = apiErr.errorCode || 'CONNECTION_REFUSED';
    const correlationId = apiErr.correlationId || `ERR-${Date.now()}`;

    return (
      <div className={`titanium-panel rounded-xl border border-rose-500/50 bg-rose-950/20 p-6 shadow-2xl relative overflow-hidden ${className}`}>
        {/* Ambient Red Alert Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex items-start space-x-4">
          <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/30 text-rose-400 shrink-0">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {errorCode}
                </span>
                <h4 className="text-base font-bold text-rose-200">
                  LỖI KẾT NỐI HỆ THỐNG DWH • KỶ LUẬT ZERO-MOCK ĐƯỢC THI CÔNG
                </h4>
              </div>

              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 text-xs font-semibold border border-rose-500/40 transition-all shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại truy vấn (Retry)</span>
                </button>
              )}
            </div>

            <p className="text-sm text-rose-300/90 font-mono leading-relaxed">
              {error.message || 'Không thể thiết lập kết nối an toàn tới cơ sở dữ liệu vật lý.'}
            </p>

            {apiErr.details && (
              <div className="p-2.5 rounded bg-black/40 border border-rose-900/60 font-mono text-xs text-rose-400/80 space-y-1">
                <div className="flex items-center space-x-1 text-rose-300 font-semibold text-[11px]">
                  <Terminal className="w-3 h-3" />
                  <span>Chi tiết phản hồi từ database engine:</span>
                </div>
                <div className="text-[11px] break-all">{apiErr.details}</div>
              </div>
            )}

            {/* Zero-Mock Golden Rule Notice */}
            <div className="mt-4 pt-3 border-t border-rose-900/40 flex items-start space-x-2.5 text-xs text-titanium-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-semibold">Quy tắc bắt buộc:</strong> Giao diện C-Suite tuyệt đối không fallback về mock data khi mất kết nối hoặc truy vấn lỗi. Hãy kiểm tra dịch vụ PostgreSQL replica tại cổng <code className="text-cyan-300 font-mono bg-slate-900 px-1 py-0.5 rounded">5435</code>.
                <span className="block mt-1 font-mono text-[11px] text-titanium-500">Correlation ID: {correlationId}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Verified Success State with Audit Stamp
  return (
    <div className={`space-y-3 ${className}`}>
      {(title || audit || headerAction) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-titanium-200 flex items-center space-x-2">
                <span>{title}</span>
              </h3>
              {subtitle && <p className="text-xs text-titanium-400 mt-0.5">{subtitle}</p>}
            </div>
          )}

          <div className="flex items-center space-x-3 ml-auto">
            {headerAction}
            {audit && <AuditStampBadge audit={audit} variant="compact" />}
          </div>
        </div>
      )}

      <div>{children}</div>
    </div>
  );
};
