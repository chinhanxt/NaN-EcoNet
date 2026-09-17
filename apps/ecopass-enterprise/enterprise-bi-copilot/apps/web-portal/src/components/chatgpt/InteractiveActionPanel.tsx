import React, { useState } from "react";
import {
  ExcelSpreadsheetSvg,
  AuditShieldSvg,
  LockSecuritySvg,
  CopySvg,
  CheckSvg
} from "./SvgIcons";
import { Loader2 } from "lucide-react";

export interface ActionPanelProps {
  reportId?: string;
  sha256Hash?: string;
  summaryText?: string;
  onExportExcel?: () => Promise<void> | void;
  onSignVerification?: (hash: string) => Promise<void> | void;
  onCopySummary?: (text: string) => Promise<void> | void;
  onViewAuditTrail?: () => void;
  className?: string;
}

export const InteractiveActionPanel: React.FC<ActionPanelProps> = ({
  reportId = "REP-2026-09-FIN",
  sha256Hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  summaryText = "Nhận định C-Suite: Dòng tiền hoạt động kinh doanh duy trì biên an toàn 18.4%. Cần thắt chặt đối soát OPEX khối Operations trước ngày 25.",
  onExportExcel,
  onSignVerification,
  onCopySummary,
  onViewAuditTrail,
  className = "",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  // Xử lý xuất Excel
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      if (onExportExcel) {
        await onExportExcel();
      } else {
        await new Promise((res) => setTimeout(res, 600));
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Xử lý ký số SHA-256
  const handleSign = async () => {
    try {
      setIsSigning(true);
      if (onSignVerification) {
        await onSignVerification(sha256Hash);
      } else {
        await new Promise((res) => setTimeout(res, 800));
      }
      setIsSigned(true);
    } finally {
      setIsSigning(false);
    }
  };

  // Xử lý sao chép nhận định C-Suite
  const handleCopy = async () => {
    if (onCopySummary) {
      await onCopySummary(summaryText);
    } else {
      await navigator.clipboard.writeText(summaryText);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={`flex items-center justify-between gap-2 pt-1 font-sans ${className}`}>
      {/* 2 Lightweight Action Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Nút 1: Xuất Excel */}
        <button
          onClick={handleExportExcel}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-950 transition-all shadow-2xs disabled:opacity-60 cursor-pointer whitespace-nowrap btn-tactile"
          title="Tải bảng tính Excel"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
          ) : (
            <ExcelSpreadsheetSvg size={14} className="text-emerald-700" />
          )}
          <span>Xuất Excel</span>
        </button>

        {/* Nút 2: Sao chép */}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-950 transition-all shadow-2xs cursor-pointer whitespace-nowrap btn-tactile"
          title="Sao chép nội dung"
        >
          {isCopied ? (
            <>
              <CheckSvg size={13} className="text-emerald-600" />
              <span className="text-slate-950">Đã chép!</span>
            </>
          ) : (
            <>
              <CopySvg size={13} className="text-slate-400" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>

      {/* Subtle Integrity Badge */}
      <div 
        className="flex items-center gap-1 text-[11px] font-bold text-slate-400 select-none whitespace-nowrap"
        title={sha256Hash ? `Bảo chứng DWH SHA-256: ${sha256Hash}` : "Bảo chứng DWH"}
      >
        <AuditShieldSvg size={12} className="text-emerald-600" />
        <span>Bảo chứng DWH</span>
      </div>
    </div>
  );
};
