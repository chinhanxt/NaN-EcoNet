"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap,
  ArrowLeft,
  CheckCircle2,
  QrCode,
  Barcode,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from "html5-qrcode";
import { playScanBeep, playLockSuccess, playErrorBeep, vibrateDevice } from "../../lib/sound";

interface ScannerScreenProps {
  onBack: () => void;
  onProductDetected: (product: DetectedProduct) => void;
}

export interface DetectedProduct {
  code: string;
  name: string;
  brand: string;
  category: string;
  isSurveyTarget: boolean;
  comparedTo?: string;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({
  onBack,
  onProductDetected,
}) => {
  const [torch, setTorch] = useState(false);
  // Step 1: Quét QR Thùng Rác -> Step 2: Quét Tem Ly Nước
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scanning animation state (idle -> detecting -> locked)
  const [scanningState, setScanningState] = useState<"idle" | "detecting" | "locked">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedBin, setVerifiedBin] = useState<any>(null);
  const [lockedProduct, setLockedProduct] = useState<any>(null);
  const [flashEffect, setFlashEffect] = useState<"success" | "error" | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const currentStepRef = useRef<1 | 2>(1);

  // Keep currentStepRef in sync with state for callbacks
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Xử lý mã quét được từ camera stream thực tế (Không có nút bấm giả lập vượt rào)
  const handleCodeScanned = useCallback(async (rawCode: string) => {
    const code = (rawCode || "").trim();
    if (!code) return;
    if (isProcessingRef.current) return;

    const step = currentStepRef.current;

    if (step === 1) {
      // Step 1: Xác thực mã QR Thùng Rác với CSDL
      isProcessingRef.current = true;
      setErrorMessage(null);

      try {
        const res = await fetch("/api/ecopass/bins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", qrCode: code }),
        });
        const result = await res.json();

        if (!result.valid) {
          setFlashEffect("error");
          setTimeout(() => setFlashEffect(null), 500);
          vibrateDevice([120, 80, 120]);
          playErrorBeep();
          setErrorMessage(result.message || `Mã QR "${code}" không hợp lệ hoặc chưa được đăng ký trong hệ sinh thái EcoPass!`);
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 2500);
          return;
        }

        // QR Thùng rác hợp lệ
        setFlashEffect("success");
        setTimeout(() => setFlashEffect(null), 600);
        playScanBeep();
        vibrateDevice(70);
        setVerifiedBin(result.data);
        setCurrentStep(2);

