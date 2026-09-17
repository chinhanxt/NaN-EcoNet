import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Gift,
  CheckCircle2,
  Users,
  Search,
  Download,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  QrCode,
  MoreVertical,
  Plus,
  Trash2,
  Edit2,
  Clock,
  ThumbsUp,
  AlertCircle,
  X,
  Dumbbell,
  GraduationCap,
  ShieldCheck,
  Award,
} from "lucide-react";

// ==========================================
// ĐỒNG BỘ 100% STYLE VỚI CỔNG 3011 (MERCHANT PORTAL):
// - FLOATING FROSTED GLASS SIDEBAR NỀN ĐEN KÍNH MỜ
// - VÙNG NỘI DUNG CHÍNH (MAIN WORKSPACE) BO TRÒN 28PX
// - 4 MÀU CHUẨN: ĐEN (#000000) - TRẮNG (#FFFFFF) - XANH (#059669) - ĐỎ (#DC2626)
// - TUYỆT ĐỐI KHÔNG HIỂN THỊ /pos TRÊN GIAO DIỆN
// ==========================================

// ĐIỀU HƯỚNG URL LINK THEO TAB
const ROUTES = {
  "/": "dashboard",
  "/tongquan": "dashboard",
  "/goiudai": "packages",
  "/checkin": "checkin",
  "/sinhvien": "students",
};

const TAB_TO_PATH = {
  dashboard: "/",
  packages: "/goiudai",
  checkin: "/checkin",
  students: "/sinhvien",
};

