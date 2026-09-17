import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Zap,
  Server,
  Layers,
  Database
} from "lucide-react";
import { CopilotAiSvg } from "./SvgIcons";

export interface McpServerStatus {
  name: string;
  status: "active" | "idle" | "error";
  latencyMs?: number;
}

export interface ConversationalStatusEnvelopeProps {
  assistantName?: string;
  personaTitle?: string;
  avatarUrl?: string;
  responseTimeMs?: number;
  tokensCount?: number;
  mcpServers?: McpServerStatus[];
  modelBadge?: string;
  timestamp?: string;
  children: React.ReactNode;
  actionPanelSlot?: React.ReactNode;
  quickPromptSlot?: React.ReactNode;
  className?: string;
}

export const ConversationalStatusEnvelope: React.FC<ConversationalStatusEnvelopeProps> = ({
  assistantName = "C-Suite Copilot",
  personaTitle = "Cố Vấn Chiến Lược Doanh Nghiệp",
  avatarUrl,
  responseTimeMs = 14,
  tokensCount = 1240,
  mcpServers = [
    { name: "PostgreSQL-DWH", status: "active", latencyMs: 14 },
    { name: "Budget-Excel-Bridge", status: "active", latencyMs: 22 },
  ],
  modelBadge = "AI GATEWAY (AGY CLI)",
  timestamp = "Vừa xong",
  children,
  actionPanelSlot,
  quickPromptSlot,
  className = "",
}) => {
  const [showMetaDetails, setShowMetaDetails] = useState(false);

  return (
    <div
      className={`w-full rounded-2xl border border-slate-200 bg-white shadow-xs transition-all overflow-hidden font-sans ${className}`}
    >
      {/* 1. Header Envelope: Nhận diện AI tinh gọn, ít chữ */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
        {/* Trái: Avatar + Tên Copilot + Model */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-950 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <CopilotAiSvg size={15} className="text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-tight text-slate-950 whitespace-nowrap">
              {assistantName}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 whitespace-nowrap">
              {modelBadge}
            </span>
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
              • {timestamp}
            </span>
          </div>
        </div>

        {/* Phải: Nút xem thông số kỹ thuật (thu gọn mặc định) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowMetaDetails(!showMetaDetails)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Xem chi tiết kỹ thuật DWH & latency"
          >
            <span>{responseTimeMs}ms</span>
            {showMetaDetails ? (
              <ChevronUp className="w-3 h-3 stroke-[2.2]" />
            ) : (
              <ChevronDown className="w-3 h-3 stroke-[2.2]" />
            )}
          </button>
        </div>
      </div>

      {/* Accordion Chi tiết Kỹ thuật MCP & Tokens */}
      {showMetaDetails && (
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 text-[11px] text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-1 font-medium">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Layers className="w-3.5 h-3.5 text-slate-900 stroke-[2.2]" />
              <span>Token usage: <strong className="font-bold font-mono">{tokensCount.toLocaleString()}</strong></span>
            </div>
            {mcpServers.map((server) => (
              <div key={server.name} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{server.name}: <strong className="font-bold font-mono">{server.latencyMs || 0}ms</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Nội dung trả lời chính (Body Content) */}
      <div className="p-4 sm:p-5 text-sm text-slate-900 space-y-3">
        {children}
      </div>

      {/* 3. Slot Action Panel (Nút thao tác nhanh) */}
      {actionPanelSlot && (
        <div className="px-4 sm:px-5 pb-4">
          {actionPanelSlot}
        </div>
      )}

      {/* 4. Slot Quick Prompt Carousel (Gợi ý tác vụ tiếp theo) */}
      {quickPromptSlot && (
        <div className="px-4 sm:px-5 pb-3 pt-2 border-t border-slate-100 bg-slate-50/60">
          {quickPromptSlot}
        </div>
      )}
    </div>
  );
};
