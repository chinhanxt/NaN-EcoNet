import React from 'react';
import { Database, ShieldCheck } from 'lucide-react';

interface ShimmerLoadingProps {
  type?: 'kpi' | 'chart' | 'table' | 'full';
  count?: number;
  message?: string;
}

export const ShimmerLoading: React.FC<ShimmerLoadingProps> = ({
  type = 'chart',
  count = 4,
  message = 'Đang truy vấn trực tiếp từ PostgreSQL Replica (Zero-Mock Policy)...'
}) => {
  if (type === 'kpi') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="titanium-panel rounded-xl p-5 border border-titanium-700/60 relative overflow-hidden"
          >
            <div className="shimmer-effect absolute inset-0 opacity-40" />
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-28 bg-titanium-700/60 rounded"></div>
              <div className="h-6 w-6 bg-titanium-700/60 rounded-md"></div>
            </div>
            <div className="h-7 w-36 bg-titanium-700/80 rounded mb-2"></div>
            <div className="h-3 w-20 bg-titanium-700/50 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="titanium-panel rounded-xl p-6 border border-titanium-700/60 relative overflow-hidden">
        <div className="shimmer-effect absolute inset-0 opacity-30" />
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-48 bg-titanium-700/70 rounded"></div>
          <div className="h-8 w-32 bg-titanium-700/50 rounded-lg"></div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4 py-2 border-b border-titanium-800/60">
              <div className="h-4 w-24 bg-titanium-700/60 rounded"></div>
              <div className="h-4 w-40 bg-titanium-700/60 rounded flex-1"></div>
              <div className="h-4 w-28 bg-titanium-700/60 rounded"></div>
              <div className="h-4 w-20 bg-titanium-700/60 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="titanium-panel rounded-xl p-6 border border-titanium-700/60 min-h-[380px] flex flex-col justify-between relative overflow-hidden">
      <div className="shimmer-effect absolute inset-0 opacity-40" />
      
      {/* Header shimmer */}
      <div className="flex items-center justify-between z-10">
        <div>
          <div className="h-5 w-64 bg-titanium-700/70 rounded mb-2"></div>
          <div className="h-3 w-96 bg-titanium-700/40 rounded"></div>
        </div>
        <div className="flex space-x-2">
          <div className="h-7 w-20 bg-titanium-700/50 rounded"></div>
          <div className="h-7 w-20 bg-titanium-700/50 rounded"></div>
        </div>
      </div>

      {/* Chart body bars shimmer */}
      <div className="my-8 flex items-end justify-between gap-3 h-48 px-4 z-10">
        {[40, 65, 30, 85, 45, 90, 55, 75, 60, 95, 70, 80, 50, 88, 62, 78].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <div
              className="w-full bg-titanium-700/50 rounded-t transition-all duration-500"
              style={{ height: `${h}%` }}
            />
            <div className="h-2 w-4 bg-titanium-800/80 rounded"></div>
          </div>
        ))}
      </div>

      {/* Footer live status */}
      <div className="flex items-center justify-between text-xs text-titanium-400 border-t border-titanium-800/80 pt-3 z-10">
        <div className="flex items-center space-x-2">
          <Database className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span className="font-mono">{message}</span>
        </div>
        <div className="flex items-center space-x-1.5 text-titanium-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>AST Gatekeeper Active</span>
        </div>
      </div>
    </div>
  );
};
