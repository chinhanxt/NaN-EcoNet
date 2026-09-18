import React, { useState, useRef, useEffect } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import {
  LayoutDashboard,
  Users,
  Tag,
  TicketPercent,
  Receipt,
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
  CheckCircle2,
  QrCode,
  MoreVertical,
  Plus,
  Trash2,
  Edit2,
  HelpCircle,
  Clock,
  ThumbsUp,
  AlertCircle,
  X,
  Eye,
  RefreshCw
} from "lucide-react";

// ==========================================
// 4 MÀU CHUẨN: ĐEN (#000000) - TRẮNG (#FFFFFF) - XANH (#059669) - ĐỎ (#DC2626)
// ==========================================

// ĐIỀU HƯỚNG URL LINK THEO TAB
const ROUTES = {
  "/": "dashboard",
  "/tongquan": "dashboard",
  "/khaosat": "surveys",
  "/temlynuoc": "stickers",
  "/voucher": "vouchers",
  "/cauhoikhaosat": "questions",
  "/cauhoi": "questions",
};

const TAB_TO_PATH = {
  dashboard: "/",
  surveys: "/khaosat",
  stickers: "/temlynuoc",
  vouchers: "/voucher",
  questions: "/cauhoikhaosat",
};

const REVENUE_TIMELINE = [
  { day: "T2", revenue: 18.2, cost: 2.1, orders: 120, label: "18.2 Tr", x: 45, y: 78 },
  { day: "T3", revenue: 14.5, cost: 2.8, orders: 105, label: "14.5 Tr", x: 88, y: 92 },
  { day: "T4", revenue: 24.0, cost: 2.4, orders: 178, label: "24.0 Tr", x: 131, y: 58 },
  { day: "T5", revenue: 21.5, cost: 3.2, orders: 162, label: "21.5 Tr", x: 174, y: 70 },
  { day: "T6", revenue: 31.5, cost: 4.1, orders: 268, label: "31.5 Tr", x: 217, y: 36 },
  { day: "T7", revenue: 26.8, cost: 3.5, orders: 224, label: "26.8 Tr", x: 260, y: 52 },
  { day: "CN", revenue: 22.0, cost: 2.6, orders: 180, label: "22.0 Tr", x: 302, y: 68 },
];

const DISH_STATS = [
  { name: "Phindi Hạnh Nhân", count: 58, percent: 85, color: "#059669" },
  { name: "Bánh Mì Que Pâté", count: 112, percent: 92, color: "#059669" },
  { name: "Trà Sen Vàng", count: 84, percent: 76, color: "#059669" },
  { name: "Freeze Matcha", count: 42, percent: 64, color: "#DC2626" },
];

const INITIAL_STICKERS = [
  { id: "STK-1", code: "#HL-8921", barcode: "1089215437", drink: "Phindi Hạnh Nhân", time: "10:30", pos: "POS 1", status: "done" },
  { id: "STK-2", code: "#HL-8922", barcode: "2789229104", drink: "Trà Sen Vàng", time: "10:35", pos: "POS 1", status: "pending" },
  { id: "STK-3", code: "#HL-8923", barcode: "3989231846", drink: "Phindi Hạnh Nhân", time: "10:41", pos: "POS 2", status: "pending" },
  { id: "STK-4", code: "#HL-8924", barcode: "4889247215", drink: "Freeze Matcha", time: "09:40", pos: "POS 2", status: "done" },
  { id: "STK-5", code: "#HL-8925", barcode: "5289256390", drink: "Bánh Mì Que", time: "08:50", pos: "POS 1", status: "done" },
  { id: "STK-6", code: "#HL-8919", barcode: "6389198041", drink: "Trà Sen Vàng", time: "08:15", pos: "POS 1", status: "done" },
  { id: "STK-7", code: "#HL-8918", barcode: "7589184319", drink: "Freeze Matcha", time: "07:50", pos: "POS 2", status: "done" },
];

const INITIAL_SURVEYS = [
  {
    id: "S-101",
    fullName: "Nguyễn Văn Hoàng Nam",
    phone: "0918.234.892",
    drink: "Phindi Hạnh Nhân",
    stickerCode: "#HL-8921",
    barcode: "1089215437",
    answer: "Béo thơm hạnh nhân, ngọt vừa vặn",
    rating: "good",
    time: "10:42",
  },
  {
    id: "S-102",
    fullName: "Lê Thị Thảo My",
    phone: "0983.112.450",
    drink: "Trà Sen Vàng",
    stickerCode: "#HL-8919",
    barcode: "6389198041",
    answer: "Sen giòn ngọt thanh, nên thêm đá",
    rating: "medium",
    time: "10:15",
  },
  {
    id: "S-103",
    fullName: "Phạm Quốc Bảo",
    phone: "0905.889.312",
    drink: "Freeze Matcha",
    stickerCode: "#HL-8918",
    barcode: "7589184319",
    answer: "Hơi ngọt so với khẩu vị",
    rating: "bad",
    time: "09:50",
  },
  {
    id: "S-104",
    fullName: "Trần Minh Quân",
    phone: "0972.441.908",
    drink: "Phindi Hạnh Nhân",
    stickerCode: "#HL-8924",
    barcode: "4889247215",
    answer: "Ngon bất ngờ nhờ voucher 10k",
    rating: "good",
    time: "09:30",
  },
  {
    id: "S-105",
    fullName: "Đỗ Thị Quỳnh Anh",
    phone: "0934.776.221",
    drink: "Bánh Mì Que",
    stickerCode: "#HL-8925",
    barcode: "5289256390",
    answer: "Vỏ giòn rụm, pātê thơm ngậy",
    rating: "good",
    time: "08:55",
  },
];

const INITIAL_VOUCHERS = [
  {
    id: "V-1",
    code: "EP-HL-PHINDI",
    dish: "Phindi Hạnh Nhân",
    discount: "Giảm 15.000đ",
    condition: "Đơn ≥ 45.000đ",
    rescued: 58,
    active: true,
    note: "Kích hoạt bẫy mua món best-seller",
  },
  {
    id: "V-2",
    code: "EP-HL-BANHMI",
    dish: "Bánh Mì Que Pâté",
    discount: "Giảm 5.000đ",
    condition: "Kèm Cà phê đá",
    rescued: 112,
    active: true,
    note: "Giải phóng tồn kho bánh mì que",
  },
  {
    id: "V-3",
    code: "EP-HL-TRASEN",
    dish: "Trà Sen Vàng",
    discount: "Giảm 10.000đ",
    condition: "Đơn ≥ 50.000đ",
    rescued: 84,
    active: true,
    note: "Món ưa chuộng giờ nghỉ trưa",
  },
  {
    id: "V-4",
    code: "EP-HL-MATCHA",
    dish: "Freeze Matcha",
    discount: "Giảm 10.000đ",
    condition: "Đơn ≥ 60.000đ",
    rescued: 42,
    active: true,
    note: "Bẫy mua dòng Freeze cao cấp",
  },
];

const INITIAL_QUESTIONS = [
  {
    id: "Q-1",
    title: "1. Vị ngọt và độ béo cốt trà / cà phê hôm nay thế nào?",
    type: "Thang 3 mức",
    dishTarget: "Tất cả đồ uống",
    options: ["Chuẩn vị (92%)", "Hơi ngọt (5%)", "Nhạt (3%)"],
    satisfaction: 92,
    responsesCount: 1143,
    active: true,
  },
  {
    id: "Q-2",
    title: "2. Lượng đá và độ lạnh của ly nước đã vừa vặn chưa?",
    type: "Thang 3 mức",
    dishTarget: "Đồ uống có đá",
    options: ["Vừa đủ (88%)", "Quá nhiều đá (9%)", "Ít lạnh (3%)"],
    satisfaction: 88,
    responsesCount: 980,
    active: true,
  },
  {
    id: "Q-3",
    title: "3. Độ nóng giòn của Bánh Mì Que Pâté khi phục vụ?",
    type: "Đánh giá cảm xúc",
    dishTarget: "Bánh Mì Que Pâté",
    options: ["Nóng giòn thơm (96%)", "Giòn vừa (3%)", "Bị nguội (1%)"],
    satisfaction: 96,
    responsesCount: 450,
    active: true,
  },
  {
    id: "Q-4",
    title: "4. Bạn có sẵn sàng giới thiệu món này cho bạn bè không?",
    type: "NPS (1 - 10)",
    dishTarget: "Toàn bộ thực đơn",
    options: ["9 - 10 điểm (94.2%)", "7 - 8 điểm (4.5%)", "Dưới 6 điểm (1.3%)"],
    satisfaction: 94,
    responsesCount: 890,
    active: true,
  },
];

