import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { 
  ArrowUpRight, 
  ArrowDownRight,
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp,
  ArrowLeft,
  ArrowDown,
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Settings, 
  Activity, 
  QrCode, 
  Download, 
  X, 
  CheckCircle2, 
  RefreshCw,
  Sparkles,
  Store,
  Ticket,
  Printer,
  Copy,
  Barcode,
  ExternalLink,
  ShieldCheck,
  Zap,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Filter,
  Layers,
  Flame,
  Check,
  LayoutDashboard,
  Truck,
  BarChart3,
  HelpCircle,
  Bell,
  MessageSquare,
  Plus,
  RotateCw,
  Crown,
  Trash2,
  Clock,
  Eye,
  BatteryCharging,
  Radio,
  Navigation,
  CheckCheck,
  Menu,
  Users,
  Handshake,
  ClipboardList,
  Award,
  FileText,
  DollarSign,
  Coffee,
  Dumbbell,
  GraduationCap,
  PieChart
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
      className={`group/barcode inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border transition-all select-none text-left bg-white shadow-2xs hover:shadow-xs hover:border-[#059669] cursor-pointer whitespace-nowrap ${
        isDone
          ? "border-emerald-200/90"
          : "border-amber-200/90"
      }`}
      title={`Bấm xem mã tem để quét: ${code} (${cleanDigits})`}
    >
      <div className="flex flex-col items-center justify-center bg-white px-1.5 py-0.5 rounded-lg border border-neutral-200/90 shadow-2xs flex-shrink-0">
        <svg ref={svgRef} className="block select-none" />
      </div>

      <div className="flex flex-col justify-center pr-1 min-w-[80px]">
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
          <span>{isDone ? "Đã Ký Số Đốt" : "Chờ Bỏ Thùng"}</span>
        </span>
      </div>
    </button>
  );
}

// =========================================================================
// HỆ DỮ LIỆU ĐỐI SOÁT TUẦN HOÀN 4-WIN (CLEARINGHOUSE ENGINE :3010)
// =========================================================================

// 1. Dữ liệu chuỗi thời gian 7 ngày cho Sơ Đồ Dòng Tiền & Voucher Bẫy Mua (Diagram 1)
const TIMELINE_DATA = [
  { day: "T2", label: "Thứ Hai", revenue: 18.5, vouchers: 142, leverage: "4.1x", topDish: "Phindi Hạnh Nhân", avgBill: "48.200đ", x: 50, yRevenue: 124, yLeverage: 120 },
  { day: "T3", label: "Thứ Ba", revenue: 21.0, vouchers: 165, leverage: "4.2x", topDish: "Trà Sen Vàng", avgBill: "49.500đ", x: 140, yRevenue: 115, yLeverage: 110 },
  { day: "T4", label: "Thứ Tư", revenue: 28.4, vouchers: 210, leverage: "4.5x", topDish: "Phindi Hạnh Nhân", avgBill: "51.000đ", x: 230, yRevenue: 89, yLeverage: 80 },
  { day: "T5", label: "Thứ Năm", revenue: 24.8, vouchers: 188, leverage: "4.3x", topDish: "Ô Long Mãng Cầu", avgBill: "50.400đ", x: 320, yRevenue: 102, yLeverage: 100 },
  { day: "T6", label: "Thứ Sáu (Peak)", revenue: 38.6, vouchers: 294, leverage: "4.8x", topDish: "Phindi Hạnh Nhân", avgBill: "54.800đ", x: 410, yRevenue: 53, yLeverage: 50 },
  { day: "T7", label: "Thứ Bảy", revenue: 31.2, vouchers: 245, leverage: "4.4x", topDish: "Trà Sen Vàng", avgBill: "52.100đ", x: 500, yRevenue: 79, yLeverage: 90 },
  { day: "CN", label: "Chủ Nhật", revenue: 22.5, vouchers: 172, leverage: "4.2x", topDish: "Bánh Mì Que", avgBill: "49.000đ", x: 590, yRevenue: 110, yLeverage: 110 },
];

// 2. Dữ liệu 4 Node cho Sơ Đồ Tuần Hoàn Giá Trị 4-Win
const FLYWHEEL_NODES = [
  {
    id: 0,
    title: "Sinh Viên Campus",
    role: "Kích Hoạt Chu Trình",
    badge: "WIN 1",
    tagline: "Chi phí cơ hội 0đ, nhận ưu đãi tiền tươi mỗi ngày",
    cost: "1 Vỏ sạch + 3s đánh giá",
    benefit: "Tiết kiệm 10k - 30k/ngày",
    giveTag: "1 vỏ sạch",
    getTag: "+10k - 30k/ngày",
    metricValue: "32.8 Tr",
    metricLabel: "Tiết kiệm tích lũy cho SV",
    impact: "1,097 Voucher đổi thành công (0đ chi phí rác)",
    flowTo: "Đổi Voucher Ăn Uống",
    color: "#059669",
    icon: Users
  },
  {
    id: 1,
    title: "Chuỗi Quán F&B",
    role: "Đòn Bẩy Doanh Thu Mới",
    badge: "WIN 2",
    tagline: "Voucher bẫy mua kéo đơn hàng tối thiểu 45k tại POS",
    cost: "Tài trợ 10k món chậm (Phindi)",
    benefit: "Kéo khách, tăng bill >45k",
    giveTag: "Tài trợ 10k",
    getTag: "Đơn kéo >45k",
    metricValue: "48.5 Tr",
    metricLabel: "Doanh thu tạo mới (Net-New)",
    impact: "86% Đơn hàng có mua kèm món tại POS",
    flowTo: "Dữ Liệu POS & Bill Thật",
    color: "#059669",
    icon: Store
  },
  {
    id: 2,
    title: "Nhãn Hàng FMCG",
    role: "Tài Trợ Ngân Sách",
    badge: "WIN 3",
    tagline: "Khảo sát khẩu vị tức thì, tiết kiệm 85% chi phí nghiên cứu",
    cost: "2.000đ/Mẫu thử (Rẻ hơn agency)",
    benefit: "100% Ý kiến thật từ SV",
    giveTag: "2.000đ/mẫu",
    getTag: "Ý kiến thật 100%",
    metricValue: "1,143 Mẫu",
    metricLabel: "Khảo sát vị giác thực tế",
    impact: "Tiết kiệm 85% chi phí R&D mẫu thử",
    flowTo: "Tài Trợ Quỹ Tái Chế EPR",
    color: "#111613",
    icon: Sparkles
  },
  {
    id: 3,
    title: "Thu Gom Sạch EPR",
    role: "Khép Kín Chu Trình",
    badge: "WIN 4",
    tagline: "Dòng rác sạch đồng nhất, giảm 80% công đoạn bới rác",
    cost: "Tuyến xe thu gom sẵn có",
    benefit: "Bán nguồn vỏ sạch giá x2",
    giveTag: "Xe gom sẵn",
    getTag: "Bán vỏ x2 giá",
    metricValue: "4,850 Vỏ",
    metricLabel: "Chai/lon sạch đạt chuẩn EPR",
    impact: "Giảm 80% chi phí lọc rửa thủ công",
    flowTo: "Hoàn Điểm Vỏ Sạch Cho SV",
    color: "#111613",
    icon: ShieldCheck
  },
];

// 2.1 Cơ Cấu Phân Bổ Giá Trị 4 Bên (Donut Ring Chart)
// Bán kính r=68, chu vi C = 2 * pi * 68 ≈ 427.26
const DONUT_VALUE_SEGMENTS = [
  { id: 'fb', name: 'Cửa Hàng F&B', share: 42, value: '40.5 Tr', role: 'Doanh thu mới kéo theo (Net-New)', color: '#059669', strokeDash: '179.45 427.26', offset: 0 },
  { id: 'sv', name: 'Sinh Viên', share: 30, value: '28.9 Tr', role: 'Tiết kiệm ăn uống trực tiếp', color: '#10B981', strokeDash: '128.18 427.26', offset: -179.45 },
  { id: 'fmcg', name: 'Nhãn Hàng FMCG', share: 18, value: '17.3 Tr', role: 'Tiết kiệm 85% chi phí phát mẫu', color: '#111613', strokeDash: '76.91 427.26', offset: -307.63 },
  { id: 'epr', name: 'Thu Gom Tái Chế', share: 10, value: '9.6 Tr', role: 'Giá bán vỏ sạch tăng gấp đôi', color: '#6EE7B7', strokeDash: '42.73 427.26', offset: -384.54 },
];

// 2.2 Phễu Chuyển Đổi Kích Cầu F&B (Conversion Funnel Chart)
const FUNNEL_STEPS = [
  { step: "01", name: "Thu Gom Vỏ Chai Sạch", count: "4,850 Vỏ", rate: "100%", sub: "Đạt chuẩn tái chế EPR", pct: 100, color: "#059669" },
  { step: "02", name: "Đổi Voucher Bẫy Mua", count: "3,680 Mã", rate: "75.9%", sub: "Voucher giảm 10k - 15k có điều kiện", pct: 76, color: "#10B981" },
  { step: "03", name: "Tới Quầy Gọi Món", count: "3,100 Lượt", rate: "63.9%", sub: "Đến trực tiếp cửa hàng F&B Campus", pct: 64, color: "#34D399" },
  { step: "04", name: "Đơn Kèm Món >45k (Upsell)", count: "2,666 Đơn", rate: "86.0%", sub: "Chi tiêu vượt định mức ưu đãi", pct: 55, color: "#111613" },
];

// 2.3 Khung Giờ Cao Điểm Quét Mã & Đổi Món (Hourly Peak Bar Chart)
const HOURLY_PEAK_DATA = [
  { hour: "8h", vouchers: 45, height: 18, peak: false },
  { hour: "9h", vouchers: 95, height: 32, peak: false },
  { hour: "10h", vouchers: 160, height: 50, peak: false },
  { hour: "11h", vouchers: 310, height: 88, peak: true, tag: "Trưa" },
  { hour: "12h", vouchers: 345, height: 100, peak: true, tag: "Đỉnh" },
  { hour: "13h", vouchers: 220, height: 68, peak: false },
  { hour: "14h", vouchers: 110, height: 36, peak: false },
  { hour: "15h", vouchers: 140, height: 46, peak: false },
  { hour: "16h", vouchers: 190, height: 60, peak: false },
  { hour: "17h", vouchers: 285, height: 82, peak: true, tag: "Tan học" },
  { hour: "18h", vouchers: 240, height: 72, peak: true },
  { hour: "19h", vouchers: 120, height: 40, peak: false },
];

// 2.4 Ma Trận Cân Bằng Lợi Ích 5 Trục (Radar Spider Chart)
const RADAR_METRICS = [
  { label: "Tái Chế Sạch", score: "95%", x: 120, y: 18 },
  { label: "Đòn Bẩy F&B", score: "92%", x: 206, y: 76 },
  { label: "Tiết Kiệm SV", score: "88%", x: 174, y: 182 },
  { label: "Chi Phí FMCG", score: "90%", x: 66, y: 182 },
  { label: "Đối Soát Realtime", score: "96%", x: 34, y: 76 },
];
const RADAR_POLYGON_POINTS = "120,38.8 185.6,88.7 158.8,163.4 80.3,164.6 51.5,87.8";

// 3. Danh sách chiến dịch kích cầu đang chạy
const INITIAL_CAMPAIGNS = [
  {
    id: "CMP-01",
    brand: "Highlands Coffee",
    name: "Kích Cầu Phindi Hạnh Nhân Campus",
    dish: "Phindi Hạnh Nhân",
    condition: "Đơn tối thiểu 45.000đ",
    discount: "Giảm 10.000đ",
    quotaTotal: 600,
    quotaUsed: 542,
    revenue: "24.3 Tr",
    roi: "4.8x",
    status: "active",
    category: "F&B"
  },
  {
    id: "CMP-02",
    brand: "Phúc Long Tea & Coffee",
    name: "Combo Trà Ô Long & Bánh Tươi",
    dish: "Trà Ô Long Mãng Cầu",
    condition: "Hóa đơn trà kèm bánh",
    discount: "Giảm 15.000đ",
    quotaTotal: 500,
    quotaUsed: 380,
    revenue: "16.2 Tr",
    roi: "4.2x",
    status: "active",
    category: "F&B"
  },
  {
    id: "CMP-03",
    brand: "The New Gym",
    name: "Pass 7 Ngày Thể Thao Học Đường",
    dish: "Full Dàn Máy Tập Campus",
    condition: "Đổi 3 vỏ chai PET đạt chuẩn",
    discount: "Tài trợ 100%",
    quotaTotal: 200,
    quotaUsed: 175,
    revenue: "8.0 Tr (Quy đổi)",
    roi: "100% SV thật",
    status: "active",
    category: "Sponsor"
  },
];

// 4. Danh sách hợp đồng đối tác F&B và nhà tài trợ
const INITIAL_CONTRACTS = [
  {
    id: "CTR-HL-01",
    partner: "Highlands Coffee Campus",
    category: "fb",
    categoryLabel: "F&B Cấp 1",
    scope: "Campus Khu E & Tòa H6",
    commitment: "Chấp nhận voucher 10k cho đơn từ 45k có Phindi Hạnh Nhân",
    monthlyQuota: "800 mã/tháng",
    redemptionRate: "86.4%",
    totalSettled: "28.5 Tr",
    status: "active",
    expiry: "12/2026",
    posIntegrated: true,
  },
  {
    id: "CTR-PL-02",
    partner: "Phúc Long Tea & Coffee",
    category: "fb",
    categoryLabel: "F&B Liên Kết",
    scope: "Sảnh Tòa Thư Viện",
    commitment: "Voucher 15k cho hóa đơn Trà Ô Long kèm bánh",
    monthlyQuota: "600 mã/tháng",
    redemptionRate: "79.2%",
    totalSettled: "18.2 Tr",
    status: "active",
    expiry: "09/2026",
    posIntegrated: true,
  },
  {
    id: "CTR-H6-03",
    partner: "Căn Tin Tòa H6",
    category: "fb",
    categoryLabel: "Căn Tin Campus",
    scope: "Tầng Trệt Tòa H6",
    commitment: "Giảm 5k suất cơm trưa khi trả khay phân loại rác sạch",
    monthlyQuota: "1,200 mã/tháng",
    redemptionRate: "92.0%",
    totalSettled: "14.8 Tr",
    status: "active",
    expiry: "12/2026",
    posIntegrated: true,
  },
  {
    id: "CTR-H1-04",
    partner: "Căn Tin Tòa H1",
    category: "fb",
    categoryLabel: "Căn Tin Campus",
    scope: "Khối Kỹ Thuật Tòa H1",
    commitment: "Giảm 5k cho combo đồ uống & đồ ăn sáng sinh viên",
    monthlyQuota: "1,000 mã/tháng",
    redemptionRate: "84.5%",
    totalSettled: "11.6 Tr",
    status: "active",
    expiry: "12/2026",
    posIntegrated: true,
  },
  {
    id: "CTR-GYM-05",
    partner: "The New Gym Campus",
    category: "sponsor",
    categoryLabel: "Tài Trợ Thể Thao",
    scope: "Toàn bộ sinh viên Campus",
    commitment: "Tài trợ 500 suất tập 7 ngày trải nghiệm full phòng tập",
    monthlyQuota: "250 pass/tháng",
    redemptionRate: "88.0%",
    totalSettled: "12.5 Tr (Tài trợ)",
    status: "active",
    expiry: "06/2026",
    posIntegrated: true,
  },
  {
    id: "CTR-MX-06",
    partner: "MindX Technology School",
    category: "sponsor",
    categoryLabel: "Tài Trợ Giáo Dục",
    scope: "Sinh viên Khối Công Nghệ",
    commitment: "Học bổng 500.000đ cho khóa học lập trình thực chiến",
    monthlyQuota: "150 suất/tháng",
    redemptionRate: "72.4%",
    totalSettled: "15.0 Tr (Tài trợ)",
    status: "active",
    expiry: "08/2026",
    posIntegrated: true,
  },
];

// 5. Luồng giao dịch đối soát realtime từ quầy POS :3009
const REALTIME_SETTLEMENTS = [
  {
    id: "EP-9821",
    pos: "POS 1 (Highlands Căn Tin E)",
    dish: "Phindi Hạnh Nhân + Bánh Mì",
    discount: "10.000đ",
    paid: "49.000đ",
    time: "2 phút trước",
    status: "success",
    port: "3009"
  },
  {
    id: "EP-9820",
    pos: "POS 1 (Phúc Long Thư Viện)",
    dish: "Ô Long Mãng Cầu + Cookie",
    discount: "15.000đ",
    paid: "55.000đ",
    time: "6 phút trước",
    status: "success",
    port: "3009"
  },
  {
    id: "EP-9819",
    pos: "Check-in (The New Gym)",
    dish: "Kích Hoạt Pass 7 Ngày Tập",
    discount: "100%",
    paid: "0đ",
    time: "11 phút trước",
    status: "success",
    port: "3012"
  },
  {
    id: "EP-9818",
    pos: "POS 2 (Căn Tin Tòa H6)",
    dish: "Cơm Trưa Sinh Viên + Canh",
    discount: "5.000đ",
    paid: "35.000đ",
    time: "18 phút trước",
    status: "success",
    port: "3009"
  },
];

// Danh sách điểm đặt thùng rác mẫu tại HUTECH Campus
const INITIAL_BINS = [
  {
    id: "bin-h6-01",
    stationCode: "H6",
    name: "Trạm H6: Căn Tin 1 (Box #08)",
    location: "Khu vực Bàn nước Căn tin Tòa H6",
    fillPercent: 82,
    collectedCount: "2,410",
    status: "Cần gom",
    riskColor: "text-[#D94841]",
    barColor: "bg-[#D94841]",
    trend: "+14.2%",
    isPositive: true,
    qrValue: "ECOPASS-BIN-H6-01-HUTECH",
    category: "Chai PET",
    sparkWave: "M0,18 C15,4 30,14 45,6 C52,2 58,8 60,4",
  },
  {
    id: "bin-h1-03",
    stationCode: "H1",
    name: "Trạm H1: Thí Nghiệm (Box #03)",
    location: "Sảnh A2 Tòa H1, Khối Kỹ Thuật",
    fillPercent: 34,
    collectedCount: "1,150",
    status: "Ổn định",
    riskColor: "text-[#6BA101]",
    barColor: "bg-[#6BA101]",
    trend: "-0.2%",
    isPositive: false,
    qrValue: "ECOPASS-BIN-H1-03-HUTECH",
    category: "Vỏ lon nhôm",
    sparkWave: "M0,8 C15,16 30,8 45,16 C52,20 58,14 60,18",
  },
  {
    id: "bin-lib-02",
    stationCode: "LIB",
    name: "Trạm Thư Viện (Box #02)",
    location: "Sảnh chính Tầng trệt Thư viện",
    fillPercent: 58,
    collectedCount: "1,890",
    status: "Gần đầy",
    riskColor: "text-[#E68A00]",
    barColor: "bg-[#E68A00]",
    trend: "+6.78%",
    isPositive: true,
    qrValue: "ECOPASS-BIN-LIB-02-HUTECH",
    category: "Chai PET",
    sparkWave: "M0,15 C15,6 30,16 45,8 C52,4 58,10 60,6",
  },
  {
    id: "bin-cafe-05",
    stationCode: "HL",
    name: "Trạm Highlands Căn Tin (Box #05)",
    location: "Trước quầy Highlands Căn tin Khu E",
    fillPercent: 88,
    collectedCount: "3,120",
    status: "Cần gom",
    riskColor: "text-[#D94841]",
    barColor: "bg-[#D94841]",
    trend: "+22.4%",
    isPositive: true,
    qrValue: "ECOPASS-BIN-HL-05-HUTECH",
    category: "Chai PET",
    sparkWave: "M0,19 C15,6 30,12 45,4 C52,2 58,8 60,2",
  },
  {
    id: "bin-sport-04",
    stationCode: "SP",
    name: "Trạm Sân Thể Thao (Box #04)",
    location: "Cổng vào Sân bóng rổ ngoài trời",
    fillPercent: 42,
    collectedCount: "940",
    status: "Ổn định",
    riskColor: "text-[#6BA101]",
    barColor: "bg-[#6BA101]",
    trend: "+3.15%",
    isPositive: true,
    qrValue: "ECOPASS-BIN-SP-04-HUTECH",
    category: "Vỏ lon nhôm",
    sparkWave: "M0,14 C15,16 30,8 45,12 C52,14 58,8 60,6",
  },
  {
    id: "bin-dorm-06",
    stationCode: "KTX",
    name: "Trạm Ký Túc Xá (Box #06)",
    location: "Sảnh tầng 1 Ký túc xá Sinh viên",
    fillPercent: 76,
    collectedCount: "2,050",
    status: "Gần đầy",
    riskColor: "text-[#E68A00]",
    barColor: "bg-[#E68A00]",
    trend: "+9.8%",
    isPositive: true,
    qrValue: "ECOPASS-BIN-KTX-06-HUTECH",
    category: "Chai PET",
    sparkWave: "M0,16 C15,8 30,14 45,7 C52,4 58,10 60,5",
  }
];


