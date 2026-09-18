import React, { useState } from "react";
import { CheckCircle2, XCircle, Send, Clock, Receipt, Check } from "lucide-react";

export const ShiftHistoryTab = ({ transactions = [], onSendReport }) => {
  const [reportSent, setReportSent] = useState(false);

  const successTx = transactions.filter((t) => t.status !== "failed");
  const failedTx = transactions.filter((t) => t.status === "failed");
  const totalDiscount = successTx.reduce((acc, curr) => acc + (curr.discount || 0), 0);

  const handleSend = () => {
    setReportSent(true);
    if (onSendReport) {
      onSendReport();
    }
    setTimeout(() => {
      setReportSent(false);
    }, 3000);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
      {/* PHẦN CỐ ĐỊNH PHÍA TRÊN: Header + Thẻ Thống Kê KHÔNG DI CHUYỂN */}
      <div className="shrink-0 px-4 pt-1 pb-2 space-y-2.5 bg-[#F8FAF8]">
        {/* 1. Header with Gửi Báo Cáo Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-[#1A1D1A]">
              Lịch Sử Ca Trực
            </h2>
            <p className="text-[11px] text-[#606861] font-medium">
              Hôm nay • Ca Sáng
            </p>
          </div>

          <button
            onClick={handleSend}
            disabled={reportSent}
            className={`h-8 px-3 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all ${
              reportSent
                ? "bg-[#E8F5E9] text-[#3A9A43] border border-[#3A9A43]/20"
                : "bg-white border border-black/5 text-[#1A1D1A] hover:text-[#3A9A43]"
            }`}
            title="Gửi báo cáo ca trực về hệ thống"
          >
            {reportSent ? (
              <>
                <Check size={13} className="text-[#3A9A43]" />
                <span className="text-[#3A9A43]">Đã gửi!</span>
              </>
            ) : (
              <>
                <Send size={13} />
                <span>Gửi Báo Cáo</span>
              </>
            )}
          </button>
        </div>

        {/* Thông báo gửi thành công nếu vừa bấm */}
        {reportSent && (
          <div className="p-2 rounded-[16px] bg-[#E8F5E9] border border-[#3A9A43]/20 text-[#286B30] text-xs font-bold text-center animate-in fade-in">
            ✓ Đã gửi dữ liệu ca trực về hệ thống quản trị!
          </div>
        )}

        {/* 2. Key Metrics Card (Cố định, không bị cuộn trôi) */}
        <div className="bg-white rounded-[24px] p-3.5 border border-black/[0.05] shadow-ios-card space-y-2.5">
          {/* Hàng trên: Tổng tiền giảm */}
          <div className="text-center pb-2 border-b border-black/[0.04]">
            <div className="text-2xl font-black text-[#3A9A43] leading-tight">
              {totalDiscount.toLocaleString("vi-VN")}đ
            </div>
            <div className="text-[10px] font-bold text-[#949E95] uppercase tracking-wider mt-0.5">
              Tổng tiền đã khấu trừ
            </div>
          </div>

          {/* Hàng dưới: 2 cột Thành công & Từ chối */}
          <div className="grid grid-cols-2 gap-2 divide-x divide-black/[0.05]">
            <div className="text-center pr-2">
              <div className="text-base font-black text-[#1A1D1A]">
                {successTx.length}
              </div>
              <div className="text-[10px] font-bold text-[#3A9A43] uppercase tracking-wider mt-0.5">
                Thành công
              </div>
            </div>

            <div className="text-center pl-2">
              <div className="text-base font-black text-rose-600">
                {failedTx.length}
              </div>
              <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-0.5">
                Từ chối
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PHẦN CUỘN ĐỘC LẬP PHÍA DƯỚI: CHỈ DANH SÁCH NHẬT KÝ QUÉT NÀY MỚI TRƯỢT */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-4 space-y-2">
        <div className="sticky top-0 bg-[#F8FAF8] py-1 z-10">
          <span className="text-xs font-black text-[#1A1D1A] uppercase tracking-wider flex items-center gap-1.5">
            <Receipt size={14} className="text-[#3A9A43]" />
            Nhật Ký Quét ({transactions.length})
          </span>
        </div>

        <div className="space-y-2">
          {transactions.map((tx) => {
            const isFailed = tx.status === "failed";

            return (
              <div
                key={tx.id}
                className="bg-white p-3 rounded-[20px] border border-black/[0.04] shadow-ios-card flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      isFailed
                        ? "bg-rose-50 text-rose-600"
                        : "bg-[#E8F5E9] text-[#3A9A43]"
                    }`}
                  >
                    {isFailed ? (
                      <XCircle size={16} strokeWidth={2.5} />
                    ) : (
                      <CheckCircle2 size={16} strokeWidth={2.5} />
                    )}
                  </div>
                  <div>
                    {/* Mã Voucher ghi to rõ ràng */}
                    <div className="text-xs font-mono font-black text-[#1A1D1A]">
                      {tx.code}
                    </div>
                    <div
                      className={`text-[10px] font-medium flex items-center gap-1 mt-0.5 ${
                        isFailed ? "text-rose-600 font-bold" : "text-[#606861]"
                      }`}
                    >
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} />
                        {tx.time}
                      </span>
                      <span>•</span>
                      <span>{isFailed ? tx.reason || "Từ chối" : "Đã áp dụng"}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {isFailed ? (
                    <div className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                      Từ chối
                    </div>
                  ) : (
                    <div className="text-xs font-black text-[#3A9A43] bg-[#E8F5E9] px-2.5 py-1 rounded-full">
                      -{tx.discount.toLocaleString("vi-VN")}đ
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {transactions.length === 0 && (
            <div className="p-8 text-center bg-white rounded-[24px] border border-black/[0.04]">
              <p className="text-xs text-[#949E95] font-bold">
                Chưa có giao dịch nào trong ca này
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
