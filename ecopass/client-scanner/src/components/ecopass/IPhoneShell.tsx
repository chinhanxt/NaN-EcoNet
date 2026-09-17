"use client";

import React, { ReactNode } from "react";

interface IPhoneShellProps {
  children: ReactNode;
  activeTab?: string;
  bottomDock?: ReactNode;
}

export const IPhoneShell: React.FC<IPhoneShellProps> = ({
  children,
  activeTab,
  bottomDock,
}) => {
  return (
    <div className="min-h-screen bg-[#DDE4DD] flex flex-col items-center justify-center p-0 md:p-3 font-['Plus_Jakarta_Sans',-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif]">
      {/* Phone Container: Native 100% on mobile, fitted card on desktop/laptop */}
      <div className="w-full h-[100dvh] md:max-w-[400px] md:h-[min(94vh,840px)] md:rounded-[40px] md:shadow-[0_24px_60px_-15px_rgba(20,45,25,0.18)] md:border md:border-black/[0.08] flex flex-col relative overflow-hidden bg-[#F5F8F5]">
        
        {/* Background của App (Ảnh 2: Lá mềm mại pastel) */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src="/img/app_bg_leaves.png"
            alt="App Background"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-white/20" />
        </div>

        {/* 1. Inner Screen Canvas - Screens manage fixed header/cards and scrollable lists independently */}
        <div className="flex-1 min-h-0 relative z-10 flex flex-col overflow-hidden">
          {children}
        </div>

        {/* 2. Pinned Bottom Navigation Dock - TÁCH RIÊNG HOÀN TOÀN KHỎI VÙNG CUỘN */}
        {bottomDock && (
          <div className="shrink-0 relative z-40 bg-transparent pt-1 pb-5 sm:pb-3 px-4 flex justify-center">
            {bottomDock}
          </div>
        )}

        {/* 3. iOS Home Indicator Bar - Chỉ hiện trên desktop mockup */}
        <div className="hidden md:flex shrink-0 h-3 justify-center items-center pointer-events-none z-50 bg-transparent">
          <div className="w-32 h-1 bg-[#1A1D1A]/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};