// COMPONENT MÃ VẠCH (BARCODE) CHUẨN QUỐC TẾ CODE-128 QUÉT CỰC NHẠY
function BarcodeSvg({ barcode = "1089215437", height = 55 }) {
  const svgRef = useRef(null);
  const cleanDigits = String(barcode).replace(/\D/g, "").slice(0, 12) || "1089215437";

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, cleanDigits, {
          format: "CODE128",
          width: 2.1,
          height: height,
          displayValue: false,
          margin: 16,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (e) {
        console.error("JsBarcode error:", e);
      }
    }
  }, [cleanDigits, height]);

  return (
    <div className="flex flex-col items-center justify-center bg-white px-3 py-1.5 rounded-2xl border border-neutral-300 shadow-2xs flex-shrink-0">
      <svg ref={svgRef} className="block select-none max-w-full" />
    </div>
  );
}

// COMPONENT THẺ MÃ VẠCH TEM LY NẰM NGANG CHUẨN CODE-128
function HorizontalStickerBadge({ code, barcode, status, onClick }) {
  const isDone = status === "done" || status === "used";
  const effectiveBarcode = barcode || (code ? `89${code.replace(/\D/g, "")}5437` : "1089215437");
  const svgRef = useRef(null);
  const cleanDigits = String(effectiveBarcode).replace(/\D/g, "").slice(0, 12) || "1089215437";

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, cleanDigits, {
          format: "CODE128",
          width: 1.15,
          height: 22,
          displayValue: true,
          font: "monospace",
          fontSize: 9,
          textMargin: 1,
          margin: 3,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (e) {
        console.error("JsBarcode error:", e);
      }
    }
  }, [cleanDigits]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/barcode inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border transition-all select-none text-left bg-white shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap ${
        isDone
          ? "border-emerald-200/90 hover:border-[#059669]"
          : "border-amber-200/90 hover:border-amber-400"
      }`}
      title={`Bấm xem mã tem để camera điện thoại quét: ${code} (${cleanDigits})`}
    >
      <div className="flex flex-col items-center justify-center bg-white px-1.5 py-0.5 rounded-lg border border-neutral-200/90 shadow-2xs flex-shrink-0">
        <svg ref={svgRef} className="block select-none" />
      </div>

      {/* Thông tin tem & trạng thái */}
      <div className="flex flex-col justify-center pr-1 min-w-[75px]">
        <div className="flex items-center gap-1">
          <span className="font-mono font-black text-xs text-black tracking-tight">
            {code}
          </span>
        </div>
        <span
          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border mt-0.5 inline-flex items-center gap-1 whitespace-nowrap ${
            isDone
              ? "bg-emerald-50 text-[#059669] border-emerald-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isDone ? "bg-[#059669]" : "bg-amber-500 animate-pulse"
            }`}
          />
          <span>{isDone ? "Đã Bỏ Thùng" : "Chờ Bỏ Vào Thùng"}</span>
        </span>
      </div>
    </button>
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
  const [copiedPhone, setCopiedPhone] = useState(null);
  const [surveys, setSurveys] = useState(INITIAL_SURVEYS);
  const [stickers, setStickers] = useState(INITIAL_STICKERS);
  const [vouchers, setVouchers] = useState(INITIAL_VOUCHERS);
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS);
  const [selectedStickerPreview, setSelectedStickerPreview] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Đồng bộ thời gian thực danh sách tem từ CSDL trung tâm (:3011)
  const fetchStickersFromDb = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("http://localhost:3011/api/ecopass/stickers");
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const hlList = json.data.filter((s) => !s.storeId || s.storeId === "highlands");
          const mapped = hlList.map((item) => ({
            id: item.id || `stk-${item.barcode}`,
            code: item.code || `#HL-${item.barcode.slice(-4)}`,
            barcode: item.barcode,
            drink: item.drinkName || item.drink || "Phindi Hạnh Nhân",
            time: item.usedAt ? item.usedAt.substring(11, 16) : (item.syncedAt ? item.syncedAt.substring(11, 16) : "10:30"),
            pos: item.posTerminal || item.pos || "POS 1",
            price: item.price || 45000,
            status: item.status === "used" ? "done" : "pending",
            usedAt: item.usedAt,
            storeName: item.storeName || "Highlands Coffee",
          }));
          setStickers(mapped);
        }
      }
    } catch (e) {
      // Local fallback
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchStickersFromDb();
    const timer = setInterval(fetchStickersFromDb, 4000);
    return () => clearInterval(timer);
  }, []);

  // Xóa mã tem khỏi CSDL
  const handleDeleteSticker = async (barcode) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mã tem ${barcode} khỏi CSDL không?`)) return;
    try {
      const res = await fetch("http://localhost:3011/api/ecopass/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", barcode }),
      });
      const data = await res.json();
      if (data.success) {
        setStickers((prev) => prev.filter((s) => s.barcode !== barcode));
        setToastMsg(`✓ Đã xóa mã tem ${barcode} khỏi CSDL!`);
        setTimeout(() => setToastMsg(null), 2500);
      } else {
        alert(data.message || "Không thể xóa tem!");
      }
    } catch (e) {
      setStickers((prev) => prev.filter((s) => s.barcode !== barcode));
      setToastMsg(`✓ Đã xóa mã tem ${barcode}!`);
      setTimeout(() => setToastMsg(null), 2500);
    }
  };

  // Đặt lại (Reset) mã tem đã quét về trạng thái sẵn sàng để quét lại
  const handleResetSticker = async (barcode) => {
    try {
      const res = await fetch("http://localhost:3011/api/ecopass/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", barcode }),
      });
      const data = await res.json();
      if (data.success) {
        setStickers((prev) =>
          prev.map((s) => (s.barcode === barcode ? { ...s, status: "pending", usedAt: null } : s))
        );
        setToastMsg(`✓ Đã khôi phục mã ${barcode} về trạng thái sẵn sàng quét!`);
        setTimeout(() => setToastMsg(null), 2500);
      } else {
        alert(data.message || "Không thể khôi phục tem!");
      }
    } catch (e) {
      setStickers((prev) =>
        prev.map((s) => (s.barcode === barcode ? { ...s, status: "pending", usedAt: null } : s))
      );
      setToastMsg(`✓ Đã khôi phục mã ${barcode}!`);
      setTimeout(() => setToastMsg(null), 2500);
    }
  };

  // In tem mới và lưu trực tiếp vào CSDL
  const handleCreateSticker = async () => {
    const newSerial = Math.floor(8926 + Math.random() * 50);
    const newCode = `#HL-${newSerial}`;
    const prefix = Math.floor(10 + Math.random() * 89);
    const suffix = Math.floor(1000 + Math.random() * 8999);
    const newBarcode = `${prefix}${newSerial}${suffix}`;
    const payload = {
      barcode: newBarcode,
      code: newCode,
      storeId: "highlands",
      storeName: "Highlands Coffee",
      drinkName: "Phindi Hạnh Nhân",
      price: 45000,
      posTerminal: "POS 1",
      status: "active",
    };
    try {
      const res = await fetch("http://localhost:3011/api/ecopass/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setStickers((prev) => [
          {
            id: data.data.id || `STK-${Date.now()}`,
            code: newCode,
            barcode: newBarcode,
            drink: "Phindi Hạnh Nhân",
            time: "Vừa xong",
            pos: "POS 1",
            price: 45000,
            status: "pending",
          },
          ...prev,
        ]);
        setToastMsg(`✓ Đã in tem mới ${newBarcode} lưu vào CSDL!`);
        setTimeout(() => setToastMsg(null), 2500);
      }
    } catch (e) {
      setStickers((prev) => [
        {
          id: `STK-${Date.now()}`,
          code: newCode,
          barcode: newBarcode,
          drink: "Phindi Hạnh Nhân",
          time: "Vừa xong",
          pos: "POS 1",
          price: 45000,
          status: "pending",
        },
        ...prev,
      ]);
      setToastMsg(`✓ Đã in tem mới ${newBarcode}!`);
      setTimeout(() => setToastMsg(null), 2500);
    }
  };

  // Quản lý Modal & Menu 3 chấm cho Voucher
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  const [activeVoucherMenuId, setActiveVoucherMenuId] = useState(null);
  const [voucherForm, setVoucherForm] = useState({
    code: "",
    dish: "",
    discount: "Giảm 10.000đ",
    condition: "Đơn ≥ 45.000đ",
    note: "",
  });

  // Quản lý Modal & Menu 3 chấm cho Câu hỏi khảo sát
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [activeQuestionMenuId, setActiveQuestionMenuId] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    title: "",
    dishTarget: "Tất cả đồ uống",
    type: "Thang 3 mức",
  });

  // Lắng nghe phím Back/Forward của trình duyệt để cập nhật tab tương ứng
  useEffect(() => {
    const handlePopState = () => {
      setActiveNav(getInitialNav());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Hàm chuyển tab và cập nhật trực tiếp link URL (/khaosat, /temlynuoc, /voucher, /cauhoikhaosat)
  const navigateTo = (navId) => {
    setActiveNav(navId);
    const targetPath = TAB_TO_PATH[navId] || "/";
    if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
      window.history.pushState({ navId }, "", targetPath);
    }
  };

  const chartSvgRef = useRef(null);

  // Kéo chuột mượt mà trên sơ đồ doanh thu
  const handleChartInteraction = (e) => {
    if (!chartSvgRef.current) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(ratio * (REVENUE_TIMELINE.length - 1));
    setActiveDayIdx(idx);
  };

  const currentPoint = REVENUE_TIMELINE[activeDayIdx];

  const handleCopyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 1500);
  };

  const handleExportCSV = () => {
    const headers = "Họ Tên,SĐT,Món,Khảo Sát,Đánh Giá,Giờ,Mã Tem,Trạng Thái\n";
    const rows = surveys
      .map((s) => {
        const stk = stickers.find((item) => item.code === s.stickerCode);
        const statusText = stk && stk.status === "done" ? "Đã Bỏ Thùng" : "Chờ Bỏ Vào Thùng";
        return `"${s.fullName}","${s.phone}","${s.drink}","${s.answer}","${s.rating}","${s.time}","${s.stickerCode}","${statusText}"`;
      })
      .join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_KhachHang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden text-[#000000] font-sans antialiased p-3 sm:p-4 gap-3 sm:gap-4 relative"
      style={{
        background: "linear-gradient(145deg, #141A16 0%, #0B0E0C 100%)",
      }}
    >
      {/* Thông báo Toast đồng bộ CSDL */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-neutral-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 animate-fade-in flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}
      {/* =========================================================
          1. FLOATING FROSTED GLASS SIDEBAR (KÍNH MỜ NGHỆ THUẬT, KHÔNG CẦN ẢNH CÂY PHÍA SAU)
          ========================================================= */}
      <aside
        className={`h-full text-white flex flex-col justify-between rounded-[28px] transition-all duration-300 ease-in-out select-none flex-shrink-0 z-30 border border-white/20 backdrop-blur-2xl relative overflow-hidden ${
          isSidebarOpen ? "w-60" : "w-20"
        }`}
        style={{
          background: "linear-gradient(165deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 35%, rgba(14,19,16,0.92) 100%), #111613",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 1.5px rgba(255,255,255,0.35)"
        }}
      >
        {/* Glow khúc xạ ánh sáng nội bộ bên trong menu (được kẹp kín bởi overflow-hidden, không lem) */}
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
                    STORE
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

          {/* Nav Items: 5 TAB ĐẦY ĐỦ ĐỒNG BỘ LINK URL */}
          <nav className="p-3.5 space-y-2.5 mt-2">
            {[
              { id: "dashboard", label: "Tổng Quan", path: "/", icon: LayoutDashboard },
              { id: "surveys", label: "Khảo Sát (SĐT)", path: "/khaosat", icon: Users, badge: surveys.length },
              { id: "stickers", label: "Tem Ly Nước", path: "/temlynuoc", icon: Tag, badge: stickers.length },
              { id: "vouchers", label: "Voucher Bẫy", path: "/voucher", icon: TicketPercent, badge: vouchers.length },
              { id: "questions", label: "Câu Hỏi Khảo Sát", path: "/cauhoikhaosat", icon: HelpCircle, badge: questions.length },
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
              HL
            </div>
            {isSidebarOpen && (
              <div className="truncate">
                <div className="text-xs font-black text-white truncate">Highlands Campus</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* =========================================================
          2. MAIN WORKSPACE CONTAINER (BO GÓC NGHỆ THUẬT, MƯỢT MÀ)
          ========================================================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-[28px] border border-neutral-200/80 shadow-sm overflow-hidden">
        {/* Header bar phẳng, tinh giản */}
        <header className="h-16 px-6 lg:px-8 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 w-full z-20">
          <div className="min-w-0 pr-4">
            <h1 className="text-base sm:text-lg font-black text-black tracking-tight truncate">
              {activeNav === "dashboard" && "Tổng Quan Cửa Hàng"}
              {activeNav === "surveys" && "Kho Data Khảo Sát & SĐT"}
              {activeNav === "stickers" && "Quản Lý Tem Ly Nước"}
              {activeNav === "vouchers" && "Danh Sách Voucher Bẫy Mua"}
              {activeNav === "questions" && "Bộ Câu Hỏi Khảo Sát Khẩu Vị"}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative w-44 sm:w-60">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm SĐT, tên..."
                className="w-full bg-neutral-50 border border-neutral-200/80 rounded-full pl-9 pr-3 py-1.5 text-xs text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
              />
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-[#000000] hover:bg-neutral-900 text-white px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>
          </div>
        </header>

        {/* Khung nội dung cuộn dọc (Thoáng đãng, thưa ra, padding đáy lớn tránh bị cắt trang) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-8 space-y-8 pb-28 sm:pb-36">
          {/* ========================================================
              TAB TỔNG QUAN: 3 SƠ ĐỒ NGHỆ THUẬT CÙNG 1 HÀNG NGANG
              ======================================================== */}
          {activeNav === "dashboard" && (
            <>
              {/* 3 CARD SƠ ĐỒ NẰM NGANG CÙNG 1 HÀNG (RESPONSIVE, THƯA THOÁNG) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* --------------------------------------------------
                    SƠ ĐỒ 1: DOANH THU NGHỆ THUẬT (SILKY UNDULATING WAVE NHƯ MẪU)
                    Lượn sóng mềm mại, 2 đường biên nhịp nhàng, tooltip trắng chữ xanh & đen
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        1. Doanh Thu
                      </span>
                      {/* Chú thích chuẩn ký hiệu: Nét liền (Thực tế) & Nét đứt (Tuần trước) */}
                      <div className="flex items-center gap-2.5 text-[10px] font-bold flex-shrink-0 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-neutral-800">
                          <span className="w-3 h-[2.5px] rounded-full bg-[#059669]" /> Thực tế
                        </span>
                        <span className="flex items-center gap-1 text-neutral-500">
                          <span className="w-3 h-[2px] border-b-2 border-dashed border-[#10B981]" /> Tuần trước
                        </span>
                      </div>
                    </div>

                    <div className="my-2 flex items-baseline justify-between gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">128.4 Tr</span>
                        <span className="text-[10px] font-black text-[#059669] flex items-center whitespace-nowrap">
                          <TrendingUp className="w-3 h-3 mr-0.5" /> +7.5%
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">
                        Chạm kéo xem ngày
                      </span>
                    </div>
                  </div>

                  {/* Sơ đồ sóng lượn mềm mại (Silky Undulating Wave) */}
                  <div
                    ref={chartSvgRef}
                    onMouseMove={handleChartInteraction}
                    onClick={handleChartInteraction}
                    className="relative h-36 w-full my-1 cursor-crosshair select-none"
                  >
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 320 120" preserveAspectRatio="none">
                      <defs>
                        {/* Gradient đổ bóng mềm mại cho sóng chính */}
                        <linearGradient id="silkyWaveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#059669" stopOpacity="0.20" />
                          <stop offset="65%" stopColor="#059669" stopOpacity="0.04" />
                          <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                        </linearGradient>
                        {/* Bộ lọc bóng mờ cho tooltip TRẮNG */}
                        <filter id="whiteTooltipShadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.12" />
                        </filter>
                      </defs>

                      {/* Lưới ngang tham chiếu siêu mảnh (Bắt đầu từ x=36, không chạm text) */}
                      <line x1="36" y1="28" x2="308" y2="28" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />
                      <line x1="36" y1="52" x2="308" y2="52" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />
                      <line x1="36" y1="76" x2="308" y2="76" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />
                      <line x1="36" y1="100" x2="308" y2="100" stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />

                      {/* Nhãn trục Y bên trái (x=28, cách xa sóng 17px, tuyệt đối không bị đè) */}
                      <text x="28" y="31" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">40Tr</text>
                      <text x="28" y="55" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">30Tr</text>
                      <text x="28" y="79" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">20Tr</text>
                      <text x="28" y="103" textAnchor="end" fill="#9CA3AF" fontSize="8" fontWeight="600">10Tr</text>

                      {/* Sóng phụ 2: Tuần trước (Nét đứt mềm mại chạy song hành) */}
                      <path
                        d="M 45 90 C 65 92, 75 102, 88 102 C 103 102, 116 72, 131 72 C 146 72, 159 82, 174 82 C 189 82, 202 50, 217 50 C 232 50, 245 66, 260 66 C 275 66, 288 80, 302 80"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        opacity="0.45"
                      />

                      {/* Vùng diện tích sóng gradient phát quang */}
                      <path
                        d="M 45 78 C 65 80, 75 92, 88 92 C 103 92, 116 58, 131 58 C 146 58, 159 70, 174 70 C 189 70, 202 36, 217 36 C 232 36, 245 52, 260 52 C 275 52, 288 68, 302 68 L 302 110 L 45 110 Z"
                        fill="url(#silkyWaveGrad)"
                      />

                      {/* Đường Sóng Doanh Thu Chính (Lượn sóng mềm mại, liên tục) */}
                      <path
                        d="M 45 78 C 65 80, 75 92, 88 92 C 103 92, 116 58, 131 58 C 146 58, 159 70, 174 70 C 189 70, 202 36, 217 36 C 232 36, 245 52, 260 52 C 275 52, 288 68, 302 68"
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Đường dọi đứng từ điểm chọn xuống đáy */}
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

                      {/* Nút điểm chọn trên sóng (Hollow Ring phát sáng) */}
                      <circle
                        cx={currentPoint.x}
                        cy={currentPoint.y}
                        r="7"
                        fill="#059669"
                        opacity="0.2"
                      />
                      <circle
                        cx={currentPoint.x}
                        cy={currentPoint.y}
                        r="4.5"
                        fill="#FFFFFF"
                        stroke="#059669"
                        strokeWidth="2.5"
                      />

                      {/* Tooltip TRẮNG nổi bật (Ô màu trắng, chữ xanh và đen theo yêu cầu) */}
                      <g
                        transform={`translate(${currentPoint.x}, ${Math.max(16, currentPoint.y - 28)})`}
                        filter="url(#whiteTooltipShadow)"
                      >
                        {/* Hộp nền trắng viền mảnh xám */}
                        <rect
                          x="-36"
                          y="-18"
                          width="72"
                          height="26"
                          rx="8"
                          fill="#FFFFFF"
                          stroke="#E5E7EB"
                          strokeWidth="1"
                        />
                        {/* Mũi tên nhọn hướng xuống điểm sóng */}
                        <polygon
                          points="-4,8 4,8 0,12"
                          fill="#FFFFFF"
                          stroke="#E5E7EB"
                          strokeWidth="1"
                        />
                        {/* Chữ đen: Ngày và số đơn */}
                        <text x="0" y="-7" textAnchor="middle" fill="#000000" fontSize="8" fontWeight="800">
                          {currentPoint.day} • {currentPoint.orders} đơn
                        </text>
                        {/* Chữ xanh: Doanh thu tiền tươi */}
                        <text x="0" y="5" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="900">
                          {currentPoint.label}
                        </text>
                      </g>
                    </svg>
                  </div>

                  {/* Thanh chọn ngày (Pill buttons T2 -> CN như ảnh mẫu) */}
                  <div className="flex items-center justify-between bg-white p-1 rounded-2xl border border-neutral-200/70 text-center">
                    {REVENUE_TIMELINE.map((p, idx) => (
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
                    SƠ ĐỒ 2: TỶ LỆ ĐỔI VOUCHER (180° SEMI-CIRCLE GAUGE CHUẨN MẪU)
                    Đồng hồ bán nguyệt 180° êm ái, thanh thoát như mẫu Product Return / Turnover Rate
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        2. Tỷ Lệ Voucher
                      </span>
                      <span className="text-xs font-black text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                        142 Mã / Ngày
                      </span>
                    </div>

                    <div className="my-2 flex items-baseline justify-between gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">84.2%</span>
                        <span className="text-[10px] font-bold text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          +5.4%
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-500 whitespace-nowrap">Khách đem đổi</span>
                    </div>
                  </div>

                  {/* Đồng hồ bán nguyệt 180° chuẩn mẫu */}
                  <div className="my-2 flex items-center justify-center">
                    <div className="relative w-44 h-28 flex items-end justify-center">
                      <svg className="w-44 h-36 overflow-visible" viewBox="0 0 160 110">
                        <defs>
                          <linearGradient id="gaugeGreenGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#059669" />
                            <stop offset="100%" stopColor="#10B981" />
                          </linearGradient>
                        </defs>

                        {/* Rãnh nền bán nguyệt (180 độ từ x=25..135, R=55, cy=85) */}
                        <path
                          d="M 25 85 A 55 55 0 0 1 135 85"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />

                        {/* Phần đỏ đệm (15.8% còn lại chưa đổi) */}
                        <path
                          d="M 125.6 50.8 A 55 55 0 0 1 135 85"
                          fill="none"
                          stroke="#FEE2E2"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />

                        {/* Cung Xanh Tiến Độ (84.2% của 180 độ = 151.6 độ) */}
                        <path
                          d="M 25 85 A 55 55 0 0 1 125.6 50.8"
                          fill="none"
                          stroke="url(#gaugeGreenGrad)"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />

                        {/* Điểm ngọc phát sáng tại đầu cung tiến độ */}
                        <circle
                          cx="125.6"
                          cy="50.8"
                          r="5.5"
                          fill="#FFFFFF"
                          stroke="#059669"
                          strokeWidth="2.5"
                        />
                      </svg>

                      {/* Chỉ số trung tâm nằm dưới vòm bán nguyệt */}
                      <div className="absolute bottom-2 text-center">
                        <span className="text-2xl font-black text-black tracking-tight">1,280</span>
                        <div className="text-[10px] font-black text-[#059669] uppercase tracking-wider">
                          Mã Đã Duyệt
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2 Thẻ chỉ số vệ tinh tinh gọn */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200/60 font-bold text-xs">
                    <div className="bg-white p-2 rounded-xl border border-neutral-200/60 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#059669] flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-neutral-500 text-[10px] block">Đã Đổi</span>
                        <span className="text-black font-black text-xs">1,280 (84%)</span>
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-neutral-200/60 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#DC2626] flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-neutral-500 text-[10px] block">Chờ Quét</span>
                        <span className="text-black font-black text-xs">240 (16%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --------------------------------------------------
                    SƠ ĐỒ 3: GIẢI CỨU MÓN CHẬM (BIỂU ĐỒ THANH PHÂN BỔ MÓN)
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        3. Giải Cứu Món
                      </span>
                      <span className="text-xs font-black text-[#059669] flex items-center gap-0.5 whitespace-nowrap">
                        <TrendingDown className="w-3.5 h-3.5" /> -85% Tồn
                      </span>
                    </div>

                    <div className="my-2 flex items-baseline justify-between gap-1">
                      <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">314 Ly</span>
                      <span className="text-[10px] font-semibold text-neutral-500 whitespace-nowrap">Đã bán kèm bill</span>
                    </div>

                    <p className="text-[11px] text-neutral-400">
                      Tỷ lệ giải phóng tồn kho nguyên liệu theo từng món
                    </p>
                  </div>

                  {/* 4 Thanh Cột Phân Bổ Món Nghệ Thuật */}
                  <div className="my-2 space-y-2.5">
                    {DISH_STATS.map((d) => (
                      <div key={d.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-neutral-800 truncate max-w-[140px]">{d.name}</span>
                          <span className="text-black font-mono font-black">{d.count} ly ({d.percent}%)</span>
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
                    <span>Mục tiêu tuần: 350 Ly</span>
                    <span className="font-black text-[#059669]">Đạt 90%</span>
                  </div>
                </div>
              </div>

              {/* ========================================================
                  KHỐI DƯỚI: 2 SƠ ĐỒ NGHỆ THUẬT (DATA DIAGRAMS ĐẲNG CẤP)
                  Card 4: Phổ Cảm Xúc & Tiêu Chuẩn Khẩu Vị (Không rớt hàng)
                  Card 5: Nhịp Quét Tem Ly Theo Giờ Trong Ngày (Histogram)
                  ======================================================== */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* --------------------------------------------------
                    SƠ ĐỒ 4: KHẢO SÁT KHẨU VỊ & CẢM XÚC KHÁCH HÀNG
                    Dải phổ cảm xúc ngang 100% không rớt hàng + 3 Thẻ tiêu chuẩn khẩu vị
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    {/* Header Card */}
                    <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2.5">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        4. Khảo Sát Khẩu Vị & Cảm Xúc
                      </span>
                      <button
                        onClick={() => setActiveNav("surveys")}
                        className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1"
                      >
                        <span>Data SĐT ({surveys.length})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Chỉ số chính */}
                    <div className="my-2.5 flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">
                          94.2%
                        </span>
                        <span className="text-[10px] font-black text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ★ 4.8 / 5.0 • Rất Ngon
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">
                        1,143 lượt đánh giá
                      </span>
                    </div>

                    {/* Dải phổ cảm xúc ngang liền mạch (Segmented Spectrum - 100% không rớt hàng) */}
                    <div className="space-y-2 mt-1">
                      <div className="w-full h-3 rounded-full bg-neutral-100 flex overflow-hidden p-[1px] border border-neutral-200/80">
                        <div style={{ width: "82%" }} className="bg-[#059669] h-full rounded-l-full" title="82% Hài lòng" />
                        <div style={{ width: "12%" }} className="bg-[#18181B] h-full mx-[1px]" title="12% Tạm ổn" />
                        <div style={{ width: "6%" }} className="bg-[#DC2626] h-full rounded-r-full" title="6% Góp ý" />
                      </div>

                      {/* Chú thích dàn đều nguyên hàng, tuyệt đối không rớt chữ */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 px-0.5">
                        <span className="flex items-center gap-1.5 text-black whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#059669] flex-shrink-0" />
                          <span>82% Hài Lòng (938)</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-neutral-800 whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#18181B] flex-shrink-0" />
                          <span>12% Tạm Ổn (137)</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[#DC2626] whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] flex-shrink-0" />
                          <span>6% Góp Ý (68)</span>
                        </span>
                      </div>
                    </div>

                    {/* 3 Thẻ Tiêu Chuẩn Khẩu Vị (Độ ngọt, Độ lạnh, Topping) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mt-3.5 pt-3 border-t border-neutral-200/70">
                      <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/70 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-neutral-500 block truncate">Độ Ngọt & Cốt Trà</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm sm:text-base font-black text-black">92%</span>
                          <span className="text-[9px] font-black text-[#059669] whitespace-nowrap">Chuẩn vị</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#059669] h-full rounded-full w-[92%]" />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/70 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-neutral-500 block truncate">Lượng Đá & Độ Lạnh</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm sm:text-base font-black text-black">88%</span>
                          <span className="text-[9px] font-black text-[#059669] whitespace-nowrap">Vừa đủ</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#059669] h-full rounded-full w-[88%]" />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/70 space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-neutral-500 block truncate">Bánh Mì & Món Kèm</span>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm sm:text-base font-black text-black">96%</span>
                          <span className="text-[9px] font-black text-[#059669] whitespace-nowrap">Nóng giòn</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#059669] h-full rounded-full w-[96%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* --------------------------------------------------
                    SƠ ĐỒ 5: NHỊP QUÉT TEM LY TẠI THÙNG RÁC THEO GIỜ
                    Biểu đồ cột Histogram phản ánh thời điểm sinh viên quét mã đổi voucher
                    -------------------------------------------------- */}
                <div className="bg-neutral-50/80 hover:bg-neutral-50 p-5 rounded-3xl border border-neutral-200/80 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md">
                  <div>
                    {/* Header Card */}
                    <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2.5">
                      <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                        5. Nhịp Quét Tem Bỏ Thùng
                      </span>
                      <button
                        onClick={() => setActiveNav("stickers")}
                        className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1"
                      >
                        <span>Kho tem ({stickers.length})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Chỉ số chính */}
                    <div className="my-2.5 flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight whitespace-nowrap">
                          1,280 Ly
                        </span>
                        <span className="text-[10px] font-black text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          84.2% Thu Hồi
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap">
                        Đỉnh: 12:00 (380 ly)
                      </span>
                    </div>

                    {/* Biểu đồ cột phân bổ nhịp quét qua 7 khung giờ */}
                    <div className="h-28 w-full flex items-end justify-between gap-2 px-1 pt-3 pb-1">
                      {[
                        { time: "08h", count: 110, height: "32%", isPeak: false },
                        { time: "10h", count: 195, height: "54%", isPeak: false },
                        { time: "12h", count: 380, height: "100%", isPeak: true, label: "Đỉnh trưa" },
                        { time: "14h", count: 160, height: "44%", isPeak: false },
                        { time: "16h", count: 220, height: "60%", isPeak: false },
                        { time: "18h", count: 310, height: "84%", isPeak: true, label: "Tan học" },
                        { time: "20h", count: 105, height: "30%", isPeak: false },
                      ].map((col) => (
                        <div key={col.time} className="flex-1 flex flex-col items-center gap-1 group relative">
                          {/* Tooltip hiển thị số ly khi hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 bg-black text-white text-[9px] font-black py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-10">
                            {col.count} ly
                          </div>
                          <div className="w-full bg-neutral-200/50 hover:bg-neutral-200 h-16 rounded-xl flex items-end p-1 transition-all">
                            <div
                              style={{ height: col.height }}
                              className={`w-full rounded-lg transition-all duration-500 ${
                                col.isPeak
                                  ? "bg-[#059669] shadow-sm shadow-[#059669]/30"
                                  : "bg-[#18181B] group-hover:bg-black"
                              }`}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${col.isPeak ? "text-[#059669] font-black" : "text-neutral-500"}`}>
                            {col.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chân card: 2 chỉ số so sánh rõ ràng */}
                  <div className="flex items-center justify-between text-[11px] font-bold pt-3 mt-1 border-t border-neutral-200/70 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-black">
                      <span className="w-2 h-2 rounded-full bg-[#059669]" />
                      <span>Trạm nhiều nhất: <strong className="text-[#059669]">H6 Căn Tin (412 ly)</strong></span>
                    </div>
                    <div className="text-neutral-500">
                      TB giữ ly: <strong className="text-black font-black">28 phút / ly</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================
              TAB 2: KHO DATA KHẢO SÁT & SĐT KHÁCH HÀNG (FULL)
              ======================================================== */}
          {activeNav === "surveys" && (
            <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-black uppercase tracking-wide">
                    Danh Sách Số Điện Thoại & Khảo Sát Khách Hàng
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Data chính chủ thu thập từ sinh viên sau khi quét mã nhận voucher tại thùng rác
                  </p>
                </div>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  {surveys.length} Khách Hàng
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-extrabold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-3.5 whitespace-nowrap">Họ và Tên</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Số Điện Thoại</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Món Đã Uống</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Phản Hồi 3s</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-center">Đánh Giá</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Mã Tem Ly (Barcode)</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">Sao Chép</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {surveys
                      .filter(
                        (s) =>
                          s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.phone.includes(searchQuery)
                      )
                      .map((s) => {
                        const stk = stickers.find((item) => item.code === s.stickerCode);
                        const currentStatus = stk ? stk.status : "done";
                        return (
                          <tr key={s.id} className="hover:bg-neutral-50/80 transition">
                            <td className="py-3 px-3.5 font-bold text-black whitespace-nowrap">{s.fullName}</td>
                            <td className="py-3 px-3.5 font-mono font-bold text-neutral-800 whitespace-nowrap">{s.phone}</td>
                            <td className="py-3 px-3.5 font-semibold text-neutral-700 whitespace-nowrap">{s.drink}</td>
                            <td className="py-3 px-3.5 text-neutral-600 max-w-[190px] whitespace-nowrap truncate" title={s.answer}>
                              "{s.answer}"
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center justify-center whitespace-nowrap text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                  s.rating === "good"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : s.rating === "medium"
                                    ? "bg-neutral-200 text-neutral-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {s.rating === "good" ? "Hài Lòng" : s.rating === "medium" ? "Tạm Ổn" : "Góp Ý"}
                              </span>
                            </td>
                            {/* Cột Mã Tem Ly dạng Barcode nằm ngang, độc nhất từng ly */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <HorizontalStickerBadge
                                code={s.stickerCode}
                                barcode={s.barcode || (stk ? stk.barcode : undefined)}
                                status={currentStatus}
                                onClick={() => {
                                  const match = stickers.find((item) => item.code === s.stickerCode) || {
                                    id: `STK-${s.id}`,
                                    code: s.stickerCode,
                                    barcode: s.barcode || (stk ? stk.barcode : "1089215437"),
                                    drink: s.drink,
                                    time: s.time,
                                    pos: "POS 1",
                                    status: currentStatus,
                                  };
                                  setSelectedStickerPreview(match);
                                }}
                              />
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleCopyPhone(s.phone)}
                                className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-500 hover:text-black transition inline-flex items-center justify-center"
                                title="Sao chép SĐT"
                              >
                                {copiedPhone === s.phone ? (
                                  <Check className="w-3.5 h-3.5 text-[#059669]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: QUẢN LÝ TEM IN TRÊN LY NƯỚC (TOKENS 1 LẦN)
              ======================================================== */}
          {activeNav === "stickers" && (
            <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-black uppercase tracking-wide">
                      Quản Lý Tem In Nhiệt Trên Ly (Mã Dùng 1 Lần)
                    </h2>
                    <span className="text-[10px] font-black bg-emerald-100 text-[#059669] px-2.5 py-0.5 rounded-full">
                      {stickers.filter((s) => s.status === "pending").length} Khả dụng • {stickers.filter((s) => s.status === "done").length} Đã đốt
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Mỗi mã tem ly chỉ được quét kích hoạt voucher 1 lần tại thùng rác thông minh • Đồng bộ CSDL trung tâm thời gian thực
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchStickersFromDb}
                    disabled={isSyncing}
                    className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Làm mới danh sách từ CSDL"
                  >
                    <RefreshCw size={13} className={isSyncing ? "animate-spin text-[#059669]" : ""} />
                    <span>Làm Mới</span>
                  </button>

                  <button
                    onClick={handleCreateSticker}
                    className="bg-[#059669] hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>In Tem Mới</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-extrabold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-3.5 whitespace-nowrap">Mã Tem Ly (Barcode)</th>
                      <th className="py-3 px-3 whitespace-nowrap">Mã Đơn POS</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Món Nước</th>
                      <th className="py-3 px-3 whitespace-nowrap">Quầy In & Giá</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">Trạng Thái (1-Time Burn)</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {stickers.map((stk) => (
                      <tr key={stk.id} className="hover:bg-neutral-50/80 transition">
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <HorizontalStickerBadge
                            code={stk.code}
                            barcode={stk.barcode}
                            status={stk.status}
                            onClick={() => setSelectedStickerPreview(stk)}
                          />
                        </td>
                        <td className="py-3 px-3 font-bold text-neutral-600 whitespace-nowrap">{stk.code}</td>
                        <td className="py-3 px-3.5 font-bold text-neutral-800 whitespace-nowrap">{stk.drink}</td>
                        <td className="py-3 px-3 text-neutral-600 whitespace-nowrap">
                          {stk.pos} • {Number(stk.price || 45000).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {stk.status === "done" ? (
                            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 inline-flex items-center gap-1.5 border border-neutral-200 shadow-2xs">
                              <CheckCircle2 size={12} className="text-neutral-500" />
                              <span>Đã Ký Số Đốt ({stk.usedAt ? stk.usedAt.substring(11, 16) : stk.time})</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-[#059669] inline-flex items-center gap-1.5 border border-emerald-200/60 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                              <span>Khả Dụng (Sẵn Sàng)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setSelectedStickerPreview(stk)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#059669] text-[11px] font-bold transition flex items-center gap-1 border border-emerald-200/60 cursor-pointer shadow-2xs"
                              title="Xem mã vạch to và QR để camera quét"
                            >
                              <Eye size={12} />
                              <span>Xem Mã</span>
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(stk.barcode);
                                setToastMsg(`Đã chép mã tem ${stk.barcode}`);
                                setTimeout(() => setToastMsg(null), 2000);
                              }}
                              className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Sao chép mã barcode"
                            >
                              <Copy size={12} />
                              <span>Copy</span>
                            </button>
                            {stk.status === "done" && (
                              <button
                                onClick={() => handleResetSticker(stk.barcode)}
                                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold transition flex items-center gap-1 border border-amber-200/80 cursor-pointer shadow-2xs"
                                title="Khôi phục trạng thái sẵn sàng để quét lại"
                              >
                                <RefreshCw size={11} />
                                <span>Reset</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSticker(stk.barcode)}
                              className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition flex items-center justify-center border border-red-100 cursor-pointer shadow-2xs"
                              title="Xóa mã tem khỏi CSDL"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 4: VOUCHER BẪY MUA (DẠNG DANH SÁCH LIST + ICON XANH LÁ + 3 CHẤM SỬA XÓA)
              ======================================================== */}
          {activeNav === "vouchers" && (
            <div className="space-y-5">
              {/* Header Tab */}
              <div className="bg-white p-5 rounded-3xl border border-neutral-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-black uppercase tracking-wide">
                      Danh Sách Voucher Bẫy Mua (Kèm Điều Kiện Đơn)
                    </h2>
                    <span className="text-[10px] font-black bg-emerald-100 text-[#059669] px-2.5 py-0.5 rounded-full">
                      {vouchers.filter((v) => v.active).length}/{vouchers.length} Đang áp dụng
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Cơ chế bẫy mua: Giảm 5k - 15k khi bill đạt mức tối thiểu để kéo thêm 40k - 50k tiền tươi
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingVoucherId(null);
                    setVoucherForm({
                      code: `EP-HL-${Math.floor(1000 + Math.random() * 9000)}`,
                      dish: "",
                      discount: "Giảm 10.000đ",
                      condition: "Đơn ≥ 45.000đ",
                      note: "Kích thích gọi kèm đồ uống",
                    });
                    setIsVoucherModalOpen(true);
                  }}
                  className="bg-[#059669] hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition shadow-md shadow-[#059669]/25 flex items-center gap-2 self-start sm:self-auto flex-shrink-0 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Voucher Mới</span>
                </button>
              </div>

              {/* Bảng danh sách voucher dạng list */}
              <div className="bg-white rounded-3xl border border-neutral-200/90 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-extrabold text-neutral-500 uppercase tracking-wider">
                        <th className="py-4 px-5 whitespace-nowrap">Voucher & Món Áp Dụng</th>
                        <th className="py-4 px-5 whitespace-nowrap">Mức Giảm</th>
                        <th className="py-4 px-5 whitespace-nowrap">Điều Kiện Bẫy Mua</th>
                        <th className="py-4 px-5 whitespace-nowrap">Đã Giải Cứu</th>
                        <th className="py-4 px-5 whitespace-nowrap">Trạng Thái</th>
                        <th className="py-4 px-5 text-right whitespace-nowrap">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {vouchers.map((v) => (
                        <tr key={v.id} className="hover:bg-neutral-50/80 transition">
                          {/* Cột 1: Icon voucher xanh lá đẹp + Tên món + Code */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3.5">
                              {/* Icon voucher xanh lá đẹp */}
                              <div className="w-10 h-10 rounded-2xl bg-[#059669]/10 border border-[#059669]/25 text-[#059669] flex items-center justify-center flex-shrink-0 shadow-xs">
                                <TicketPercent className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-black text-black text-sm">{v.dish}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[10px] font-extrabold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                                    {v.code}
                                  </span>
                                  {v.note && (
                                    <span className="text-[10px] text-neutral-400 truncate max-w-xs">
                                      • {v.note}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Mức giảm */}
                          <td className="py-4 px-5">
                            <span className="text-xs font-black text-[#DC2626] bg-red-50 border border-red-100 px-2.5 py-1 rounded-xl">
                              {v.discount}
                            </span>
                          </td>

                          {/* Điều kiện đơn */}
                          <td className="py-4 px-5">
                            <div className="font-bold text-neutral-900 bg-neutral-100/90 border border-neutral-200/80 px-2.5 py-1 rounded-xl inline-block text-xs">
                              {v.condition}
                            </div>
                          </td>

                          {/* Đã giải cứu */}
                          <td className="py-4 px-5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-black text-sm text-[#059669]">{v.rescued}</span>
                              <span className="text-[10px] font-semibold text-neutral-400">đơn</span>
                            </div>
                          </td>

                          {/* Trạng thái toggle */}
                          <td className="py-4 px-5">
                            <button
                              onClick={() => {
                                setVouchers(
                                  vouchers.map((item) =>
                                    item.id === v.id ? { ...item, active: !item.active } : item
                                  )
                                );
                              }}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 ${
                                v.active
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-neutral-100 text-neutral-500 border-neutral-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  v.active ? "bg-[#059669]" : "bg-neutral-400"
                                }`}
                              />
                              <span>{v.active ? "Đang Áp Dụng" : "Tạm Ngưng"}</span>
                            </button>
                          </td>

                          {/* Thao tác: Dấu 3 chấm sửa xóa */}
                          <td className="py-4 px-5 text-right relative">
                            <div className="inline-block text-left">
                              <button
                                onClick={() =>
                                  setActiveVoucherMenuId(
                                    activeVoucherMenuId === v.id ? null : v.id
                                  )
                                }
                                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 hover:text-black transition"
                                title="Tùy chọn voucher"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Dropdown menu sửa / xóa */}
                              {activeVoucherMenuId === v.id && (
                                <div className="absolute right-5 mt-1 w-36 bg-white rounded-2xl shadow-xl border border-neutral-200 py-1.5 z-30 animate-in fade-in zoom-in-95">
                                  <button
                                    onClick={() => {
                                      setEditingVoucherId(v.id);
                                      setVoucherForm({
                                        code: v.code,
                                        dish: v.dish,
                                        discount: v.discount,
                                        condition: v.condition,
                                        note: v.note || "",
                                      });
                                      setActiveVoucherMenuId(null);
                                      setIsVoucherModalOpen(true);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 hover:text-black flex items-center gap-2"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-[#059669]" />
                                    <span>Sửa Voucher</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setVouchers(
                                        vouchers.map((item) =>
                                          item.id === v.id ? { ...item, active: !item.active } : item
                                        )
                                      );
                                      setActiveVoucherMenuId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 hover:text-black flex items-center gap-2"
                                  >
                                    <TicketPercent className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>{v.active ? "Tạm ngưng" : "Kích hoạt"}</span>
                                  </button>
                                  <div className="border-t border-neutral-100 my-1" />
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Xóa voucher bẫy mua "${v.dish}"?`)) {
                                        setVouchers(vouchers.filter((item) => item.id !== v.id));
                                      }
                                      setActiveVoucherMenuId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Xóa Voucher</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 5: CÂU HỎI KHẢO SÁT KHẨU VỊ & CẢM XÚC (3S)
              ======================================================== */}
          {activeNav === "questions" && (
            <div className="space-y-5">
              {/* Header Tab */}
              <div className="bg-white p-5 rounded-3xl border border-neutral-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-black uppercase tracking-wide">
                      Bộ Câu Hỏi Khảo Sát Khẩu Vị & Cảm Xúc (3 Giây)
                    </h2>
                    <span className="text-[10px] font-black bg-emerald-100 text-[#059669] px-2.5 py-0.5 rounded-full">
                      {questions.filter((q) => q.active).length} Câu Đang Bật
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Sinh viên trả lời siêu tốc trong 3 giây sau khi quét mã tem ly để nhận voucher đổi quà
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingQuestionId(null);
                    setQuestionForm({
                      title: "",
                      dishTarget: "Tất cả đồ uống",
                      type: "Thang 3 mức",
                    });
                    setIsQuestionModalOpen(true);
                  }}
                  className="bg-[#059669] hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition shadow-md shadow-[#059669]/25 flex items-center gap-2 self-start sm:self-auto flex-shrink-0 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Câu Hỏi Mới</span>
                </button>
              </div>

              {/* 4 Thẻ thống kê nhanh */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                  <span className="text-[10px] font-bold text-neutral-400 block uppercase">Tổng Câu Hỏi</span>
                  <span className="text-2xl font-black text-black mt-1 block">{questions.length} câu</span>
                </div>
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                  <span className="text-[10px] font-bold text-neutral-400 block uppercase">Thời Gian TB</span>
                  <span className="text-2xl font-black text-[#059669] mt-1 block">2.8 giây</span>
                </div>
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                  <span className="text-[10px] font-bold text-neutral-400 block uppercase">Điểm Hài Lòng</span>
                  <span className="text-2xl font-black text-black mt-1 block">94.2%</span>
                </div>
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/70">
                  <span className="text-[10px] font-bold text-neutral-400 block uppercase">Lượt Đánh Giá</span>
                  <span className="text-2xl font-black text-neutral-900 mt-1 block">1,143 lượt</span>
                </div>
              </div>

              {/* Danh sách các câu hỏi khảo sát */}
              <div className="space-y-3.5">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="bg-white p-5 rounded-3xl border border-neutral-200/90 shadow-sm hover:border-[#059669]/40 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center font-black text-xs flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-black">{q.title}</h3>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200">
                              Áp dụng: {q.dishTarget}
                            </span>
                            <span className="text-[10px] font-bold text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded-lg border border-neutral-150">
                              Dạng: {q.type}
                            </span>
                            <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                              {q.satisfaction}% Hài Lòng
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 relative">
                        <button
                          onClick={() => {
                            setQuestions(
                              questions.map((item) =>
                                item.id === q.id ? { ...item, active: !item.active } : item
                              )
                            );
                          }}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 ${
                            q.active
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-neutral-100 text-neutral-500 border-neutral-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              q.active ? "bg-[#059669]" : "bg-neutral-400"
                            }`}
                          />
                          <span>{q.active ? "Đang Bật" : "Đang Tắt"}</span>
                        </button>

                        <button
                          onClick={() =>
                            setActiveQuestionMenuId(
                              activeQuestionMenuId === q.id ? null : q.id
                            )
                          }
                          className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-500 hover:text-black transition"
                          title="Tùy chọn"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Menu 3 chấm sửa xóa câu hỏi */}
                        {activeQuestionMenuId === q.id && (
                          <div className="absolute right-0 top-8 w-36 bg-white rounded-2xl shadow-xl border border-neutral-200 py-1.5 z-30">
                            <button
                              onClick={() => {
                                setEditingQuestionId(q.id);
                                setQuestionForm({
                                  title: q.title,
                                  dishTarget: q.dishTarget,
                                  type: q.type,
                                });
                                setActiveQuestionMenuId(null);
                                setIsQuestionModalOpen(true);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 hover:text-black flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#059669]" />
                              <span>Sửa câu hỏi</span>
                            </button>
                            <div className="border-t border-neutral-100 my-1" />
                            <button
                              onClick={() => {
                                if (window.confirm("Xóa câu hỏi khảo sát này?")) {
                                  setQuestions(questions.filter((item) => item.id !== q.id));
                                }
                                setActiveQuestionMenuId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa câu hỏi</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Phân bổ tỷ lệ các phương án trả lời */}
                    <div className="mt-4 pt-3.5 border-t border-neutral-100">
                      <div className="text-[11px] font-bold text-neutral-400 mb-2">
                        Tỷ lệ sinh viên lựa chọn ({q.responsesCount} lượt):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/60 text-xs font-bold text-neutral-800 flex items-center justify-between"
                          >
                            <span>{opt}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* ========================================================
              MODAL THÊM / SỬA VOUCHER
              ======================================================== */}
          {isVoucherModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-150">
                  <div className="flex items-center gap-2.5 text-[#059669]">
                    <TicketPercent className="w-5 h-5" />
                    <span className="font-black text-sm text-black">
                      {editingVoucherId ? "Chỉnh Sửa Voucher Bẫy Mua" : "Thêm Voucher Bẫy Mua Mới"}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsVoucherModalOpen(false)}
                    className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                      Món Áp Dụng (hoặc gọi kèm)
                    </label>
                    <input
                      type="text"
                      value={voucherForm.dish}
                      onChange={(e) => setVoucherForm({ ...voucherForm, dish: e.target.value })}
                      placeholder="Ví dụ: Phindi Hạnh Nhân, Freeze Matcha..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                        Mã Code
                      </label>
                      <input
                        type="text"
                        value={voucherForm.code}
                        onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-mono font-bold text-black outline-none focus:border-[#059669]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                        Mức Giảm Giá
                      </label>
                      <input
                        type="text"
                        value={voucherForm.discount}
                        onChange={(e) => setVoucherForm({ ...voucherForm, discount: e.target.value })}
                        placeholder="Giảm 10.000đ"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-bold text-[#DC2626] outline-none focus:border-[#059669]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                      Điều Kiện Bẫy Mua (Min Bill)
                    </label>
                    <input
                      type="text"
                      value={voucherForm.condition}
                      onChange={(e) => setVoucherForm({ ...voucherForm, condition: e.target.value })}
                      placeholder="Ví dụ: Đơn ≥ 45.000đ hoặc Kèm Cà phê đá"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                      Ghi Chú Chiến Dịch
                    </label>
                    <input
                      type="text"
                      value={voucherForm.note}
                      onChange={(e) => setVoucherForm({ ...voucherForm, note: e.target.value })}
                      placeholder="Ví dụ: Giải phóng tồn kho giờ nghỉ trưa"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-medium text-neutral-700 outline-none focus:border-[#059669]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                  <button
                    onClick={() => setIsVoucherModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-700"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (!voucherForm.dish.trim()) {
                        alert("Vui lòng nhập tên món áp dụng");
                        return;
                      }
                      if (editingVoucherId) {
                        setVouchers(
                          vouchers.map((v) =>
                            v.id === editingVoucherId ? { ...v, ...voucherForm } : v
                          )
                        );
                      } else {
                        const newVoucher = {
                          id: `V-${Date.now()}`,
                          ...voucherForm,
                          rescued: 0,
                          active: true,
                        };
                        setVouchers([newVoucher, ...vouchers]);
                      }
                      setIsVoucherModalOpen(false);
                    }}
                    className="px-5 py-2 rounded-full bg-[#059669] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                  >
                    {editingVoucherId ? "Lưu Thay Đổi" : "Tạo Voucher"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              MODAL THÊM / SỬA CÂU HỎI KHẢO SÁT
              ======================================================== */}
          {isQuestionModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-150">
                  <div className="flex items-center gap-2.5 text-[#059669]">
                    <HelpCircle className="w-5 h-5" />
                    <span className="font-black text-sm text-black">
                      {editingQuestionId ? "Chỉnh Sửa Câu Hỏi Khảo Sát" : "Thêm Câu Hỏi Khảo Sát (3s)"}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsQuestionModalOpen(false)}
                    className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                      Nội Dung Câu Hỏi (Ngắn gọn, dễ trả lời trong 3 giây)
                    </label>
                    <textarea
                      rows={3}
                      value={questionForm.title}
                      onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                      placeholder="Ví dụ: Độ ngọt và độ lạnh của ly nước đã vừa ý bạn chưa?"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                      Áp Dụng Cho Món
                    </label>
                    <input
                      type="text"
                      value={questionForm.dishTarget}
                      onChange={(e) =>
                        setQuestionForm({ ...questionForm, dishTarget: e.target.value })
                      }
                      placeholder="Ví dụ: Tất cả đồ uống, Bánh Mì Que..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                      Loại Câu Hỏi
                    </label>
                    <select
                      value={questionForm.type}
                      onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 font-bold text-black outline-none focus:border-[#059669]"
                    >
                      <option value="Thang 3 mức">Thang 3 mức (Chuẩn vị / Hơi ngọt / Nhạt)</option>
                      <option value="Đánh giá cảm xúc">Đánh giá cảm xúc (Nóng giòn / Bình thường / Chưa ưng)</option>
                      <option value="NPS (1 - 10)">NPS (1 - 10 điểm sẵn sàng giới thiệu)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                  <button
                    onClick={() => setIsQuestionModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-700"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (!questionForm.title.trim()) {
                        alert("Vui lòng nhập nội dung câu hỏi");
                        return;
                      }
                      if (editingQuestionId) {
                        setQuestions(
                          questions.map((q) =>
                            q.id === editingQuestionId ? { ...q, ...questionForm } : q
                          )
                        );
                      } else {
                        const newQ = {
                          id: `Q-${Date.now()}`,
                          ...questionForm,
                          options: ["Rất hài lòng (90%)", "Tạm ổn (7%)", "Cần cải thiện (3%)"],
                          satisfaction: 92,
                          responsesCount: 0,
                          active: true,
                        };
                        setQuestions([...questions, newQ]);
                      }
                      setIsQuestionModalOpen(false);
                    }}
                    className="px-5 py-2 rounded-full bg-[#059669] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                  >
                    {editingQuestionId ? "Lưu Câu Hỏi" : "Tạo Câu Hỏi"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODAL XEM MÃ VẠCH TEM LY ĐỂ CAMERA ĐIỆN THOẠI QUÉT BƯỚC 2
          ========================================================================= */}
          {selectedStickerPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in">
              <div className="relative w-full max-w-sm bg-white rounded-[32px] p-6 sm:p-7 shadow-2xl border border-neutral-100 space-y-4 text-center text-black">
                <button 
                  onClick={() => setSelectedStickerPreview(null)}
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition cursor-pointer"
                >
                  <X size={15} />
                </button>

                <div className="pt-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#059669] text-[10px] font-black uppercase tracking-wider mb-2">
                    <Tag size={12} />
                    <span>HIGHLANDS COFFEE • TEM LY NƯỚC (BƯỚC 2)</span>
                  </div>
                  <h3 className="text-lg font-black text-neutral-900">
                    {selectedStickerPreview.storeName || "Highlands Coffee"}
                  </h3>
                  <p className="text-sm text-neutral-800 font-extrabold mt-0.5">
                    {selectedStickerPreview.drink || selectedStickerPreview.drinkName} • <span className="font-mono text-[#059669]">{selectedStickerPreview.code}</span>
                  </p>
                  <p className="text-xs text-neutral-500 font-semibold mt-0.5">
                    {selectedStickerPreview.pos || selectedStickerPreview.posTerminal || "POS 1"} • {selectedStickerPreview.price ? Number(selectedStickerPreview.price).toLocaleString('vi-VN') + 'đ' : '45.000đ'}
                  </p>
                </div>

                {/* Khung Tem Ly Chuẩn Cửa Hàng (Gồm Mã Vạch 1D & QR Xác Thực 2D) */}
                <div className="p-4 sm:p-5 bg-white rounded-3xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center shadow-xs">
                  {/* Mã Vạch Code-128 */}
                  <div className="flex flex-col items-center max-w-full">
                    <BarcodeSvg barcode={selectedStickerPreview.barcode} height={52} />
                    <span className="font-mono text-sm font-black tracking-widest text-neutral-900 mt-1.5 select-all">
                      {selectedStickerPreview.barcode}
                    </span>
                  </div>

                  {/* Vạch ngăn cách */}
                  <div className="w-full flex items-center gap-2 my-2.5">
                    <div className="h-px bg-neutral-200 flex-1" />
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">hoặc quét QR tem ly</span>
                    <div className="h-px bg-neutral-200 flex-1" />
                  </div>

                  {/* Mã QR Tem Ly (Quét tức thì 0.1s trên mọi camera điện thoại) */}
                  <div className="p-2.5 bg-white rounded-2xl border border-neutral-200 shadow-2xs flex flex-col items-center">
                    <QRCodeSVG
                      value={selectedStickerPreview.barcode}
                      size={110}
                      level="M"
                      includeMargin={false}
                    />
                    <span className="text-[9px] font-bold text-neutral-500 mt-1 font-mono">
                      TEM LY: {selectedStickerPreview.code || selectedStickerPreview.barcode}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 text-[11px] text-[#059669] font-bold flex items-center justify-center gap-1.5">
                  <span>📱</span>
                  <span>Hướng camera vào mã vạch hoặc mã QR trên để hoàn thành Bước 2</span>
                </div>

                <div className="pt-1 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedStickerPreview.barcode);
                      alert(`Đã sao chép mã ${selectedStickerPreview.barcode}`);
                    }}
                    className="px-4 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Sao Chép Mã</span>
                  </button>
                  <button
                    onClick={() => setSelectedStickerPreview(null)}
                    className="px-5 py-2 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
