"use client";

import React from "react";
import { Home, Scan, Ticket } from "lucide-react";

interface FloatingDockProps {
  activeTab: "home" | "scan" | "wallet";
  onTabChange: (tab: "home" | "scan" | "wallet") => void;
  voucherCount?: number;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  activeTab,
  onTabChange,
  voucherCount = 2,
}) => {
  return (
    <nav className="h-[58px] px-5 bg-white rounded-full border border-black/[0.08] shadow-ios-card flex items-center justify-between w-full max-w-[270px]">
      {/* Tab 1: Home */}
      <button
        type="button"
        onClick={() => onTabChange("home")}
        className={`relative w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer touch-manipulation ${
          activeTab === "home" ? "text-[#3A9A43]" : "text-[#949E95] hover:text-[#1A1D1A]"
        }`}
        title="Trang chủ"
      >
        <Home size={22} strokeWidth={activeTab === "home" ? 2.8 : 2} />
        {activeTab === "home" && (
          <span className="w-1.5 h-1.5 bg-[#3A9A43] rounded-full mt-0.5" />
        )}
      </button>

      {/* Tab 2: Center Big Scan Icon (NO TEXT, prominent & elevated) */}
      <button
        type="button"
        onClick={() => onTabChange("scan")}
        className="w-12 h-12 -my-2 rounded-full bg-gradient-to-tr from-[#286B30] to-[#3A9A43] text-white flex items-center justify-center shadow-ios-glow hover:scale-105 active:scale-90 transition-all cursor-pointer touch-manipulation"
        title="Quét mã"
      >
        <Scan size={22} strokeWidth={2.8} />
      </button>

      {/* Tab 3: Voucher Wallet */}
      <button
        type="button"
        onClick={() => onTabChange("wallet")}
        className={`relative w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer touch-manipulation ${
          activeTab === "wallet" ? "text-[#3A9A43]" : "text-[#949E95] hover:text-[#1A1D1A]"
        }`}
        title="Ví Voucher"
      >
        <Ticket size={22} strokeWidth={activeTab === "wallet" ? 2.8 : 2} />
        {voucherCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#E11D48] text-white text-[9px] font-black flex items-center justify-center shadow-sm">
            {voucherCount}
          </span>
        )}
        {activeTab === "wallet" && (
          <span className="w-1.5 h-1.5 bg-[#3A9A43] rounded-full mt-0.5" />
        )}
      </button>
    </nav>
  );
};
