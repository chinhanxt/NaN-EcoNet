import React from "react";

export const POSHeader = ({ counterName = "Quầy #01", status = "Online" }) => {
  return (
    <div className="flex items-center justify-between pt-4 px-5 pb-2">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-black text-[#3A9A43] uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-[#3A9A43]" />
          Ministop Căn Tin
        </div>
        <h1 className="text-2xl font-black text-[#1A1D1A] tracking-tight mt-0.5">
          Máy Quét Thu Ngân
        </h1>
      </div>

      {/* Counter Badge */}
      <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-black/5 shadow-ios-card">
        <span className="w-2 h-2 rounded-full bg-[#3A9A43]" />
        <span className="text-xs font-black text-[#1A1D1A]">{counterName}</span>
      </div>
    </div>
  );
};
