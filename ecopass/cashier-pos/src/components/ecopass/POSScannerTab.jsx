import React, { useState, useEffect, useRef } from "react";
import { Zap, Camera, CheckCircle2, AlertTriangle, Search, Keyboard } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";

export const POSScannerTab = ({ onVoucherScanned, onSimulateCode }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [torch, setTorch] = useState(false);
  const videoRef = useRef(null);
  const readerRef = useRef(null);

  // Initialize camera scanner
  useEffect(() => {
    let stream = null;
    const startScanner = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setCameraActive(true);

            const reader = new BrowserMultiFormatReader();
            readerRef.current = reader;
            reader.decodeFromVideoElement(videoRef.current, (result) => {
              if (result) {
                const text = result.getText();
                onVoucherScanned(text);
              }
            });
          }
        }
      } catch (err) {
        setCameraActive(false);
      }
    };

    startScanner();

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onVoucherScanned]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onVoucherScanned(manualCode.trim().toUpperCase());
      setManualCode("");
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-3.5 animate-in fade-in duration-200">
      {/* 1. Camera Viewfinder Box */}
      <div className="relative w-full h-[240px] rounded-[28px] bg-black overflow-hidden shadow-ios-card flex flex-col justify-between p-3.5">
        {/* Real / Simulated Video Stream */}
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover opacity-85"
            playsInline
            muted
          />
          {!cameraActive && (
            <div className="absolute inset-0 bg-[#141814] flex flex-col items-center justify-center p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mb-2">
                <Camera size={22} />
              </div>
              <p className="text-white/70 text-xs font-bold">
                Camera sẵn sàng quét mã QR
              </p>
            </div>
          )}
        </div>

        {/* Viewfinder Top Controls */}
        <div className="relative z-20 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-white/90 px-3 py-1 rounded-full border border-white/15">
            Quét mã voucher
          </span>
          <button
            onClick={() => setTorch(!torch)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              torch
                ? "bg-[#3A9A43] text-white shadow-ios-glow"
                : "bg-black/50 backdrop-blur-md text-white border border-white/15"
            }`}
            title="Đèn flash"
          >
            <Zap size={14} />
          </button>
        </div>

        {/* Viewfinder Reticle Corners */}
        <div className="relative z-10 self-center w-[150px] h-[150px]">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-[#3A9A43] rounded-tl-[14px]" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-[#3A9A43] rounded-tr-[14px]" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-[#3A9A43] rounded-bl-[14px]" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-[#3A9A43] rounded-br-[14px]" />

          {/* Laser Scanline */}
          <div className="absolute inset-x-2 top-2 h-0.5 bg-gradient-to-r from-transparent via-[#3A9A43] to-transparent shadow-ios-glow animate-pulse" />
        </div>

        {/* Viewfinder Bottom Tip */}
        <div className="relative z-20 text-center">
          <span className="text-[10px] font-bold text-white/80 bg-black/50 backdrop-blur-md px-3 py-0.5 rounded-full border border-white/10">
            Đưa mã QR vào khung
          </span>
        </div>
      </div>

      {/* 2. Nhập mã thủ công - Hiển thị chữ to rõ, không bị cắt */}
      <div className="bg-white p-3 rounded-[24px] border border-black/[0.04] shadow-ios-card">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Nhập mã voucher..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="w-full h-11 pl-9 pr-3 rounded-full bg-[#F8FAF8] border border-black/[0.04] text-xs font-mono font-bold text-[#1A1D1A] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#3A9A43]"
            />
            <Keyboard size={15} className="absolute left-3 top-3.5 text-neutral-400" />
          </div>
          <button
            type="submit"
            className="h-11 px-4 rounded-full bg-[#3A9A43] hover:bg-[#286B30] text-white text-xs font-black active:scale-95 transition-all shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Search size={14} />
            <span>Kiểm tra</span>
          </button>
        </form>
      </div>

      {/* 3. Thử nhanh mã mẫu (Bỏ 0đ, chỉ giữ voucher giảm giá dễ hiểu & mã đã dùng) */}
      <div className="space-y-2 pt-0.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black text-[#606861] uppercase tracking-wider">
            Thử nhanh mã mẫu
          </span>
          <span className="text-[10px] text-[#3A9A43] font-bold bg-[#E8F5E9] px-2 py-0.5 rounded-full">
            1 chạm
          </span>
        </div>

        <div className="space-y-1.5">
          {/* Sample 1: Hợp lệ 10k */}
          <button
            onClick={() => onSimulateCode("ECO-HL-10K-892")}
            className="w-full p-2.5 rounded-[18px] bg-white border border-black/[0.04] shadow-sm hover:border-[#3A9A43] flex items-center justify-between text-left active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#3A9A43] flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-xs font-black text-[#1A1D1A]">
                  Voucher Giảm 10.000đ
                </div>
                <div className="text-[10px] text-[#3A9A43] font-mono font-bold">
                  ECO-HL-10K-892
                </div>
              </div>
            </div>
            <span className="text-xs font-black text-[#3A9A43] bg-[#E8F5E9] px-2.5 py-1 rounded-full">
              -10.000đ
            </span>
          </button>

          {/* Sample 2: Hợp lệ 20k */}
          <button
            onClick={() => onSimulateCode("ECO-HL-20K-015")}
            className="w-full p-2.5 rounded-[18px] bg-white border border-black/[0.04] shadow-sm hover:border-[#3A9A43] flex items-center justify-between text-left active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#3A9A43] flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-xs font-black text-[#1A1D1A]">
                  Voucher Giảm 20.000đ
                </div>
                <div className="text-[10px] text-[#3A9A43] font-mono font-bold">
                  ECO-HL-20K-015
                </div>
              </div>
            </div>
            <span className="text-xs font-black text-[#3A9A43] bg-[#E8F5E9] px-2.5 py-1 rounded-full">
              -20.000đ
            </span>
          </button>

          {/* Sample 3: Cảnh báo đã dùng */}
          <button
            onClick={() => onSimulateCode("ECO-USED-10K")}
            className="w-full p-2.5 rounded-[18px] bg-white border border-black/[0.04] shadow-sm hover:border-rose-400 flex items-center justify-between text-left active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-xs font-black text-rose-700">
                  Mã Đã Dùng
                </div>
                <div className="text-[10px] text-rose-500 font-mono font-bold">
                  ECO-USED-10K
                </div>
              </div>
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
              Đã đổi
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
