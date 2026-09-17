"use client";

import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { DetectedProduct } from "./ScannerScreen";
import { playVoucherTing } from "../../lib/sound";

interface SurveyModalProps {
  product: DetectedProduct;
  onComplete: (surveyResult: { choice: string; voucherGranted: any }) => void;
  onCancel: () => void;
}

export const SurveyModal: React.FC<SurveyModalProps> = ({
  product,
  onComplete,
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<"question" | "reward">("question");

  const handleSelect = (choice: string) => {
    setSelected(choice);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }

    // Tự động chuyển bước sau 300ms và phát âm thanh tinh tế
    setTimeout(() => {
      setStep("reward");
      playVoucherTing();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
    }, 300);
  };

  const handleClaimVoucher = async () => {
    playVoucherTing();
    try {
      // Đốt tem 1 lần trong CSDL thực tế
      const res = await fetch("/api/ecopass/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "burn", barcode: product.code, choice: selected || "A" }),
      });
      const data = await res.json();
      const granted = data.voucher || {
        id: "ECO-HL-10K-892",
        code: "ECO-HL-10K-892",
        title: "Giảm 10.000đ",
        subtitle: `Đơn từ 45.000đ tại chuỗi ${product.brand || "Highlands Coffee"}`,
        brand: product.brand || "Highlands Coffee",
        expiresIn: "Tem ký số 1 lần (Dùng tại quầy)",
      };
      onComplete({
        choice: selected || "A",
        voucherGranted: granted,
      });
    } catch {
      onComplete({
        choice: selected || "A",
        voucherGranted: {
          id: "ECO-HL-10K-892",
          code: "ECO-HL-10K-892",
          title: "Giảm 10.000đ",
          subtitle: `Đơn từ 45.000đ tại chuỗi ${product.brand || "Highlands Coffee"}`,
          brand: product.brand || "Highlands Coffee",
          expiresIn: "Tem ký số 1 lần (Dùng tại quầy)",
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-[340px] bg-white rounded-[26px] p-6 shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
        {step === "question" ? (
          <div>
            {/* Header chuyên nghiệp */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2 h-2 rounded-full bg-[#3A9A43]" />
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Khảo sát nhanh • {product.brand}
              </span>
            </div>

            {/* Câu hỏi ngắn gọn, thực tế */}
            <h2 className="text-[15px] font-extrabold text-neutral-900 tracking-tight leading-snug mb-4">
              Đánh giá hương vị {product.name} hôm nay:
            </h2>

            {/* Lựa chọn khảo sát chuyên nghiệp */}
            <div className="space-y-2.5">
              {[
                { id: "A", label: "Độ ngọt vừa vặn, thơm béo vị hạnh nhân" },
                { id: "B", label: "Cần tăng độ đậm đà của cà phê phin" },
              ].map((item) => {
                const isSelected = selected === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full min-h-[50px] px-4 py-3 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer touch-manipulation ${
                      isSelected
                        ? "bg-[#EBF6EC] border-2 border-[#3A9A43] shadow-sm"
                        : "bg-neutral-50 border border-neutral-200/80 hover:bg-neutral-100/70"
                    }`}
                  >
                    <span className="text-xs font-semibold text-neutral-800 leading-snug">
                      {item.label}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-3 transition-all ${
                        isSelected
                          ? "bg-[#3A9A43] text-white"
                          : "border border-neutral-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 6.2L4.8 8.5L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Màn hình Nhận Quà (Sạch sẽ, chuẩn SVG, không sến súa) */
          <div className="text-center animate-in zoom-in-95 duration-200">
            {/* SVG Icon Hộp quà cao cấp chuẩn Vector */}
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-[#EBF6EC] border border-[#3A9A43]/20 flex items-center justify-center text-[#286B30] shadow-sm">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect x="2" y="7" width="20" height="5" rx="1.5" />
                <line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </div>

            <h3 className="text-[19px] font-black text-neutral-900 tracking-tight">
              Bạn được tặng 1 voucher
            </h3>
            <p className="text-xs text-neutral-500 mt-1 mb-4 font-medium">
              Đã tích lũy <span className="font-bold text-[#3A9A43]">+10 Điểm Xanh</span> và mở khóa ưu đãi.
            </p>

            {/* Voucher Card tinh tế */}
            <div className="bg-neutral-50 border border-neutral-200/90 rounded-2xl p-3.5 mb-4 text-left relative overflow-hidden">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-extrabold text-[#3A9A43] tracking-wide uppercase">
                  {product.brand}
                </span>
                <span className="text-[10px] font-bold text-neutral-400 font-mono">
                  ECO-HL-10K
                </span>
              </div>
              <p className="text-sm font-extrabold text-neutral-900">
                Giảm 10.000đ
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5 font-medium">
                Đơn từ 45.000đ khi mua tại quầy
              </p>
            </div>

            {/* Nút hành động Nhận Quà */}
            <button
              type="button"
              onClick={handleClaimVoucher}
              className="w-full h-12 rounded-2xl bg-[#3A9A43] hover:bg-[#286B30] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer touch-manipulation"
            >
              <span>Nhận quà</span>
              <ArrowRight size={15} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
