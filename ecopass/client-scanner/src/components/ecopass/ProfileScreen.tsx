"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  User,
  Save,
  CheckCircle2,
  Camera,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";

export interface UserProfileData {
  fullName: string;
  phone: string;
}

interface ProfileScreenProps {
  onBack: () => void;
  userProfile: UserProfileData;
  onSaveProfile: (profile: UserProfileData) => void;
  currentPoints?: number;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  userProfile,
  onSaveProfile,
}) => {
  const [fullName, setFullName] = useState(userProfile.fullName);
  const [phone, setPhone] = useState(userProfile.phone);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Quản lý trạng thái Đổi Mật Khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passError, setPassError] = useState("");

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveProfile({
      fullName: fullName.trim() || userProfile.fullName,
      phone: phone.trim() || userProfile.phone,
    });
    setToastMessage("Đã cập nhật thông tin thành công!");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");

    if (!currentPassword) {
      setPassError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (newPassword.length < 6) {
      setPassError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("Mật khẩu xác nhận không trùng khớp");
      return;
    }

    // Đổi mật khẩu thành công
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setToastMessage("Đổi mật khẩu thành công!");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Lấy chữ cái đầu làm avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (name.slice(0, 2) || "AN").toUpperCase();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-transparent animate-in fade-in duration-200">
      {/* 1. Header cố định */}
      <div className="shrink-0 px-5 pt-4 pb-3 flex items-center justify-between border-b border-black/[0.04] bg-white/40 backdrop-blur-md z-20">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-black/5 shadow-ios-card flex items-center justify-center text-[#1A1D1A] hover:text-[#3A9A43] active:scale-95 transition-all"
          title="Quay lại"
        >
          <ArrowLeft size={19} strokeWidth={2.4} />
        </button>

        <h1 className="text-base font-black text-[#1A1D1A] tracking-tight">
          Hồ Sơ Tài Khoản
        </h1>

        {/* Spacer cân bằng tiêu đề giữa màn hình */}
        <div className="w-10 h-10" />
      </div>

      {/* Toast thông báo */}
      {showToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D1A] text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={15} className="text-[#3A9A43]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Nội dung cuộn mượt mà */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4 space-y-4">
        {/* Card Avatar & Thông Tin Cơ Bản */}
        <div className="bg-white/92 backdrop-blur-md rounded-[28px] p-5 border border-white/80 shadow-ios-card flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#3A9A43]/5 pointer-events-none" />

          {/* Avatar với nút camera */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#286B30] to-[#3A9A43] text-white flex items-center justify-center text-2xl font-black shadow-ios-glow">
              {getInitials(fullName)}
            </div>
            <button
              type="button"
              onClick={() => {
                setToastMessage("Tính năng đổi ảnh đại diện đang mở!");
                setShowToast(true);
                setTimeout(() => setShowToast(false), 2000);
              }}
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white text-[#1A1D1A] border border-black/10 shadow-sm flex items-center justify-center hover:bg-neutral-100 transition"
              title="Đổi ảnh đại diện"
            >
              <Camera size={13} strokeWidth={2.4} />
            </button>
          </div>

          <h2 className="text-xl font-black text-[#1A1D1A] tracking-tight">
            {fullName || "Chưa cập nhật tên"}
          </h2>
          <p className="text-xs font-bold text-neutral-500 mt-0.5 font-mono">
            {phone || "Chưa cập nhật SĐT"}
          </p>
        </div>

        {/* Card Form 1: Họ tên & Số điện thoại */}
        <form
          onSubmit={handleSave}
          className="bg-white/92 backdrop-blur-md rounded-[28px] p-5 border border-white/80 shadow-ios-card space-y-3.5"
        >
          <div className="flex items-center gap-2 pb-1 border-b border-black/[0.04]">
            <User size={16} strokeWidth={2.4} className="text-[#3A9A43]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1D1A]">
              Thông Tin Tài Khoản
            </h3>
          </div>

          {/* Trường 1: Họ và Tên */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-neutral-500 uppercase tracking-wide">
              Họ và Tên
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ..."
                className="w-full bg-white/70 border border-black/[0.08] focus:border-[#3A9A43] focus:ring-2 focus:ring-[#3A9A43]/15 rounded-2xl px-4 py-3 text-sm font-bold text-[#1A1D1A] placeholder:text-neutral-400 outline-none transition"
              />
            </div>
          </div>

          {/* Trường 2: Số Điện Thoại */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-neutral-500 uppercase tracking-wide flex items-center justify-between">
              <span>Số Điện Thoại</span>
              <span className="text-[10px] text-[#3A9A43] font-bold">
                Để sử dụng voucher
              </span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ví dụ: 0908 123 456"
                className="w-full bg-white/70 border border-black/[0.08] focus:border-[#3A9A43] focus:ring-2 focus:ring-[#3A9A43]/15 rounded-2xl px-4 py-3 text-sm font-bold text-[#1A1D1A] placeholder:text-neutral-400 outline-none transition font-mono"
              />
            </div>
          </div>

          {/* Nút lưu thông tin tài khoản */}
          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-tr from-[#286B30] to-[#3A9A43] hover:brightness-105 active:scale-[0.98] text-white font-black text-sm shadow-ios-glow transition flex items-center justify-center gap-2"
          >
            <Save size={15} strokeWidth={2.4} />
            <span>Lưu Thông Tin</span>
          </button>
        </form>

        {/* Card Form 2: Đổi Mật Khẩu (Thay thế cho phần Thành tích & MSSV Cơ sở) */}
        <form
          onSubmit={handleChangePassword}
          className="bg-white/92 backdrop-blur-md rounded-[28px] p-5 border border-white/80 shadow-ios-card space-y-3.5"
        >
          <div className="flex items-center gap-2 pb-1 border-b border-black/[0.04]">
            <Lock size={16} strokeWidth={2.4} className="text-[#3A9A43]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1D1A]">
              Đổi Mật Khẩu
            </h3>
          </div>

          {/* Báo lỗi nếu có */}
          {passError && (
            <div className="p-2.5 rounded-xl bg-[#FEE2E2] text-[#DC2626] text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle size={15} className="shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {/* Mật khẩu hiện tại */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-neutral-500 uppercase tracking-wide">
              Mật Khẩu Hiện Tại
            </label>
            <div className="relative">
              <input
                type={showCurrentPass ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại..."
                className="w-full bg-white/70 border border-black/[0.08] focus:border-[#3A9A43] focus:ring-2 focus:ring-[#3A9A43]/15 rounded-2xl px-4 py-3 pr-11 text-sm font-bold text-[#1A1D1A] placeholder:text-neutral-400 outline-none transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
                title={showCurrentPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Mật khẩu mới */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-neutral-500 uppercase tracking-wide">
              Mật Khẩu Mới
            </label>
            <div className="relative">
              <input
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                className="w-full bg-white/70 border border-black/[0.08] focus:border-[#3A9A43] focus:ring-2 focus:ring-[#3A9A43]/15 rounded-2xl px-4 py-3 pr-11 text-sm font-bold text-[#1A1D1A] placeholder:text-neutral-400 outline-none transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
                title={showNewPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-neutral-500 uppercase tracking-wide">
              Xác Nhận Mật Khẩu Mới
            </label>
            <div className="relative">
              <input
                type={showConfirmPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full bg-white/70 border border-black/[0.08] focus:border-[#3A9A43] focus:ring-2 focus:ring-[#3A9A43]/15 rounded-2xl px-4 py-3 pr-11 text-sm font-bold text-[#1A1D1A] placeholder:text-neutral-400 outline-none transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
                title={showConfirmPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Nút cập nhật mật khẩu */}
          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-2xl bg-white border border-[#3A9A43]/40 text-[#286B30] hover:bg-[#E8F5E9] active:scale-[0.98] font-black text-xs shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <KeyRound size={15} strokeWidth={2.4} />
            <span>Cập Nhật Mật Khẩu</span>
          </button>
        </form>

        {/* Nút thoát về trang chủ */}
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 rounded-2xl bg-white/90 backdrop-blur-md border border-black/[0.08] hover:bg-neutral-50 active:scale-[0.98] text-[#1A1D1A] font-bold text-xs shadow-ios-card transition flex items-center justify-center gap-1.5"
        >
          <ArrowLeft size={14} strokeWidth={2.4} />
          <span>Quay Lại Trang Chủ</span>
        </button>
      </div>
    </div>
  );
};
