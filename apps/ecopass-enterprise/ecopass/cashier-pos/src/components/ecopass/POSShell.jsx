import React from "react";

export const POSShell = ({ children, activeTab, bottomDock }) => {
  return (
    <div className="min-h-screen bg-[#EAEFEA] flex flex-col items-center justify-center p-0 md:p-3 font-['Plus_Jakarta_Sans',-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] overflow-hidden">
      {/* Phone Container: Native 100% on mobile, fitted card on desktop/laptop */}
      <div className="w-full h-[100dvh] md:max-w-[400px] md:h-[min(94vh,840px)] md:rounded-[40px] md:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] md:border md:border-black/[0.06] bg-[#F8FAF8] flex flex-col relative overflow-hidden select-none">
        
        {/* 1. Inner Screen Canvas - Screens manage fixed header/cards and scrollable lists independently */}
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          {children}
        </div>

        {/* 2. Pinned Bottom Navigation Dock - TÁCH RIÊNG HOÀN TOÀN KHỎI VÙNG CUỘN */}
        {bottomDock && (
          <div className="shrink-0 relative z-40 bg-[#F8FAF8] pt-1.5 pb-2 px-5 flex justify-center border-t border-black/[0.03] shadow-sm">
            {bottomDock}
          </div>
        )}

        {/* 3. iOS Home Indicator Bar */}
        <div className="shrink-0 h-3 flex justify-center items-center pointer-events-none z-50 bg-[#F8FAF8]">
          <div className="w-32 h-1 bg-[#1A1D1A]/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};
