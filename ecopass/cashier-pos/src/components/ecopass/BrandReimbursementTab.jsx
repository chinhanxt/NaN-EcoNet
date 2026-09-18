import React from "react";
import { ShieldCheck, Building2, CheckCircle2, ChevronRight, Coins } from "lucide-react";

export const BrandReimbursementTab = () => {
  const sponsors = [
    {
      name: "Suntory PepsiCo Việt Nam",
      campaign: "Khảo sát vị Trà Ô Long Tea+ & Thu vỏ PET",
      vouchersRedeemed: 8,
      amount: 80000,
      status: "Đã chốt đối soát",
      payoutDate: "20/09/2026",
    },
    {
      name: "TCP Group (Warrior Energy)",
      campaign: "Dùng thử Nước Tăng Lực Warrior Vị Nho",
      vouchersRedeemed: 4,
      amount: 40000,
      status: "Đã chốt đối soát",
      payoutDate: "20/09/2026",
    },
    {
      name: "Quỹ EPR & Khuyến Mãi Tân Binh",
      campaign: "Chương trình chào mừng tân sinh viên HUTECH",
      vouchersRedeemed: 3,
      amount: 30000,
      status: "Đã thanh toán",
      payoutDate: "18/09/2026",
    },
  ];

  const totalReimbursed = sponsors.reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 font-['Plus_Jakarta_Sans',sans-serif] animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-black text-[#1A1D1A]">
          Đối Soát Hoàn Tiền Nhãn Hàng
        </h2>
        <p className="text-xs text-[#606861]">
          Ngân sách MarTech & EPR tài trợ 100% chi phí voucher cho Cửa Hàng
        </p>
      </div>

      {/* Overview Card */}
      <div className="bg-gradient-to-br from-[#1E201E] to-[#2D312E] rounded-[28px] p-5 text-white shadow-ios-float relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full w-fit">
            <ShieldCheck size={13} />
            Bảo Lãnh Thanh Toán 100%
          </div>

          <div className="text-3xl font-black tracking-tight mt-3">
            +{totalReimbursed.toLocaleString("vi-VN")}đ
          </div>
          <p className="text-xs text-white/80 mt-1">
            Tổng tiền nhãn hàng sẽ hoàn trả cho Căn tin kỳ đối soát tuần này.
          </p>

          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs text-white/90 font-medium">
            <span>Trạng thái tài khoản:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} />
              Đã kiểm toán tự động
            </span>
          </div>
        </div>
      </div>

      {/* Brand Breakdown */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-[#606861] uppercase tracking-wider px-1">
          Chi Tiết Nhãn Hàng Hoàn Tiền
        </span>

        {sponsors.map((s, idx) => (
          <div
            key={idx}
            className="bg-white p-4 rounded-[24px] border border-black/[0.04] shadow-ios-card space-y-2"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-xs font-bold text-[#1A1D1A] flex items-center gap-1.5">
                  <Building2 size={14} className="text-[#3A9A43]" />
                  {s.name}
                </h4>
                <p className="text-[11px] text-[#606861] mt-0.5">
                  {s.campaign}
                </p>
              </div>
              <span className="text-sm font-black text-[#3A9A43]">
                +{s.amount.toLocaleString("vi-VN")}đ
              </span>
            </div>

            <div className="pt-2 border-t border-black/[0.03] flex justify-between items-center text-[11px] text-[#949E95]">
              <span>{s.vouchersRedeemed} lượt voucher quy đổi</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