// DỮ LIỆU ĐỐI TÁC THỂ THAO & GIÁO DỤC
const PARTNER_PROFILES = {
  gym: {
    id: "gym",
    name: "Ares Fitness & Yoga",
    campus: "Đối Tác Thể Thao • Campus Khu E",
    avatarText: "AF",
    icon: Dumbbell,
    categoryName: "Gym & Thể Thao",
    timeline: [
      { day: "T2", checkins: 14, claims: 18, orders: 18, label: "14 Lượt", x: 45, y: 76 },
      { day: "T3", checkins: 19, claims: 24, orders: 24, label: "19 Lượt", x: 88, y: 62 },
      { day: "T4", checkins: 26, claims: 32, orders: 32, label: "26 Lượt", x: 131, y: 44 },
      { day: "T5", checkins: 22, claims: 28, orders: 28, label: "22 Lượt", x: 174, y: 54 },
      { day: "T6", checkins: 35, claims: 42, orders: 42, label: "35 Lượt", x: 217, y: 26 },
      { day: "T7", checkins: 30, claims: 36, orders: 36, label: "30 Lượt", x: 260, y: 36 },
      { day: "CN", checkins: 24, claims: 30, orders: 30, label: "24 Lượt", x: 302, y: 50 },
    ],
    kpis: {
      totalQuota: 250,
      claimed: 192,
      checkedIn: 148,
      pointsBurned: 4440,
      rate: "77.1%",
    },
    topPackages: [
      { name: "Pass 7 Ngày Full Phòng Máy", count: 88, percent: 88, color: "#059669" },
      { name: "1 Buổi Yoga / Zumba Nhóm", count: 52, percent: 74, color: "#059669" },
      { name: "Đo InBody & Tư Vấn Dinh Dưỡng", count: 34, percent: 68, color: "#059669" },
      { name: "Pass 3 Ngày Tự Do Trải Nghiệm", count: 18, percent: 45, color: "#DC2626" },
    ],
    initialPackages: [
      {
        id: "PKG-GYM-1",
        title: "Pass 7 Ngày Trải Nghiệm Full Phòng Tập",
        subtitle: "Tập không giới hạn toàn bộ dàn máy Gym & Cardio tại cơ sở Campus",
        points: 30,
        quotaTotal: 100,
        quotaUsed: 88,
        status: "Đang Mở",
        createdDate: "01/09/2026",
      },
      {
        id: "PKG-GYM-2",
        title: "1 Buổi Trải Nghiệm Lớp Yoga / Zumba Miễn Phí",
        subtitle: "Tham gia 1 buổi huấn luyện viên chuyên nghiệp hướng dẫn lớp nhóm",
        points: 20,
        quotaTotal: 70,
        quotaUsed: 52,
        status: "Đang Mở",
        createdDate: "05/09/2026",
      },
      {
        id: "PKG-GYM-3",
        title: "Gói Đo InBody & Lên Giáo Án Dinh Dưỡng 1:1",
        subtitle: "Phân tích cơ xương mỡ và tư vấn thực đơn khoa học cho sinh viên",
        points: 15,
        quotaTotal: 50,
        quotaUsed: 34,
        status: "Đang Mở",
        createdDate: "10/09/2026",
      },
      {
        id: "PKG-GYM-4",
        title: "Pass 3 Ngày Tự Do Trải Nghiệm Khung Giờ Vàng",
        subtitle: "Trải nghiệm tập luyện khung giờ từ 08:00 - 16:00 các ngày trong tuần",
        points: 10,
        quotaTotal: 40,
        quotaUsed: 18,
        status: "Đang Mở",
        createdDate: "12/09/2026",
      },
    ],
    initialStudents: [
      { code: "SV-84920", name: "Nguyễn Văn Hùng", phone: "0918.234.892", mssv: "2180601244", pkg: "Pass 7 Ngày Full Phòng Máy", pts: 30, date: "19/09 14:15", status: "Đã Kích Hoạt" },
      { code: "SV-84921", name: "Trần Thị Mai", phone: "0983.112.450", mssv: "2280603120", pkg: "1 Buổi Yoga / Zumba Nhóm", pts: 20, date: "19/09 13:40", status: "Đã Kích Hoạt" },
      { code: "SV-84922", name: "Lê Hoàng Long", phone: "0905.889.312", mssv: "2080600981", pkg: "Đo InBody & Tư Vấn Dinh Dưỡng", pts: 15, date: "19/09 11:20", status: "Chờ Kích Hoạt" },
      { code: "SV-84923", name: "Phạm Thảo My", phone: "0972.441.908", mssv: "2380607712", pkg: "Pass 7 Ngày Full Phòng Máy", pts: 30, date: "19/09 09:55", status: "Đã Kích Hoạt" },
      { code: "SV-84924", name: "Đỗ Quốc Khánh", phone: "0934.776.221", mssv: "2180604432", pkg: "Pass 7 Ngày Full Phòng Máy", pts: 30, date: "18/09 16:30", status: "Chờ Kích Hoạt" },
      { code: "SV-84925", name: "Hoàng Minh Trí", phone: "0912.338.441", mssv: "2280605589", pkg: "1 Buổi Yoga / Zumba Nhóm", pts: 20, date: "18/09 15:10", status: "Đã Kích Hoạt" },
    ],
  },
  edu: {
    id: "edu",
    name: "The IELTS Workshop",
    campus: "Đối Tác Ngoại Ngữ • Campus Khu A/B",
    avatarText: "IW",
    icon: GraduationCap,
    categoryName: "Giáo Dục & Khóa Học",
    timeline: [
      { day: "T2", checkins: 18, claims: 22, orders: 22, label: "18 Lượt", x: 45, y: 72 },
      { day: "T3", checkins: 24, claims: 28, orders: 28, label: "24 Lượt", x: 88, y: 56 },
      { day: "T4", checkins: 32, claims: 38, orders: 38, label: "32 Lượt", x: 131, y: 38 },
      { day: "T5", checkins: 28, claims: 34, orders: 34, label: "28 Lượt", x: 174, y: 46 },
      { day: "T6", checkins: 42, claims: 48, orders: 48, label: "42 Lượt", x: 217, y: 20 },
      { day: "T7", checkins: 36, claims: 40, orders: 40, label: "36 Lượt", x: 260, y: 30 },
      { day: "CN", checkins: 28, claims: 32, orders: 32, label: "28 Lượt", x: 302, y: 46 },
    ],
    kpis: {
      totalQuota: 300,
      claimed: 242,
      checkedIn: 186,
      pointsBurned: 5580,
      rate: "76.8%",
    },
    topPackages: [
      { name: "Test IELTS 4 Kỹ Năng Chuẩn", count: 96, percent: 96, color: "#059669" },
      { name: "Học Thử Speaking 1-1 Giảng Viên", count: 64, percent: 80, color: "#059669" },
      { name: "Ebook 200 Bài Mẫu Writing Task 2", count: 48, percent: 72, color: "#059669" },
      { name: "Workshop Bí Quyết Listening 8.0", count: 34, percent: 56, color: "#DC2626" },
    ],
    initialPackages: [
      {
        id: "PKG-EDU-1",
        title: "Test Trình Độ IELTS 4 Kỹ Năng Chuẩn Cambridge",
        subtitle: "Được chấm trực tiếp bởi giáo viên 8.0+ IELTS kèm lộ trình học tập cá nhân",
        points: 25,
        quotaTotal: 100,
        quotaUsed: 96,
        status: "Đang Mở",
        createdDate: "02/09/2026",
      },
      {
        id: "PKG-EDU-2",
        title: "1 Buổi Học Thử Speaking 1-1 Với Giảng Viên 8.5",
        subtitle: "Sửa phát âm, nâng cấp từ vựng Band 7+ trong 45 phút tương tác thực chiến",
        points: 35,
        quotaTotal: 80,
        quotaUsed: 64,
        status: "Đang Mở",
        createdDate: "06/09/2026",
      },
      {
        id: "PKG-EDU-3",
        title: "Bộ Ebook 200 Bài Mẫu Writing Task 2 Độc Quyền",
        subtitle: "Tài liệu giải đề chi tiết kèm file Audio mẫu tự luyện thi tại nhà",
        points: 15,
        quotaTotal: 65,
        quotaUsed: 48,
        status: "Đang Mở",
        createdDate: "12/09/2026",
      },
      {
        id: "PKG-EDU-4",
        title: "Vé Tham Dự Workshop Chinh Phục Listening 8.0",
        subtitle: "Chia sẻ mẹo bắt key từ thủ khoa IELTS và tặng kèm tài liệu độc quyền",
        points: 20,
        quotaTotal: 60,
        quotaUsed: 34,
        status: "Đang Mở",
        createdDate: "15/09/2026",
      },
    ],
    initialStudents: [
      { code: "SV-91001", name: "Ngô Bá Quân", phone: "0968.321.455", mssv: "2180608921", pkg: "Test IELTS 4 Kỹ Năng Chuẩn", pts: 25, date: "19/09 14:20", status: "Đã Kích Hoạt" },
      { code: "SV-91002", name: "Vũ Hải Đăng", phone: "0977.890.112", mssv: "2280601132", pkg: "Học Thử Speaking 1-1 Giảng Viên", pts: 35, date: "19/09 12:45", status: "Đã Kích Hoạt" },
      { code: "SV-91003", name: "Đinh Phương Anh", phone: "0908.456.789", mssv: "2380604490", pkg: "Test IELTS 4 Kỹ Năng Chuẩn", pts: 25, date: "19/09 10:10", status: "Chờ Kích Hoạt" },
      { code: "SV-91004", name: "Lý Gia Huy", phone: "0932.118.990", mssv: "2080605511", pkg: "Ebook 200 Bài Mẫu Writing Task 2", pts: 15, date: "19/09 08:30", status: "Đã Kích Hoạt" },
      { code: "SV-91005", name: "Nguyễn Khánh Linh", phone: "0989.667.221", mssv: "2280609981", pkg: "Học Thử Speaking 1-1 Giảng Viên", pts: 35, date: "18/09 17:15", status: "Chờ Kích Hoạt" },
    ],
  },
};

