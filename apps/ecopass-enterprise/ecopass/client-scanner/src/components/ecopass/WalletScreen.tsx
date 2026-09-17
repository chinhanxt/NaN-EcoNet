"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Copy, Check, Sparkles, Gift, X, CheckCircle2, Clock } from "lucide-react";
import { playScanBeep } from "../../lib/sound";

// Icon Coupon chuẩn SVG đúng 100% theo mẫu thiết kế
export const CouponAvatar = ({ className = "w-11 h-7" }: { className?: string }) => (
  <svg
    viewBox="0 0 100 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* 1. Thân vé xanh lá có 2 vết khuyết bán nguyệt lõm hai bên */}
    <path
      d="M6 0H94C97.3137 0 100 2.68629 100 6V18C94.4772 18 90 22.4772 90 28C90 33.5228 94.4772 38 100 38V50C100 53.3137 97.3137 56 94 56H6C2.68629 56 0 53.3137 0 50V38C5.52285 38 10 33.5228 10 28C10 22.4772 5.52285 18 0 18V6C0 2.68629 2.68629 0 6 0Z"
      fill="#00B14F"
    />

    {/* 2. Đường kẻ chỉ màu trắng góc trên bên phải */}
    <line x1="56" y1="8" x2="80" y2="8" stroke="white" strokeWidth="3" strokeLinecap="round" />

    {/* 3. Đường kẻ chỉ màu trắng góc dưới bên trái */}
    <line x1="18" y1="48" x2="42" y2="48" stroke="white" strokeWidth="3" strokeLinecap="round" />

    {/* 4. Đường đứt nét gập voucher màu trắng ở giữa */}
    <line
      x1="48.5"
      y1="5"
      x2="48.5"
      y2="51"
      stroke="white"
      strokeWidth="3"
      strokeDasharray="4.5 4.5"
      strokeLinecap="round"
    />

    {/* 5. Hộp quà màu trắng bên trái kèm nơ */}
    {/* Hai cánh nơ */}
    <path
      d="M26 17C23.5 12.5 19 13 19 16.5C19 19 22.5 20.5 28 20.5C33.5 20.5 37 19 37 16.5C37 13 32.5 12.5 30 17"
      stroke="white"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Nắp hộp quà */}
    <rect x="18" y="20.5" width="20" height="6.5" rx="1.5" stroke="white" strokeWidth="2.4" fill="#00B14F" />
    {/* Thân hộp quà */}
    <rect x="20" y="27" width="16" height="13.5" rx="1" stroke="white" strokeWidth="2.4" fill="#00B14F" />
    {/* Dải ruy băng dọc */}
    <line x1="28" y1="20.5" x2="28" y2="40.5" stroke="white" strokeWidth="2.4" />

    {/* 6. Dấu phần trăm (%) màu trắng bên phải */}
    {/* Vòng tròn nhỏ góc trên */}
    <circle cx="61" cy="22" r="3.8" stroke="white" strokeWidth="2.8" />
    {/* Đường chéo */}
    <line x1="77" y1="18" x2="61" y2="38" stroke="white" strokeWidth="3" strokeLinecap="round" />
    {/* Vòng tròn nhỏ góc dưới */}
    <circle cx="77" cy="34" r="3.8" stroke="white" strokeWidth="2.8" />
  </svg>
);

export interface VoucherItem {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  brand: string;
  expiresIn: string;
  used?: boolean;
}

export interface GiftMilestone {
  id: string;
  pointsCost: number;
  title: string;
  subtitle: string;
  brand: string;
}

// Các mốc đổi thành CÁC PHẦN QUÀ thực tế
const GIFT_MILESTONES: GiftMilestone[] = [
  {
    id: "gift-50",
    pointsCost: 50,
    title: "Ly Nước Tái Chế EcoCup",
    subtitle: "Dung tích 500ml • Nhựa sinh học tái chế",
    brand: "Quỹ Môi Trường HUTECH",
  },
  {
    id: "gift-100",
    pointsCost: 100,
    title: "Bình Giữ Nhiệt EcoPass",
    subtitle: "Inox 304 giữ nóng/lạnh 8h",
    brand: "Suntory PepsiCo",
  },
  {
    id: "gift-150",
    pointsCost: 150,
    title: "Túi Canvas Sinh Viên Xanh",
    subtitle: "Vải sợi tự nhiên 100% bền bỉ",
    brand: "EcoPass Campus",
  },
  {
    id: "gift-250",
    pointsCost: 250,
    title: "Set Quà Xanh Toàn Diện",
    subtitle: "Bình Nước + Túi Canvas + Bộ Muỗng Đũa Gỗ",
    brand: "TCP Group & EcoPass",
  },
];

