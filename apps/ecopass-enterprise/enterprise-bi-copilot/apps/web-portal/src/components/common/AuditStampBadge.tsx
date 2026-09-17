import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Hash, Clock, Database, Layers, Info } from 'lucide-react';
import type { ExecutionAuditStamp } from '../../types';

interface AuditStampBadgeProps {
  audit?: ExecutionAuditStamp;
  className?: string;
  variant?: 'compact' | 'full';
}

export const AuditStampBadge: React.FC<AuditStampBadgeProps> = ({
  audit,
  className = '',
  variant = 'compact'
}) => {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!audit) {
    return (
      <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-titanium-850/80 border border-titanium-700/50 text-titanium-400 ${className}`}>
        <Database className="w-3.5 h-3.5 text-titanium-500" />
        <span>Awaiting Query Execution</span>
      </div>
    );
  }

  const copyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audit.sha256Checksum) {
      navigator.clipboard.writeText(audit.sha256Checksum);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortHash = audit.sha256Checksum
    ? `${audit.sha256Checksum.slice(0, 8)}...${audit.sha256Checksum.slice(-6)}`
    : 'N/A';

  if (variant === 'compact') {
    return (
      <div className={`relative inline-flex items-center gap-2 ${className}`}>
        <div
          onClick={() => setShowDetails(!showDetails)}
          className="group inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono bg-slate-900/90 border border-cyan-500/30 text-titanium-300 shadow-sm cursor-pointer hover:border-cyan-400 hover:bg-slate-850 transition-all"
          title="Click to view Cryptographic Audit Details"
        >
          <div className="flex items-center space-x-1 text-cyan-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>ZERO-MOCK</span>
          </div>

          <span className="text-titanium-600">|</span>

          <span className="text-titanium-400 font-mono" title={audit.queryId}>
            {audit.queryId}
          </span>

          <span className="text-titanium-600">|</span>

          <span className="text-emerald-400 flex items-center space-x-1">
            <Clock className="w-3 h-3 inline" />
            <span>{audit.durationMs}ms</span>
          </span>

          <span className="text-titanium-600">|</span>

          <button
            onClick={copyHash}
            className="flex items-center space-x-1 text-titanium-400 hover:text-cyan-300 transition-colors"
            title="Copy SHA-256 Checksum"
          >
            <Hash className="w-3 h-3 text-cyan-400" />
            <span className="font-mono">{shortHash}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
            )}
          </button>
        </div>

        {/* Detailed Modal / Popover */}
        {showDetails && (
          <div className="absolute right-0 top-9 z-50 w-96 p-4 rounded-xl titanium-panel border border-cyan-500/40 shadow-2xl text-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-titanium-700/80">
              <div className="flex items-center space-x-2 font-semibold text-titanium-100">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Cryptographic Audit Proof</span>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-titanium-400 hover:text-titanium-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-titanium-300">
              <div>
                <span className="text-titanium-500 block text-[10px] uppercase">Query Reference</span>
                <span className="font-mono font-medium text-titanium-200">{audit.queryId}</span>
              </div>
              <div>
                <span className="text-titanium-500 block text-[10px] uppercase">Execution Latency</span>
                <span className="font-mono font-medium text-emerald-400">{audit.durationMs} milliseconds</span>
              </div>
              <div>
                <span className="text-titanium-500 block text-[10px] uppercase">Data Source</span>
                <span className="font-mono font-medium text-cyan-400">{audit.dataSource}</span>
              </div>
              <div>
                <span className="text-titanium-500 block text-[10px] uppercase">Record Count</span>
                <span className="font-mono font-medium text-titanium-200">{audit.totalRecords} verified rows</span>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-titanium-500 text-[10px] uppercase">SHA-256 Checksum (Deterministic)</span>
                <button
                  onClick={copyHash}
                  className="text-[10px] text-cyan-400 hover:underline flex items-center space-x-0.5"
                >
                  {copied ? <span>Copied!</span> : <span>Copy Full Hash</span>}
                </button>
              </div>
              <div className="p-2 bg-slate-950/90 rounded border border-titanium-800 font-mono text-[11px] text-cyan-300 break-all select-all">
                {audit.sha256Checksum}
              </div>
            </div>

            <div className="text-[11px] text-titanium-400 flex items-start space-x-1.5 pt-1 text-slate-400">
              <Info className="w-3.5 h-3.5 mt-0.5 text-cyan-400 shrink-0" />
              <span>
                Toàn bộ dữ liệu được trích xuất trực tiếp từ replica cơ sở dữ liệu vật lý với kiểm định chữ ký SHA-256. Không có mock fallback.
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`p-3 rounded-lg bg-titanium-900/90 border border-titanium-700/60 font-mono text-xs ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-300 font-semibold">ZERO-MOCK AUDIT CERTIFIED</span>
          <span className="text-titanium-600">•</span>
          <span className="text-titanium-300">{audit.queryId}</span>
        </div>
        <div className="flex items-center space-x-4 text-titanium-400 text-[11px]">
          <span>Source: <strong className="text-cyan-400">{audit.dataSource}</strong></span>
          <span>Duration: <strong className="text-emerald-400">{audit.durationMs}ms</strong></span>
          <span>Rows: <strong className="text-titanium-200">{audit.totalRecords}</strong></span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-titanium-800/80 flex items-center justify-between">
        <span className="text-[11px] text-titanium-400 truncate mr-2">
          SHA-256: <code className="text-cyan-300">{audit.sha256Checksum}</code>
        </span>
        <button
          onClick={copyHash}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 shrink-0"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};
