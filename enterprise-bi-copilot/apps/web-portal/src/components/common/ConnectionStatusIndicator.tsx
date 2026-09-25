import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Server, Lock } from 'lucide-react';
import { checkBackendHealth } from '../../services/api';

interface ConnectionStatusIndicatorProps {
  role?: string;
  className?: string;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  role = 'executive',
  className = ''
}) => {
  const [status, setStatus] = useState<'UP' | 'DOWN' | 'CHECKING'>('CHECKING');
  const [latency, setLatency] = useState<number | null>(null);

  const ping = async () => {
    const start = Date.now();
    try {
      const res = await checkBackendHealth();
      setLatency(Date.now() - start);
      setStatus(res.status === 'UP' ? 'UP' : 'DOWN');
    } catch {
      setStatus('DOWN');
      setLatency(null);
    }
  };

  useEffect(() => {
    ping();
    const interval = setInterval(ping, 10000);
    return () => clearInterval(interval);
  }, []);

  const isLive = status === 'UP';

  return (
    <div className={`flex items-center space-x-2 text-xs font-mono ${className}`}>
      {/* Live status badge */}
      <div
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border transition-all ${
          isLive
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
            : status === 'CHECKING'
            ? 'bg-titanium-800/40 border-titanium-600/30 text-titanium-400'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-400 animate-pulse'
        }`}
        title={`Database Connection: ${status}`}
      >
        <span className="relative flex h-2 w-2">
          {isLive && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isLive ? 'bg-emerald-400' : status === 'CHECKING' ? 'bg-amber-400' : 'bg-rose-500'
            }`}
          ></span>
        </span>
        <span className="text-[11px] font-medium tracking-wide">
          {isLive ? 'LIVE • PG-5435' : status === 'CHECKING' ? 'CONNECTING...' : 'DISCONNECTED'}
        </span>
        {latency !== null && isLive && (
          <span className="text-emerald-500/80 text-[10px]">({latency}ms)</span>
        )}
      </div>

      {/* Security Context Badge */}
      <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900/60 border border-titanium-700/60 text-titanium-300 text-[11px]">
        <Lock className="w-3 h-3 text-cyan-400" />
        <span className="capitalize">{role}</span>
        <span className="text-titanium-600">/</span>
        <span className="text-cyan-400 font-semibold">RLS-ACTIVE</span>
      </div>
    </div>
  );
};
