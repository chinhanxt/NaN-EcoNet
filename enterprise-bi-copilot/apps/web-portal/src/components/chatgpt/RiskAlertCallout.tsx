import React from 'react';
import { 
  AlertTriangle, 
  AlertOctagon, 
  ShieldAlert
} from 'lucide-react';

export type RiskSeverity = 'warning' | 'critical' | 'info';

export interface RiskAlertCalloutProps {
  severity?: RiskSeverity;
  title: string;
  metricViolation?: {
    metricName: string;
    actualValue: string;
    thresholdValue: string;
    impactAmount?: string;
  };
  description: string;
  executiveRecommendation: string;
  actionButton?: {
    label: string;
    actionPayload?: string;
    onClick?: () => void;
  };
  auditCode?: string;
}

export const RiskAlertCallout: React.FC<RiskAlertCalloutProps> = ({
  severity = 'warning',
  title,
  metricViolation,
  description,
  executiveRecommendation,
  actionButton,
  auditCode = 'RISK-SEC-402'
}) => {
  const isCritical = severity === 'critical';

  return (
    <div className="w-full border border-slate-300 bg-white rounded-2xl p-5 my-3.5 shadow-xs font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
            {isCritical ? (
              <AlertOctagon className="w-5 h-5 text-rose-600 stroke-[2.2]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 stroke-[2.2]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                isCritical ? 'bg-rose-700 text-white' : 'bg-slate-950 text-white'
              }`}>
                {isCritical ? 'RỦI RO NGHIÊM TRỌNG' : 'CẢNH BÁO TÀI CHÍNH'}
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-400 whitespace-nowrap">
                #{auditCode}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-950 mt-1 whitespace-nowrap">
              {title}
            </h3>
          </div>
        </div>

        {actionButton && (
          <button
            onClick={actionButton.onClick}
            className="self-start sm:self-center px-4 py-2 rounded-xl text-xs font-bold bg-slate-950 text-white hover:bg-black transition-all cursor-pointer whitespace-nowrap shadow-2xs btn-tactile"
          >
            {actionButton.label}
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-sm font-semibold text-slate-700 mt-3.5 leading-relaxed">
        {description}
      </p>

      {/* Metric Violation Chip Grid */}
      {metricViolation && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Chỉ Số Vi Phạm</span>
            <span className="font-bold text-slate-950 mt-0.5 block whitespace-nowrap">{metricViolation.metricName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Thực Tế / Ngưỡng Trần</span>
            <span className="font-mono font-bold text-rose-700 mt-0.5 block whitespace-nowrap">
              {metricViolation.actualValue} <span className="text-slate-400 font-normal">/ {metricViolation.thresholdValue}</span>
            </span>
          </div>
          {metricViolation.impactAmount && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Tác Động Tài Chính</span>
              <span className="font-mono font-bold text-slate-950 mt-0.5 block whitespace-nowrap">{metricViolation.impactAmount}</span>
            </div>
          )}
        </div>
      )}

      {/* C-Suite Strategic Recommendation */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-slate-950 shrink-0 mt-0.5 stroke-[2.2]" />
        <div className="flex-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-950 whitespace-nowrap">
            Khuyến Nghị C-Suite:
          </span>
          <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5 leading-relaxed">
            {executiveRecommendation}
          </p>
        </div>
      </div>
    </div>
  );
};