const HEATMAP_TIMES = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

const HEATMAP_DAYS = [
  { day: "CN", full: "Chủ Nhật", vals: [1, 1, 2, 3, 2, 2, 3, 2, 1], counts: [45, 82, 190, 320, 210, 240, 310, 180, 43] },
  { day: "T2", full: "Thứ Hai", vals: [1, 2, 3, 4, 3, 3, 3, 2, 1], counts: [68, 195, 410, 720, 380, 420, 490, 230, 62] },
  { day: "T3", full: "Thứ Ba", vals: [1, 3, 4, 4, 4, 3, 4, 2, 1], counts: [75, 340, 620, 842, 590, 460, 680, 270, 71] },
  { day: "T4", full: "Thứ Tư", vals: [1, 2, 3, 4, 3, 3, 3, 2, 1], counts: [62, 210, 450, 710, 410, 390, 470, 215, 58] },
  { day: "T5", full: "Thứ Năm", vals: [1, 3, 4, 4, 3, 3, 4, 2, 1], counts: [80, 310, 580, 790, 480, 440, 620, 260, 65] },
  { day: "T6", full: "Thứ Sáu", vals: [2, 3, 4, 4, 4, 4, 3, 2, 1], counts: [110, 360, 640, 815, 630, 520, 580, 290, 82] },
  { day: "T7", full: "Thứ Bảy", vals: [1, 2, 2, 3, 3, 2, 2, 1, 1], counts: [50, 120, 230, 410, 350, 260, 280, 140, 48] },
];

const MONTH_POINTS = [
  { m: "Th1", val: "+8.20%", count: "9,820", x: 25, y: 160 },
  { m: "Th2", val: "+9.45%", count: "10,450", x: 75, y: 105 },
  { m: "Th3", val: "+11.10%", count: "11,200", x: 130, y: 120 },
  { m: "Th4", val: "+12.35%", count: "12,100", x: 185, y: 125 },
  { m: "Th5", val: "+13.80%", count: "12,850", x: 240, y: 85 },
  { m: "Th6", val: "+14.25%", count: "13,400", x: 295, y: 55 },
  { m: "Th7", val: "+13.90%", count: "13,100", x: 350, y: 75 },
  { m: "Th8", val: "+14.80%", count: "13,950", x: 405, y: 110 },
  { m: "Th9", val: "+15.60%", count: "14,320", x: 460, y: 115 },
  { m: "Th10", val: "+16.75%", count: "14,820", x: 520, y: 45 },
  { m: "Th11", val: "+15.90%", count: "14,410", x: 570, y: 70 },
  { m: "Th12", val: "+17.20%", count: "15,200", x: 618, y: 55 },
];