interface WalletScreenProps {
  vouchers: VoucherItem[];
  currentPoints: number;
  onBack: () => void;
  onRedeemMilestone: (milestone: GiftMilestone) => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({
  vouchers,
  currentPoints = 120,
  onBack,
  onRedeemMilestone,
}) => {
  const [activeTab, setActiveTab] = useState<"gifts" | "my_vouchers">("gifts");
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const activeVouchers = vouchers.filter((v) => !v.used);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
      {/* PHẦN CỐ ĐỊNH PHÍA TRÊN: Header + Tab Switcher + Card Quỹ Điểm + Tiêu Đề Danh Sách KHÔNG DI CHUYỂN */}
      <div className="shrink-0 px-5 pt-5 pb-2 space-y-3 bg-transparent z-20">
        {/* 1. Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-black/5 shadow-ios-card flex items-center justify-center text-[#1A1D1A] active:scale-95 transition-all"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>

          <h1 className="text-xl font-black text-[#1A1D1A] tracking-tight">
            Ưu Đãi & Đổi Quà
          </h1>

          {/* Spacer to keep title centered */}
          <div className="w-10 h-10" />
        </div>

        {/* 2. CARD 1: Segmented Pill Switcher */}
        <div className="grid grid-cols-2 p-1 bg-white/90 backdrop-blur-md rounded-full border border-white/80 shadow-sm">
          <button
            onClick={() => setActiveTab("gifts")}
            className={`py-2 rounded-full text-xs font-black transition-all ${
              activeTab === "gifts"
                ? "bg-[#3A9A43] text-white shadow-sm"
                : "text-[#606861] hover:text-[#1A1D1A]"
            }`}
          >
            Đổi Phần Quà
          </button>
          <button
            onClick={() => setActiveTab("my_vouchers")}
            className={`py-2 rounded-full text-xs font-black transition-all relative flex items-center justify-center gap-1.5 ${
              activeTab === "my_vouchers"
                ? "bg-[#3A9A43] text-white shadow-sm"
                : "text-[#606861] hover:text-[#1A1D1A]"
            }`}
          >
            <span>Ví Của Bạn</span>
            {activeVouchers.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === "my_vouchers"
                    ? "bg-white text-[#3A9A43]"
                    : "bg-[#E8F5E9] text-[#3A9A43]"
                }`}
              >
                {activeVouchers.length}
              </span>
            )}
          </button>
        </div>

        {/* 3. CARD 2: Quỹ Điểm Banner Cố Định */}
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-[24px] border border-white/80 shadow-ios-card flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#3A9A43]">
              QUỸ ĐIỂM CỦA BẠN
            </span>
            <div className="text-xl font-black text-[#1A1D1A]">
              {currentPoints} Điểm Xanh
            </div>
            <p className="text-[11px] text-[#606861] font-semibold mt-0.5">
              Vứt rác đúng cách để tích lũy thêm điểm
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#286B30] flex items-center justify-center shadow-sm shrink-0">
            <Gift size={24} strokeWidth={2.2} />
          </div>
        </div>

        {/* 4. Tiêu đề danh sách (Cố định ở đây, thẻ trượt bên dưới không bao giờ bị đè lên) */}
        <div className="pt-1">
          <span className="text-xs font-black text-[#606861] uppercase tracking-wider px-1">
            {activeTab === "gifts"
              ? "Các Phần Quà Có Thể Đổi"
              : `Quà & Voucher Của Bạn (${activeVouchers.length})`}
          </span>
        </div>
      </div>

      {/* PHẦN CUỘN ĐỘC LẬP PHÍA DƯỚI: CHỈ DANH SÁCH THẺ NÀY MỚI TRƯỢT */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-5 space-y-2.5">
        {/* TAB 1: CÁC PHẦN QUÀ ĐỔI ĐIỂM */}
        {activeTab === "gifts" && (
          <div className="space-y-2.5 animate-in fade-in duration-200">
            {GIFT_MILESTONES.map((item) => {
              const canRedeem = currentPoints >= item.pointsCost;
              const progressPct = Math.min(
                100,
                Math.round((currentPoints / item.pointsCost) * 100)
              );

              return (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-[26px] border border-black/[0.04] shadow-ios-card space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar icon Coupon đứng độc lập, không cần card bao quanh */}
                      <CouponAvatar className="w-14 h-8 shrink-0 drop-shadow-sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-[#1A1D1A]">
                            {item.title}
                          </h4>
                          <span className="text-[10px] font-black text-[#3A9A43] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                            {item.pointsCost} Điểm
                          </span>
                        </div>
                        <p className="text-[11px] text-[#606861] font-semibold mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Thanh tiến độ & Nút Đổi Quà */}
                  <div className="pt-2 border-t border-black/[0.03] flex items-center justify-between">
                    {canRedeem ? (
                      <span className="text-[11px] font-black text-[#3A9A43] flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        Đã đủ điểm đổi quà
                      </span>
                    ) : (
                      <div className="flex-1 max-w-[150px]">
                        <div className="flex justify-between text-[10px] font-bold text-[#949E95] mb-1">
                          <span>Thiếu {item.pointsCost - currentPoints} điểm</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3A9A43] rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => canRedeem && onRedeemMilestone(item)}
                      disabled={!canRedeem}
                      className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${
                        canRedeem
                          ? "bg-[#3A9A43] text-white shadow-sm hover:bg-[#286B30] active:scale-95"
                          : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                      }`}
                    >
                      {canRedeem ? "Đổi ngay" : "Chưa đủ"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: VÍ VOUCHER / QUÀ TẶNG CỦA BẠN */}
        {activeTab === "my_vouchers" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {vouchers.map((voucher) => (
              <div
                key={voucher.id}
                onClick={() => {
                  if (!voucher.used) {
                    playScanBeep();
                    setSelectedVoucher(voucher);
                  }
                }}
                className={`bg-white rounded-[26px] p-4 border transition-all cursor-pointer relative overflow-hidden ${
                  voucher.used
                    ? "opacity-50 border-black/5"
                    : "border-black/[0.04] shadow-ios-card hover:border-[#3A9A43] active:scale-[0.99]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#3A9A43] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                      {voucher.brand}
                    </span>
                    <h3 className="text-base font-black text-[#1A1D1A] mt-1.5">
                      {voucher.title}
                    </h3>
                    <p className="text-xs text-[#606861] font-semibold mt-0.5">
                      {voucher.subtitle}
                    </p>
                  </div>
                  {/* Icon Coupon đứng độc lập, không card bao quanh */}
                  <CouponAvatar className="w-14 h-8 shrink-0 drop-shadow-sm self-start mt-1" />
                </div>

                <div className="mt-3 pt-3 border-t border-dashed border-neutral-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[#949E95] font-semibold">
                    <Clock size={12} />
                    <span>{voucher.expiresIn}</span>
                  </div>
                  <span className="font-mono font-bold text-[#3A9A43] bg-[#F8FAF8] px-2 py-0.5 rounded-md border border-black/5">
                    {voucher.code}
                  </span>
                </div>
              </div>
            ))}

            {vouchers.length === 0 && (
              <div className="p-8 text-center bg-white rounded-[26px] border border-black/5">
                <CouponAvatar className="w-12 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-[#949E95] font-bold">
                  Bạn chưa có phần quà hay voucher nào trong ví
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL SHEET APPLE PASSBOOK: XEM MÃ QR ĐỂ THU NGÂN QUÉT */}
      {selectedVoucher && (
        <div
          onClick={() => setSelectedVoucher(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] max-h-[90dvh] overflow-y-auto no-scrollbar bg-white rounded-[32px] p-5 shadow-ios-float border border-black/5 animate-in zoom-in-95 duration-200 relative space-y-3.5"
          >
            {/* Header with Close [X] */}
            <div className="flex items-center justify-between pb-0.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#3A9A43] bg-[#E8F5E9] px-2.5 py-0.5 rounded-full">
                  {selectedVoucher.brand}
                </span>
                <h3 className="text-lg font-black text-[#1A1D1A] mt-1">
                  {selectedVoucher.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 active:scale-90 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* QR Code Container */}
            <div className="bg-[#F8FAF8] p-4 rounded-[22px] border border-black/[0.04] flex flex-col items-center justify-center shadow-inner">
              <div className="bg-white p-3 rounded-[16px] shadow-sm">
                <QRCodeSVG
                  value={selectedVoucher.code}
                  size={160}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-[11px] text-[#606861] font-bold mt-2.5 text-center">
                Đưa mã này cho thu ngân tại quầy thanh toán
              </p>
            </div>

            {/* Voucher Code Copy Bar */}
            <div className="flex items-center justify-between p-2.5 px-3 rounded-full bg-[#F8FAF8] border border-black/[0.04]">
              <span className="font-mono font-black text-xs text-[#1A1D1A] pl-1 tracking-wider">
                {selectedVoucher.code}
              </span>
              <button
                onClick={() => handleCopyCode(selectedVoucher.code)}
                className="px-3 py-1.5 rounded-full bg-[#3A9A43] text-white font-black text-xs flex items-center gap-1 active:scale-95 transition-all shadow-sm hover:bg-[#286B30]"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? "Đã chép" : "Sao chép"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