export default function PartnerPortalApp() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [partnerType, setPartnerType] = useState("gym"); // 'gym' | 'edu'
  const brand = PARTNER_PROFILES[partnerType];

  // Khởi tạo activeNav đồng bộ theo link URL hiện tại trên thanh địa chỉ
  const getInitialNav = () => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname.toLowerCase().replace(/\/$/, "");
      return ROUTES[p] || ROUTES[p + "/"] || "dashboard";
    }
    return "dashboard";
  };

  const [activeNav, setActiveNav] = useState(getInitialNav);
  const [activeDayIdx, setActiveDayIdx] = useState(4); // Mặc định T6
  const [searchQuery, setSearchQuery] = useState("");
  const [packages, setPackages] = useState(brand.initialPackages);
  const [students, setStudents] = useState(brand.initialStudents);

  // Check-in state
  const [inputCode, setInputCode] = useState("");
  const [checkinResult, setCheckinResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Modal Thêm Gói Mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPkgTitle, setNewPkgTitle] = useState("");
  const [newPkgSubtitle, setNewPkgSubtitle] = useState("");
  const [newPkgPoints, setNewPkgPoints] = useState(20);
  const [newPkgQuota, setNewPkgQuota] = useState(50);

  // Lắng nghe popstate để đồng bộ link URL
  useEffect(() => {
    const handlePopState = () => {
      setActiveNav(getInitialNav());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Chuyển tab và cập nhật URL
  const navigateTo = (navId) => {
    setActiveNav(navId);
    const targetPath = TAB_TO_PATH[navId] || "/";
    if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
      window.history.pushState({ navId }, "", targetPath);
    }
  };

  // Cập nhật khi chuyển đổi Partner Gym vs Education
  useEffect(() => {
    setPackages(PARTNER_PROFILES[partnerType].initialPackages);
    setStudents(PARTNER_PROFILES[partnerType].initialStudents);
    setCheckinResult(null);
  }, [partnerType]);

  const chartSvgRef = useRef(null);

  // Tương tác kéo rê chuột trên biểu đồ sóng
  const handleChartInteraction = (e) => {
    if (!chartSvgRef.current) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(ratio * (brand.timeline.length - 1));
    setActiveDayIdx(idx);
  };

  const currentPoint = brand.timeline[activeDayIdx] || brand.timeline[4];

  // Xử lý Check-in mã sinh viên
  const handleCheckin = (e) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    const trimmed = inputCode.trim().toUpperCase();
    const found = students.find((s) => s.code.toUpperCase() === trimmed);

    if (found) {
      if (found.status === "Đã Kích Hoạt") {
        setCheckinResult({
          success: false,
          msg: `Mã [${found.code}] đã được kích hoạt trước đó vào lúc ${found.date}!`,
          data: found,
        });
      } else {
        setStudents((prev) =>
          prev.map((s) => (s.code === found.code ? { ...s, status: "Đã Kích Hoạt", date: "Vừa kích hoạt" } : s))
        );
        setCheckinResult({
          success: true,
          msg: `Xác thực thành công! Sinh viên: ${found.name} (${found.mssv}) đã được cấp quyền tham gia [${found.pkg}].`,
          data: { ...found, status: "Đã Kích Hoạt", date: "Vừa kích hoạt" },
        });
      }
    } else {
      setCheckinResult({
        success: false,
        msg: `Không tìm thấy mã [${trimmed}]. Vui lòng kiểm tra lại mã hợp lệ trên ứng dụng EcoPass của sinh viên!`,
      });
    }
    setInputCode("");
  };

  // Xử lý thêm gói mới
  const handleAddPackage = (e) => {
    e.preventDefault();
    if (!newPkgTitle.trim()) return;

    const newPkg = {
      id: `PKG-${Date.now().toString().slice(-4)}`,
      title: newPkgTitle,
      subtitle: newPkgSubtitle || "Gói trải nghiệm đặc quyền đối tác HUTECH",
      points: Number(newPkgPoints) || 20,
      quotaTotal: Number(newPkgQuota) || 50,
      quotaUsed: 0,
      status: "Đang Mở",
      createdDate: "Hôm nay",
    };

    setPackages([newPkg, ...packages]);
    setIsModalOpen(false);
    setNewPkgTitle("");
    setNewPkgSubtitle("");
  };

  // Xóa gói
  const handleDeletePackage = (id) => {
    setPackages(packages.filter((p) => p.id !== id));
  };

  // Xuất CSV danh sách sinh viên
  const handleExportCSV = () => {
    const headers = "Mã Voucher,Họ Tên,SĐT,MSSV,Gói Trải Nghiệm,Điểm Đổi,Thời Gian,Trạng Thái\n";
    const rows = students
      .map((s) => `"${s.code}","${s.name}","${s.phone}","${s.mssv}","${s.pkg}","${s.pts}","${s.date}","${s.status}"`)
      .join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_SinhVien_${brand.id}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden text-[#000000] font-sans antialiased p-3 sm:p-4 gap-3 sm:gap-4 relative"
      style={{
        background: "linear-gradient(145deg, #141A16 0%, #0B0E0C 100%)",
      }}
    >
      {/* =========================================================
          1. FLOATING FROSTED GLASS SIDEBAR (ĐỒNG BỘ 100% VỚI CỔNG 3011)
          Kính mờ nghệ thuật, inner shadow viền trên, glow phản xạ nội bộ
          ========================================================= */}
      <aside
        className={`h-full text-white flex flex-col justify-between rounded-[28px] transition-all duration-300 ease-in-out select-none flex-shrink-0 z-30 border border-white/20 backdrop-blur-2xl relative overflow-hidden ${
          isSidebarOpen ? "w-60" : "w-20"
        }`}
        style={{
          background: "linear-gradient(165deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 35%, rgba(14,19,16,0.92) 100%), #111613",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 1.5px rgba(255,255,255,0.35)",
        }}
      >
        {/* Glow khúc xạ ánh sáng nội bộ bên trong menu */}
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-[#059669]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 -right-12 w-36 h-36 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          {/* Logo Brand & Nút Toggle */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.10]">
            {isSidebarOpen ? (
              <div className="flex items-center gap-2.5 overflow-hidden pl-1">
                <div className="w-8 h-8 rounded-xl bg-[#059669] flex items-center justify-center text-white font-black text-xs shadow-md shadow-[#059669]/40 flex-shrink-0">
                  EP
                </div>
                <div className="truncate">
                  <span className="text-sm font-black tracking-tight text-white">ecopass</span>
                  <span className="ml-1.5 text-[9px] font-black text-[#10B981] bg-[#059669]/25 px-1.5 py-0.5 rounded-full border border-[#059669]/40">
                    PARTNER
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 mx-auto rounded-xl bg-[#059669] flex items-center justify-center text-white font-black text-xs shadow-sm">
                EP
              </div>
            )}

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Thu gọn menu" : "Mở rộng menu"}
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.10] transition"
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </div>

          {/* 4 TAB ĐIỀU HƯỚNG CHUẨN (KHÔNG HỀ CÓ /pos) */}
          <nav className="p-3.5 space-y-2 mt-1">
            {[
              { id: "dashboard", label: "Tổng Quan", path: "/", icon: LayoutDashboard },
              { id: "packages", label: "Gói Trải Nghiệm", path: "/goiudai", icon: Gift, badge: packages.length },
              { id: "checkin", label: "Xác Thực Check-in", path: "/checkin", icon: CheckCircle2 },
              { id: "students", label: "Sinh Viên Nhận Gói", path: "/sinhvien", icon: Users, badge: students.length },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  title={!isSidebarOpen ? item.label : undefined}
                  className={`w-full flex items-center rounded-2xl text-xs font-bold transition-all duration-200 ${
                    isSidebarOpen ? "px-3.5 py-2.5 justify-between" : "p-3 justify-center"
                  } ${
                    isActive
                      ? "bg-[#059669] text-white shadow-lg shadow-[#059669]/30 scale-[1.02]"
                      : "text-white/90 hover:text-white hover:bg-white/[0.10]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">{item.label}</span>}
                  </div>

                  {isSidebarOpen && item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        isActive ? "bg-white text-[#059669]" : "bg-white/[0.18] text-white border border-white/10"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Brand Avatar ở đáy */}
        <div className="p-3.5 border-t border-white/[0.10] relative z-10">
          <div className={`flex items-center gap-2.5 ${isSidebarOpen ? "px-2 py-1" : "justify-center"}`}>
            <div className="w-8 h-8 rounded-full bg-white/[0.12] border border-white/20 flex items-center justify-center text-xs font-black text-[#10B981] flex-shrink-0">
              {brand.avatarText}
            </div>
            {isSidebarOpen && (
              <div className="truncate">
                <div className="text-xs font-black text-white truncate">{brand.name}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* =========================================================
          2. MAIN WORKSPACE CONTAINER (ĐỒNG BỘ BO GÓC 28PX VỚI CỔNG 3011)
          ========================================================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-[28px] border border-neutral-200/80 shadow-sm overflow-hidden">
        {/* Header bar phẳng, thanh thoát */}
        <header className="h-16 px-6 lg:px-8 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 w-full z-20">
          <div className="min-w-0 pr-4">
            <h1 className="text-base sm:text-lg font-black text-black tracking-tight truncate">
              {activeNav === "dashboard" && "Tổng Quan Đối Tác"}
              {activeNav === "packages" && "Quản Lý Gói Trải Nghiệm Free"}
              {activeNav === "checkin" && "Xác Thực & Nhận Mã Sinh Viên"}
              {activeNav === "students" && "Danh Sách Sinh Viên Nhận Gói"}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative w-44 sm:w-60">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm MSSV, tên gói..."
                className="w-full bg-neutral-50 border border-neutral-200/80 rounded-full pl-9 pr-3 py-1.5 text-xs text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
              />
            </div>

            {activeNav === "packages" ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] text-white px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Gói Mới</span>
              </button>
            ) : (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 bg-[#000000] hover:bg-neutral-900 text-white px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xuất CSV</span>
              </button>
            )}
          </div>
        </header>

        {/* Khung nội dung cuộn dọc (Padding đáy rộng rãi, thoáng đãng) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-8 space-y-8 pb-28 sm:pb-36">
          {/* ========================================================
              TAB TỔNG QUAN: 3 SƠ ĐỒ NGHỆ THUẬT CÙNG 1 HÀNG + 2 SƠ ĐỒ DƯỚI
              ======================================================== */}
          {activeNav === "dashboard" && (
            <>
              {/* HÀNG TRÊN: 3 CARD SƠ ĐỒ NẰM NGANG CÙNG 1 HÀNG */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* --------------------------------------------------
                    SƠ ĐỒ 1: NHỊP ĐỘ KÍCH HOẠT (SILKY UNDULATING WAVE)
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        1. Nhịp Độ Kích Hoạt
                      </span>
                      {/* Chú thích: Thực tế & Mục tiêu */}
                      <div className="flex items-center gap-2.5 text-[10px] font-bold flex-shrink-0 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-neutral-800">
                          <span className="w-3 h-[2.5px] rounded-full bg-[#059669]" /> Đến tập/học
                        </span>
                        <span className="flex items-center gap-1 text-neutral-500">
                          <span className="w-3 h-[2px] border-b-2 border-dashed border-[#10B981]" /> Suất đổi
                        </span>
                      </div>
                    </div>

                    <div className="my-2 flex items-baseline justify-between gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">
                          {brand.kpis.checkedIn} Lượt
                        </span>
                        <span className="text-[10px] font-black text-[#059669] flex items-center whitespace-nowrap">
                          <TrendingUp className="w-3 h-3 mr-0.5" /> +18.4%
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">
                        Chạm kéo xem ngày
                      </span>
                    </div>
                  </div>

                  {/* Sơ đồ sóng lượn mềm mại */}
                  <div
                    ref={chartSvgRef}
                    onMouseMove={handleChartInteraction}
                    onClick={handleChartInteraction}
                    className="relative h-36 w-full my-1 cursor-crosshair select-none"
                  >
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 320 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="partnerWaveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
                          <stop offset="65%" stopColor="#059669" stopOpacity="0.04" />
                          <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="partnerTooltipShadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.12" />
                        </filter>
                      </defs>

                      {/* Lưới ngang siêu mảnh */}
                      <line x1="36" y1="28" x2="308" y2="28" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />
                      <line x1="36" y1="52" x2="308" y2="52" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />
                      <line x1="36" y1="76" x2="308" y2="76" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />
                      <line x1="36" y1="100" x2="308" y2="100" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />

                      {/* Nhãn trục Y bên trái */}
                      <text x="28" y="31" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">40L</text>
                      <text x="28" y="55" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">30L</text>
                      <text x="28" y="79" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">20L</text>
                      <text x="28" y="103" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">10L</text>

                      {/* Sóng phụ nét đứt: Suất đăng ký đổi */}
                      <path
                        d="M 45 88 C 65 90, 75 100, 88 100 C 103 100, 116 70, 131 70 C 146 70, 159 80, 174 80 C 189 80, 202 46, 217 46 C 232 46, 245 62, 260 62 C 275 62, 288 78, 302 78"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        opacity="0.45"
                      />

                      {/* Vùng diện tích sóng gradient phát quang */}
                      <path
                        d="M 45 76 C 65 78, 75 90, 88 90 C 103 90, 116 54, 131 54 C 146 54, 159 66, 174 66 C 189 66, 202 32, 217 32 C 232 32, 245 48, 260 48 C 275 48, 288 64, 302 64 L 302 110 L 45 110 Z"
                        fill="url(#partnerWaveGrad)"
                      />

                      {/* Đường sóng chính lượn sóng */}
                      <path
                        d="M 45 76 C 65 78, 75 90, 88 90 C 103 90, 116 54, 131 54 C 146 54, 159 66, 174 66 C 189 66, 202 32, 217 32 C 232 32, 245 48, 260 48 C 275 48, 288 64, 302 64"
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Đường dọi đứng */}
                      <line
                        x1={currentPoint.x}
                        y1={currentPoint.y}
                        x2={currentPoint.x}
                        y2="108"
                        stroke="#059669"
                        strokeWidth="1"
                        strokeDasharray="2 3"
                        opacity="0.6"
                      />

                      {/* Ring phát sáng */}
                      <circle cx={currentPoint.x} cy={currentPoint.y} r="7" fill="#059669" opacity="0.2" />
                      <circle cx={currentPoint.x} cy={currentPoint.y} r="4.5" fill="#FFFFFF" stroke="#059669" strokeWidth="2.5" />

                      {/* Tooltip TRẮNG nổi bật */}
                      <g
                        transform={`translate(${currentPoint.x}, ${Math.max(16, currentPoint.y - 28)})`}
                        filter="url(#partnerTooltipShadow)"
                      >
                        <rect x="-36" y="-18" width="72" height="26" rx="8" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
                        <polygon points="-4,8 4,8 0,12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
                        <text x="0" y="-7" textAnchor="middle" fill="#000000" fontSize="8" fontWeight="800">
                          {currentPoint.day} • {currentPoint.orders} suất
                        </text>
                        <text x="0" y="5" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="900">
                          {currentPoint.label}
                        </text>
                      </g>
                    </svg>
                  </div>

                  {/* Thanh chọn ngày (Pill buttons T2 -> CN) */}
                  <div className="flex items-center justify-between bg-white p-1 rounded-2xl border border-neutral-200/70 text-center">
                    {brand.timeline.map((p, idx) => (
                      <button
                        key={p.day}
                        onClick={() => setActiveDayIdx(idx)}
                        className={`py-1 px-2.5 rounded-xl text-[10px] font-black transition-all ${
                          activeDayIdx === idx
                            ? "bg-[#000000] text-white shadow-sm scale-105"
                            : "text-neutral-400 hover:text-black hover:bg-neutral-100"
                        }`}
                      >
                        {p.day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* --------------------------------------------------
                    SƠ ĐỒ 2: TỶ LỆ KÍCH HOẠT GÓI (180° SEMI-CIRCLE GAUGE)
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        2. Tỷ Lệ Kích Hoạt
                      </span>
                      <span className="text-xs font-black text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {brand.kpis.checkedIn} / {brand.kpis.claimed} Suất
                      </span>
                    </div>

                    <div className="my-2 flex items-baseline justify-between gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">
                          {brand.kpis.rate}
                        </span>
                        <span className="text-[10px] font-bold text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          +6.2%
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-500 whitespace-nowrap">
                        Đến quầy trải nghiệm
                      </span>
                    </div>
                  </div>

                  {/* Đồng hồ bán nguyệt 180° */}
                  <div className="my-2 flex items-center justify-center">
                    <div className="relative w-44 h-28 flex items-end justify-center">
                      <svg className="w-44 h-36 overflow-visible" viewBox="0 0 160 110">
                        <defs>
                          <linearGradient id="gaugePartnerGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#059669" />
                            <stop offset="100%" stopColor="#10B981" />
                          </linearGradient>
                        </defs>

                        {/* Rãnh nền bán nguyệt */}
                        <path
                          d="M 25 85 A 55 55 0 0 1 135 85"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />

                        {/* Phần đỏ đệm (22.9% chưa kích hoạt) */}
                        <path
                          d="M 121 44.5 A 55 55 0 0 1 135 85"
                          fill="none"
                          stroke="#FEE2E2"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />

                        {/* Cung xanh tiến độ (77.1% của 180 độ = 138.8 độ) */}
                        <path
                          d="M 25 85 A 55 55 0 0 1 121 44.5"
                          fill="none"
                          stroke="url(#gaugePartnerGrad)"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />

                        {/* Điểm ngọc phát sáng tại đầu cung */}
                        <circle cx="121" cy="44.5" r="5.5" fill="#FFFFFF" stroke="#059669" strokeWidth="2.5" />
                      </svg>

                      {/* Chỉ số trung tâm */}
                      <div className="absolute bottom-2 text-center">
                        <span className="text-2xl font-black text-black tracking-tight">{brand.kpis.checkedIn}</span>
                        <div className="text-[10px] font-black text-[#059669] uppercase tracking-wider">
                          Đã Đến Check-in
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2 Thẻ chỉ số vệ tinh */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200/60 font-bold text-xs">
                    <div className="bg-white p-2 rounded-xl border border-neutral-200/60 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#059669] flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-neutral-500 text-[10px] block">Đã Sử Dụng</span>
                        <span className="text-black font-black text-xs">{brand.kpis.checkedIn} ({brand.kpis.rate})</span>
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-neutral-200/60 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#DC2626] flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-neutral-500 text-[10px] block">Chờ Đến Lớp</span>
                        <span className="text-black font-black text-xs">{brand.kpis.claimed - brand.kpis.checkedIn} (22.9%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --------------------------------------------------
                    SƠ ĐỒ 3: PHÂN BỔ GÓI TRẢI NGHIỆM ĐƯỢC ĐỔI NHIỀU NHẤT
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        3. Gói Được Ưa Chuộng
                      </span>
                      <span className="text-xs font-black text-[#059669] flex items-center gap-0.5 whitespace-nowrap">
                        <TrendingUp className="w-3.5 h-3.5" /> 100% Suất Free
                      </span>
                    </div>

                    <div className="my-2 flex items-baseline justify-between gap-1">
                      <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">
                        {brand.kpis.claimed} Suất
                      </span>
                      <span className="text-[10px] font-semibold text-neutral-500 whitespace-nowrap">
                        Đổi bằng điểm rác
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400">
                      Tỷ lệ sinh viên lựa chọn các gói trải nghiệm thực tế
                    </p>
                  </div>

                  {/* 4 Thanh Cột Phân Bổ */}
                  <div className="my-2 space-y-2.5">
                    {brand.topPackages.map((d) => (
                      <div key={d.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-neutral-800 truncate max-w-[140px]">{d.name}</span>
                          <span className="text-black font-mono font-black">{d.count} suất ({d.percent}%)</span>
                        </div>
                        <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-neutral-200/60 p-[1px]">
                          <div
                            style={{ width: `${d.percent}%`, backgroundColor: d.color }}
                            className="h-full rounded-full transition-all duration-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-neutral-200/60 text-neutral-500 font-bold">
                    <span>Hạn mức đợt 1: {brand.kpis.totalQuota} Suất</span>
                    <span className="font-black text-[#059669]">
                      Đã phát {Math.round((brand.kpis.claimed / brand.kpis.totalQuota) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* HÀNG DƯỚI: 2 SƠ ĐỒ NGHỆ THUẬT (DATA DIAGRAMS ĐẲNG CẤP) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* --------------------------------------------------
                    SƠ ĐỒ 4: ĐÁNH GIÁ TRẢI NGHIỆM & ĐIỂM ECOPASS TIÊU THỤ
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    {/* Header Card */}
                    <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2.5">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        4. Đánh Giá Trải Nghiệm & Điểm Đổi
                      </span>
                      <button
                        onClick={() => navigateTo("students")}
                        className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1"
                      >
                        <span>Danh Sách ({students.length})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Chỉ số chính */}
                    <div className="my-2.5 flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">
                          96.5%
                        </span>
                        <span className="text-[10px] font-black text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ★ 4.9 / 5.0 • Xuất Sắc
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">
                        {brand.kpis.pointsBurned} Điểm EcoPass đã tiêu
                      </span>
                    </div>

                    {/* Dải phổ cảm xúc ngang */}
                    <div className="space-y-2 mt-1">
                      <div className="w-full h-3 rounded-full bg-neutral-100 flex overflow-hidden p-[1px] border border-neutral-200/80">
                        <div style={{ width: "88%" }} className="bg-[#059669] h-full rounded-l-full" title="88% Rất hài lòng" />
                        <div style={{ width: "9%" }} className="bg-[#18181B] h-full mx-[1px]" title="9% Tốt" />
                        <div style={{ width: "3%" }} className="bg-[#DC2626] h-full rounded-r-full" title="3% Góp ý" />
                      </div>

                      {/* Chú thích */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 px-0.5">
                        <span className="flex items-center gap-1.5 text-black whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#059669] flex-shrink-0" />
                          <span>88% Cực Thích (130)</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-neutral-800 whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#18181B] flex-shrink-0" />
                          <span>9% Hài Lòng (14)</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[#DC2626] whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] flex-shrink-0" />
                          <span>3% Góp Ý (4)</span>
                        </span>
                      </div>
                    </div>

                    {/* 3 Thẻ Tiêu Chuẩn Trải Nghiệm */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mt-3.5 pt-3 border-t border-neutral-200/70">
                      <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/70 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-neutral-500 block truncate">
                          {partnerType === "gym" ? "Cơ Sở & Máy Tập" : "Giáo Trình Học"}
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm sm:text-base font-black text-black">98%</span>
                          <span className="text-[9px] font-black text-[#059669] whitespace-nowrap">Hiện đại</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#059669] h-full rounded-full w-[98%]" />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/70 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-neutral-500 block truncate">
                          {partnerType === "gym" ? "HLV / Hướng Dẫn" : "Giảng Viên 8.0+"}
                        </span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm sm:text-base font-black text-black">95%</span>
                          <span className="text-[9px] font-black text-[#059669] whitespace-nowrap">Nhiệt tình</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#059669] h-full rounded-full w-[95%]" />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/70 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-neutral-500 block truncate">Sẵn Sàng Đăng Ký</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm sm:text-base font-black text-black">86%</span>
                          <span className="text-[9px] font-black text-[#059669] whitespace-nowrap">Chuyển đổi</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#059669] h-full rounded-full w-[86%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --------------------------------------------------
                    SƠ ĐỒ 5: KHUNG GIỜ SINH VIÊN ĐẾN CHECK-IN TRONG NGÀY
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    {/* Header Card */}
                    <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2.5">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        5. Khung Giờ Check-in Tại Cơ Sở
                      </span>
                      <span className="text-xs font-bold text-[#059669] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Giờ Cao Điểm</span>
                      </span>
                    </div>

                    {/* Chỉ số chính */}
                    <div className="my-2.5 flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">
                          {brand.kpis.checkedIn} Lượt
                        </span>
                        <span className="text-[10px] font-black text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Đỉnh: 16:00 - 18:00
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">
                        Sau giờ tan học HUTECH
                      </span>
                    </div>

                    {/* Biểu đồ Histogram theo giờ */}
                    <div className="grid grid-cols-7 gap-2 pt-2 items-end h-28 select-none">
                      {[
                        { time: "08h", height: "35%", val: "12", active: false },
                        { time: "10h", height: "48%", val: "18", active: false },
                        { time: "12h", height: "85%", val: "34", active: true },
                        { time: "14h", height: "40%", val: "15", active: false },
                        { time: "16h", height: "65%", val: "26", active: false },
                        { time: "18h", height: "95%", val: "40", active: true },
                        { time: "20h", height: "30%", val: "11", active: false },
                      ].map((bar) => (
                        <div key={bar.time} className="flex flex-col items-center gap-1 h-full justify-end group cursor-pointer">
                          <span className="text-[9px] font-bold text-neutral-400 group-hover:text-black opacity-0 group-hover:opacity-100 transition-opacity">
                            {bar.val}
                          </span>
                          <div className="w-full bg-neutral-200/50 rounded-xl h-full flex items-end p-0.5">
                            <div
                              style={{ height: bar.height }}
                              className={`w-full rounded-lg transition-all duration-300 ${
                                bar.active
                                  ? "bg-[#059669] shadow-sm shadow-[#059669]/30"
                                  : "bg-[#18181B] group-hover:bg-[#059669]"
                              }`}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-neutral-500">{bar.time}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-3 border-t border-neutral-200/60 text-neutral-500 font-bold mt-2">
                      <span className="text-[11px]">
                        Điểm tập trung đông: <strong className="text-black">Khu E & Thư Viện</strong>
                      </span>
                      <span className="text-[11px] text-[#059669]">TB phục vụ: 3 phút / lượt</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================
              TAB 2: QUẢN LÝ GÓI TRẢI NGHIỆM FREE (/goiudai)
              ======================================================== */}
          {activeNav === "packages" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/80 p-5 rounded-3xl border border-neutral-200/80">
                <div>
                  <h2 className="text-base font-black text-black">
                    Danh Sách Gói Trải Nghiệm Free & Thử Nghiệm
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Sinh viên HUTECH thu gom rác nhựa/lon để tích điểm EcoPass và đổi các gói miễn phí này
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-[#059669] hover:bg-[#047857] text-white text-xs font-black px-4 py-2 rounded-full flex items-center justify-center gap-1.5 shadow-sm transition self-start sm:self-auto"
                >
                  <Plus size={16} /> Thêm Gói Mới
                </button>
              </div>

              {/* Lưới danh sách các gói */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                {packages.map((pkg) => {
                  const percentUsed = Math.round((pkg.quotaUsed / pkg.quotaTotal) * 100);
                  return (
                    <div
                      key={pkg.id}
                      className="bg-neutral-50/80 hover:bg-neutral-50 rounded-3xl border border-neutral-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-mono font-bold text-neutral-400 text-xs">{pkg.id}</span>
                          <span className="bg-[#059669]/10 text-[#059669] px-2.5 py-0.5 rounded-full font-black text-[10px]">
                            {pkg.status}
                          </span>
                        </div>
                        <h3 className="font-black text-base text-black leading-snug mb-1">{pkg.title}</h3>
                        <p className="text-xs text-neutral-500 leading-relaxed">{pkg.subtitle}</p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-neutral-200/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500 font-bold">Điểm EcoPass Cần Đổi:</span>
                          <span className="font-black text-[#059669] bg-[#059669]/10 px-2.5 py-0.5 rounded-full text-xs">
                            {pkg.points} Điểm (0 VNĐ)
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                            <span className="text-neutral-500">Đã đổi:</span>
                            <span className="text-black font-black">
                              {pkg.quotaUsed} / {pkg.quotaTotal} suất ({percentUsed}%)
                            </span>
                          </div>
                          <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-neutral-200/60 p-[1px]">
                            <div
                              className="h-full bg-[#059669] rounded-full transition-all duration-500"
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-neutral-400 text-[11px]">Ngày khởi tạo: {pkg.createdDate}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              className="p-1.5 text-neutral-400 hover:text-[#DC2626] rounded-xl hover:bg-white transition"
                              title="Xóa gói trải nghiệm"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: XÁC THỰC CHECK-IN (/checkin)
              ======================================================== */}
          {activeNav === "checkin" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-neutral-50/80 p-8 rounded-3xl border border-neutral-200/80 shadow-sm text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#059669]/10 text-[#059669] flex items-center justify-center mx-auto shadow-sm">
                  <QrCode size={32} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-black">Xác Thực Mã Kích Hoạt Của Sinh Viên</h2>
                  <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto leading-relaxed">
                    Nhập mã code trên màn hình app điện thoại sinh viên hoặc dùng máy quét để cấp quyền vào phòng tập / lớp học
                  </p>
                </div>

                <form onSubmit={handleCheckin} className="max-w-md mx-auto space-y-3 pt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Mã SV (Ví dụ: SV-84920)"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      className="flex-1 bg-white border border-neutral-300 rounded-full px-4 py-3 text-sm font-black tracking-wider uppercase text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
                    />
                    <button
                      type="submit"
                      className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-3 rounded-full font-black text-xs transition shadow-sm"
                    >
                      Kích Hoạt
                    </button>
                  </div>
                </form>
              </div>

              {/* Thông báo kết quả xác thực */}
              {checkinResult && (
                <div
                  className={`p-5 rounded-3xl border ${
                    checkinResult.success
                      ? "bg-emerald-50 border-[#059669]/30 text-emerald-950"
                      : "bg-red-50 border-[#DC2626]/30 text-red-950"
                  } space-y-2 animate-fade-in`}
                >
                  <div className="flex items-center gap-2 font-black text-sm">
                    {checkinResult.success ? (
                      <CheckCircle2 size={18} className="text-[#059669]" />
                    ) : (
                      <AlertCircle size={18} className="text-[#DC2626]" />
                    )}
                    <span>{checkinResult.success ? "Kích Hoạt Thành Công!" : "Thông Báo Lỗi / Không Hợp Lệ"}</span>
                  </div>
                  <p className="text-xs leading-relaxed">{checkinResult.msg}</p>
                </div>
              )}

              {/* Danh sách 5 lượt kích hoạt gần đây */}
              <div className="bg-neutral-50/80 p-5 rounded-3xl border border-neutral-200/80 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-neutral-200/60 pb-2">
                  <h3 className="font-black text-xs text-black">5 Lượt Check-in Gần Nhất Tại Quầy</h3>
                  <span className="text-[10px] font-bold text-neutral-400">Tự động cập nhật</span>
                </div>
                <div className="divide-y divide-neutral-200/60 text-xs">
                  {students.slice(0, 5).map((s, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-black text-black mr-2">{s.code}</span>
                        <span className="font-bold text-neutral-800">{s.name}</span>
                        <span className="text-[10px] text-neutral-400 ml-1.5">({s.mssv})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[11px] font-semibold">{s.pkg}</span>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            s.status === "Đã Kích Hoạt"
                              ? "bg-emerald-50 text-[#059669] border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 4: DANH SÁCH SINH VIÊN NHẬN GÓI (/sinhvien)
              ======================================================== */}
          {activeNav === "students" && (
            <div className="bg-neutral-50/80 rounded-3xl border border-neutral-200/80 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-neutral-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-base text-black">
                    Danh Sách Sinh Viên Đã Đổi Suất Trải Nghiệm
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Dữ liệu được đồng bộ thời gian thực từ ví sinh viên EcoPass HUTECH
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black bg-white border border-neutral-200 px-3 py-1 rounded-full text-black">
                    Tổng số: {students.length} sinh viên
                  </span>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 bg-[#000000] hover:bg-neutral-900 text-white px-3.5 py-1 rounded-full text-xs font-bold transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất CSV</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white text-neutral-400 font-bold border-b border-neutral-200/60 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">Mã Voucher</th>
                      <th className="py-3.5 px-5">Họ & Tên Sinh Viên</th>
                      <th className="py-3.5 px-5">SĐT</th>
                      <th className="py-3.5 px-5">MSSV</th>
                      <th className="py-3.5 px-5">Gói Trải Nghiệm</th>
                      <th className="py-3.5 px-5 text-center">Điểm Đổi</th>
                      <th className="py-3.5 px-5">Thời Gian</th>
                      <th className="py-3.5 px-5 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 text-neutral-600 font-medium">
                    {students.map((s, idx) => (
                      <tr key={idx} className="hover:bg-white transition-colors">
                        <td className="py-3.5 px-5 font-mono font-black text-black">
                          <button
                            onClick={() => handleCopyCode(s.code)}
                            className="flex items-center gap-1 text-black hover:text-[#059669] transition"
                            title="Sao chép mã"
                          >
                            <span>{s.code}</span>
                            {copiedCode === s.code ? <Check size={12} className="text-[#059669]" /> : <Copy size={12} className="text-neutral-400" />}
                          </button>
                        </td>
                        <td className="py-3.5 px-5 font-black text-black">{s.name}</td>
                        <td className="py-3.5 px-5 font-mono text-neutral-500">{s.phone}</td>
                        <td className="py-3.5 px-5 font-mono">{s.mssv}</td>
                        <td className="py-3.5 px-5 font-bold text-neutral-800">{s.pkg}</td>
                        <td className="py-3.5 px-5 text-center font-black text-[#059669] bg-[#059669]/5 rounded-xl">
                          {s.pts} pts
                        </td>
                        <td className="py-3.5 px-5 text-neutral-400 text-[11px]">{s.date}</td>
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-black border ${
                              s.status === "Đã Kích Hoạt"
                                ? "bg-emerald-50 text-[#059669] border-emerald-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          MODAL THÊM GÓI TRẢI NGHIỆM MỚI (CHUẨN KÍNH MỜ BENTOPORTAL)
          ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 sm:p-7 shadow-2xl border border-neutral-100 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-black text-black">Thêm Gói Học / Tập Thử Mới</h3>
                <p className="text-xs text-neutral-400">Tạo ưu đãi miễn phí đổi bằng điểm EcoPass</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-black transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPackage} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-black block mb-1">Tên Gói Trải Nghiệm</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Pass 14 Ngày Tập Thử Miễn Phí"
                  value={newPkgTitle}
                  onChange={(e) => setNewPkgTitle(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="font-bold text-black block mb-1">Mô Tả Ngắn Quyền Lợi</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Miễn phí tủ đồ cá nhân và phòng tắm nóng lạnh"
                  value={newPkgSubtitle}
                  onChange={(e) => setNewPkgSubtitle(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-black block mb-1">Số Điểm Cần Đổi</label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={newPkgPoints}
                    onChange={(e) => setNewPkgPoints(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
                  />
                </div>
                <div>
                  <label className="font-bold text-black block mb-1">Số Suất Hạn Mức</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={newPkgQuota}
                    onChange={(e) => setNewPkgQuota(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-full text-neutral-600 font-bold hover:bg-neutral-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-2.5 rounded-full font-black shadow-sm transition"
                >
                  Lưu & Kích Hoạt Gói
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
