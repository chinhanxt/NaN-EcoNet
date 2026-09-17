import React from "react";
import { User, Store, Shield, LogOut, CheckCircle2, Smartphone } from "lucide-react";

export const AccountTab = () => {
  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div>
        <h2 className="text-lg font-black text-[#1A1D1A]">
          Tài Khoản Thu Ngân
        </h2>
        <p className="text-xs text-[#606861] font-medium">
          Thông tin thiết bị & ca trực
        </p>
      </div>

      {/* 2. Cashier Profile Card */}
      <div className="bg-white rounded-[26px] p-4 border border-black/[0.05] shadow-ios-card flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-full bg-[#E8F5E9] text-[#3A9A43] flex items-center justify-center font-black text-xl shadow-sm shrink-0">
          <User size={28} strokeWidth={2.2} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-black text-[#1A1D1A]">Nguyễn Lan Anh</h3>
            <span className="w-2 h-2 rounded-full bg-[#3A9A43]" />
          </div>
          <div className="text-xs text-[#606861] font-medium mt-0.5">
            Mã NV: <strong className="text-[#1A1D1A]">NV-8821</strong>
          </div>
          <div className="text-[11px] text-[#3A9A43] font-bold mt-0.5">
            Thu ngân chính • Ca Sáng
          </div>
        </div>
      </div>

      {/* 3. Device & Store Info List (iOS Grouped Style) */}
      <div className="bg-white rounded-[26px] p-4 border border-black/[0.05] shadow-ios-card space-y-3">
        <div className="flex justify-between items-center text-xs py-1 border-b border-black/[0.04]">
          <span className="text-[#606861] font-medium flex items-center gap-2">
            <Store size={15} className="text-[#3A9A43]" />
            Điểm bán:
          </span>
          <span className="font-bold text-[#1A1D1A]">Ministop Căn Tin HUTECH</span>
        </div>

        <div className="flex justify-between items-center text-xs py-1 border-b border-black/[0.04]">
          <span className="text-[#606861] font-medium flex items-center gap-2">
            <Smartphone size={15} className="text-[#3A9A43]" />
            Mã thiết bị:
          </span>
          <span className="font-mono font-bold text-[#1A1D1A]">POS-HUTECH-01</span>
        </div>

        <div className="flex justify-between items-center text-xs py-1 border-b border-black/[0.04]">
          <span className="text-[#606861] font-medium flex items-center gap-2">
            <Shield size={15} className="text-[#3A9A43]" />
            Kết nối máy chủ:
          </span>
          <span className="font-bold text-[#3A9A43] flex items-center gap-1">
            <CheckCircle2 size={13} />
            Trực tuyến
          </span>
        </div>

        <div className="flex justify-between items-center text-xs py-1">
          <span className="text-[#606861] font-medium">Phiên bản POS:</span>
          <span className="font-mono text-[#949E95] text-[11px]">v1.2 (Web POS)</span>
        </div>
      </div>

      {/* 4. Actions */}
      <div className="pt-2">
        <button
          onClick={() => alert("Đăng xuất thành công.")}
          className="w-full h-11 rounded-full bg-rose-50 text-rose-600 text-xs font-black flex items-center justify-center gap-2 hover:bg-rose-100 active:scale-95 transition-all"
        >
          <LogOut size={14} />
          <span>Đăng Xuất</span>
        </button>
      </div>
    </div>
  );
};
