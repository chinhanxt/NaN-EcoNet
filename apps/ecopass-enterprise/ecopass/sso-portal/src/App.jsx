import React, { useState } from "react";
import {
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Store,
  Layers,
  Terminal,
  Dumbbell,
  Check,
  Lock,
  User,
  Zap,
} from "lucide-react";

// =========================================================================
// DANH SÁCH 4 CỔNG WEB TRONG HỆ THỐNG ECOPASS SSO
// =========================================================================
const WEB_APPS = [
  {
    id: "3009",
    name: "Cashier POS",
    desc: "Thu ngân & Quét mã",
    port: "3009",
    url: "http://localhost:3009/",
    icon: Terminal,
    color: "#059669",
    bgLight: "rgba(5, 150, 105, 0.15)",
    role: "Thu Ngân Quầy",
    defaultUser: "cashier.h6@ecopass.vn",
  },
  {
    id: "3010",
    name: "Operations Hub",
    desc: "Trung tâm điều phối & trạm rác",
    port: "3010",
    url: "http://localhost:3010/",
    icon: Layers,
    color: "#10B981",
    bgLight: "rgba(16, 185, 129, 0.15)",
    role: "Ban Quản Trị ESG",
    defaultUser: "admin.hub@ecopass.vn",
  },
  {
    id: "3011",
    name: "Merchant Portal",
    desc: "Cửa hàng Highlands Coffee",
    port: "3011",
    url: "http://localhost:3011/",
    icon: Store,
    color: "#059669",
    bgLight: "rgba(5, 150, 105, 0.15)",
    role: "Chủ Cửa Hàng (Merchant)",
    defaultUser: "highlands.campus@ecopass.vn",
  },
  {
    id: "3012",
    name: "Partner Portal",
    desc: "Đối tác trải nghiệm & Gym",
    port: "3012",
    url: "http://localhost:3012/",
    icon: Dumbbell,
    color: "#10B981",
    bgLight: "rgba(16, 185, 129, 0.15)",
    role: "Đối Tác Trải Nghiệm",
    defaultUser: "partner.ares@ecopass.vn",
  },
];