const WEEKLY_VOUCHER_DATA = [
  { day: "CN", fullDay: "Chủ Nhật", count: 1420, topY: 105, x: 65 },
  { day: "T2", fullDay: "Thứ Hai", count: 2150, topY: 65, x: 142 },
  { day: "T3", fullDay: "Thứ Ba", count: 2587, topY: 42, x: 220 },
  { day: "T4", fullDay: "Thứ Tư", count: 1980, topY: 75, x: 298 },
  { day: "T5", fullDay: "Thứ Năm", count: 2420, topY: 52, x: 376 },
  { day: "T6", fullDay: "Thứ Sáu", count: 2050, topY: 70, x: 454 },
  { day: "T7", fullDay: "Thứ Bảy", count: 1560, topY: 98, x: 532 },
];

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  
  // 3 Trang trên Toolbar: 0: Giám Sát, 1: Tổng Quan (MẶC ĐỊNH LÀ TAB GIỮA), 2: Khảo Sát & Voucher
  const [activeHeroTab, setActiveHeroTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#tab0' || hash === '#stations') return 0;
      if (hash === '#tab2' || hash === '#vouchers') return 2;
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === '0') return 0;
      if (params.get('tab') === '2') return 2;
    }
    return 1; // MẶC ĐỊNH LÀ TRANG Ở GIỮA
  }); 

  // Tab 0: Ma trận Heatmap tương tác (Mặc định: T3 lúc 12:00, hỗ trợ URL param ?hday=2&htime=3)
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const d = params.get('hday');
      const t = params.get('htime');
      if (d !== null || t !== null) {
        return {
          dayIndex: d !== null && !isNaN(parseInt(d)) ? Math.max(0, Math.min(6, parseInt(d))) : 2,
          timeIndex: t !== null && !isNaN(parseInt(t)) ? Math.max(0, Math.min(8, parseInt(t))) : 3
        };
      }
    }
    return { dayIndex: 2, timeIndex: 3 }; // T3 12:00
  });

  // Tab 1: Kéo thanh dọc trên sơ đồ miền 12 tháng (Mặc định: Th10 index 9, hỗ trợ URL param ?month=...)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const m = new URLSearchParams(window.location.search).get('month');
      if (m !== null && !isNaN(parseInt(m))) return Math.max(0, Math.min(11, parseInt(m)));
    }
    return 9; // Th10
  });
  const [isScrubbingWave, setIsScrubbingWave] = useState(false);
  const waveSvgRef = useRef(null);

  // Function xử lý kéo/click trên sơ đồ sóng miền Tab 1
  const handleWavePointer = (clientX) => {
    if (!waveSvgRef.current) return;
    const rect = waveSvgRef.current.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;
    const svgX = relativeX * 640;
    
    let closestIdx = 0;
    let minDiff = Infinity;
    MONTH_POINTS.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setSelectedMonthIndex(closestIdx);
  };

  // Lắng nghe sự kiện kéo chuột toàn cầu khi đang kéo thanh dọc trên Tab 1
  useEffect(() => {
    const handleGlobalMove = (e) => {
      if (!isScrubbingWave) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      handleWavePointer(clientX);
    };
    const handleGlobalUp = () => {
      if (isScrubbingWave) setIsScrubbingWave(false);
    };
    if (isScrubbingWave) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchmove', handleGlobalMove);
      window.addEventListener('touchend', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isScrubbingWave]);

  // Cột được chọn trong biểu đồ Tab 2 (Mặc định: Thứ 3 index 2, hỗ trợ URL param ?day=...)
  const [selectedDayColIndex, setSelectedDayColIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('day');
      if (p !== null && !isNaN(parseInt(p))) return Math.max(0, Math.min(6, parseInt(p)));
    }
    return 2;
  });

  const [selectedBin, setSelectedBin] = useState(null);
  const [syncToast, setSyncToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash === '#tab0' || hash === '#stations') {
        setActiveHeroTab(0);
      } else if (hash === '#tab2' || hash === '#vouchers') {
        setActiveHeroTab(2);
      } else if (hash === '#tab1' || hash === '#overview') {
        setActiveHeroTab(1);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Quản lý Route: 'welcome' (/) và 'banlamviec' (/banlamviec) với Animation mượt mà
  const initialIsBanLamViec = typeof window !== 'undefined' && 
    (window.location.pathname === '/banlamviec' || window.location.hash === '#banlamviec');

  const [currentRoute, setCurrentRoute] = useState(initialIsBanLamViec ? 'banlamviec' : 'welcome');
  const [isSlideIn, setIsSlideIn] = useState(initialIsBanLamViec);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [isWorkspaceSidebarOpen, setIsWorkspaceSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("banlamviec");

  // Trạng thái cho Sơ đồ và Bàn Làm Việc 4-Win
  const [selectedTimelineDay, setSelectedTimelineDay] = useState(4); // Mặc định: Thứ Sáu (Peak)
  const [timelineMetricView, setTimelineMetricView] = useState("revenue"); // 'revenue' hoặc 'leverage'
  const [selectedDonutSegment, setSelectedDonutSegment] = useState(0); // 0: Cửa Hàng F&B
  const [selectedPeakHour, setSelectedPeakHour] = useState(4); // 4: 12h peak
  const [selectedFunnelStep, setSelectedFunnelStep] = useState(0); // 0: Vỏ chai sạch

  // Trạng thái cho Tab Hợp Đồng
  const [contractFilter, setContractFilter] = useState("all"); // 'all', 'fb', 'sponsor'
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [contractsList, setContractsList] = useState(INITIAL_CONTRACTS);
  const [newContractForm, setNewContractForm] = useState({
    partner: '',
    category: 'fb',
    categoryLabel: 'Căn Tin & F&B',
    scope: 'Campus HUTECH Khu E',
    commitment: 'Voucher 10.000đ cho đơn từ 45.000đ',
    monthlyQuota: '600 mã/tháng',
  });

  // Trạng thái cho Tab Chiến Dịch
  const [campaignFilter, setCampaignFilter] = useState("all"); // 'all', 'active', 'paused'
  const [isNewCampaignModalOpen, setIsNewCampaignModalOpen] = useState(false);
  const [campaignsList, setCampaignsList] = useState(INITIAL_CAMPAIGNS);
  const [newCampaignForm, setNewCampaignForm] = useState({
    brand: 'Highlands Coffee',
    name: '',
    dish: '',
    condition: 'Hóa đơn từ 45.000đ',
    discount: 'Giảm 10.000đ',
    quotaTotal: 500,
  });

  // 1. Quản lý mã QR các cửa hàng (Store / Bin QR codes)
  const [storeQrsList, setStoreQrsList] = useState([
    { id: 'qr-1', qrCode: 'BIN-HL-01', storeId: 'highlands', storeName: 'Highlands Coffee', location: 'Khu B - Sảnh Căn Tin FPT', status: 'active', scanCount: 143, createdAt: '2026-09-18 08:00:00' },
    { id: 'qr-2', qrCode: 'BIN-PL-02', storeId: 'phuclong', storeName: 'Phúc Long Tea & Coffee', location: 'Khu E - Cửa Hàng Phúc Long', status: 'active', scanCount: 89, createdAt: '2026-09-18 09:30:00' },
    { id: 'qr-3', qrCode: 'BIN-TCH-03', storeId: 'tch', storeName: 'The Coffee House', location: 'Tòa Alpha - Hành Lang Tầng 1', status: 'active', scanCount: 65, createdAt: '2026-09-19 08:15:00' },
    { id: 'qr-4', qrCode: 'BIN-CHEESE-04', storeId: 'cheese', storeName: 'Cheese Coffee', location: 'Tòa Gamma - Cổng Tây', status: 'active', scanCount: 38, createdAt: '2026-09-19 14:20:00' },
  ]);
  const [isNewQrModalOpen, setIsNewQrModalOpen] = useState(false);
  const [selectedQrPrint, setSelectedQrPrint] = useState(null);
  const [newQrForm, setNewQrForm] = useState({
    qrCode: '',
    storeName: 'Highlands Coffee',
    storeId: 'highlands',
    location: '',
    status: 'active',
  });

  // 2. Quản lý tem in nhiệt từ Cửa Hàng (Order Stickers / Barcodes from :3013)
  const [partnerStoresList, setPartnerStoresList] = useState([
    { id: 'highlands', name: 'Highlands Coffee', category: 'Cà phê & Đồ uống', activeStickers: 7, totalScans: 48, portalPort: 3013, status: 'connected' },
    { id: 'phuclong', name: 'Phúc Long Tea & Coffee', category: 'Trà & Cà phê', activeStickers: 2, totalScans: 26, portalPort: 3013, status: 'connected' },
    { id: 'tch', name: 'The Coffee House', category: 'Cà phê', activeStickers: 2, totalScans: 19, portalPort: 3013, status: 'connected' },
    { id: 'cheese', name: 'Cheese Coffee', category: 'Cà phê sáng tạo', activeStickers: 1, totalScans: 12, portalPort: 3013, status: 'connected' },
  ]);
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState('all');
  const [orderStickersList, setOrderStickersList] = useState([]);
  const [isSyncingFromStore, setIsSyncingFromStore] = useState(false);
  const [selectedStickerPreview, setSelectedStickerPreview] = useState(null);
  const [isNewStickerModalOpen, setIsNewStickerModalOpen] = useState(false);
  const [newStickerForm, setNewStickerForm] = useState({
    barcode: '',
    code: '',
    storeName: 'Highlands Coffee',
    storeId: 'highlands',
    drinkName: '',
    price: 45000,
    posTerminal: 'POS 1',
  });

  // Tự động load dữ liệu từ API CSDL (:3011) khi vào trang
  const fetchPortalData = async () => {
    try {
      const resBins = await fetch('http://localhost:3011/api/ecopass/bins');
      if (resBins.ok) {
        const jsonBins = await resBins.json();
        if (jsonBins.data) setStoreQrsList(jsonBins.data);
      }
      const resStickers = await fetch('http://localhost:3011/api/ecopass/stickers');
      if (resStickers.ok) {
        const jsonStickers = await resStickers.json();
        if (jsonStickers.data) setOrderStickersList(jsonStickers.data);
        if (jsonStickers.partners) setPartnerStoresList(jsonStickers.partners);
      }
    } catch (err) {
      console.log('Real DB API not reachable, using local data:', err);
    }
  };

  useEffect(() => {
    fetchPortalData();
    const timer = setInterval(fetchPortalData, 4000);
    return () => clearInterval(timer);
  }, [activeWorkspaceTab]);

  // Đồng bộ mã vạch từ Cửa Hàng Highlands (:3013)
  const handleSyncFromStore3013 = async () => {
    setIsSyncingFromStore(true);
    try {
      const res = await fetch('http://localhost:3011/api/ecopass/sync-partner', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncToast(`✓ Đã đồng bộ thành công ${data.total} mã tem từ Cửa Hàng Highlands (:3013)!`);
        await fetchPortalData();
      } else {
        setSyncToast(`⚠️ Lỗi đồng bộ: ${data.error || 'Cửa hàng 3013 không phản hồi'}`);
      }
    } catch (err) {
      setSyncToast('⚠️ Lỗi kết nối CSDL và Cửa Hàng :3013!');
    } finally {
      setIsSyncingFromStore(false);
      setTimeout(() => setSyncToast(null), 3000);
    }
  };

  // Xóa tem mã vạch khỏi CSDL
  const handleDeleteSticker = async (barcode) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mã tem ${barcode} khỏi CSDL không?`)) return;
    try {
      const res = await fetch('http://localhost:3011/api/ecopass/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', barcode }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderStickersList(prev => prev.filter(s => s.barcode !== barcode));
        setSyncToast(`✓ Đã xóa tem ${barcode} khỏi CSDL thành công!`);
        setTimeout(() => setSyncToast(null), 2500);
      } else {
        alert(data.message || "Không thể xóa tem!");
      }
    } catch (err) {
      setOrderStickersList(prev => prev.filter(s => s.barcode !== barcode));
      setSyncToast(`✓ Đã xóa tem ${barcode}!`);
      setTimeout(() => setSyncToast(null), 2500);
    }
  };

  // Đặt lại (Reset) trạng thái tem đã đốt về trạng thái sẵn sàng để quét lại
  const handleResetSticker = async (barcode) => {
    try {
      const res = await fetch('http://localhost:3011/api/ecopass/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', barcode }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderStickersList(prev => prev.map(s => s.barcode === barcode ? { ...s, status: 'active', usedAt: null } : s));
        setSyncToast(`✓ Đã khôi phục tem ${barcode} về trạng thái sẵn sàng quét!`);
        setTimeout(() => setSyncToast(null), 2500);
      } else {
        alert(data.message || "Không thể khôi phục tem!");
      }
    } catch (err) {
      setOrderStickersList(prev => prev.map(s => s.barcode === barcode ? { ...s, status: 'active', usedAt: null } : s));
      setSyncToast(`✓ Đã khôi phục tem ${barcode}!`);
      setTimeout(() => setSyncToast(null), 2500);
    }
  };

  // Thêm QR Cửa Hàng mới vào CSDL
  const handleCreateStoreQr = async (e) => {
    e.preventDefault();
    if (!newQrForm.qrCode.trim() || !newQrForm.location.trim()) {
      alert("Vui lòng nhập đầy đủ mã QR và vị trí!");
      return;
    }
    try {
      const res = await fetch('http://localhost:3011/api/ecopass/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQrForm),
      });
      const data = await res.json();
      if (data.success) {
        setStoreQrsList(prev => [data.data, ...prev]);
        setIsNewQrModalOpen(false);
        setNewQrForm({ qrCode: '', storeName: 'Highlands Coffee', storeId: 'highlands', location: '', status: 'active' });
        setSyncToast(`✓ Đã tạo mã QR thùng rác ${data.data.qrCode} thành công!`);
        setTimeout(() => setSyncToast(null), 3000);
      }
    } catch (err) {
      alert("Lỗi khi thêm mã QR vào CSDL!");
    }
  };

  // Thêm Tem Barcode mới vào CSDL
  const handleCreateSticker = async (e) => {
    e.preventDefault();
    if (!newStickerForm.barcode.trim() || !newStickerForm.drinkName.trim()) {
      alert("Vui lòng nhập đầy đủ mã vạch Barcode và tên món!");
      return;
    }
    try {
      const res = await fetch('http://localhost:3011/api/ecopass/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStickerForm),
      });
      const data = await res.json();
      if (data.success) {
        setOrderStickersList(prev => [data.data, ...prev]);
        setIsNewStickerModalOpen(false);
        setNewStickerForm({ barcode: '', code: '', storeName: 'Highlands Coffee', storeId: 'highlands', drinkName: '', price: 45000, posTerminal: 'POS 1' });
        setSyncToast(`✓ Đã thêm tem mã vạch ${data.data.barcode} thành công!`);
        setTimeout(() => setSyncToast(null), 3000);
      }
    } catch (err) {
      alert("Lỗi khi thêm tem vào CSDL!");
    }
  };

  // Trạng thái cho Tab Cài Đặt
  const [settingsData, setSettingsData] = useState({
    pointsPerBottle: 10,
    maxScansPerDay: 5,
    minBillAmount: 45000,
    voucherExpiryHours: 24,
    autoSettlement: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Toggle bật/tắt chiến dịch
  const toggleCampaignStatus = (id) => {
    setCampaignsList(prev => prev.map(c => {
      if (c.id === id) {
        const nextStatus = c.status === 'active' ? 'paused' : 'active';
        setSyncToast(nextStatus === 'active' ? `Đã kích hoạt lại ${c.name}` : `Đã tạm dừng ${c.name}`);
        setTimeout(() => setSyncToast(null), 2500);
        return { ...c, status: nextStatus };
      }
      return c;
    }));
  };

  // Tạo chiến dịch mới
  const handleCreateCampaign = (e) => {
    e.preventDefault();
    if (!newCampaignForm.name.trim() || !newCampaignForm.dish.trim()) {
      alert("Vui lòng nhập đầy đủ tên chiến dịch và món cần kích cầu!");
      return;
    }
    const newCamp = {
      id: `CMP-${Date.now().toString().slice(-4)}`,
      brand: newCampaignForm.brand,
      name: newCampaignForm.name.trim(),
      dish: newCampaignForm.dish.trim(),
      condition: newCampaignForm.condition,
      discount: newCampaignForm.discount,
      quotaTotal: Number(newCampaignForm.quotaTotal) || 500,
      quotaUsed: 0,
      revenue: "0 Tr",
      roi: "Đang tính",
      status: "active",
      category: "F&B"
    };
    setCampaignsList(prev => [newCamp, ...prev]);
    setIsNewCampaignModalOpen(false);
    setNewCampaignForm({
      brand: 'Highlands Coffee',
      name: '',
      dish: '',
      condition: 'Hóa đơn từ 45.000đ',
      discount: 'Giảm 10.000đ',
      quotaTotal: 500,
    });
    setSyncToast("Đã kích hoạt chiến dịch bẫy mua mới thành công");
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Tạo hợp đồng mới
  const handleCreateContract = (e) => {
    e.preventDefault();
    if (!newContractForm.partner.trim()) {
      alert("Vui lòng nhập tên đối tác ký kết!");
      return;
    }
    const newCtr = {
      id: `CTR-${Date.now().toString().slice(-4)}`,
      partner: newContractForm.partner.trim(),
      category: newContractForm.category,
      categoryLabel: newContractForm.category === 'fb' ? 'Căn Tin & F&B' : 'Tài Trợ Dịch Vụ',
      scope: newContractForm.scope.trim() || 'Campus Khu E',
      commitment: newContractForm.commitment.trim() || 'Chấp nhận voucher EcoPass',
      monthlyQuota: newContractForm.monthlyQuota.trim() || '500 mã/tháng',
      redemptionRate: "0%",
      totalSettled: "0 Tr",
      status: "active",
      expiry: "12/2026",
      posIntegrated: true,
    };
    setContractsList(prev => [newCtr, ...prev]);
    setIsNewContractModalOpen(false);
    setNewContractForm({
      partner: '',
      category: 'fb',
      categoryLabel: 'Căn Tin & F&B',
      scope: 'Campus HUTECH Khu E',
      commitment: 'Voucher 10.000đ cho đơn từ 45.000đ',
      monthlyQuota: '600 mã/tháng',
    });
    setSyncToast("Đã lưu hợp đồng đối tác mới vào sàn đối soát");
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Lưu cấu hình cài đặt
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setTimeout(() => {
      setIsSavingSettings(false);
      setSyncToast("Đã lưu cấu hình vận hành Trụ sở HQ thành công");
      setTimeout(() => setSyncToast(null), 3000);
    }, 450);
  };

  const navigateTo = (route) => {
    if (isTransitioning) return;

    if (route === 'banlamviec') {
      setIsTransitioning(true);
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', '/banlamviec');
      }
      requestAnimationFrame(() => {
        setTimeout(() => {
          setIsSlideIn(true);
          setCurrentRoute('banlamviec');
          setTimeout(() => {
            setIsTransitioning(false);
          }, 720);
        }, 30);
      });
    } else {
      setIsTransitioning(true);
      setIsSlideIn(false);
      setCurrentRoute('welcome');
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', '/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => {
        setIsTransitioning(false);
      }, 720);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const isBLV = window.location.pathname === '/banlamviec' || window.location.hash === '#banlamviec';
      if (isBLV && !isSlideIn) {
        navigateTo('banlamviec');
      } else if (!isBLV && isSlideIn) {
        navigateTo('welcome');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSlideIn, isTransitioning]);

  // Phím tắt bàn phím (Esc để quay về khi ở bàn làm việc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSlideIn && !isTransitioning) {
        navigateTo('welcome');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSlideIn, isTransitioning]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0E1116] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full bg-[#6BA101] flex items-center justify-center shadow-xl animate-pulse">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping" />
        </div>
        <h2 className="text-xl font-black text-white tracking-tight mb-1">
          EcoPass Operations Hub
        </h2>
        <p className="text-xs font-bold text-neutral-400">
          Khởi tạo trung tâm điều phối và tiếp nhận dữ liệu...
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0E1116] text-[#FAF8F2] p-2.5 sm:p-4 selection:bg-[#34D399]/30 selection:text-emerald-300 flex flex-col justify-between">
      
      {/* Ambient biophilic aura glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(52,211,153,0.06),transparent_70%)] z-0" />

      {/* Background Topographic Contour Lines */}
      <div className="fixed inset-0 pointer-events-none opacity-15 overflow-hidden z-0">
        <svg className="w-full h-full" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M-100 200 C300 150, 600 450, 1100 250 C1300 170, 1500 300, 1600 350" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" strokeDasharray="4 6" />
          <path d="M-50 450 C350 350, 750 650, 1250 420 C1450 320, 1550 500, 1650 550" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" />
          <path d="M-80 750 C280 620, 800 880, 1300 680 C1480 600, 1580 780, 1680 820" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" strokeDasharray="6 8" />
        </svg>
      </div>

      {/* Toast đồng bộ */}
      {syncToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1A1D1A] text-white px-5 py-3 rounded-full shadow-2xl border border-white/20 flex items-center gap-3 text-xs font-bold transition-all animate-bounce">
          <CheckCircle2 size={16} className="text-[#6BA101]" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: TRANG ĐÓN TIẾP / TỔNG QUAN (WELCOME & OPERATIONS HUB)
          KHÓA TRỌN 1 MÀN HÌNH CHUẨN (H-SCREEN OVERFLOW-HIDDEN) - HOÀN TOÀN KHÔNG THANH TRƯỢT
      ========================================================================= */}
      <div 
        className={`h-full w-full flex-1 flex flex-col min-h-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
          isSlideIn
            ? 'scale-[0.95] opacity-20 -translate-y-4 pointer-events-none'
            : 'scale-100 opacity-100 translate-y-0'
        } ${isSlideIn && !isTransitioning ? 'hidden' : 'relative flex'}`}
      >
        <div className="relative z-10 max-w-[1360px] w-full mx-auto h-full flex flex-col justify-between pb-8 min-h-0">
        
        {/* =========================================================================
            CARD 1 (TRÊN): HERO SECTION BIOPHILIC & 3 TRANG NỘI DUNG LINH HOẠT
            - Khớp trọn vẹn 1 khung hình, không còn thanh cuộn ngoài
        ========================================================================= */}
        <div 
          className="relative rounded-[28px] sm:rounded-[36px] overflow-hidden bg-cover bg-right sm:bg-center px-5 sm:px-8 pt-4 pb-4 sm:pt-5 sm:pb-5 shadow-[0_25px_65px_-12px_rgba(30,35,25,0.28)] border border-black/[0.05] flex-1 flex flex-col justify-between min-h-0"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(140,132,122,0.38), rgba(42,55,20,0.56)), url('/hero-bg.jpg')`
          }}
        >
          {/* Studio Shadow Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-stone-900/15 to-transparent pointer-events-none" />

          {/* 1. THANH ĐIỀU HƯỚNG DẠNG VIÊN THUỐC 3 TRANG (MẶC ĐỊNH LÀ TRANG Ở GIỮA) */}
          <nav className="relative z-10 flex items-center justify-between gap-4 mb-4 sm:mb-6">
            {/* Logo EcoPass */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#557A2B] shadow-md flex items-center justify-center text-white font-black">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <span className="text-white font-black tracking-tight text-base block leading-none">
                  EcoPass Hub
                </span>
                <span className="text-[10px] text-white/70 font-semibold tracking-wider uppercase mt-0.5 block">
                  Operations Center
                </span>
              </div>
            </div>

            {/* Menu Capsule 3 Trang: Mặc định là Trang ở giữa (Index 1) */}
            <div className="flex items-center gap-1 p-1 bg-white/18 backdrop-blur-xl border border-white/30 rounded-full shadow-lg">
              <button 
                onClick={() => {
                  setActiveHeroTab(0);
                  if (typeof window !== 'undefined') window.history.replaceState(null, '', '#tab0');
                }}
                className={`px-3.5 sm:px-5 py-2 rounded-full text-xs font-black transition-all ${
                  activeHeroTab === 0
                    ? 'bg-white text-[#1A1D1A] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                Giám Sát Trạm Rác
              </button>
              <button 
                onClick={() => {
                  setActiveHeroTab(1);
                  if (typeof window !== 'undefined') window.history.replaceState(null, '', '#tab1');
                }}
                className={`px-3.5 sm:px-5 py-2 rounded-full text-xs font-black transition-all ${
                  activeHeroTab === 1
                    ? 'bg-white text-[#1A1D1A] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                Tổng Quan Điều Hành
              </button>
              <button 
                onClick={() => {
                  setActiveHeroTab(2);
                  if (typeof window !== 'undefined') window.history.replaceState(null, '', '#tab2');
                }}
                className={`px-3.5 sm:px-5 py-2 rounded-full text-xs font-black transition-all ${
                  activeHeroTab === 2
                    ? 'bg-white text-[#1A1D1A] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                Khảo Sát & Voucher
              </button>
            </div>

            {/* Quick Actions bên phải */}
            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-10 h-10 rounded-full bg-white/18 hover:bg-white/30 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center transition shadow-sm"
                title="Tìm kiếm"
              >
                <Search size={16} />
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="w-10 h-10 rounded-full bg-white/18 hover:bg-white/30 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center transition shadow-sm"
                title="Cài đặt"
              >
                <Settings size={16} />
              </button>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/70 shadow-sm bg-white flex items-center justify-center">
                <svg className="w-6 h-6 text-[#1A1D1A]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z" />
                </svg>
              </div>
            </div>
          </nav>

          {/* 2. KHU VỰC CHÍNH (TIÊU ĐỀ & 3 CỤM NỘI DUNG SƠ ĐỒ ĐỈNH CAO) */}
          <div className="relative z-10 flex-1 flex flex-col justify-center my-3 sm:my-5">
            {/* Eyebrow Badge & H1 Tiêu đề */}
            <div className="mb-3 sm:mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-sm mb-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                <span>HUTECH Campus • 19/09/2026</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                EcoPass Hub
              </h1>
            </div>

            {/* =====================================================================
                TAB 1 (THỨ TỰ 2 - MẶC ĐỊNH Ở GIỮA): DẠNG MIỀN (SPLINE AREA CHART)
            ===================================================================== */}
            {activeHeroTab === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch animate-fade-in-up">
                
                {/* SƠ ĐỒ 2: BIỂU ĐỒ MIỀN SPLINE XANH LÁ (ECO RETURN TREND) */}
                <div className="lg:col-span-7 bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[28px] p-5 sm:p-6 shadow-glass-edge flex flex-col justify-between">
                  <div>
                    {/* Header thông số dạng miền */}
                    <div className="flex items-center justify-between text-white mb-3">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-[#FAF8F2] tracking-tight">
                          Xu Hướng Thu Hồi Sinh Thái
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          {MONTH_POINTS[selectedMonthIndex]?.val || "+16.75%"}
                        </span>
                      </div>
                    </div>

                    {/* Biểu đồ miền vector thuần SVG - Hỗ trợ kéo lướt thanh dọc */}
                    <div className="relative w-full aspect-[640/220] my-2 select-none">
                      <svg 
                        ref={waveSvgRef}
                        viewBox="0 0 640 220" 
                        className="w-full h-full overflow-visible cursor-ew-resize touch-none"
                        onMouseDown={(e) => {
                          setIsScrubbingWave(true);
                          handleWavePointer(e.clientX);
                        }}
                        onMouseMove={(e) => {
                          if (isScrubbingWave) handleWavePointer(e.clientX);
                        }}
                        onTouchStart={(e) => {
                          setIsScrubbingWave(true);
                          handleWavePointer(e.touches[0].clientX);
                        }}
                        onTouchMove={(e) => {
                          if (isScrubbingWave) handleWavePointer(e.touches[0].clientX);
                        }}
                      >
                        <defs>
                          {/* Gradient miền xanh lá */}
                          <linearGradient id="areaGreenGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34D399" stopOpacity="0.45" />
                            <stop offset="65%" stopColor="#10B981" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                          </linearGradient>

                          {/* Glow filter */}
                          <filter id="areaLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Lưới ngang mờ */}
                        <g stroke="#ffffff" strokeOpacity="0.08" strokeDasharray="3 5">
                          <line x1="20" y1="40" x2="620" y2="40" />
                          <line x1="20" y1="85" x2="620" y2="85" />
                          <line x1="20" y1="130" x2="620" y2="130" />
                          <line x1="20" y1="175" x2="620" y2="175" />
                        </g>

                        {/* Miền xanh lá lượn sóng (Area Fill) */}
                        <path
                          d="M 25,160 
                             C 45,150 60,110 80,105 
                             C 100,100 115,140 135,120 
                             C 155,100 170,145 190,125 
                             C 210,105 225,65 245,85 
                             C 265,105 280,75 300,55 
                             C 320,35 335,85 355,75 
                             C 375,65 390,120 410,110 
                             C 430,100 445,130 465,115 
                             C 485,100 500,65 520,45 
                             C 540,65 555,50 575,70 
                             C 595,90 610,60 620,55 
                             L 620,185 L 25,185 Z"
                          fill="url(#areaGreenGrad)"
                        />

                        {/* Đường Stroke Xanh Lá Phát Quang (Spline Line) */}
                        <path
                          d="M 25,160 
                             C 45,150 60,110 80,105 
                             C 100,100 115,140 135,120 
                             C 155,100 170,145 190,125 
                             C 210,105 225,65 245,85 
                             C 265,105 280,75 300,55 
                             C 320,35 335,85 355,75 
                             C 375,65 390,120 410,110 
                             C 430,100 445,130 465,115 
                             C 485,100 500,65 520,45 
                             C 540,65 555,50 575,70 
                             C 595,90 610,60 620,55"
                          fill="none"
                          stroke="#34D399"
                          strokeWidth="3"
                          filter="url(#areaLineGlow)"
                        />

                        {/* Cursor đường đứt nét có thể kéo theo 12 tháng */}
                        <line 
                          x1={MONTH_POINTS[selectedMonthIndex].x} 
                          y1={MONTH_POINTS[selectedMonthIndex].y} 
                          x2={MONTH_POINTS[selectedMonthIndex].x} 
                          y2="185" 
                          stroke="#34D399" 
                          strokeWidth="2" 
                          strokeDasharray="3 3"
                          className="transition-all duration-75"
                        />

                        {/* Chấm tròn đỉnh tháng đang chọn */}
                        <circle 
                          cx={MONTH_POINTS[selectedMonthIndex].x} 
                          cy={MONTH_POINTS[selectedMonthIndex].y} 
                          r="6" 
                          fill="#34D399" 
                          stroke="#FFFFFF" 
                          strokeWidth="2.5" 
                          className="transition-all duration-75 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                        />

                        {/* Tooltip Card nổi với nền trong suốt thống nhất, di chuyển theo vị trí kéo */}
                        <g 
                          transform={`translate(${Math.max(76, Math.min(564, MONTH_POINTS[selectedMonthIndex].x))}, ${Math.max(16, MONTH_POINTS[selectedMonthIndex].y - 28)})`}
                          className="transition-all duration-75 pointer-events-none"
                        >
                          <rect x="-68" y="-13" width="136" height="26" rx="13" fill="rgba(255,255,255,0.18)" stroke="#34D399" strokeWidth="1.5" />
                          <circle cx="-50" cy="0" r="3" fill="#34D399" />
                          <text x="-40" y="3.5" fill="#FAF8F2" fontSize="10.5" fontWeight="bold" fontFamily="monospace">
                            {MONTH_POINTS[selectedMonthIndex].val} Thu hồi
                          </text>
                        </g>

                        {/* Trục hoành 12 tháng (Việt hóa) - có thể bấm chọn trực tiếp */}
                        <g fill="#FAF8F2" fillOpacity="0.75" fontSize="10" fontFamily="sans-serif">
                          {MONTH_POINTS.map((pt, idx) => {
                            const isMonthSelected = selectedMonthIndex === idx;
                            return (
                              <text
                                key={idx}
                                x={pt.x}
                                y="202"
                                textAnchor="middle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMonthIndex(idx);
                                }}
                                className="cursor-pointer hover:opacity-100 transition-colors"
                                fill={isMonthSelected ? "#34D399" : "#FAF8F2"}
                                fillOpacity={isMonthSelected ? 1 : 0.75}
                                fontWeight={isMonthSelected ? "bold" : "normal"}
                              >
                                {pt.m}
                              </text>
                            );
                          })}
                        </g>
                      </svg>
                    </div>
                  </div>

                  {/* Chú thích phía dưới biểu đồ miền */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/15 text-[11px] font-bold text-white px-1 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                      <span className="text-[#FAF8F2]">
                        Đang xem: {MONTH_POINTS[selectedMonthIndex].m} ({MONTH_POINTS[selectedMonthIndex].count} lượt)
                      </span>
                    </div>
                    <span className="text-emerald-300 font-mono">Kéo thanh dọc để xem các tháng</span>
                  </div>
                </div>

                {/* CỤM PHẢI TAB 1 */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    
                    {/* Thẻ 1: Lượt Quét */}
                    <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge">
                      <div className="flex items-center justify-between text-white/80 text-xs font-bold">
                        <span>Lượt Quét</span>
                        <ArrowUpRight size={14} className="text-[#34D399]" />
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-white tracking-tight my-1 tabular-nums">
                        14,820
                      </div>
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black border border-emerald-500/30">
                        <span>+12.4% tuần này</span>
                      </div>
                    </div>

                    {/* Thẻ 2: Tỷ Lệ Đổi */}
                    <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge">
                      <div className="flex items-center justify-between text-white/80 text-xs font-bold">
                        <span>Đổi Voucher</span>
                        <Sparkles size={14} className="text-[#34D399]" />
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-white tracking-tight my-1 tabular-nums">
                        68.4%
                      </div>
                      <div className="text-xs font-black text-[#34D399]">
                        Hiệu Quả Cao
                      </div>
                    </div>
                  </div>

                  {/* Thẻ 3: Top Đối Tác */}
                  <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white text-xs font-black mb-2.5">
                      <span className="tracking-wide">Top Đối Tác</span>
                      <ArrowUpRight size={14} className="text-white/60" />
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { name: 'Highlands Coffee', tag: 'Căn Tin Khu E (Món Phindi)', val: '5,240 lượt', bg: 'bg-[#6BA101]' },
                        { name: 'TCP Group (Warrior)', tag: 'Tài Trợ Voucher Lon Tím', val: '4,180 lượt', bg: 'bg-[#3A5A42]' },
                        { name: 'Suntory PepsiCo', tag: 'Chiến dịch Chai Tea+ Oolong', val: '3,210 lượt', bg: 'bg-[#1A1D1A]' },
                      ].map((partner, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-white font-medium p-1.5 rounded-xl bg-white/[0.05] border border-white/[0.06]">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full ${partner.bg} flex items-center justify-center text-[11px] font-black text-white shadow-sm border border-white/20`}>
                              {partner.name[0]}
                            </div>
                            <div>
                              <div className="font-bold leading-tight text-[#FAF8F2]">{partner.name}</div>
                              <div className="text-[10px] text-white/70">{partner.tag}</div>
                            </div>
                          </div>
                          <div className="font-black tabular-nums text-emerald-300 font-mono">{partner.val}</div>
                        </div>
                      ))}
                      </div>
                    </div>

                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 0 (THỨ TỰ 1): DẠNG GITHUB (HEATMAP MA TRẬN HOẠT ĐỘNG 7 NGÀY & KHUNG GIỜ)
            ===================================================================== */}
            {activeHeroTab === 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch animate-fade-in-up">
                
                {/* SƠ ĐỒ 1: MA TRẬN GITHUB HEATMAP GRID THEO MẪU ẢNH 2 */}
                <div className="lg:col-span-7 bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[28px] p-5 sm:p-6 shadow-glass-edge flex flex-col justify-between">
                  <div>
                    {/* Header Ma trận GitHub */}
                    <div className="flex items-center justify-between text-white mb-3">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-[#FAF8F2] tracking-tight">
                          Mật Độ Quét Theo Giờ
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          14,820 lượt/tuần
                        </span>
                      </div>
                    </div>

                    {/* SVG Ma trận Heatmap phong cách GitHub - Tương tác bấm từng ô, từng cột */}
                    <div className="relative w-full aspect-[640/220] my-2">
                      <svg viewBox="0 0 640 256" className="w-full h-full overflow-visible">
                        <defs>
                          <filter id="tileGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Floating Tooltip tại ô / cột đang chọn (nền trong suốt thống nhất, rộng thoáng, không che nhãn giờ) */}
                        <g 
                          transform={`translate(${Math.max(76, Math.min(564, 84 + selectedHeatmapCell.timeIndex * 60))}, 2)`}
                          className="transition-all duration-200 pointer-events-none"
                        >
                          <rect x="-72" y="-12" width="144" height="24" rx="12" fill="rgba(255,255,255,0.18)" stroke="#34D399" strokeWidth="1.5" />
                          <circle cx="-54" cy="0" r="3" fill="#34D399" />
                          <text x="-44" y="3.5" fill="#FAF8F2" fontSize="10.5" fontWeight="700" fontFamily="sans-serif">
                            {HEATMAP_DAYS[selectedHeatmapCell.dayIndex]?.day || "T3"} {HEATMAP_TIMES[selectedHeatmapCell.timeIndex] || "12:00"} • {HEATMAP_DAYS[selectedHeatmapCell.dayIndex]?.counts[selectedHeatmapCell.timeIndex] || 842} lượt
                          </text>
                        </g>

                        {/* Nhãn khung giờ căn giữa từng cột (Columns: 06:00 -> 22:00) - Bấm để chọn cột */}
                        <g fontSize="10" fontFamily="sans-serif" textAnchor="middle">
                          {HEATMAP_TIMES.map((time, cIdx) => {
                            const isColSelected = selectedHeatmapCell.timeIndex === cIdx;
                            return (
                              <text
                                key={cIdx}
                                x={84 + cIdx * 60}
                                y="28"
                                onClick={() => setSelectedHeatmapCell(prev => ({ ...prev, timeIndex: cIdx }))}
                                className="cursor-pointer hover:opacity-100 transition-colors font-mono"
                                fill={isColSelected ? "#34D399" : "#FAF8F2"}
                                fillOpacity={isColSelected ? 1 : 0.75}
                                fontWeight={isColSelected ? "bold" : "normal"}
                              >
                                {time}
                              </text>
                            );
                          })}
                        </g>

                        {/* Vạch kẻ chỉ báo cột được chọn - Di chuyển mượt mà */}
                        <rect 
                          x={60 + selectedHeatmapCell.timeIndex * 60} 
                          y="36" 
                          width="48" 
                          height="154" 
                          rx="6" 
                          fill="rgba(52,211,153,0.08)" 
                          stroke="rgba(52,211,153,0.3)" 
                          strokeDasharray="3 3" 
                          className="transition-all duration-200 pointer-events-none"
                        />

                        {/* Ma trận 7 hàng (CN -> T7) x 9 cột - Bấm vào từng ô hoặc hàng */}
                        {HEATMAP_DAYS.map((row, rIdx) => {
                          const y = 40 + rIdx * 21;
                          const fillMap = {
                            1: "rgba(255,255,255,0.08)",
                            2: "rgba(16,185,129,0.30)",
                            3: "rgba(16,185,129,0.65)",
                            4: "#34D399",
                          };
                          const isRowSelected = selectedHeatmapCell.dayIndex === rIdx;
                          return (
                            <g key={rIdx}>
                              {/* Tên thứ bên trái - Bấm chọn hàng */}
                              <text 
                                x="45" 
                                y={y + 12} 
                                textAnchor="end" 
                                fill={isRowSelected ? "#34D399" : "#FAF8F2"} 
                                fillOpacity={isRowSelected ? 1 : 0.8} 
                                fontSize="10" 
                                fontFamily="sans-serif" 
                                fontWeight="bold"
                                className="cursor-pointer select-none hover:opacity-100 transition-colors"
                                onClick={() => setSelectedHeatmapCell(prev => ({ ...prev, dayIndex: rIdx }))}
                              >
                                {row.day}
                              </text>
                              
                              {/* 9 Ô nhiệt độ trong hàng - Bấm chọn từng ô */}
                              {row.vals.map((v, cIdx) => {
                                const x = 60 + cIdx * 60;
                                const isCurrentCell = selectedHeatmapCell.dayIndex === rIdx && selectedHeatmapCell.timeIndex === cIdx;
                                return (
                                  <rect
                                    key={cIdx}
                                    x={x}
                                    y={y}
                                    width="48"
                                    height="16"
                                    rx="4"
                                    fill={fillMap[v]}
                                    stroke={isCurrentCell ? "#FFFFFF" : "rgba(255,255,255,0.12)"}
                                    strokeWidth={isCurrentCell ? "2" : "1"}
                                    filter={isCurrentCell || v === 4 ? "url(#tileGlow)" : undefined}
                                    className="cursor-pointer hover:opacity-80 transition-all"
                                    onClick={() => setSelectedHeatmapCell({ dayIndex: rIdx, timeIndex: cIdx })}
                                  />
                                );
                              })}
                            </g>
                          );
                        })}

                        {/* Scale chú thích ở đáy */}
                        <g transform="translate(60, 206)">
                          <text x="0" y="12" fill="#FAF8F2" fillOpacity="0.7" fontSize="10" fontFamily="sans-serif">Ít</text>
                          <rect x="25" y="2" width="14" height="12" rx="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.1)" />
                          <rect x="44" y="2" width="14" height="12" rx="3" fill="rgba(16,185,129,0.30)" />
                          <rect x="63" y="2" width="14" height="12" rx="3" fill="rgba(16,185,129,0.65)" />
                          <rect x="82" y="2" width="14" height="12" rx="3" fill="#34D399" />
                          <text x="105" y="12" fill="#FAF8F2" fillOpacity="0.7" fontSize="10" fontFamily="sans-serif">Nhiều (50 - 850 lượt/h)</text>
                        </g>
                      </svg>
                    </div>
                  </div>

                  {/* Chú thích đáy */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/15 text-[11px] font-bold text-white px-1 mt-2">
                    <span className="text-[#34D399] font-mono">
                      Đang chọn: {HEATMAP_DAYS[selectedHeatmapCell.dayIndex]?.full || "Thứ Ba"} {HEATMAP_TIMES[selectedHeatmapCell.timeIndex] || "12:00"} ({HEATMAP_DAYS[selectedHeatmapCell.dayIndex]?.counts[selectedHeatmapCell.timeIndex] || 842} lượt)
                    </span>
                    <span className="text-white/80">6/6 trạm ổn định</span>
                  </div>
                </div>

                {/* CỤM PHẢI TAB 0 */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge">
                      <div className="flex items-center justify-between text-white/80 text-xs font-bold">
                        <span>Giờ Cao Điểm</span>
                        <Activity size={14} className="text-[#34D399]" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight my-1 tabular-nums">
                        11h - 13h
                      </div>
                      <div className="text-[11px] font-bold text-emerald-300">
                        Căn tin H6 & Highlands
                      </div>
                    </div>

                    <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge">
                      <div className="flex items-center justify-between text-white/80 text-xs font-bold">
                        <span>Lưu Lượng TB</span>
                        <Zap size={14} className="text-[#34D399]" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight my-1 tabular-nums">
                        310 lượt
                      </div>
                      <div className="text-xs font-bold text-[#EBF7DC]">
                        Mỗi giờ cao điểm
                      </div>
                    </div>
                  </div>

                  {/* Card Trạng Thái Cân Bằng Tải & AI (Bỏ chữ Điều Phối Thu Gom) */}
                  <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-white text-xs font-black mb-2">
                        <span className="tracking-wide">Phân Loại Đúng</span>
                        <span className="font-mono text-emerald-300 font-bold">92.4%</span>
                      </div>
                      <div className="text-xs text-white/80 mt-1">
                        Camera AI hướng dẫn phân loại tự động tại trạm
                      </div>
                    </div>
                    <div className="pt-3 flex items-center justify-between border-t border-white/15 mt-3 text-xs text-white/80">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                        <span className="font-bold text-[#FAF8F2]">Tự động cân bằng tải</span>
                      </div>
                      <span className="font-mono text-emerald-300 text-[11px] font-bold">Hoạt động ổn định</span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 2 (THỨ TỰ 3): DẠNG CỘT PIN LOLLIPOP (TẦN SUẤT ĐỔI VOUCHER THEO NGÀY)
            ===================================================================== */}
            {activeHeroTab === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch animate-fade-in-up">
                
                {/* SƠ ĐỒ 3: BIỂU ĐỒ CỘT PIN LOLLIPOP 7 NGÀY - TƯƠNG TÁC BẤM CHỌN TỪNG CỘT */}
                <div className="lg:col-span-7 bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[28px] p-5 sm:p-6 shadow-glass-edge flex flex-col justify-between">
                  <div>
                    {/* Header thông số cột pin */}
                    <div className="flex items-center justify-between text-white mb-3">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-[#FAF8F2] tracking-tight">
                          Tần Suất Đổi Voucher
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-emerald-300 bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/30 font-bold">
                        TB: 2.8s
                      </span>
                    </div>

                    {/* Biểu đồ cột dạng Pin / Lollipop tương tác */}
                    <div className="relative w-full aspect-[640/220] my-2">
                      <svg viewBox="0 0 640 230" className="w-full h-full overflow-visible">
                        {/* Lưới ngang mờ */}
                        <g stroke="#ffffff" strokeOpacity="0.08" strokeDasharray="3 5">
                          <line x1="30" y1="40" x2="610" y2="40" />
                          <line x1="30" y1="85" x2="610" y2="85" />
                          <line x1="30" y1="130" x2="610" y2="130" />
                        </g>

                        {/* Capsule động bao quanh cột đang được bấm chọn - Thay đổi chiều cao linh hoạt theo từng cột */}
                        {(() => {
                          const activeCol = WEEKLY_VOUCHER_DATA[selectedDayColIndex] || WEEKLY_VOUCHER_DATA[2];
                          const capsuleY = activeCol.topY - 10;
                          const capsuleHeight = 206 - capsuleY;
                          return (
                            <rect
                              x={activeCol.x - 33}
                              y={capsuleY}
                              width="66"
                              height={capsuleHeight}
                              rx="28"
                              fill="rgba(255,255,255,0.14)"
                              stroke="rgba(255,255,255,0.32)"
                              strokeWidth="1.5"
                              className="transition-all duration-300 ease-out pointer-events-none"
                            />
                          );
                        })()}

                        {/* Tooltip Badge động nằm hoàn toàn TRÊN ĐỈNH capsule, không đè lên card */}
                        {(() => {
                          const activeCol = WEEKLY_VOUCHER_DATA[selectedDayColIndex] || WEEKLY_VOUCHER_DATA[2];
                          const badgeY = activeCol.topY - 28;
                          return (
                            <g 
                              transform={`translate(${activeCol.x}, ${badgeY})`}
                              className="transition-all duration-300 ease-out pointer-events-none"
                            >
                              <rect x="-35" y="-11" width="70" height="22" rx="11" fill="rgba(255,255,255,0.22)" stroke="#34D399" strokeWidth="1.5" />
                              <text x="0" y="3.5" fill="#34D399" fontSize="11" fontWeight="900" fontFamily="monospace" textAnchor="middle">
                                {activeCol.count.toLocaleString()}
                              </text>
                            </g>
                          );
                        })()}

                        {/* 7 Cột Lollipop có thể bấm chọn (CN, T2, T3, T4, T5, T6, T7) */}
                        {WEEKLY_VOUCHER_DATA.map((col, idx) => {
                          const isSelected = selectedDayColIndex === idx;
                          return (
                            <g 
                              key={idx}
                              onClick={() => setSelectedDayColIndex(idx)}
                              className="cursor-pointer group select-none"
                            >
                              {/* Vùng bấm vô hình (Click Area) phủ rộng */}
                              <rect x={col.x - 33} y="15" width="66" height="195" fill="transparent" />

                              {/* Thân cọc mảnh (Stem Pin) */}
                              <line
                                x1={col.x}
                                y1={col.topY}
                                x2={col.x}
                                y2="168"
                                stroke={isSelected ? "#34D399" : "rgba(255,255,255,0.3)"}
                                strokeWidth={isSelected ? "2.5" : "1.8"}
                                className="transition-colors duration-200"
                              />

                              {/* Chấm tròn trên đỉnh (Head Dot) */}
                              <circle
                                cx={col.x}
                                cy={col.topY}
                                r={isSelected ? "6" : "4.5"}
                                fill={isSelected ? "#34D399" : "#6EE7B7"}
                                stroke={isSelected ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
                                strokeWidth={isSelected ? "2.5" : "1.5"}
                                className="transition-all duration-200"
                              />

                              {/* Vòng tròn nhãn thứ ở chân cọc */}
                              <circle
                                cx={col.x}
                                cy="185"
                                r="15"
                                fill={isSelected ? "#34D399" : "rgba(255,255,255,0.12)"}
                                stroke={isSelected ? "#FFFFFF" : "rgba(255,255,255,0.2)"}
                                strokeWidth="1"
                                className="transition-all duration-200"
                              />
                              <text
                                x={col.x}
                                y="189"
                                textAnchor="middle"
                                fill={isSelected ? "#080C09" : "#FAF8F2"}
                                fontSize="11"
                                fontWeight="800"
                                fontFamily="sans-serif"
                              >
                                {col.day}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* Chú thích phía dưới biểu đồ cột */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/15 text-[11px] font-bold text-white px-1 mt-2">
                    <span className="text-[#34D399] font-mono">
                      Đang xem: {WEEKLY_VOUCHER_DATA[selectedDayColIndex].fullDay} ({WEEKLY_VOUCHER_DATA[selectedDayColIndex].count.toLocaleString()} mã)
                    </span>
                    <span className="text-white/80">Tỷ lệ đổi thành công: 94.6%</span>
                  </div>
                </div>

                {/* CỤM PHẢI TAB 2 */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge">
                      <div className="flex items-center justify-between text-white/80 text-xs font-bold">
                        <span>Hoàn Thành 3s</span>
                        <CheckCircle2 size={14} className="text-[#34D399]" />
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-white tracking-tight my-1 tabular-nums">
                        94.6%
                      </div>
                      <div className="text-xs font-bold text-[#EBF7DC]">
                        1,143 mẫu khảo sát
                      </div>
                    </div>

                    <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge">
                      <div className="flex items-center justify-between text-white/80 text-xs font-bold">
                        <span>Voucher Đã Đổi</span>
                        <Ticket size={14} className="text-[#34D399]" />
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-white tracking-tight my-1 tabular-nums">
                        1,097 mã
                      </div>
                      <div className="text-xs font-bold text-white/90">
                        Tại POS :3009
                      </div>
                    </div>
                  </div>

                  {/* Card Trạng Thái Chiến Dịch (Bỏ nút Đẩy vào App :3008) */}
                  <div className="bg-black/25 backdrop-blur-2xl border border-white/30 rounded-[22px] p-4 shadow-glass-edge flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-white text-xs font-black mb-1">
                        <span className="tracking-wide">Highlands Coffee (Căn Tin H6)</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">Hoạt động</span>
                      </div>
                      <div className="text-xs text-white/80 mt-1">
                        Giảm 10k cho đơn từ 45k sau khảo sát 3s
                      </div>
                    </div>
                    <div className="pt-3 flex items-center justify-between border-t border-white/15 mt-3 text-xs text-white/80">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                        <span className="font-bold text-[#FAF8F2]">Tự động phát hành voucher</span>
                      </div>
                      <span className="font-mono text-emerald-300 text-[11px] font-bold">Đồng bộ POS</span>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      </div>

      {/* FLOATING TRIGGER: CHỈ MŨI TÊN + CHỮ BÀN LÀM VIỆC (KHÔNG CẦN Ô TRÒN NGOÀI) */}
      {!isSlideIn && (
        <button 
          onClick={() => navigateTo('banlamviec')}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 cursor-pointer group select-none transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none"
          title="Vào Bàn Làm Việc (/banlamviec)"
        >
          <div className="text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] group-hover:text-[#34D399] group-hover:-translate-y-1.5 transition-all duration-300 animate-bounce">
            <ChevronUp size={32} strokeWidth={2.6} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] group-hover:text-[#34D399] transition-colors duration-300">
            Bàn Làm Việc
          </span>
        </button>
      )}

      {/* =========================================================================
          VIEW 2: BÀN LÀM VIỆC ĐIỀU HÀNH (/banlamviec)
          ĐỒNG BỘ 100% STYLE THIẾT KẾ VỚI CỔNG 3011 & 3012
          - Sidebar kính mờ nền tối bên trái (Frosted Glass Obsidian Sidebar)
          - Khung nội dung chính trắng bo góc 28px bên phải (Main White Canvas)
          - Có nút Về Trang Chủ tinh tế, không còn hướng dẫn Esc hay thanh dài phía trên
      ========================================================================= */}
      <div
        className={`fixed inset-0 z-40 flex h-screen w-screen overflow-hidden text-[#000000] font-sans antialiased p-3 sm:p-4 gap-3 sm:gap-4 select-none transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform will-change-transform ${
          isSlideIn 
            ? 'translate-y-0 shadow-[0_-30px_90px_rgba(0,0,0,0.95)]' 
            : 'translate-y-full pointer-events-none'
        } ${!isSlideIn && !isTransitioning ? 'hidden' : 'flex'}`}
          style={{
            background: "linear-gradient(145deg, #141A16 0%, #0B0E0C 100%)",
          }}
        >
          {/* Backdrop khi mở sidebar trên mobile */}
          {isWorkspaceSidebarOpen && (
            <div 
              onClick={() => setIsWorkspaceSidebarOpen(false)}
              className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
            />
          )}

          {/* 1. SIDEBAR KÍNH MỜ (ĐỒNG BỘ 3011 & 3012) */}
          <aside
            className={`h-full text-white flex flex-col justify-between rounded-[28px] transition-all duration-300 ease-in-out select-none flex-shrink-0 z-30 border border-white/20 backdrop-blur-2xl relative overflow-hidden ${
              isWorkspaceSidebarOpen ? "w-64 fixed sm:relative inset-y-3 left-3 z-50 sm:inset-0 shadow-2xl sm:shadow-none" : "hidden sm:flex sm:w-20"
            }`}
            style={{
              background: "linear-gradient(165deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 35%, rgba(14,19,16,0.92) 100%), #111613",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 1.5px rgba(255,255,255,0.35)",
            }}
          >
            {/* Glow nội bộ */}
            <div className="absolute -top-10 -left-10 w-44 h-44 bg-[#059669]/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              {/* Header Logo Brand */}
              <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.10]">
                {isWorkspaceSidebarOpen ? (
                  <div className="flex items-center gap-2.5 overflow-hidden pl-1">
                    <div className="w-8 h-8 rounded-xl bg-[#059669] flex items-center justify-center text-white font-black text-xs shadow-md shadow-[#059669]/40 flex-shrink-0">
                      EP
                    </div>
                    <div className="truncate">
                      <span className="text-sm font-black tracking-tight text-white">ecopass</span>
                      <span className="ml-1.5 text-[9px] font-black text-[#10B981] bg-[#059669]/25 px-1.5 py-0.5 rounded-full border border-[#059669]/40">
                        HQ
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-8 h-8 mx-auto rounded-xl bg-[#059669] flex items-center justify-center text-white font-black text-xs shadow-sm">
                    EP
                  </div>
                )}

                <button
                  onClick={() => setIsWorkspaceSidebarOpen(!isWorkspaceSidebarOpen)}
                  title={isWorkspaceSidebarOpen ? "Thu gọn menu" : "Mở rộng menu"}
                  className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.10] transition"
                >
                  {isWorkspaceSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* Menu Điều Hướng: Hệ thống 6 Tab điều hành chuẩn 4-Win */}
              <nav className="p-3.5 space-y-2 mt-1">
                {[
                  { id: "banlamviec", label: "Bàn Làm Việc", icon: LayoutDashboard },
                  { id: "store_qrs", label: "QR Cửa Hàng", icon: QrCode, badge: String(storeQrsList.length) },
                  { id: "order_stickers", label: "Tem Cửa Hàng", icon: Ticket, badge: String(orderStickersList.filter(s => s.status === 'active').length) },
                  { id: "contracts", label: "Hợp Đồng", icon: Handshake, badge: String(contractsList.length) },
                  { id: "campaigns", label: "Chiến Dịch", icon: Flame, badge: String(campaignsList.filter(c => c.status === 'active').length) },
                  { id: "settings", label: "Cài Đặt", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeWorkspaceTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveWorkspaceTab(item.id)}
                      title={!isWorkspaceSidebarOpen ? item.label : undefined}
                      className={`w-full flex items-center rounded-2xl text-xs font-bold transition-all duration-200 ${
                        isWorkspaceSidebarOpen ? "px-3.5 py-2.5 justify-between" : "p-3 justify-center"
                      } ${
                        isActive
                          ? "bg-[#059669] text-white shadow-lg shadow-[#059669]/30 scale-[1.02]"
                          : "text-white/80 hover:text-white hover:bg-white/[0.10]"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {isWorkspaceSidebarOpen && <span className="truncate">{item.label}</span>}
                      </div>
                      {isWorkspaceSidebarOpen && item.badge && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isActive ? "bg-white/20 text-white" : "bg-white/10 text-white/70"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Footer Trạng Thái Kết Nối Hub */}
            <div className="p-4 border-t border-white/[0.10]">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse flex-shrink-0" />
                {isWorkspaceSidebarOpen && (
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-white leading-tight truncate">EcoPass Network</p>
                    <p className="text-[10px] text-white/50">Hệ Thống Sẵn Sàng</p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* 2. MAIN WHITE WORKSPACE CANVAS (ĐỒNG BỘ 3011 & 3012) */}
          <main className="flex-1 bg-white rounded-[28px] overflow-hidden flex flex-col shadow-2xl border border-neutral-200/80 relative z-10">
            {/* Topbar điều hướng bên trong Bàn Làm Việc */}
            <header className="h-16 px-4 sm:px-6 border-b border-neutral-200/80 flex items-center justify-between flex-shrink-0 bg-white/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsWorkspaceSidebarOpen(!isWorkspaceSidebarOpen)}
                  className="sm:hidden p-1.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                >
                  <Menu className="w-4 h-4" />
                </button>

                <div className="flex items-baseline gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-neutral-900">
                    {activeWorkspaceTab === "banlamviec" && "Tổng Quan Điều Hành 4-Win"}
                    {activeWorkspaceTab === "store_qrs" && "Quản Lý Mã QR Thùng Rác / Cửa Hàng"}
                    {activeWorkspaceTab === "order_stickers" && "Quản Lý Tem In Nhiệt Cửa Hàng"}
                    {activeWorkspaceTab === "contracts" && "Quản Lý Hợp Đồng Đối Tác"}
                    {activeWorkspaceTab === "campaigns" && "Chiến Dịch Voucher Thúc Đẩy"}
                    {activeWorkspaceTab === "settings" && "Cài Đặt Hệ Thống HQ"}
                  </h1>
                  <span className="text-[10px] font-black text-[#059669] bg-[#059669]/10 px-2 py-0.5 rounded-full border border-[#059669]/20 hidden md:inline-block uppercase tracking-wider">
                    {activeWorkspaceTab === "banlamviec" && "ĐỐI SOÁT 4-WIN"}
                    {activeWorkspaceTab === "store_qrs" && `${storeQrsList.length} ĐIỂM QUÉT`}
                    {activeWorkspaceTab === "order_stickers" && "TEM CỬA HÀNG :3013"}
                    {activeWorkspaceTab === "contracts" && "6 ĐỐI TÁC LIÊN KẾT"}
                    {activeWorkspaceTab === "campaigns" && "3 CHIẾN DỊCH ACTIVE"}
                    {activeWorkspaceTab === "settings" && "TRỤ SỞ :3010"}
                  </span>
                </div>
              </div>

              {/* Thanh tìm kiếm nhanh và nút hành động đặc thù theo từng tab */}
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="relative w-36 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm..."
                    className="w-full bg-neutral-50 border border-neutral-200/80 rounded-full pl-9 pr-3 py-1.5 text-xs text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
                  />
                </div>

                {activeWorkspaceTab === "banlamviec" && (
                  <button
                    onClick={() => {
                      setSyncToast("Đã xuất báo cáo đối soát tuần (CSV / PDF)");
                      setTimeout(() => setSyncToast(null), 3000);
                    }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-sm"
                  >
                    <Download size={13} />
                    <span>Xuất Báo Cáo</span>
                  </button>
                )}

                {activeWorkspaceTab === "store_qrs" && (
                  <button
                    onClick={() => setIsNewQrModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Thêm Mã QR</span>
                  </button>
                )}

                {activeWorkspaceTab === "order_stickers" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncFromStore3013}
                      disabled={isSyncingFromStore}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition shadow-sm"
                      title="Đồng bộ mã vạch tem mới từ Cửa Hàng Highlands :3013"
                    >
                      <RefreshCw size={13} className={isSyncingFromStore ? "animate-spin" : ""} />
                      <span>{isSyncingFromStore ? "Đang Sync :3013..." : "Sync Từ Cửa Hàng :3013"}</span>
                    </button>
                    <button
                      onClick={() => setIsNewStickerModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-sm"
                    >
                      <Plus size={13} />
                      <span>Thêm Tem</span>
                    </button>
                  </div>
                )}

                {activeWorkspaceTab === "contracts" && (
                  <button
                    onClick={() => setIsNewContractModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Tạo Hợp Đồng</span>
                  </button>
                )}

                {activeWorkspaceTab === "campaigns" && (
                  <button
                    onClick={() => setIsNewCampaignModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Tạo Chiến Dịch</span>
                  </button>
                )}
              </div>
            </header>

            {/* Content Body: Thay đổi linh hoạt theo activeWorkspaceTab */}
            <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#F9FAF9] space-y-6">
              
              {/* =========================================================================
                  TAB 1: BÀN LÀM VIỆC ĐIỀU HÀNH & ĐỐI SOÁT 4-WIN
              ========================================================================= */}
              {/* =========================================================================
                  TAB 1: BÀN LÀM VIỆC ĐIỀU HÀNH & ĐỐI SOÁT 4-WIN (CHART-CENTRIC)
              ========================================================================= */}
              {activeWorkspaceTab === "banlamviec" && (
                <div className="space-y-6">
                  {/* TOP STRIP: 4 THẺ NANO KPI + MINI SPARKLINE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Win 1: Sinh Viên */}
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between hover:border-[#059669]/40 transition">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">WIN 1 • SINH VIÊN</span>
                          <span className="text-[9px] font-black text-[#059669] bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">+14.6%</span>
                        </div>
                        <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">32.8 Tr</div>
                        <div className="text-[11px] font-bold text-neutral-500 mt-0.5">Tiết kiệm ăn uống trực tiếp</div>
                      </div>
                      <div className="w-16 h-10 flex-shrink-0">
                        <svg viewBox="0 0 64 32" className="w-full h-full overflow-visible">
                          <path d="M 0 26 Q 16 28 28 16 T 64 6" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" />
                          <circle cx="64" cy="6" r="3" fill="#059669" />
                        </svg>
                      </div>
                    </div>

                    {/* Win 2: Cửa Hàng F&B */}
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between hover:border-[#059669]/40 transition">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">WIN 2 • CỬA HÀNG F&B</span>
                          <span className="text-[9px] font-black text-[#059669] bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">+18.2%</span>
                        </div>
                        <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">48.5 Tr</div>
                        <div className="text-[11px] font-bold text-neutral-500 mt-0.5">Doanh thu kéo theo (Net-New)</div>
                      </div>
                      <div className="w-16 h-10 flex-shrink-0">
                        <svg viewBox="0 0 64 32" className="w-full h-full overflow-visible">
                          <path d="M 0 28 Q 20 22 36 12 T 64 4" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" />
                          <circle cx="64" cy="4" r="3" fill="#059669" />
                        </svg>
                      </div>
                    </div>

                    {/* Win 3: Nhãn Hàng FMCG */}
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between hover:border-[#059669]/40 transition">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">WIN 3 • NHÃN HÀNG FMCG</span>
                          <span className="text-[9px] font-black text-[#059669] bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">-85% Phí</span>
                        </div>
                        <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">1,143 Mẫu</div>
                        <div className="text-[11px] font-bold text-neutral-500 mt-0.5">Ý kiến khảo sát vị giác thật</div>
                      </div>
                      <div className="w-16 h-10 flex-shrink-0">
                        <svg viewBox="0 0 64 32" className="w-full h-full overflow-visible">
                          <path d="M 0 24 Q 18 18 34 22 T 64 8" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" />
                          <circle cx="64" cy="8" r="3" fill="#059669" />
                        </svg>
                      </div>
                    </div>

                    {/* Win 4: Thu Gom Sạch */}
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between hover:border-[#059669]/40 transition">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">WIN 4 • THU GOM SẠCH</span>
                          <span className="text-[9px] font-black text-[#059669] bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">100% SẠCH</span>
                        </div>
                        <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">4,850 Vỏ</div>
                        <div className="text-[11px] font-bold text-neutral-500 mt-0.5">Vỏ chai đạt chuẩn tái chế EPR</div>
                      </div>
                      <div className="w-16 h-10 flex-shrink-0">
                        <svg viewBox="0 0 64 32" className="w-full h-full overflow-visible">
                          <path d="M 0 26 Q 22 24 38 14 T 64 5" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" />
                          <circle cx="64" cy="5" r="3" fill="#059669" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* ROW 1: 2 CHARTS: SƠ ĐỒ DÒNG TIỀN (7 CỘT) + PHÂN BỔ GIÁ TRỊ DONUT (5 CỘT) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* CHART 1: Sơ Đồ Dòng Tiền & Voucher Bẫy Mua (7 Cột) */}
                    <div className="lg:col-span-7 rounded-3xl bg-white border border-neutral-200/80 p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-black tracking-tight">Sơ Đồ Dòng Tiền & Đòn Bẩy F&B</h3>
                              <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">7 NGÀY QUA</span>
                            </div>
                            <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Mỗi voucher 10k kích hoạt đơn hàng tối thiểu 45k tại quầy POS :3009</p>
                          </div>
                          <div className="flex items-center p-1 bg-neutral-100/80 rounded-xl gap-1 self-start sm:self-auto">
                            <button
                              onClick={() => setTimelineMetricView("revenue")}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                                timelineMetricView === "revenue"
                                  ? "bg-white text-[#059669] shadow-xs ring-1 ring-black/5"
                                  : "text-neutral-500 hover:text-black"
                              }`}
                            >
                              Doanh Thu
                            </button>
                            <button
                              onClick={() => setTimelineMetricView("leverage")}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                                timelineMetricView === "leverage"
                                  ? "bg-white text-[#2563EB] shadow-xs ring-1 ring-black/5"
                                  : "text-neutral-500 hover:text-black"
                              }`}
                            >
                              Đòn Bẩy
                            </button>
                          </div>
                        </div>

                        {/* Banner tóm tắt ngày đang chọn */}
                        {(() => {
                          const cur = TIMELINE_DATA[selectedTimelineDay] || TIMELINE_DATA[4];
                          const isRev = timelineMetricView === "revenue";
                          return (
                            <div className={`my-3 p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
                              isRev ? "bg-[#FBFDFB] border-neutral-200/70" : "bg-[#F8FAFC] border-blue-100"
                            }`}>
                              <div className="flex items-center gap-2.5">
                                <span className={`w-8 h-8 rounded-xl text-white font-black text-xs flex items-center justify-center transition-colors ${
                                  isRev ? "bg-neutral-900" : "bg-blue-600"
                                }`}>
                                  {cur.day}
                                </span>
                                <div>
                                  <div className="font-black text-neutral-900">{cur.label}</div>
                                  <div className="text-[10px] text-neutral-400 font-medium">Món dẫn dắt: <strong className="text-neutral-700">{cur.topDish}</strong></div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-right">
                                <div>
                                  <span className="text-[9px] text-neutral-400 font-black uppercase tracking-wider block">
                                    {isRev ? "DOANH THU ĐƠN" : "HỆ SỐ ĐÒN BẨY"}
                                  </span>
                                  <span className={`text-sm font-black transition-colors ${isRev ? "text-neutral-900" : "text-blue-600"}`}>
                                    {isRev ? `${cur.revenue} Tr` : cur.leverage}
                                  </span>
                                </div>
                                <div className="h-6 w-px bg-neutral-200/70" />
                                <div>
                                  <span className="text-[9px] text-neutral-400 font-black uppercase tracking-wider block">VOUCHER ĐỔI</span>
                                  <span className="text-sm font-black text-[#059669]">{cur.vouchers} Mã</span>
                                </div>
                                <div className="h-6 w-px bg-neutral-200/70" />
                                <div>
                                  <span className="text-[9px] text-neutral-400 font-black uppercase tracking-wider block">
                                    {isRev ? "HỆ SỐ ĐÒN BẨY" : "GIÁ TRỊ ĐƠN TB"}
                                  </span>
                                  <span className="text-sm font-black text-neutral-900">
                                    {isRev ? cur.leverage : cur.avgBill}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* SVG Financial Area Canvas */}
                        {(() => {
                          const isRev = timelineMetricView === "revenue";
                          const curY = (pt) => isRev ? pt.yRevenue : pt.yLeverage;
                          const curVal = (pt) => isRev ? `${pt.revenue} Tr` : pt.leverage;
                          const activeColor = isRev ? "#059669" : "#2563EB";
                          const areaPath = isRev
                            ? "M 50 180 L 50 124 C 95 120, 95 115, 140 115 C 185 115, 185 89, 230 89 C 275 89, 275 102, 320 102 C 365 102, 365 53, 410 53 C 455 53, 455 79, 500 79 C 545 79, 545 110, 590 110 L 590 180 Z"
                            : "M 50 180 L 50 120 C 95 115, 95 110, 140 110 C 185 110, 185 80, 230 80 C 275 80, 275 100, 320 100 C 365 100, 365 50, 410 50 C 455 50, 455 90, 500 90 C 545 90, 545 110, 590 110 L 590 180 Z";
                          const strokePath = isRev
                            ? "M 50 124 C 95 120, 95 115, 140 115 C 185 115, 185 89, 230 89 C 275 89, 275 102, 320 102 C 365 102, 365 53, 410 53 C 455 53, 455 79, 500 79 C 545 79, 545 110, 590 110"
                            : "M 50 120 C 95 115, 95 110, 140 110 C 185 110, 185 80, 230 80 C 275 80, 275 100, 320 100 C 365 100, 365 50, 410 50 C 455 50, 455 90, 500 90 C 545 90, 545 110, 590 110";

                          const pt = TIMELINE_DATA[selectedTimelineDay] || TIMELINE_DATA[4];
                          const activePointY = curY(pt);

                          return (
                            <div className="relative w-full aspect-[640/200] my-2">
                              <svg viewBox="0 0 640 200" className="w-full h-full overflow-visible">
                                <defs>
                                  <linearGradient id="financialGlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
                                    <stop offset="65%" stopColor="#059669" stopOpacity="0.04" />
                                    <stop offset="100%" stopColor="#059669" stopOpacity="0.00" />
                                  </linearGradient>
                                  <linearGradient id="leverageGlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                                    <stop offset="65%" stopColor="#2563EB" stopOpacity="0.04" />
                                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.00" />
                                  </linearGradient>
                                </defs>

                                {/* Minimal Gridlines */}
                                <g stroke="#F1F5F9" strokeWidth="1">
                                  <line x1="35" y1="30" x2="605" y2="30" strokeDasharray="3 4" />
                                  <line x1="35" y1="80" x2="605" y2="80" strokeDasharray="3 4" />
                                  <line x1="35" y1="130" x2="605" y2="130" strokeDasharray="3 4" />
                                  <line x1="35" y1="180" x2="605" y2="180" />
                                </g>
                                {isRev ? (
                                  <>
                                    <text x="30" y="34" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">40Tr</text>
                                    <text x="30" y="84" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">30Tr</text>
                                    <text x="30" y="134" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">20Tr</text>
                                    <text x="30" y="184" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">0đ</text>
                                  </>
                                ) : (
                                  <>
                                    <text x="30" y="34" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">5.0x</text>
                                    <text x="30" y="84" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">4.5x</text>
                                    <text x="30" y="134" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">4.0x</text>
                                    <text x="30" y="184" fill="#94A3B8" fontSize="9" fontWeight="700" textAnchor="end">3.0x</text>
                                  </>
                                )}

                                {/* Clean Hairline Guide for Active Day */}
                                <g className="transition-all duration-300 pointer-events-none">
                                  <line x1={pt.x} y1={25} x2={pt.x} y2={180} stroke={activeColor} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.45" />
                                  <g transform={`translate(${pt.x}, ${activePointY - 18})`}>
                                    <rect x="-24" y="-12" width="48" height="18" rx="5" fill="#111613" />
                                    <text x="0" y="1" fill="#FFFFFF" fontSize="9" fontWeight="800" textAnchor="middle" dominantBaseline="middle">
                                      {curVal(pt)}
                                    </text>
                                    <polygon points="-4,6 4,6 0,10" fill="#111613" />
                                  </g>
                                </g>

                                {/* Area Gradient Fill */}
                                <path
                                  d={areaPath}
                                  fill={`url(#${isRev ? "financialGlow" : "leverageGlow"})`}
                                  className="transition-all duration-500"
                                />

                                {/* Crisp Financial Curve */}
                                <path
                                  d={strokePath}
                                  fill="none"
                                  stroke={activeColor}
                                  strokeWidth="2.8"
                                  strokeLinecap="round"
                                  className="transition-all duration-500"
                                />

                                {/* Interactive Beacon Points */}
                                {TIMELINE_DATA.map((p, idx) => {
                                  const isSel = idx === selectedTimelineDay;
                                  const py = curY(p);
                                  return (
                                    <g key={idx} className="cursor-pointer group" onClick={() => setSelectedTimelineDay(idx)}>
                                      <circle cx={p.x} cy={py} r="16" fill="transparent" />
                                      {isSel ? (
                                        <>
                                          <circle cx={p.x} cy={py} r="10" fill={activeColor} opacity="0.16" />
                                          <circle cx={p.x} cy={py} r="5" fill={activeColor} stroke="#FFFFFF" strokeWidth="2" />
                                        </>
                                      ) : (
                                        <circle
                                          cx={p.x}
                                          cy={py}
                                          r="3.5"
                                          fill="#FFFFFF"
                                          stroke={activeColor}
                                          strokeWidth="2"
                                          className="group-hover:r-[5] transition-all"
                                        />
                                      )}
                                    </g>
                                  );
                                })}
                              </svg>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Sleek Segmented Control Timeline Scrubber */}
                      <div className="grid grid-cols-7 gap-1.5 pt-3 border-t border-neutral-100">
                        {TIMELINE_DATA.map((pt, idx) => {
                          const isSel = idx === selectedTimelineDay;
                          const isRev = timelineMetricView === "revenue";
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedTimelineDay(idx)}
                              className={`py-2 px-1 rounded-xl text-center transition-all ${
                                isSel
                                  ? "bg-neutral-900 text-white shadow-sm scale-[1.02]"
                                  : "bg-neutral-50/80 hover:bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              <div className="text-[11px] font-black">{pt.day}</div>
                              <div className={`text-[9px] font-bold mt-0.5 ${
                                isSel ? (isRev ? "text-emerald-400" : "text-blue-400") : "text-neutral-400"
                              }`}>
                                {isRev ? `${pt.revenue} Tr` : pt.leverage}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* CHART 2: Cơ Cấu Phân Bổ Giá Trị 4 Bên (Donut Ring Chart - 5 Cột) */}
                    <div className="lg:col-span-5 rounded-3xl bg-white border border-neutral-200/80 p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-black tracking-tight">Cơ Cấu Giá Trị 4 Bên</h3>
                            <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">DONUT RING</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Tỷ trọng giá trị chia sẻ trên 96.3 Tr tuần hoàn</p>
                        </div>
                      </div>

                      {/* Donut Chart Visual & Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-3">
                        {/* Donut Circle (5 cols) */}
                        <div className="sm:col-span-5 relative flex items-center justify-center">
                          <svg viewBox="0 0 160 160" className="w-36 h-36 overflow-visible transform -rotate-90">
                            <circle cx="80" cy="80" r="58" fill="none" stroke="#F3F4F6" strokeWidth="16" />
                            {DONUT_VALUE_SEGMENTS.map((seg, idx) => {
                              const isSel = idx === selectedDonutSegment;
                              // C = 2 * pi * 58 ≈ 364.42
                              const segC = 364.42;
                              const segLen = (seg.share / 100) * segC;
                              let segOffset = 0;
                              for (let i = 0; i < idx; i++) {
                                segOffset += (DONUT_VALUE_SEGMENTS[i].share / 100) * segC;
                              }
                              return (
                                <circle
                                  key={seg.id}
                                  cx="80"
                                  cy="80"
                                  r="58"
                                  fill="none"
                                  stroke={seg.color}
                                  strokeWidth={isSel ? "19" : "16"}
                                  strokeDasharray={`${segLen} ${segC}`}
                                  strokeDashoffset={-segOffset}
                                  strokeLinecap="round"
                                  className="cursor-pointer transition-all duration-300"
                                  onClick={() => setSelectedDonutSegment(idx)}
                                />
                              );
                            })}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-sm font-black text-black leading-none">96.3 Tr</span>
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">TỔNG GIÁ TRỊ</span>
                          </div>
                        </div>

                        {/* Breakdown List (7 cols) */}
                        <div className="sm:col-span-7 space-y-1.5">
                          {DONUT_VALUE_SEGMENTS.map((seg, idx) => {
                            const isSel = idx === selectedDonutSegment;
                            return (
                              <div
                                key={seg.id}
                                onClick={() => setSelectedDonutSegment(idx)}
                                className={`p-2 rounded-xl border cursor-pointer transition-all ${
                                  isSel ? "bg-[#F9FAF9] border-[#059669]/40 shadow-xs" : "bg-white border-transparent hover:bg-neutral-50"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                                    <span className="text-xs font-black text-black">{seg.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-neutral-900">{seg.value}</span>
                                    <span className="text-[10px] font-bold text-neutral-400">({seg.share}%)</span>
                                  </div>
                                </div>
                                <div className="text-[10px] text-neutral-500 font-medium pl-4 mt-0.5 truncate">
                                  {seg.role}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                        <span>Cơ chế bù đắp khép kín</span>
                        <span className="font-bold text-[#059669]">Zero Deficit Ratio</span>
                      </div>
                    </div>
                  </div>

                  {/* ROW 2: 2 CHARTS: PHỄU CHUYỂN ĐỔI KÍCH CẦU (6 CỘT) + MA TRẬN CÂN BẰNG LỢI ÍCH RADAR (6 CỘT) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* CHART 3: Phễu Chuyển Đổi Kích Cầu F&B (Conversion Funnel Chart - 6 Cột) */}
                    <div className="lg:col-span-6 rounded-3xl bg-white border border-neutral-200/80 p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-black tracking-tight">Phễu Chuyển Đổi Kích Cầu F&B</h3>
                            <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">HIỆU SUẤT 86%</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Tỷ lệ rớt phễu và chuyển hóa vỏ rác thành hóa đơn mua kèm</p>
                        </div>
                      </div>

                      {/* Stepped Funnel Bars */}
                      <div className="space-y-2.5 my-3">
                        {FUNNEL_STEPS.map((step, idx) => {
                          const isSel = idx === selectedFunnelStep;
                          return (
                            <div
                              key={step.step}
                              onClick={() => setSelectedFunnelStep(idx)}
                              className={`p-2.5 rounded-2xl border cursor-pointer transition-all ${
                                isSel ? "bg-[#F9FAF9] border-[#059669]/40 shadow-xs" : "bg-white border-neutral-100 hover:border-neutral-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-neutral-900 text-white font-black text-[10px] flex items-center justify-center">
                                    {step.step}
                                  </span>
                                  <span className="text-xs font-black text-black">{step.name}</span>
                                  <span className="text-[10px] font-semibold text-neutral-400">• {step.sub}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-neutral-900">{step.count}</span>
                                  <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {step.rate}
                                  </span>
                                </div>
                              </div>
                              <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${step.pct}%`,
                                    backgroundColor: step.color
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                        <span>Đòn bẩy giỏ hàng: 86% sinh viên chi vượt mức 45k</span>
                        <span className="font-black text-black">Net-New Lift: +28.5k/bill</span>
                      </div>
                    </div>

                    {/* CHART 4: Ma Trận Cân Bằng Lợi Ích 5 Trục (Radar Spider Chart - 6 Cột) */}
                    <div className="lg:col-span-6 rounded-3xl bg-white border border-neutral-200/80 p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-black tracking-tight">Ma Trận Cân Bằng Lợi Ích 5 Bên</h3>
                            <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">5-AXIS RADAR</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Cân bằng Nash: các bên đều có lợi ích thặng dư tối ưu</p>
                        </div>
                      </div>

                      {/* Radar SVG Visual */}
                      <div className="relative w-full aspect-[280/190] my-2 flex items-center justify-center">
                        <svg viewBox="0 0 240 200" className="w-full h-full overflow-visible">
                          {/* Concentric pentagon grids */}
                          <polygon points="120,45 186.6,93.4 161.1,171.6 78.9,171.6 53.4,93.4" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3 3" />
                          <polygon points="120,65 164.4,97.3 147.4,149.4 92.6,149.4 75.6,97.3" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3 3" />
                          <polygon points="120,85 142.2,101.1 133.7,127.2 106.3,127.2 97.8,101.1" fill="none" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3 3" />

                          {/* 5 Axis Rays */}
                          <line x1="120" y1="110" x2="120" y2="25" stroke="#E5E7EB" strokeWidth="1" />
                          <line x1="120" y1="110" x2="201" y2="84" stroke="#E5E7EB" strokeWidth="1" />
                          <line x1="120" y1="110" x2="170" y2="180" stroke="#E5E7EB" strokeWidth="1" />
                          <line x1="120" y1="110" x2="70" y2="180" stroke="#E5E7EB" strokeWidth="1" />
                          <line x1="120" y1="110" x2="39" y2="84" stroke="#E5E7EB" strokeWidth="1" />

                          {/* Data Polygon */}
                          <polygon
                            points={RADAR_POLYGON_POINTS}
                            fill="rgba(5,150,105,0.22)"
                            stroke="#059669"
                            strokeWidth="2.5"
                          />

                          {/* Vertex Dots */}
                          <circle cx="120" cy="38.8" r="4" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />
                          <circle cx="185.6" cy="88.7" r="4" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />
                          <circle cx="158.8" cy="163.4" r="4" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />
                          <circle cx="80.3" cy="164.6" r="4" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />
                          <circle cx="51.5" cy="87.8" r="4" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />

                          {/* Axis Labels */}
                          {RADAR_METRICS.map((m, idx) => (
                            <g key={idx}>
                              <text x={m.x} y={m.y} fill="#111613" fontSize="8" fontWeight="800" textAnchor="middle">
                                {m.label}
                              </text>
                              <text x={m.x} y={m.y + 10} fill="#059669" fontSize="7.5" fontWeight="900" textAnchor="middle">
                                {m.score}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>

                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                        <span>Chỉ số cân bằng tổng thể</span>
                        <span className="font-black text-[#059669]">92.2% Đạt Chuẩn SOTA</span>
                      </div>
                    </div>
                  </div>

                  {/* ROW 3: KHUNG GIỜ CAO ĐIỂM (12 CỘT PANORAMIC) */}
                  <div className="rounded-3xl bg-white border border-neutral-200/80 p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-black tracking-tight">Khung Giờ Đổi Món Cao Điểm Campus</h3>
                          <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">CAMPUS PEAK</span>
                        </div>
                        <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Phân bổ lượng voucher quét tại canteen theo khung giờ (8h - 19h)</p>
                      </div>
                    </div>

                    {/* Hourly Bars Canvas */}
                    <div className="my-3">
                      <div className="h-40 flex items-end justify-between gap-1 sm:gap-2 px-1 pb-2 border-b border-neutral-100">
                        {HOURLY_PEAK_DATA.map((item, idx) => {
                          const isSel = idx === selectedPeakHour;
                          return (
                            <div
                              key={item.hour}
                              onClick={() => setSelectedPeakHour(idx)}
                              className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group"
                            >
                              {item.tag && (
                                <span className="text-[8px] font-black text-[#059669] bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/60">
                                  {item.tag}
                                </span>
                              )}
                              <div className="w-full flex items-end justify-center h-28">
                                <div
                                  className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                                    isSel
                                      ? "bg-[#059669] shadow-md shadow-[#059669]/30"
                                      : item.peak
                                      ? "bg-emerald-400 group-hover:bg-[#059669]"
                                      : "bg-neutral-200 group-hover:bg-neutral-300"
                                  }`}
                                  style={{ height: `${item.height}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-bold ${isSel ? "text-[#059669] font-black" : "text-neutral-400"}`}>
                                {item.hour}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Selected Hour Insight */}
                      {(() => {
                        const cur = HOURLY_PEAK_DATA[selectedPeakHour] || HOURLY_PEAK_DATA[4];
                        return (
                          <div className="mt-3 p-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200/70 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-black">Khung {cur.hour}00</span>
                              <span className="text-[10px] text-neutral-400 font-semibold">• Lưu lượng: <strong className="text-[#059669]">{cur.vouchers} voucher/giờ</strong></span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500">
                              {cur.peak ? "Cao điểm: Cần sẵn sàng quầy POS" : "Lưu lượng bình thường"}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                      <span>Đỉnh trưa 11h-13h: 655 lượt</span>
                      <span className="font-bold text-[#059669]">Cân đối bếp F&B</span>
                    </div>
                  </div>

                  {/* ROW 4: THANH ĐỐI SOÁT REALTIME TELEMETRY (CLEAN STRIP) */}
                  <div className="rounded-2xl bg-white border border-neutral-200/80 p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#059669]"></span>
                      </span>
                      <div className="text-xs font-bold text-neutral-700">
                        Hệ Thống Đối Soát Realtime: <span className="font-black text-black">42 tx/phút</span> • Độ trễ: <span className="font-black text-black">0.12s</span> • Cổng POS :3009: <span className="text-[#059669] font-black">100% Sẵn Sàng</span>
                      </div>
                    </div>

                    <a
                      href="http://localhost:3009"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-black transition flex-shrink-0"
                    >
                      <Store size={14} className="text-[#10B981]" />
                      <span>Mở Quầy Thu Ngân POS :3009</span>
                      <ExternalLink size={12} className="text-neutral-400" />
                    </a>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 1: QUẢN LÝ MÃ QR CÁC CỬA HÀNG (STORE / BIN QR CODES)
              ========================================================================= */}
              {activeWorkspaceTab === "store_qrs" && (
                <div className="space-y-6">
                  {/* Top Banner giải thích cơ chế */}
                  <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-100/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center shadow-md shadow-[#059669]/20 flex-shrink-0">
                        <QrCode size={24} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-neutral-900 tracking-tight">
                          Quản Lý Mã QR Điểm Thu Gom / Cửa Hàng
                        </h2>
                        <p className="text-xs text-neutral-600 mt-0.5 max-w-2xl font-medium">
                          Mỗi thùng rác đối tác được dán mã QR định danh riêng. App sinh viên quét mã này ở <strong>Bước 1</strong> để đối soát vị trí thực tế trong cơ sở dữ liệu.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsNewQrModalOpen(true)}
                      className="px-4 py-2 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Plus size={14} />
                      <span>Cấp QR Thùng Mới</span>
                    </button>
                  </div>

                  {/* 4 Thẻ KPI Điểm Quét */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-sm">
                      <div className="text-[10px] font-black uppercase text-neutral-400">TỔNG ĐIỂM THU GOM</div>
                      <div className="text-2xl font-black text-neutral-900 my-1.5">{storeQrsList.length} Điểm</div>
                      <div className="text-[11px] text-neutral-500 font-semibold">Phủ khắp Campus HUTECH & FPT</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-sm">
                      <div className="text-[10px] font-black uppercase text-neutral-400">TRẠNG THÁI HOẠT ĐỘNG</div>
                      <div className="text-2xl font-black text-[#059669] my-1.5">
                        {storeQrsList.filter(q => q.status === 'active').length} / {storeQrsList.length} Online
                      </div>
                      <div className="text-[11px] text-emerald-600 font-semibold">100% Cảm biến sẵn sàng</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-sm">
                      <div className="text-[10px] font-black uppercase text-neutral-400">LƯỢT QUÉT HỢP LỆ</div>
                      <div className="text-2xl font-black text-neutral-900 my-1.5">
                        {storeQrsList.reduce((acc, q) => acc + (q.scanCount || 0), 0)} Lượt
                      </div>
                      <div className="text-[11px] text-neutral-500 font-semibold">Dữ liệu ghi nhận từ CSDL thật</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-sm">
                      <div className="text-[10px] font-black uppercase text-neutral-400">TỶ LỆ CHÍNH XÁC</div>
                      <div className="text-2xl font-black text-[#059669] my-1.5">99.4%</div>
                      <div className="text-[11px] text-neutral-500 font-semibold">Chặn 14 trường hợp QR giả</div>
                    </div>
                  </div>

                  {/* Bảng Danh Sách QR Cửa Hàng */}
                  <div className="bg-white rounded-3xl border border-neutral-200/80 overflow-hidden shadow-sm">
                    <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
                      <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                        Danh Sách Mã QR Thùng Rác Đang Hoạt Động
                      </h3>
                      <span className="text-xs font-bold text-neutral-400">
                        {storeQrsList.length} bản ghi trong CSDL
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 border-b border-neutral-100 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3.5 pl-5">Mã QR Code</th>
                            <th className="p-3.5">Cửa Hàng / Đối Tác</th>
                            <th className="p-3.5">Vị Trí Đặt Thùng Rác</th>
                            <th className="p-3.5 text-center">Lượt Quét</th>
                            <th className="p-3.5">Trạng Thái</th>
                            <th className="p-3.5 pr-5 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium">
                          {storeQrsList.map((qr) => (
                            <tr key={qr.id} className="hover:bg-neutral-50/70 transition">
                              <td className="p-3.5 pl-5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-xl bg-neutral-100 p-1 border border-neutral-200/80 flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setSelectedQrPrint(qr)}>
                                    <QRCodeSVG value={qr.qrCode} size={28} />
                                  </div>
                                  <div>
                                    <div className="font-mono font-black text-neutral-900 text-xs">{qr.qrCode}</div>
                                    <div className="text-[10px] text-neutral-400">Tạo: {qr.createdAt}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5">
                                <div className="flex items-center gap-2">
                                  <Store size={14} className="text-[#059669]" />
                                  <span className="font-bold text-neutral-900">{qr.storeName}</span>
                                </div>
                              </td>
                              <td className="p-3.5 text-neutral-600 font-semibold">{qr.location}</td>
                              <td className="p-3.5 text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#059669] font-black text-xs">
                                  {qr.scanCount} lượt
                                </span>
                              </td>
                              <td className="p-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  qr.status === 'active'
                                    ? 'bg-emerald-50 text-[#059669] border border-emerald-200/60'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${qr.status === 'active' ? 'bg-[#059669]' : 'bg-amber-500'}`} />
                                  {qr.status === 'active' ? 'Đang Hoạt Động' : 'Bảo Trì'}
                                </span>
                              </td>
                              <td className="p-3.5 pr-5 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedQrPrint(qr)}
                                    className="px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition flex items-center gap-1"
                                    title="Xem và in nhãn dán thùng rác"
                                  >
                                    <Printer size={12} />
                                    <span>In Mã</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(qr.qrCode);
                                      setSyncToast(`Đã sao chép ${qr.qrCode}`);
                                      setTimeout(() => setSyncToast(null), 2000);
                                    }}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
                                    title="Sao chép mã QR"
                                  >
                                    <Copy size={13} />
                                  </button>
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

              {/* =========================================================================
                  TAB 2: QUẢN LÝ TEM CỦA CÁC CỬA HÀNG (ORDER STICKERS & BARCODES :3012)
              ========================================================================= */}
              {activeWorkspaceTab === "order_stickers" && (
                <div className="space-y-6">
                  {/* Banner hướng dẫn logic & Sync :3012 */}
                  <div className="p-5 rounded-3xl bg-neutral-900 text-white shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                        <span className="text-[11px] font-black uppercase text-[#10B981] tracking-wider">
                          ĐỒNG BỘ MÃ VẠCH TỰ ĐỘNG TỪ CỬA HÀNG HIGHLANDS :3013
                        </span>
                      </div>
                      <h2 className="text-base font-black tracking-tight text-white">
                        Quản Lý Tem In Nhiệt Trên Ly (Store Order Barcodes)
                      </h2>
                      <p className="text-xs text-neutral-300 mt-1 max-w-2xl font-medium leading-relaxed">
                        Quầy cửa hàng (Highlands Coffee :3013) in nhiệt tem dán lên ly nước. EcoPass đồng bộ tập trung vào CSDL để app sinh viên đối soát tại <strong>Bước 2</strong>. Tem chỉ được ký số và nhận voucher <strong>đúng 1 lần</strong> (1-Time Burn).
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <button
                        onClick={handleSyncFromStore3013}
                        disabled={isSyncingFromStore}
                        className="px-4 py-2.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-2"
                      >
                        <RefreshCw size={14} className={isSyncingFromStore ? "animate-spin" : ""} />
                        <span>{isSyncingFromStore ? "Đang Lấy Mã :3013..." : "Lấy Tem Từ Cửa Hàng :3013"}</span>
                      </button>
                      <button
                        onClick={() => setIsNewStickerModalOpen(true)}
                        className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black transition border border-white/20 flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        <span>Thêm Tem Thủ Công</span>
                      </button>
                    </div>
                  </div>

                  {/* LIST CÁC ĐỐI TÁC CỬA HÀNG HỢP TÁC (PARTNER SWITCHER) */}
                  <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-xs font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Store size={14} className="text-[#059669]" />
                        <span>Các Cửa Hàng Đối Tác Cung Cấp Mã Tem ({partnerStoresList.length})</span>
                      </h3>
                      <span className="text-[11px] font-bold text-neutral-400">
                        Bấm vào thương hiệu để lọc tem
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {/* Thẻ Tất Cả */}
                      <button
                        onClick={() => setSelectedPartnerFilter('all')}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          selectedPartnerFilter === 'all'
                            ? 'bg-[#059669] text-white border-[#059669] shadow-md shadow-[#059669]/20'
                            : 'bg-white border-neutral-200/80 hover:bg-neutral-50 text-neutral-900'
                        }`}
                      >
                        <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">TẤT CẢ</div>
                        <div className="text-base font-black mt-0.5 truncate">Toàn Hệ Thống</div>
                        <div className="text-xs font-bold mt-1 opacity-90">
                          {orderStickersList.length} Tem CSDL
                        </div>
                      </button>

                      {/* Các đối tác cụ thể */}
                      {partnerStoresList.map((partner) => {
                        const isSelected = selectedPartnerFilter === partner.id;
                        const partnerStickers = orderStickersList.filter(s => s.storeId === partner.id);
                        const activeCount = partnerStickers.filter(s => s.status === 'active').length;
                        return (
                          <button
                            key={partner.id}
                            onClick={() => setSelectedPartnerFilter(partner.id)}
                            className={`p-3.5 rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'bg-[#059669] text-white border-[#059669] shadow-md shadow-[#059669]/20'
                                : 'bg-white border-neutral-200/80 hover:bg-neutral-50 text-neutral-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider truncate">
                                {partner.category}
                              </span>
                              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                            </div>
                            <div className="text-sm font-black mt-0.5 truncate">{partner.name}</div>
                            <div className="text-xs font-bold mt-1 opacity-90">
                              {activeCount} sẵn sàng • {partnerStickers.length} tổng
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* BẢNG CHI TIẾT CÁC MÃ TEM TRONG CSDL */}
                  <div className="bg-white rounded-3xl border border-neutral-200/80 overflow-hidden shadow-sm">
                    <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                          Danh Sách Tem Mã Vạch (Barcodes) Lưu Trữ Trong CSDL
                        </h3>
                        <p className="text-[11px] text-neutral-500 font-medium">
                          {selectedPartnerFilter === 'all' ? 'Hiển thị toàn bộ tem từ tất cả đối tác' : `Đang lọc theo đối tác: ${selectedPartnerFilter}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-500">
                          {orderStickersList.filter(s => selectedPartnerFilter === 'all' || s.storeId === selectedPartnerFilter).length} tem
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 border-b border-neutral-100 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3.5 pl-5">Mã Vạch Barcode</th>
                            <th className="p-3.5">Mã Đơn POS</th>
                            <th className="p-3.5">Món Thức Uống</th>
                            <th className="p-3.5">Cửa Hàng Phát Hành</th>
                            <th className="p-3.5">Quầy POS & Giá</th>
                            <th className="p-3.5">Trạng Thái (1-Time Burn)</th>
                            <th className="p-3.5 pr-5 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium">
                          {orderStickersList
                            .filter(s => selectedPartnerFilter === 'all' || s.storeId === selectedPartnerFilter)
                            .map((stk) => (
                              <tr key={stk.id} className="hover:bg-neutral-50/70 transition">
                                <td className="p-3.5 pl-5 whitespace-nowrap">
                                  <HorizontalStickerBadge
                                    code={stk.code}
                                    barcode={stk.barcode}
                                    status={stk.status === 'active' ? 'pending' : 'done'}
                                    onClick={() => setSelectedStickerPreview(stk)}
                                  />
                                </td>
                                <td className="p-3.5 font-bold text-neutral-600">{stk.code}</td>
                                <td className="p-3.5 font-extrabold text-neutral-900">{stk.drinkName}</td>
                                <td className="p-3.5">
                                  <span className="inline-flex items-center gap-1 font-bold text-neutral-700">
                                    <Store size={12} className="text-[#059669]" />
                                    {stk.storeName}
                                  </span>
                                </td>
                                <td className="p-3.5 text-neutral-600 font-semibold">
                                  {stk.posTerminal} • {stk.price ? Number(stk.price).toLocaleString('vi-VN') + 'đ' : '45.000đ'}
                                </td>
                                <td className="p-3.5">
                                  {stk.status === 'active' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[#059669] text-xs font-bold border border-emerald-200/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                                      Khả Dụng (Sẵn Sàng)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500 text-xs font-bold border border-neutral-200">
                                      <Check size={12} className="text-neutral-400" />
                                      Đã Ký Số Đốt ({stk.usedAt ? stk.usedAt.substring(11, 16) : 'Đã Dùng'})
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 pr-5 text-right">
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <button
                                      onClick={() => setSelectedStickerPreview(stk)}
                                      className="px-2.5 py-1 rounded-lg bg-[#059669]/10 hover:bg-[#059669]/20 text-[#059669] text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="Xem mã vạch to để camera quét"
                                    >
                                      <Eye size={12} />
                                      <span>Xem Mã</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(stk.barcode);
                                        setSyncToast(`Đã chép mã tem ${stk.barcode}`);
                                        setTimeout(() => setSyncToast(null), 2000);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="Sao chép mã barcode"
                                    >
                                      <Copy size={12} />
                                      <span>Copy</span>
                                    </button>
                                    {stk.status !== 'active' && (
                                      <button
                                        onClick={() => handleResetSticker(stk.barcode)}
                                        className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition flex items-center gap-1 border border-amber-200/80 cursor-pointer"
                                        title="Khôi phục trạng thái sẵn sàng để quét lại"
                                      >
                                        <RefreshCw size={11} />
                                        <span>Reset</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteSticker(stk.barcode)}
                                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition flex items-center justify-center border border-red-100 cursor-pointer"
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
                </div>
              )}

              {/* =========================================================================
                  TAB 3: HỢP ĐỒNG ĐỐI TÁC (F&B + NHÀ TÀI TRỢ)
              ========================================================================= */}
              {activeWorkspaceTab === "contracts" && (
                <div className="space-y-6">
                  {/* KPI Hợp Đồng */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">TỔNG ĐỐI TÁC KÝ KẾT</div>
                      <div className="text-2xl sm:text-3xl font-black text-neutral-900 my-2">{contractsList.length} Đơn Vị</div>
                      <div className="text-[11px] text-neutral-500 font-medium">100% Cam kết chấp nhận voucher</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">CĂN TIN & F&B CAMPUS</div>
                      <div className="text-2xl sm:text-3xl font-black text-[#059669] my-2">4 Đối Tác</div>
                      <div className="text-[11px] text-neutral-500 font-medium">Tích hợp trực tiếp máy quét :3009</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">NHÀ TÀI TRỢ DỊCH VỤ</div>
                      <div className="text-2xl sm:text-3xl font-black text-neutral-900 my-2">2 Đối Tác</div>
                      <div className="text-[11px] text-neutral-500 font-medium">Gym, Ngoại ngữ, Công nghệ</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">ĐỐI SOÁT DOANH THU</div>
                      <div className="text-2xl sm:text-3xl font-black text-[#059669] my-2">89.1 Tr</div>
                      <div className="text-[11px] text-neutral-500 font-medium">Tổng giá trị đơn hàng kéo theo</div>
                    </div>
                  </div>

                  {/* Thanh lọc đối tác */}
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-neutral-200/70">
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "all", label: "Tất Cả", count: contractsList.length },
                        { id: "fb", label: "Căn Tin & F&B", count: contractsList.filter(c => c.category === 'fb').length },
                        { id: "sponsor", label: "Tài Trợ Dịch Vụ", count: contractsList.filter(c => c.category === 'sponsor').length },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setContractFilter(tab.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                            contractFilter === tab.id
                              ? "bg-neutral-900 text-white shadow-sm"
                              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80"
                          }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid Danh Sách Hợp Đồng */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contractsList
                      .filter(c => contractFilter === 'all' || c.category === contractFilter)
                      .map((ctr) => (
                        <div
                          key={ctr.id}
                          className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-neutral-300 transition"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                {ctr.categoryLabel}
                              </span>
                              <span className="text-[10px] font-bold text-neutral-400 font-mono">
                                {ctr.id}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-sm font-black text-black">{ctr.partner}</h4>
                              <p className="text-[11px] font-semibold text-neutral-400 mt-0.5">{ctr.scope}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#F9FAF9] border border-neutral-200/70 text-[11px] font-medium text-neutral-700">
                              <div className="text-[9px] font-black uppercase text-neutral-400 mb-0.5">CAM KẾT HỢP ĐỒNG</div>
                              {ctr.commitment}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                              <div>
                                <span className="text-[9px] uppercase font-bold text-neutral-400 block">HẠN MỨC THÁNG</span>
                                <span className="font-black text-black">{ctr.monthlyQuota}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase font-bold text-neutral-400 block">TỶ LỆ QUY ĐỔI</span>
                                <span className="font-black text-[#059669]">{ctr.redemptionRate}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-neutral-100 mt-4 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-neutral-400 block uppercase">ĐỐI SOÁT</span>
                              <span className="text-xs font-black text-black">{ctr.totalSettled}</span>
                            </div>
                            <button
                              onClick={() => {
                                setSyncToast(`Đã tải hồ sơ đối soát ${ctr.partner}`);
                                setTimeout(() => setSyncToast(null), 2500);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition"
                            >
                              Chi Tiết
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 3: CHIẾN DỊCH BẪY MUA & KHẢO SÁT 3S
              ========================================================================= */}
              {activeWorkspaceTab === "campaigns" && (
                <div className="space-y-6">
                  {/* KPI Chiến Dịch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">CHIẾN DỊCH ACTIVE</div>
                      <div className="text-2xl sm:text-3xl font-black text-[#059669] my-2">
                        {campaignsList.filter(c => c.status === 'active').length} Chiến Dịch
                      </div>
                      <div className="text-[11px] text-neutral-500 font-medium">Đang phát voucher tại các trạm</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">VOUCHER ĐÃ PHÁT HÀNH</div>
                      <div className="text-2xl sm:text-3xl font-black text-neutral-900 my-2">1,300 Mã</div>
                      <div className="text-[11px] text-neutral-500 font-medium">Tổng ngân sách chiến dịch</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">TỶ LỆ QUY ĐỔI TẠI QUẦY</div>
                      <div className="text-2xl sm:text-3xl font-black text-[#059669] my-2">84.2%</div>
                      <div className="text-[11px] text-neutral-500 font-medium">Khách mang voucher đến quầy POS</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] font-black uppercase text-neutral-400">DOANH THU MỚI TẠO RA</div>
                      <div className="text-2xl sm:text-3xl font-black text-neutral-900 my-2">48.5 Tr</div>
                      <div className="text-[11px] text-neutral-500 font-medium">Đòn bẩy 4.5x trên chi phí voucher</div>
                    </div>
                  </div>

                  {/* Danh sách chiến dịch */}
                  <div className="space-y-4">
                    {campaignsList.map((cmp) => {
                      const pct = Math.min(100, Math.round((cmp.quotaUsed / cmp.quotaTotal) * 100));
                      return (
                        <div
                          key={cmp.id}
                          className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-6"
                        >
                          <div className="space-y-2 min-w-0 max-w-xl">
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm font-black text-black">{cmp.name}</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                cmp.status === 'active' ? 'bg-emerald-50 text-[#059669] border border-emerald-200/60' : 'bg-neutral-100 text-neutral-500'
                              }`}>
                                {cmp.status === 'active' ? 'ĐANG KÍCH HOẠT' : 'ĐÃ TẠM DỪNG'}
                              </span>
                            </div>

                            <p className="text-xs text-neutral-500 font-medium">
                              Thương hiệu: <strong className="text-black">{cmp.brand}</strong> • Món đẩy doanh số: <strong className="text-black">{cmp.dish}</strong>
                            </p>

                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 font-bold">
                                {cmp.discount}
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#059669] font-bold border border-emerald-200/50">
                                Điều kiện: {cmp.condition}
                              </span>
                            </div>

                            <div className="space-y-1 pt-2">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-neutral-500">Tiến độ quy đổi voucher</span>
                                <span className="text-black">{cmp.quotaUsed} / {cmp.quotaTotal} mã ({pct}%)</span>
                              </div>
                              <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#059669] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>

                          <div className="flex md:flex-col items-center md:items-end justify-between gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-neutral-100">
                            <div className="text-left md:text-right">
                              <div className="text-[10px] font-black uppercase text-neutral-400">DOANH THU MỚI KÉO THEO</div>
                              <div className="text-xl font-black text-black">{cmp.revenue}</div>
                              <div className="text-xs font-bold text-[#059669]">Đòn bẩy ROI: {cmp.roi}</div>
                            </div>

                            <button
                              onClick={() => toggleCampaignStatus(cmp.id)}
                              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                                cmp.status === 'active'
                                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                                  : 'bg-[#059669] hover:bg-[#047857] text-white'
                              }`}
                            >
                              {cmp.status === 'active' ? 'Tạm Dừng Chiến Dịch' : 'Kích Hoạt Lại'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 4: CÀI ĐẶT HỆ THỐNG HQ CLEARINGHOUSE
              ========================================================================= */}
              {activeWorkspaceTab === "settings" && (
                <div className="space-y-6 max-w-4xl">
                  {/* Cấu hình cơ chế quy đổi 4-Win */}
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                      <div>
                        <h3 className="text-sm font-black text-black tracking-tight">
                          Cơ Chế Quy Đổi & Chống Gian Lận (Clearinghouse Rules)
                        </h3>
                        <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                          Thiết lập các tham số cốt lõi cho sàn bù trừ và đối soát tự động
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="p-4 rounded-2xl bg-[#F9FAF9] border border-neutral-200/70 space-y-1.5">
                          <label className="block text-[11px] font-black uppercase text-neutral-500">
                            ĐIỂM XANH MỖI VỎ CHAI (PET)
                          </label>
                          <input
                            type="number"
                            value={settingsData.pointsPerBottle}
                            onChange={(e) => setSettingsData({ ...settingsData, pointsPerBottle: Number(e.target.value) })}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-neutral-200 text-sm font-black text-black outline-none focus:border-[#059669]"
                          />
                          <span className="text-[10px] text-neutral-400 font-medium">Mặc định: 1 Vỏ sạch = 10 Điểm</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#F9FAF9] border border-neutral-200/70 space-y-1.5">
                          <label className="block text-[11px] font-black uppercase text-neutral-500">
                            HẠN MỨC QUÉT TỐI ĐA / NGÀY
                          </label>
                          <input
                            type="number"
                            value={settingsData.maxScansPerDay}
                            onChange={(e) => setSettingsData({ ...settingsData, maxScansPerDay: Number(e.target.value) })}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-neutral-200 text-sm font-black text-black outline-none focus:border-[#059669]"
                          />
                          <span className="text-[10px] text-neutral-400 font-medium">Giới hạn chống gian lận lặp mã</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#F9FAF9] border border-neutral-200/70 space-y-1.5">
                          <label className="block text-[11px] font-black uppercase text-neutral-500">
                            HÓA ĐƠN TỐI THIỂU ÁP DỤNG F&B (VNĐ)
                          </label>
                          <input
                            type="number"
                            value={settingsData.minBillAmount}
                            onChange={(e) => setSettingsData({ ...settingsData, minBillAmount: Number(e.target.value) })}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-neutral-200 text-sm font-black text-black outline-none focus:border-[#059669]"
                          />
                          <span className="text-[10px] text-neutral-400 font-medium">Đảm bảo đơn kéo theo luôn sinh lời</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#F9FAF9] border border-neutral-200/70 space-y-1.5">
                          <label className="block text-[11px] font-black uppercase text-neutral-500">
                            THỜI HẠN VOUCHER (GIỜ)
                          </label>
                          <input
                            type="number"
                            value={settingsData.voucherExpiryHours}
                            onChange={(e) => setSettingsData({ ...settingsData, voucherExpiryHours: Number(e.target.value) })}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-neutral-200 text-sm font-black text-black outline-none focus:border-[#059669]"
                          />
                          <span className="text-[10px] text-neutral-400 font-medium">Hết hạn sau 24h kích hoạt tại thùng</span>
                        </div>
                      </div>
                    </div>

                    {/* Trạng thái kết nối các cổng phân tán */}
                    <div className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
                      <div>
                        <h3 className="text-sm font-black text-black tracking-tight">
                          Hạ Tầng Kết Nối Phân Tán (Ecosystem Gateway Status)
                        </h3>
                        <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                          Tình trạng hoạt động thời gian thực của 5 cổng EcoPass
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {[
                          { port: "3009", name: "Quầy Thu Ngân POS", role: "Điểm Chạm Xác Thực Đơn Hàng", status: "Online" },
                          { port: "3010", name: "Trụ Sở Điều Hành Brand", role: "Sàn Đối Soát Bù Trừ 4-Win", status: "Active (Hiện Tại)" },
                          { port: "3011", name: "Cổng Cửa Hàng F&B", role: "Quản Lý Món Chậm & Tem Ly", status: "Online" },
                          { port: "3012", name: "Cổng Đối Tác Tài Trợ", role: "Gói Ưu Đãi & Check-in Dịch Vụ", status: "Online" },
                          { port: "3013", name: "Cổng Định Danh Sinh Viên", role: "Single Sign-On (SSO) Campus", status: "Online" },
                        ].map((gw) => (
                          <div
                            key={gw.port}
                            className="p-3.5 rounded-2xl bg-[#F9FAF9] border border-neutral-200/70 flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-black">:{gw.port}</span>
                                <span className="text-xs font-bold text-neutral-700">{gw.name}</span>
                              </div>
                              <div className="text-[10px] text-neutral-400 font-medium">{gw.role}</div>
                            </div>
                            <span className="text-[10px] font-black text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                              {gw.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingSettings}
                        className="px-6 py-2.5 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-2"
                      >
                        {isSavingSettings ? (
                          <>
                            <RotateCw size={14} className="animate-spin" />
                            <span>Đang Lưu Cấu Hình...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            <span>Lưu Cấu Hình Vận Hành</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </main>
        </div>

      {/* =========================================================================
          MODAL XEM MÃ QR THÙNG RÁC (APPLE PASS STYLE)
      ========================================================================= */}
      {selectedBin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-white/40 space-y-5 text-center">
            <button 
              onClick={() => setSelectedBin(null)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition"
              title="Đóng (Esc)"
            >
              <X size={16} />
            </button>

            <div>
              <div className="w-12 h-12 rounded-[14px] bg-[#1A1D1A] text-white flex items-center justify-center font-black text-lg mx-auto mb-2 shadow-md">
                {selectedBin.stationCode}
              </div>
              <h3 className="text-lg font-black text-[#1A1D1A]">
                {selectedBin.name}
              </h3>
              <p className="text-xs font-semibold text-neutral-400 mt-0.5">
                {selectedBin.location}
              </p>
            </div>

            <div className="bg-[#F8FAF8] rounded-[24px] p-6 inline-block border border-neutral-200 shadow-inner">
              <QRCodeSVG 
                value={selectedBin.qrValue}
                size={200}
                level="H"
                fgColor="#1A1D1A"
                bgColor="transparent"
              />
              <div className="text-[11px] font-mono font-bold text-neutral-500 mt-3">
                {selectedBin.qrValue}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-[#F8FAF8] rounded-[18px] p-3 text-center border border-neutral-100">
              <div>
                <span className="block text-[9px] uppercase font-bold text-neutral-400">MỨC ĐẦY</span>
                <span className={`text-sm font-black ${selectedBin.riskColor}`}>{selectedBin.fillPercent}%</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-neutral-400">ĐÃ GOM</span>
                <span className="text-sm font-black text-[#1A1D1A]">{selectedBin.collectedCount}</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-neutral-400">TRẠNG THÁI</span>
                <span className={`text-xs font-black ${selectedBin.riskColor}`}>{selectedBin.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button 
                onClick={() => alert(`Đã tải file SVG mã QR cho ${selectedBin.name}`)}
                className="py-2.5 px-4 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-black text-[#1A1D1A] flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Download size={14} />
                <span>Tải Mã In Ấn</span>
              </button>
              <button 
                onClick={() => setSelectedBin(null)}
                className="py-2.5 px-4 rounded-full bg-[#6BA101] hover:bg-[#5E8E00] text-white text-xs font-black transition active:scale-95 shadow-sm"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL BẢN ĐỒ CAMPUS BLUEPRINT (KẾ THỪA ẢNH 2 & ẢNH 3)
      ========================================================================= */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-white/40 space-y-4 text-center">
            <button 
              onClick={() => setIsMapModalOpen(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition"
              title="Đóng (Esc)"
            >
              <X size={16} />
            </button>

            <div>
              <h3 className="text-lg font-black text-[#1A1D1A]">
                Sơ Đồ Tọa Độ Campus HUTECH (Khu E)
              </h3>
              <p className="text-xs font-semibold text-neutral-400 mt-0.5">
                Vị trí thời gian thực của 6 trạm thu gom rác thông minh
              </p>
            </div>

            {/* Bản đồ SVG Blueprint trực quan */}
            <div className="relative w-full h-64 bg-[#F2F4F0] rounded-[24px] border border-neutral-200 overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full p-4" viewBox="0 0 600 300" fill="none">
                {/* Các khối tòa nhà */}
                <rect x="40" y="40" width="160" height="100" rx="12" fill="#E2E6DF" stroke="#CCD2C7" strokeWidth="2" />
                <text x="120" y="95" textAnchor="middle" fill="#6B7264" fontSize="13" fontWeight="bold">TÒA H6 (CĂN TIN)</text>

                <rect x="360" y="40" width="180" height="90" rx="12" fill="#E2E6DF" stroke="#CCD2C7" strokeWidth="2" />
                <text x="450" y="90" textAnchor="middle" fill="#6B7264" fontSize="13" fontWeight="bold">TÒA H1 (KỸ THUẬT)</text>

                <rect x="80" y="180" width="140" height="80" rx="12" fill="#E2E6DF" stroke="#CCD2C7" strokeWidth="2" />
                <text x="150" y="225" textAnchor="middle" fill="#6B7264" fontSize="12" fontWeight="bold">THƯ VIỆN</text>

                <rect x="320" y="170" width="220" height="90" rx="12" fill="#E2E6DF" stroke="#CCD2C7" strokeWidth="2" />
                <text x="430" y="220" textAnchor="middle" fill="#6B7264" fontSize="12" fontWeight="bold">KÝ TÚC XÁ SINH VIÊN</text>

                {/* Các chấm pin định vị thùng rác */}
                {/* Pin H6: 82% Cần dọn */}
                <circle cx="160" cy="110" r="14" fill="#D94841" className="animate-pulse" />
                <circle cx="160" cy="110" r="8" fill="#FFFFFF" />
                <text x="160" y="135" textAnchor="middle" fill="#D94841" fontSize="10" fontWeight="black">H6 (82%)</text>

                {/* Pin H1: 34% Ổn định */}
                <circle cx="420" cy="85" r="12" fill="#6BA101" />
                <circle cx="420" cy="85" r="6" fill="#FFFFFF" />
                <text x="420" y="110" textAnchor="middle" fill="#3A5A42" fontSize="10" fontWeight="black">H1 (34%)</text>

                {/* Pin Thư viện: 58% Gần đầy */}
                <circle cx="150" cy="210" r="12" fill="#E68A00" />
                <circle cx="150" cy="210" r="6" fill="#FFFFFF" />
                <text x="150" y="235" textAnchor="middle" fill="#B45309" fontSize="10" fontWeight="black">LIB (58%)</text>

                {/* Pin Highlands: 88% Cần dọn */}
                <circle cx="90" cy="80" r="14" fill="#D94841" className="animate-pulse" />
                <circle cx="90" cy="80" r="8" fill="#FFFFFF" />
                <text x="90" y="105" textAnchor="middle" fill="#D94841" fontSize="10" fontWeight="black">HL (88%)</text>
              </svg>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setIsMapModalOpen(false)}
                className="px-5 py-2.5 rounded-full bg-[#1A1D1A] text-white text-xs font-bold"
              >
                Đóng Bản Đồ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TÌM KIẾM NHANH */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-[28px] p-6 shadow-2xl border border-neutral-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-150">
              <div className="flex items-center gap-2.5 text-[#1A1D1A]">
                <Search size={18} className="text-neutral-400" />
                <span className="font-black text-sm">Tìm kiếm trạm hoặc chiến dịch</span>
              </div>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <X size={14} />
              </button>
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập tên trạm, mã tòa nhà (H6, H1, KTX)..."
              className="w-full px-4 py-3 rounded-xl bg-[#F8FAF8] border border-neutral-200 text-sm font-semibold outline-none focus:border-[#6BA101]"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="px-4 py-2 rounded-full bg-[#1A1D1A] text-white text-xs font-bold"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CÀI ĐẶT */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-neutral-100 space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-150">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-[#6BA101]" />
                <span className="font-black text-sm text-[#1A1D1A]">Cấu hình EcoPass Hub</span>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAF8]">
                <div>
                  <span className="font-black text-[#1A1D1A] block">Tự động đồng bộ với POS</span>
                  <span className="text-neutral-400 text-[11px]">Đẩy mã voucher mới sang cổng :3009 mỗi 5 phút</span>
                </div>
                <input type="checkbox" defaultChecked className="accent-[#6BA101] w-4 h-4 rounded" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAF8]">
                <div>
                  <span className="font-black text-[#1A1D1A] block">Cảnh báo thùng đầy qua Telegram</span>
                  <span className="text-neutral-400 text-[11px]">Thông báo khi thùng vượt quá 85% dung lượng</span>
                </div>
                <input type="checkbox" defaultChecked className="accent-[#6BA101] w-4 h-4 rounded" />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 rounded-full bg-[#1A1D1A] text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL TẠO HỢP ĐỒNG ĐỐI TÁC MỚI (TAB 2)
      ========================================================================= */}
      {isNewContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-neutral-100 space-y-5 text-left text-black">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Handshake size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-black">Tạo Hợp Đồng Đối Tác Mới</h3>
                  <p className="text-[11px] text-neutral-400 font-semibold">Tích hợp vào sàn đối soát bù trừ EcoPass Hub</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewContractModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Tên Đối Tác Ký Kết</label>
                <input
                  type="text"
                  required
                  value={newContractForm.partner}
                  onChange={(e) => setNewContractForm({ ...newContractForm, partner: e.target.value })}
                  placeholder="Ví dụ: Căn Tin Khu B, Gong Cha Campus..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Nhóm Đối Tác</label>
                  <select
                    value={newContractForm.category}
                    onChange={(e) => setNewContractForm({ ...newContractForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  >
                    <option value="fb">Căn Tin & F&B</option>
                    <option value="sponsor">Tài Trợ Dịch Vụ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Hạn Mức Tháng</label>
                  <input
                    type="text"
                    value={newContractForm.monthlyQuota}
                    onChange={(e) => setNewContractForm({ ...newContractForm, monthlyQuota: e.target.value })}
                    placeholder="Ví dụ: 600 mã/tháng"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Phạm Vi Áp Dụng (Vị Trí)</label>
                <input
                  type="text"
                  value={newContractForm.scope}
                  onChange={(e) => setNewContractForm({ ...newContractForm, scope: e.target.value })}
                  placeholder="Ví dụ: Sảnh Tòa H1, Căn tin Khu E..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Cam Kết Hợp Đồng & Điều Kiện Áp Dụng</label>
                <textarea
                  rows={2}
                  value={newContractForm.commitment}
                  onChange={(e) => setNewContractForm({ ...newContractForm, commitment: e.target.value })}
                  placeholder="Ví dụ: Giảm 10k cho đơn từ 45k có kèm món chỉ định..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669] resize-none"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewContractModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Ký Kết & Lưu Sàn</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL TẠO CHIẾN DỊCH BẪY MUA MỚI (TAB 3)
      ========================================================================= */}
      {isNewCampaignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-neutral-100 space-y-5 text-left text-black">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Flame size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-black">Tạo Chiến Dịch Kích Cầu F&B</h3>
                  <p className="text-[11px] text-neutral-400 font-semibold">Tạo voucher bẫy mua giải phóng hàng tồn nguyên liệu</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewCampaignModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Tên Chiến Dịch Kích Cầu</label>
                <input
                  type="text"
                  required
                  value={newCampaignForm.name}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, name: e.target.value })}
                  placeholder="Ví dụ: Kích Cầu Freeze Trà Xanh Tháng 10..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Thương Hiệu Quán</label>
                  <input
                    type="text"
                    required
                    value={newCampaignForm.brand}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, brand: e.target.value })}
                    placeholder="Ví dụ: Highlands Coffee, Phúc Long..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Món Cần Đẩy Doanh Số</label>
                  <input
                    type="text"
                    required
                    value={newCampaignForm.dish}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, dish: e.target.value })}
                    placeholder="Ví dụ: Phindi Hạnh Nhân..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Mức Giảm Giá Voucher</label>
                  <input
                    type="text"
                    value={newCampaignForm.discount}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, discount: e.target.value })}
                    placeholder="Ví dụ: Giảm 10.000đ"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Điều Kiện Hóa Đơn</label>
                  <input
                    type="text"
                    value={newCampaignForm.condition}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, condition: e.target.value })}
                    placeholder="Ví dụ: Đơn từ 45.000đ"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Số Lượng Voucher Phát Hành</label>
                <input
                  type="number"
                  value={newCampaignForm.quotaTotal}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, quotaTotal: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCampaignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
                >
                  <Flame size={14} />
                  <span>Kích Hoạt Chiến Dịch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: THÊM MÃ QR THÙNG RÁC MỚI (TAB STORE_QRS)
      ========================================================================= */}
      {isNewQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-[32px] p-6 sm:p-7 shadow-2xl border border-neutral-100 space-y-4 text-left text-black">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-black">Cấp Mã QR Thùng Rác Mới</h3>
                  <p className="text-[11px] text-neutral-400 font-semibold">Tạo điểm thu gom rác cho cửa hàng đối tác</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewQrModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateStoreQr} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Mã QR Code (In trên thùng)</label>
                <input
                  type="text"
                  required
                  value={newQrForm.qrCode}
                  onChange={(e) => setNewQrForm({ ...newQrForm, qrCode: e.target.value.toUpperCase() })}
                  placeholder="Ví dụ: BIN-HL-05, BIN-PL-03..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-mono font-bold text-black outline-none focus:border-[#059669]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Cửa Hàng / Đối Tác</label>
                <select
                  value={newQrForm.storeId}
                  onChange={(e) => {
                    const sel = partnerStoresList.find(p => p.id === e.target.value);
                    setNewQrForm({
                      ...newQrForm,
                      storeId: e.target.value,
                      storeName: sel ? sel.name : 'Highlands Coffee',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                >
                  <option value="highlands">Highlands Coffee</option>
                  <option value="phuclong">Phúc Long Tea & Coffee</option>
                  <option value="tch">The Coffee House</option>
                  <option value="cheese">Cheese Coffee</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Vị Trí Đặt Thùng Rác (Campus)</label>
                <input
                  type="text"
                  required
                  value={newQrForm.location}
                  onChange={(e) => setNewQrForm({ ...newQrForm, location: e.target.value })}
                  placeholder="Ví dụ: Tòa Alpha - Sảnh Thang Máy Tầng 2"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewQrModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Lưu Vào CSDL</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: THÊM TEM MÃ VẠCH MỚI (TAB ORDER_STICKERS)
      ========================================================================= */}
      {isNewStickerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-[32px] p-6 sm:p-7 shadow-2xl border border-neutral-100 space-y-4 text-left text-black">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Ticket size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-black">Thêm Tem Mã Vạch Đối Tác</h3>
                  <p className="text-[11px] text-neutral-400 font-semibold">Lưu trữ mã vạch đơn hàng để app xác thực Bước 2</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewStickerModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateSticker} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Mã Vạch Barcode</label>
                  <input
                    type="text"
                    required
                    value={newStickerForm.barcode}
                    onChange={(e) => setNewStickerForm({ ...newStickerForm, barcode: e.target.value.trim() })}
                    placeholder="Ví dụ: 8931002245"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-mono font-bold text-black outline-none focus:border-[#059669]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Mã Đơn POS</label>
                  <input
                    type="text"
                    value={newStickerForm.code}
                    onChange={(e) => setNewStickerForm({ ...newStickerForm, code: e.target.value.trim() })}
                    placeholder="Ví dụ: #HL-8930"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-bold text-black outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Thương Hiệu Cửa Hàng</label>
                <select
                  value={newStickerForm.storeId}
                  onChange={(e) => {
                    const sel = partnerStoresList.find(p => p.id === e.target.value);
                    setNewStickerForm({
                      ...newStickerForm,
                      storeId: e.target.value,
                      storeName: sel ? sel.name : 'Highlands Coffee',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                >
                  <option value="highlands">Highlands Coffee</option>
                  <option value="phuclong">Phúc Long Tea & Coffee</option>
                  <option value="tch">The Coffee House</option>
                  <option value="cheese">Cheese Coffee</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase text-neutral-500">Tên Món / Thức Uống</label>
                <input
                  type="text"
                  required
                  value={newStickerForm.drinkName}
                  onChange={(e) => setNewStickerForm({ ...newStickerForm, drinkName: e.target.value })}
                  placeholder="Ví dụ: Freeze Trà Xanh, Phindi Ca-cao..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Quầy POS In Tem</label>
                  <input
                    type="text"
                    value={newStickerForm.posTerminal}
                    onChange={(e) => setNewStickerForm({ ...newStickerForm, posTerminal: e.target.value })}
                    placeholder="POS 1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-black uppercase text-neutral-500">Giá Đơn Hàng (VNĐ)</label>
                  <input
                    type="number"
                    value={newStickerForm.price}
                    onChange={(e) => setNewStickerForm({ ...newStickerForm, price: Number(e.target.value) })}
                    placeholder="45000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAF9] border border-neutral-200 font-semibold text-black outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewStickerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Lưu Tem Vào CSDL</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: XEM & IN MÃ QR THÙNG RÁC KHỔ CHUẨN DECAL
      ========================================================================= */}
      {selectedQrPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-[32px] p-6 sm:p-7 shadow-2xl border border-neutral-100 space-y-4 text-center text-black">
            <button 
              onClick={() => setSelectedQrPrint(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
            >
              <X size={15} />
            </button>

            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#059669] text-[10px] font-black uppercase tracking-wider mb-2">
                <ShieldCheck size={12} />
                <span>ECOPASS • ĐIỂM THU GOM LIÊN KẾT</span>
              </div>
              <h3 className="text-lg font-black text-neutral-900">{selectedQrPrint.storeName}</h3>
              <p className="text-xs text-neutral-500 font-semibold">{selectedQrPrint.location}</p>
            </div>

            {/* Khung Mã QR SVG chất lượng cao */}
            <div className="p-4 bg-white rounded-3xl border-2 border-dashed border-neutral-300 inline-block shadow-inner">
              <QRCodeSVG value={selectedQrPrint.qrCode} size={180} level="H" />
            </div>

            <div className="font-mono font-black text-sm text-neutral-800 tracking-wider">
              {selectedQrPrint.qrCode}
            </div>
            <p className="text-[11px] text-neutral-400 font-medium">
              Dán mã này tại nắp hoặc thân thùng rác phân loại để sinh viên quét xác thực Bước 1.
            </p>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-black transition shadow-sm flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>In Nhãn Dán Decal</span>
              </button>
              <button
                onClick={() => setSelectedQrPrint(null)}
                className="px-4 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: XEM MÃ VẠCH TEM LY ĐỂ CAMERA ĐIỆN THOẠI QUÉT BƯỚC 2
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
                <Store size={12} />
                <span>ECOPASS • TEM LY NƯỚC (BƯỚC 2)</span>
              </div>
              <h3 className="text-lg font-black text-neutral-900">{selectedStickerPreview.storeName}</h3>
              <p className="text-sm text-neutral-800 font-extrabold mt-0.5">
                {selectedStickerPreview.drinkName} • <span className="font-mono text-[#059669]">{selectedStickerPreview.code}</span>
              </p>
              <p className="text-xs text-neutral-500 font-semibold mt-0.5">
                {selectedStickerPreview.posTerminal} • {selectedStickerPreview.price ? Number(selectedStickerPreview.price).toLocaleString('vi-VN') + 'đ' : '45.000đ'}
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
                  setSyncToast(`Đã sao chép mã ${selectedStickerPreview.barcode}`);
                  setTimeout(() => setSyncToast(null), 2000);
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
  );
}