"use client";

import React, { useState } from "react";
import { Gift, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Clock, Bell, User } from "lucide-react";

interface HomeScreenProps {
  onStartScan: () => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
  userName?: string;
  currentPoints?: number;
  maxPoints?: number;
}

const INITIAL_SCAN_HISTORY = [
  {
    id: "hist-1",
    name: "Trà Ô Long Tea+ (Vỏ lon)",
    time: "09:30 hôm nay",
    points: "+10 Điểm",
  },
  {
    id: "hist-2",
    name: "Trà Sữa Ministop (Tem #8921)",
    time: "15:20 hôm qua",
    points: "+10 Điểm",
  },
  {
    id: "hist-3",
    name: "Cà Phê Highlands (Chai nhựa)",
    time: "11:05 - 16/09",
    points: "+10 Điểm",
  },
  {
    id: "hist-4",
    name: "Nước Khoáng Dasani (Chai nhựa)",
    time: "08:15 - 15/09",
    points: "+10 Điểm",
  },
  {
    id: "hist-5",
    name: "Revive Chanh Muối (Vỏ lon)",
    time: "14:40 - 14/09",
    points: "+10 Điểm",
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartScan,
  onOpenWallet,
  onOpenProfile,
  userName,
  currentPoints = 120,
  maxPoints = 250,
}) => {
  const [expandedHistory, setExpandedHistory] = useState(false);

  // Mặc định hiện 2 item, bấm "Xem thêm" sẽ hiện toàn bộ 5 item
  const displayedHistory = expandedHistory
    ? INITIAL_SCAN_HISTORY
    : INITIAL_SCAN_HISTORY.slice(0, 2);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
      {/* PHẦN CỐ ĐỊNH PHÍA TRÊN: Header + Hero Card + Level Card + Tiêu Đề Lịch Sử Quét KHÔNG DI CHUYỂN */}
      <div className="shrink-0 px-5 pt-5 pb-2 space-y-3 bg-transparent z-20">
        {/* 1. Header Profile Greeting */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-black text-[#1A1D1A] tracking-tight truncate flex-1 min-w-0">
            Chào {userName || "bạn"}! 🌿
          </h1>

          {/* Top Actions: Notification Bell + Account Icon */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Nút Chuông Thông Báo */}
            <button
              onClick={() => {}}
              className="relative w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-black/5 shadow-ios-card flex items-center justify-center text-[#1A1D1A] hover:text-[#3A9A43] active:scale-95 transition-all"
              title="Thông báo"
            >
              <Bell size={18} strokeWidth={2.2} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E53935] ring-2 ring-white" />
            </button>

            {/* Nút Hồ Sơ Tài Khoản */}
            <button
              onClick={onOpenProfile}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-black/5 shadow-ios-card flex items-center justify-center text-[#1A1D1A] hover:text-[#3A9A43] active:scale-95 transition-all"
              title="Hồ sơ tài khoản"
            >
              <User size={19} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* 2. CARD 1: Hero Card (Điểm Xanh Hiện Tại & Điểm Xanh Cao Nhất) - ẢNH 1 LÀM MỜ NGHỆ THUẬT */}
        <div
          onClick={onOpenWallet}
          className="relative rounded-[32px] p-5 text-white shadow-ios-glow overflow-hidden cursor-pointer active:scale-[0.99] transition-all border border-white/20 group"
        >
          {/* Lớp nền Ảnh 1 làm mờ nghệ thuật: lộ rõ đường nét lá Monstera và giọt nước tinh tế bên phải */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <img
              src="/img/card_green_leaves.png"
              alt="Lá xanh sinh thái"
              className="w-full h-full object-cover object-[85%_70%] filter blur-[1.5px] scale-105 opacity-90 group-hover:scale-110 transition-transform duration-700"
            />
            {/* Gradient bên trái đậm để tôn số điểm trắng, bên phải nhẹ nhàng để lộ lá cây */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#143B1A]/90 via-[#1B4D22]/65 to-[#0E2B13]/35" />
          </div>

          {/* Nội dung trên Card */}
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-4xl font-black tracking-tight text-white leading-none drop-shadow-sm">
                  {currentPoints}
                </div>
                <div className="text-xs font-black uppercase tracking-wider text-white/95 mt-1.5 drop-shadow-sm">
                  Điểm Xanh Hiện Tại
                </div>
              </div>

              {/* Icon hộp quà có kèm chữ "Đổi voucher" */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenWallet();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md text-[#286B30] font-black text-xs shadow-md hover:bg-white active:scale-95 transition-all"
              >
                <Gift size={15} strokeWidth={2.5} />
                <span>Đổi voucher</span>
              </button>
            </div>

            {/* Điểm xanh cao nhất */}
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/90 font-bold">
              <span>Điểm xanh cao nhất:</span>
              <span className="text-white font-black">{maxPoints} Điểm</span>
            </div>
          </div>
        </div>

        {/* 3. CARD 2: Thanh Tiến Trình Level Lên Cấp */}
        <div className="bg-white/90 backdrop-blur-md rounded-[26px] p-4 border border-white/80 shadow-ios-card space-y-2.5">
          {/* Hàng trên: Level & Điểm xanh */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-black text-sm text-[#1A1D1A]">
              <Sparkles size={16} className="text-[#3A9A43]" />
              <span>Level 1</span>
            </div>
            <div className="text-xs font-black text-[#3A9A43]">
              {currentPoints} <span className="text-[#949E95] font-bold">/ 150 Điểm xanh</span>
            </div>
          </div>

          {/* Thanh tiến trình bo góc mượt mà */}
          <div className="w-full h-2.5 bg-[#E8F5E9] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#286B30] to-[#3A9A43] transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.round((currentPoints / 150) * 100))}%` }}
            />
          </div>

          {/* Hàng dưới: Thưởng mốc tiếp theo & số điểm còn lại */}
          <div className="flex justify-between items-center text-xs pt-0.5">
            <div className="flex items-center gap-1.5 text-[#606861] font-bold">
              <Gift size={14} className="text-[#3A9A43]" />
              <span>Lên Level 2 nhận voucher 20k</span>
            </div>
            <span className="font-black text-[#3A9A43]">
              Còn {Math.max(0, 150 - currentPoints)} điểm
            </span>
          </div>
        </div>


        {/* 4. Tiêu Đề Lịch Sử Quét (Cố định hoàn toàn, không bị trôi đè lên) */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-black text-[#1A1D1A] uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={14} className="text-[#3A9A43]" />
            Lịch Sử Quét
          </span>
          <button
            onClick={() => setExpandedHistory(!expandedHistory)}
            className="text-xs font-black text-[#3A9A43] hover:underline flex items-center gap-0.5"
          >
            <span>{expandedHistory ? "Thu gọn" : "Xem thêm"}</span>
            {expandedHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* PHẦN CUỘN ĐỘC LẬP PHÍA DƯỚI: CHỈ CÁC CARD NÀY MỚI TRƯỢT, KHÔNG BAO GIỜ BỊ ĐÈ LÊN TIÊU ĐỀ */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-5 space-y-2">
        {displayedHistory.map((item) => (
          <div
            key={item.id}
            className="bg-white/90 backdrop-blur-sm p-3.5 rounded-[22px] border border-white/80 shadow-ios-card flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] flex items-center justify-center font-bold text-[#3A9A43] bg-[#E8F5E9] shrink-0">
                <CheckCircle2 size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#1A1D1A]">
                  {item.name}
                </h4>
                <span className="text-[10px] text-[#949E95] font-bold">
                  {item.time}
                </span>
              </div>
            </div>

            <span className="text-xs font-black text-[#3A9A43] bg-[#E8F5E9] px-2.5 py-1 rounded-full shrink-0">
              {item.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
