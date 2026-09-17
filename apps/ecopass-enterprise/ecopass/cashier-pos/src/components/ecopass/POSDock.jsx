import React from "react";
import { Scan, Clock, User } from "lucide-react";

export const POSDock = ({ activeTab, onTabChange, count = 0 }) => {
  return (
    <nav className="h-[58px] px-5 bg-white rounded-full border border-black/[0.08] shadow-ios-card flex items-center justify-between w-full max-w-[270px]">
      {/* Tab 1: Lịch sử ca trực */}
      <button
        onClick={() => onTabChange("history")}
        className={`relative w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 ${
          activeTab === "history"
            ? "text-[#3A9A43]"
            : "text-[#949E95] hover:text-[#1A1D1A]"
        }`}
        title="Lịch sử quét"
      >
        <Clock size={22} strokeWidth={activeTab === "history" ? 2.8 : 2} />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#3A9A43] text-white text-[9px] font-black flex items-center justify-center shadow-sm">
            {count}
          </span>
        )}
        {activeTab === "history" && (
          <span className="w-1.5 h-1.5 bg-[#3A9A43] rounded-full mt-0.5" />
        )}
      </button>

      {/* Tab 2: Nút Quét / Nhập mã to ở giữa (Đặc trưng EcoPass) */}
      <button
        onClick={() => onTabChange("scan")}
        className={`w-12 h-12 -my-2 rounded-full text-white flex items-center justify-center shadow-ios-glow hover:scale-105 active:scale-90 transition-all ${
          activeTab === "scan"
            ? "bg-gradient-to-tr from-[#286B30] to-[#3A9A43] ring-4 ring-[#E8F5E9]"
            : "bg-gradient-to-tr from-[#286B30] to-[#3A9A43] opacity-80"
        }`}
        title="Quét hoặc nhập mã"
      >
        <Scan size={22} strokeWidth={2.8} />
      </button>

      {/* Tab 3: Tài khoản thu ngân */}
      <button
        onClick={() => onTabChange("account")}
        className={`relative w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 ${
          activeTab === "account"
            ? "text-[#3A9A43]"
            : "text-[#949E95] hover:text-[#1A1D1A]"
        }`}
        title="Tài khoản"
      >
        <User size={22} strokeWidth={activeTab === "account" ? 2.8 : 2} />
        {activeTab === "account" && (
          <span className="w-1.5 h-1.5 bg-[#3A9A43] rounded-full mt-0.5" />
        )}
      </button>
    </nav>
  );
};