        // Chờ 1s để người dùng đổi sang rọi mã tem ly nước
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1200);
      } catch (err) {
        setFlashEffect("error");
        setTimeout(() => setFlashEffect(null), 500);
        vibrateDevice([120, 80, 120]);
        playErrorBeep();
        setErrorMessage("Lỗi kết nối cơ sở dữ liệu thùng rác đối tác!");
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 2200);
      }
    } else {
      // Step 2: Xác thực mã tem in nhiệt trên ly nước (Kiểm tra CSDL đối tác & Ký số 1-Time Burn)
      isProcessingRef.current = true;
      setErrorMessage(null);
      setScanningState("detecting");
      playScanBeep();
      vibrateDevice(35);

      try {
        const res = await fetch("/api/ecopass/stickers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", barcode: code }),
        });
        const result = await res.json();

        if (!result.valid) {
          setFlashEffect("error");
          setTimeout(() => setFlashEffect(null), 500);
          vibrateDevice([120, 80, 120]);
          playErrorBeep();
          setScanningState("idle");
          setErrorMessage(result.message || `Mã tem "${code}" không hợp lệ hoặc đã được sử dụng trước đó!`);
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 2500);
          return;
        }

        // Tem đơn hàng hợp lệ và còn hiệu lực
        setFlashEffect("success");
        setTimeout(() => setFlashEffect(null), 800);
        setScanningState("locked");
        setLockedProduct(result.data);
        playLockSuccess();
        vibrateDevice(70);

        // Dừng quét camera khi đã khóa tem thành công
        if (scannerRef.current) {
          try {
            if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
              scannerRef.current.stop().catch(() => {});
            }
          } catch (e) {
            // pass
          }
        }

        // Mở khảo sát thực tế của sản phẩm sau hiệu ứng khóa
        setTimeout(() => {
          const detectedItem: DetectedProduct = {
            code: result.data.barcode,
            name: `${result.data.drinkName} (${result.data.storeName})`,
            brand: result.data.storeName,
            category: "Ly Nhựa Phân Loại Sạch",
            isSurveyTarget: true,
          };
          onProductDetected(detectedItem);
        }, 1100);
      } catch (err) {
        vibrateDevice([120, 80, 120]);
        playErrorBeep();
        setScanningState("idle");
        setErrorMessage("Lỗi kết nối cơ sở dữ liệu tem đối tác!");
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 2200);
      }
    }
  }, [onProductDetected]);

  // Khởi tạo Html5Qrcode quét trực tiếp từ luồng camera của thiết bị
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    const startScanner = async () => {
      try {
        const element = document.getElementById("ecopass-scanner-viewport");
        if (!element) return;

        html5QrCode = new Html5Qrcode("ecopass-scanner-viewport", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        // Quét full-frame không bị crop biên, hỗ trợ cả mã QR vuông và mã vạch 1D dài
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 25,
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              handleCodeScanned(decodedText);
            }
          },
          () => {
            // Frame decode scan loop
          }
        );

        if (isMounted) {
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err: any) {
        console.warn("Camera start error:", err);
        if (isMounted) {
          setCameraActive(false);
          setCameraError("Vui lòng cho phép quyền Camera trên trình duyệt để quét mã.");
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCode) {
        try {
          if (html5QrCode.getState() === Html5QrcodeScannerState.SCANNING) {
            html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
          } else {
            html5QrCode.clear();
          }
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [handleCodeScanned]);

  // Bật/tắt đèn Flash nếu thiết bị hỗ trợ
  const handleToggleTorch = async () => {
    try {
      if (scannerRef.current) {
        const next = !torch;
        await (scannerRef.current as any).applyVideoConstraints({
          advanced: [{ torch: next }],
        });
        setTorch(next);
      }
    } catch (e) {
      console.log("Torch not supported on this camera track");
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex flex-col justify-between overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Visual Haptic Flash Feedback (Rung thị giác đồng bộ âm thanh & xúc giác) */}
      {flashEffect === "success" && (
        <div className="absolute inset-0 z-50 pointer-events-none border-[5px] border-emerald-400 bg-emerald-500/20 animate-in fade-in zoom-in-95 duration-200" />
      )}
      {flashEffect === "error" && (
        <div className="absolute inset-0 z-50 pointer-events-none border-[5px] border-red-500 bg-red-500/25 animate-in fade-in zoom-in-95 duration-200" />
      )}

      {/* 1. Camera Viewport Stream */}
      <div className="absolute inset-0 z-0 bg-black overflow-hidden">
        <div
          id="ecopass-scanner-viewport"
          className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>canvas]:hidden [&>#qr-shaded-region]:hidden"
        />
        {!cameraActive && (
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black flex flex-col items-center justify-center p-6 text-center z-10">
            {cameraError ? (
              <div className="p-5 max-w-xs bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 text-white space-y-3">
                <AlertTriangle size={32} className="mx-auto text-amber-400" />
                <p className="text-xs font-bold leading-relaxed">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-full bg-[#3A9A43] text-white text-xs font-black hover:bg-[#286B30] transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Tải lại trang</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/80">
                <div className="w-10 h-10 border-2 border-[#3A9A43] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold">Đang kích hoạt máy ảnh quét mã...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thông báo lỗi xác thực cơ sở dữ liệu nếu mã không hợp lệ */}
      {errorMessage && (
        <div className="absolute top-16 inset-x-4 z-40 bg-red-600/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-red-400/40 text-xs font-bold flex items-center justify-between shadow-2xl animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 flex-1 pr-2">
            <span className="text-base">⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="w-6 h-6 rounded-full bg-white/20 active:bg-white/40 flex items-center justify-center text-white cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Top Navigation & Current Step Badge */}
      <div className="relative z-30 pt-3 px-5 flex justify-between items-center">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>

        {/* Step Progress Pill */}
        <div className="bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/15 flex items-center gap-2 shadow-ios-card whitespace-nowrap">
          <span
            className={`w-2 h-2 rounded-full ${
              scanningState === "detecting"
                ? "bg-amber-400 animate-ping"
                : scanningState === "locked"
                ? "bg-emerald-400"
                : "bg-[#3A9A43] animate-pulse"
            }`}
          />
          <span className="text-xs font-black text-white tracking-wide">
            {currentStep === 1
              ? "Bước 1/2: Quét QR Thùng Rác"
              : scanningState === "detecting"
              ? "Đang đọc tem đơn hàng..."
              : scanningState === "locked"
              ? "✓ Đã khớp tem đơn hàng"
              : "Bước 2/2: Quét Tem Ly Nước"}
          </span>
        </div>

        {/* Right Action: Đèn Flash */}
        <button
          onClick={handleToggleTorch}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            torch
              ? "bg-[#3A9A43] text-white shadow-ios-glow"
              : "bg-black/50 backdrop-blur-xl border border-white/15 text-white"
          }`}
          title="Bật/Tắt Flash"
        >
          <Zap size={16} />
        </button>
      </div>

      {/* 3. Reticle Viewfinder */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6">
        <div
          className={`relative ${
            currentStep === 1 ? "w-[260px] h-[260px]" : "w-[290px] h-[190px]"
          } transition-all duration-300 ${
            scanningState === "locked" ? "scale-105" : ""
          }`}
        >
          {/* Top Tag on Reticle */}
          <div className="absolute -top-7 inset-x-0 flex justify-center pointer-events-none">
            <div className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md border bg-black/70 text-white/95 border-white/20 flex items-center gap-1.5 whitespace-nowrap shadow-md">
              {currentStep === 1 ? (
                <>
                  <QrCode size={12} className="text-[#3A9A43]" />
                  <span>Bước 1: QR Thùng Rác Đối Tác</span>
                </>
              ) : (
                <>
                  <Barcode size={12} className="text-[#3A9A43]" />
                  <span>Bước 2: Mã Vạch Tem Ly Cửa Hàng</span>
                </>
              )}
            </div>
          </div>

          {/* 4 Corner Brackets */}
          <div
            className={`absolute top-0 left-0 w-10 h-10 border-t-[3.5px] border-l-[3.5px] rounded-tl-[22px] transition-all duration-300 ${
              scanningState === "detecting"
                ? "border-amber-400"
                : scanningState === "locked"
                ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
                : "border-[#3A9A43]"
            }`}
          />
          <div
            className={`absolute top-0 right-0 w-10 h-10 border-t-[3.5px] border-r-[3.5px] rounded-tr-[22px] transition-all duration-300 ${
              scanningState === "detecting"
                ? "border-amber-400"
                : scanningState === "locked"
                ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
                : "border-[#3A9A43]"
            }`}
          />
          <div
            className={`absolute bottom-0 left-0 w-10 h-10 border-b-[3.5px] border-l-[3.5px] rounded-bl-[22px] transition-all duration-300 ${
              scanningState === "detecting"
                ? "border-amber-400"
                : scanningState === "locked"
                ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
                : "border-[#3A9A43]"
            }`}
          />
          <div
            className={`absolute bottom-0 right-0 w-10 h-10 border-b-[3.5px] border-r-[3.5px] rounded-br-[22px] transition-all duration-300 ${
              scanningState === "detecting"
                ? "border-amber-400"
                : scanningState === "locked"
                ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
                : "border-[#3A9A43]"
            }`}
          />

          {/* Central Target Line in Step 2 */}
          {currentStep === 2 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-1 rounded-full bg-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
            </div>
          )}

          {/* Locked Overlay Fill */}
          {scanningState === "locked" && (
            <div className="absolute inset-0 bg-emerald-500/20 rounded-[22px] flex flex-col items-center justify-center p-3 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-[#3A9A43] text-white flex items-center justify-center shadow-[0_0_25px_rgba(58,154,67,0.8)] mb-2 animate-bounce">
                <CheckCircle2 size={28} strokeWidth={2.8} />
              </div>
              <span className="text-xs font-black text-white text-center uppercase tracking-wide">
                Đã Khớp Tem Đơn Hàng!
              </span>
              <span className="text-[11px] text-emerald-300 text-center font-bold mt-0.5">
                {lockedProduct
                  ? `${lockedProduct.storeName} ${lockedProduct.drinkName} (${lockedProduct.code})`
                  : "Highlands Coffee"}
              </span>
            </div>
          )}

          {/* Animated Laser Scanline */}
          {scanningState !== "locked" && (
            <div
              className={`absolute inset-x-2 top-2 h-1 bg-gradient-to-r from-transparent via-[#3A9A43] to-transparent shadow-ios-scanline animate-scanline ${
                scanningState === "detecting" ? "via-amber-400 duration-500" : ""
              }`}
            />
          )}
        </div>

        {/* Real-time Clean Status Pill under reticle (No overlapping text) */}
        <div className="mt-7 flex flex-col items-center gap-2 relative z-30 pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-2 shadow-lg">
            <span
              className={`w-2 h-2 rounded-full ${
                scanningState === "detecting"
                  ? "bg-amber-400 animate-ping"
                  : scanningState === "locked"
                  ? "bg-emerald-400"
                  : "bg-[#3A9A43] animate-pulse"
              }`}
            />
            <span>
              {currentStep === 1
                ? "Hướng camera vào mã QR trên thùng rác"
                : scanningState === "detecting"
                ? "Đang đối soát mã tem với CSDL đối tác..."
                : scanningState === "locked"
                ? "✓ Đã nhận diện tem đơn hàng!"
                : "Hướng camera vào mã vạch trên tem ly"}
            </span>
          </div>
          {verifiedBin && (
            <div className="text-[11px] text-emerald-300 font-bold bg-emerald-950/80 backdrop-blur-md px-3.5 py-1 rounded-full border border-emerald-400/30 shadow">
              ✓ Đã kết nối: {verifiedBin.storeName} ({verifiedBin.location})
            </div>
          )}
        </div>
      </div>

      {/* Bottom Step Indicator Bar */}
      <div className="relative z-30 pb-4 sm:pb-6 px-6 flex justify-center gap-2">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            currentStep === 1 ? "w-10 bg-[#3A9A43]" : "w-4 bg-white/30"
          }`}
        />
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            currentStep === 2 ? "w-10 bg-[#3A9A43]" : "w-4 bg-white/30"
          }`}
        />
      </div>
    </div>
  );
};