export default function SSOLoginApp() {
  const [selectedApp, setSelectedApp] = useState(WEB_APPS[2]); // Mặc định Merchant 3011
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [username, setUsername] = useState(WEB_APPS[2].defaultUser);
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectSuccess, setRedirectSuccess] = useState(false);

  // Khi đổi web từ dropdown, tự cập nhật user mẫu tương ứng để dev nhanh
  const handleSelectApp = (app) => {
    setSelectedApp(app);
    setUsername(app.defaultUser);
    setIsDropdownOpen(false);
  };

  // Xử lý đăng nhập SSO & Chuyển hướng sang port đã chọn
  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Lưu token SSO mẫu vào localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("ecopass_sso_token", "SSO_TOKEN_" + Date.now());
      localStorage.setItem("ecopass_user_role", selectedApp.role);
    }

    setTimeout(() => {
      setIsLoading(false);
      setRedirectSuccess(true);
      setTimeout(() => {
        window.location.href = selectedApp.url;
      }, 700);
    }, 600);
  };

  const SelectedIcon = selectedApp.icon;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans text-white select-none antialiased"
      style={{
        background: "linear-gradient(150deg, #141A16 0%, #0D110F 40%, #060807 100%)",
      }}
    >
      {/* Glow phản chiếu nền Biophilic & Obsidian mờ ảo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#059669]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-white/[0.02] rounded-full blur-2xl pointer-events-none" />

      {/* CARD SSO CONTAINER: Bo góc 32px, Frosted Glass siêu sang */}
      <div
        className="relative z-10 w-full max-w-[420px] rounded-[32px] p-6 sm:p-8 border border-white/20 backdrop-blur-2xl transition-all duration-300 shadow-[0_28px_80px_rgba(0,0,0,0.6)]"
        style={{
          background:
            "linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, rgba(14,19,16,0.94) 100%), #111613",
          boxShadow:
            "0 32px 70px rgba(0,0,0,0.65), inset 0 1px 1.5px rgba(255,255,255,0.4)",
        }}
      >
        {/* HEADER: LOGO ECOPASS & BADGE SSO */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#059669] flex items-center justify-center text-white shadow-xl shadow-[#059669]/30 mb-3 border border-white/20 relative group">
            <span className="text-xl sm:text-2xl font-black tracking-tight">EP</span>
            <div className="absolute -inset-1 rounded-2xl bg-[#059669]/40 blur-md -z-10 group-hover:opacity-100 opacity-60 transition" />
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              EcoPass SSO
            </h1>
            <span className="text-[10px] font-black tracking-wider text-[#10B981] bg-[#059669]/25 px-2 py-0.5 rounded-full border border-[#059669]/40">
              CỔNG TẬP TRUNG
            </span>
          </div>
          <p className="text-xs text-white/60 mt-1 font-medium">
            Một tài khoản duy nhất cho toàn bộ hệ thống
          </p>
        </div>

        {/* DROPDOWN CHỌN 4 CỔNG WEB (ĐỂ DỄ DEV TRƯỚC THEO YÊU CẦU) */}
        <div className="mb-5 relative">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <label className="text-[11px] font-black uppercase tracking-wider text-white/50">
              Cổng Web Đích
            </label>
            <span className="text-[10px] font-mono font-bold text-[#10B981]">
              Port :{selectedApp.port}
            </span>
          </div>

          {/* Nút Trigger Dropdown */}
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/20 rounded-2xl p-3 flex items-center justify-between text-left transition-all duration-200 group focus:outline-none focus:border-[#059669]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0"
                style={{ backgroundColor: selectedApp.color }}
              >
                <SelectedIcon size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="truncate">{selectedApp.name}</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/10 text-white/80">
                    :{selectedApp.port}
                  </span>
                </div>
                <div className="text-[10px] text-white/60 truncate mt-0.5">
                  {selectedApp.desc}
                </div>
              </div>
            </div>
            <ChevronDown
              size={16}
              className={`text-white/60 transition-transform duration-200 flex-shrink-0 ml-2 ${
                isDropdownOpen ? "rotate-180 text-white" : ""
              }`}
            />
          </button>

          {/* Danh Sách 4 Cổng Trổ Xuống */}
          {isDropdownOpen && (
            <>
              {/* Lớp overlay click ngoài để đóng */}
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div
                className="absolute top-full left-0 right-0 mt-2 z-30 bg-[#161B18]/95 border border-white/25 backdrop-blur-2xl rounded-2xl p-1.5 shadow-2xl space-y-1 animate-fade-in"
                style={{
                  boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
                }}
              >
                {WEB_APPS.map((app) => {
                  const Icon = app.icon;
                  const isCur = selectedApp.id === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleSelectApp(app)}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all ${
                        isCur
                          ? "bg-[#059669] text-white shadow-md shadow-[#059669]/30"
                          : "hover:bg-white/[0.08] text-white/80 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isCur ? "bg-white/20 text-white" : "bg-white/10 text-white/90"
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate flex items-center gap-1.5">
                            <span>{app.name}</span>
                            <span
                              className={`text-[9px] font-mono px-1 rounded ${
                                isCur ? "bg-black/20 text-white" : "bg-white/10 text-white/70"
                              }`}
                            >
                              :{app.port}
                            </span>
                          </div>
                          <div
                            className={`text-[10px] truncate ${
                              isCur ? "text-white/90" : "text-white/50"
                            }`}
                          >
                            {app.desc}
                          </div>
                        </div>
                      </div>
                      {isCur && <Check size={16} className="text-white flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* FORM ĐĂNG NHẬP TINH GỌN (ÍT TEXT, TRỰC QUAN) */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Ô TÀI KHOẢN */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-white/50 block mb-1.5 px-1">
              Tài Khoản / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="email@ecopass.vn"
                className="w-full bg-white/[0.06] border border-white/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/30 transition"
              />
            </div>
          </div>

          {/* Ô MẬT KHẨU */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-white/50">
                Mật Khẩu
              </label>
              <button
                type="button"
                onClick={() => setPassword("password123")}
                className="text-[10px] font-bold text-[#10B981] hover:underline"
              >
                Tự Điền Mẫu
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full bg-white/[0.06] border border-white/20 rounded-2xl pl-10 pr-10 py-2.5 text-xs font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/30 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* NÚT ĐĂNG NHẬP CHÍNH */}
          <button
            type="submit"
            disabled={isLoading || redirectSuccess}
            className="w-full mt-2 bg-[#059669] hover:bg-[#047857] text-white py-3 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#059669]/40 hover:shadow-[#059669]/60 active:scale-[0.99] disabled:opacity-80"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang Xác Thực SSO...</span>
              </>
            ) : redirectSuccess ? (
              <>
                <Check size={16} />
                <span>Thành Công! Đang Chuyển Hướng :{selectedApp.port}</span>
              </>
            ) : (
              <>
                <span>Truy Cập {selectedApp.name}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* 4 PHÍM TRUY CẬP NHANH (QUICK SWITCH DEV DƯỚI ĐÁY) */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="text-[10px] font-black uppercase tracking-wider text-white/40 text-center mb-2.5">
            Phím Tắt Chuyển Nhanh
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {WEB_APPS.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => handleSelectApp(app)}
                className={`py-1.5 px-1 rounded-xl text-center transition-all ${
                  selectedApp.id === app.id
                    ? "bg-white text-black font-black shadow-sm scale-105"
                    : "bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white font-bold"
                }`}
                title={`${app.name} (${app.url})`}
              >
                <div className="text-[11px] leading-tight font-mono">:{app.port}</div>
              </button>
            ))}
          </div>
        </div>

        {/* FOOTER BẢO MẬT KÍNH MỜ */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-white/40 font-medium">
          <ShieldCheck size={12} className="text-[#10B981]" />
          <span>Bảo mật tiêu chuẩn SSO • HUTECH EcoPass 2026</span>
        </div>
      </div>
    </div>
  );
}
