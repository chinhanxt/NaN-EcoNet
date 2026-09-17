import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

export interface PromptItem {
  id: string;
  label: string;
  prompt: string;
  icon?: string | React.ReactNode;
  badge?: string;
}

interface QuickPromptCarouselProps {
  prompts?: PromptItem[];
  onSelectPrompt: (prompt: string, item: PromptItem) => void;
  className?: string;
  title?: string;
}

const DEFAULT_PROMPTS: PromptItem[] = [
  {
    id: "p1",
    label: "Biến Thiên Tháng 9",
    prompt: "Phân tích chi tiết biến thiên doanh thu và chi phí trong tháng 9/2026",
    icon: "📊",
    badge: "DWH",
  },
  {
    id: "p2",
    label: "Hiệu Quả 5 Khối",
    prompt: "Lập bảng so sánh ROI và hiệu suất KPI giữa các khối phòng ban Q3",
    icon: "📈",
    badge: "C-Level",
  },
  {
    id: "p3",
    label: "Đối Soát Ngân Sách",
    prompt: "Chạy đối soát chênh lệch ngân sách thực chi so với dự toán và trích xuất bảng tổng hợp",
    icon: "⚖️",
    badge: "Excel",
  },
  {
    id: "p4",
    label: "Xem Schema DWH",
    prompt: "Hiển thị cấu trúc dữ liệu DWH và lineage của bảng fact_financial_ledger",
    icon: "🏛️",
    badge: "Catalog",
  },
  {
    id: "p5",
    label: "Cảnh Báo Dòng Tiền",
    prompt: "Mô phỏng kịch bản stress-test dòng tiền 90 ngày tới nếu khách hàng lớn trễ hạn",
    icon: "🛡️",
    badge: "Risk",
  },
];

export const QuickPromptCarousel: React.FC<QuickPromptCarouselProps> = ({
  prompts = DEFAULT_PROMPTS,
  onSelectPrompt,
  className = "",
  title = "Tác vụ gợi ý tiếp theo cho Sếp",
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => window.removeEventListener("resize", checkScrollability);
  }, [prompts]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className={`w-full py-2 font-sans ${className}`}>
      {title && (
        <div className="flex items-center gap-1.5 mb-2 px-0.5 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
          <Zap className="w-3.5 h-3.5 text-slate-900 stroke-[2.2]" />
          <span>{title}</span>
        </div>
      )}

      <div className="relative group">
        {/* Nút cuộn trái */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            aria-label="Cuộn sang trái"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white shadow-md border border-slate-300 text-slate-700 hover:scale-105 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
          </button>
        )}

        {/* Nút cuộn phải */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            aria-label="Cuộn sang phải"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white shadow-md border border-slate-300 text-slate-700 hover:scale-105 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
          </button>
        )}

        {/* Container danh sách chip */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollability}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth px-0.5 py-1"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {prompts.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectPrompt(item.prompt, item)}
              className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:border-slate-950 hover:bg-slate-50 transition-all text-left cursor-pointer shadow-2xs btn-tactile"
            >
              {/* Icon / Emoji */}
              <span className="text-sm select-none">{item.icon}</span>

              {/* Nhãn chính */}
              <span className="text-xs font-bold text-slate-950 whitespace-nowrap">
                {item.label}
              </span>

              {/* Badge phân loại */}
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold whitespace-nowrap border border-slate-200">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
