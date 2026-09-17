"use client";

import React from "react";
import { ArrowLeft, MapPin, Navigation, Store, Sparkles, Coffee } from "lucide-react";

interface MapScreenProps {
  onBack: () => void;
  onSelectSpot: (spotName: string) => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({ onBack, onSelectSpot }) => {
  const spots = [
    {
      id: "1",
      name: "Căn Tin Sảnh E (Khu Ăn Uống)",
      location: "Đại học HUTECH • Tầng Trệt Sảnh E",
      distance: "Cách 15m",
      status: "Đang mở cửa",
      binType: "Thùng Rác Phân Loại 3 Ngăn",
      icon: Coffee,
      badge: "Đối Tác Ưu Đãi",
    },
    {
      id: "2",
      name: "Máy Bán Nước Tự Động Sảnh B",
      location: "Hành lang Tầng Trệt Tòa Nhà B",
      distance: "Cách 40m",
      status: "Hoạt động 24/7",
      binType: "Thùng Ép Vỏ Lon & Chai Nhựa",
      icon: Sparkles,
      badge: "Lon 0đ Sẵn Sàng",
    },
    {
      id: "3",
      name: "Cửa Hàng Ministop Cơ Sở B",
      location: "Góc cổng số 2 Đường D2",
      distance: "Cách 110m",
      status: "Mở 24/24",
      binType: "Quầy Thu Ngân Quét Voucher (SP 3)",
      icon: Store,
      badge: "Chấp Nhận Voucher",
    },
  ];

  return (
    <div className="flex-1 flex flex-col p-5 space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white border border-black/5 shadow-ios-card flex items-center justify-center text-[#1A1D1A] active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>

        <h1 className="text-lg font-black text-[#1A1D1A]">
          Bản Đồ Điểm Thu Gom
        </h1>

        <div className="w-10 h-10 rounded-full bg-[#E8F5E9] text-[#3A9A43] flex items-center justify-center">
          <MapPin size={18} />
        </div>
      </div>

      {/* Visual Map Mockup Card */}
      <div className="relative w-full h-44 rounded-[28px] bg-gradient-to-tr from-emerald-100 via-teal-50 to-green-100 border border-black/5 overflow-hidden shadow-ios-card p-4 flex flex-col justify-between">
        {/* Decorative Grid Lines to simulate map */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3A9A43_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10 flex justify-between items-start">
          <span className="text-[11px] font-extrabold uppercase bg-white/90 text-[#3A9A43] px-3 py-1 rounded-full shadow-sm">
            Định vị Campus HUTECH
          </span>
          <span className="w-8 h-8 rounded-full bg-white text-[#1A1D1A] flex items-center justify-center shadow-sm">
            <Navigation size={14} className="text-[#3A9A43]" />
          </span>
        </div>

        <div className="relative z-10 bg-white/95 backdrop-blur-md p-3 rounded-[20px] border border-black/5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#1A1D1A]">Thùng rác gần bạn nhất: Sảnh E</div>
            <div className="text-[11px] text-[#606861]">Chỉ mất 20 bước chân để đổi voucher</div>
          </div>
          <button
            onClick={() => onSelectSpot("Căn Tin Sảnh E")}
            className="px-3 py-1.5 rounded-full bg-[#3A9A43] text-white text-xs font-bold shadow-ios-glow active:scale-95"
          >
            Đến ngay
          </button>
        </div>
      </div>

      {/* List of Nearby Spots */}
      <div className="space-y-3 pt-2">
        <span className="text-xs font-bold text-[#606861] uppercase tracking-wider px-1">
          Các Điểm Đang Hoạt Động (3)
        </span>

        {spots.map((spot) => {
          const Icon = spot.icon;
          return (
            <div
              key={spot.id}
              onClick={() => onSelectSpot(spot.name)}
              className="bg-white p-4 rounded-[26px] border border-black/[0.04] shadow-ios-card flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-[18px] bg-[#E8F5E9] text-[#3A9A43] flex items-center justify-center">
                  <Icon size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#1A1D1A]">{spot.name}</h3>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                      {spot.distance}
                    </span>
                  </div>
                  <p className="text-xs text-[#606861] mt-0.5">{spot.location}</p>
                  <div className="text-[11px] text-[#3A9A43] font-semibold mt-1">
                    ✓ {spot.binType}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
