import React, { useState } from "react";
import { CheckCircle2, ShieldAlert, Check, X } from "lucide-react";

export const ValidationModal = ({ voucher, onConfirmRedeem, onClose }) => {
  const [redeemed, setRedeemed] = useState(false);

  if (!voucher) return null;

  const isValid = !voucher.used && voucher.status !== "used";

  const handleConfirm = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
    setRedeemed(true);
    setTimeout(() => {
      onConfirmRedeem(voucher);
    }, 900);
  };

  const discountAmount = voucher.discountValue || 10000;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200 select-none font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-sm bg-white rounded-t-[36px] md:rounded-[36px] p-6 shadow-ios-float border border-black/5 animate-in slide-in-from-bottom duration-300 relative overflow-hidden">
        
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-all z-10"
        >
          <X size={16} />
        </button>

        {isValid ? (
          /* MÃ HỢP LỆ */
          <div>
            {!redeemed ? (
              <>
                <div className="flex flex-col items-center text-center pt-2">
                  <div className="w-14 h-14 rounded-full bg-[#E8F5E9] text-[#3A9A43] flex items-center justify-center shadow-ios-glow mb-2">
                    <CheckCircle2 size={32} strokeWidth={2.5} />
                  </div>

                  <span className="text-[11px] font-black uppercase tracking-wider text-[#3A9A43] bg-[#E8F5E9] px-3 py-0.5 rounded-full">
                    Mã Hợp Lệ
                  </span>

                  <div className="text-3xl font-black text-[#1A1D1A] tracking-tight mt-2">
                    {voucher.title || "Giảm 10.000đ"}
                  </div>
                  <p className="text-xs text-[#606861] mt-0.5 font-medium">
                    {voucher.subtitle || "Áp dụng tại Căn tin & Ministop"}
                  </p>
                </div>

                {/* Chi tiết Voucher (Chỉ ghi mã và mức giảm, không can thiệp hóa đơn bên ngoài) */}
                <div className="mt-4 bg-[#F8FAF8] rounded-[24px] p-4 border border-black/[0.03] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#606861]">Mã voucher:</span>
                    <span className="font-mono font-bold text-[#1A1D1A] bg-white px-2 py-0.5 rounded-lg border border-black/[0.04]">
                      {voucher.code}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#606861]">Mức giảm trừ:</span>
                    <span className="font-black text-[#3A9A43] text-sm">
                      -{discountAmount.toLocaleString("vi-VN")}đ
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#606861]">Đơn vị tài trợ:</span>
                    <span className="font-bold text-[#1A1D1A]">
                      {voucher.brand || "Chiến dịch EcoPass"}
                    </span>
                  </div>
                </div>

                {/* Nút xác nhận */}
                <div className="mt-4">
                  <button
                    onClick={handleConfirm}
                    className="w-full h-13 py-3.5 rounded-full bg-[#3A9A43] hover:bg-[#286B30] text-white font-black text-sm flex items-center justify-center gap-2 shadow-ios-glow active:scale-[0.98] transition-all"
                  >
                    <Check size={18} strokeWidth={2.5} />
                    <span>Xác nhận dùng voucher</span>
                  </button>
                </div>
              </>
            ) : (
              /* Đã xác nhận thành công */
              <div className="text-center py-6 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-[#3A9A43] text-white flex items-center justify-center mx-auto mb-3 shadow-ios-glow">
                  <Check size={36} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-black text-[#1A1D1A] tracking-tight">
                  Đã áp dụng voucher!
                </h3>
                <p className="text-xs text-[#606861] mt-1 font-medium">
                  Mã <strong className="font-mono text-[#1A1D1A]">{voucher.code}</strong> đã được ghi nhận trừ <strong>{discountAmount.toLocaleString("vi-VN")}đ</strong>.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* MÃ ĐÃ SỬ DỤNG HOẶC KHÔNG HỢP LỆ */
          <div className="text-center pt-2">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shadow-ios-danger mx-auto mb-2">
              <ShieldAlert size={30} strokeWidth={2.5} />
            </div>

            <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-3 py-0.5 rounded-full">
              Từ chối áp dụng
            </span>

            <div className="text-2xl font-black text-[#1A1D1A] tracking-tight mt-2">
              {voucher.title || "Mã không hợp lệ"}
            </div>

            {/* Chi tiết lỗi */}
            <div className="mt-4 bg-rose-50/50 rounded-[24px] p-4 border border-rose-200/60 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Mã voucher:</span>
                <span className="font-mono font-bold text-[#1A1D1A]">
                  {voucher.code}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Trạng thái:</span>
                <span className="font-bold text-rose-700">
                  {voucher.usedAt ? `Đã dùng lúc ${voucher.usedAt}` : "Không tồn tại trên hệ thống"}
                </span>
              </div>
              <div className="pt-2 border-t border-rose-200/50 text-[11px] text-rose-700 font-medium">
                Mã này không thể sử dụng. Giao dịch đã được lưu vào lịch sử từ chối.
              </div>
            </div>

            {/* Nút đóng */}
            <div className="mt-4">
              <button
                onClick={onClose}
                className="w-full h-12 rounded-full bg-[#1A1D1A] hover:bg-black text-white font-black text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <span>Đóng / Quét tiếp</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
