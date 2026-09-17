import React from 'react';

export const LogoTextComponent = () => {
  return (
    <div className="flex items-center gap-[12px] cursor-pointer select-none">
      <div className="w-[36px] h-[36px] rounded-[10px] bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] flex items-center justify-center shadow-md shadow-emerald-600/30 border border-emerald-400/25">
        <svg
          width="20"
          height="20"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top Layer */}
          <path
            d="M16 3L28 9.5L16 16L4 9.5L16 3Z"
            fill="white"
            fillOpacity="0.95"
          />
          {/* Mid Layer */}
          <path
            d="M4 14.5L16 21L28 14.5"
            stroke="white"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.85"
          />
          {/* Base Layer */}
          <path
            d="M4 19.5L16 26L28 19.5"
            stroke="white"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.6"
          />
        </svg>
      </div>
      <span className="text-[24px] font-black tracking-wider text-current font-sans uppercase">
        Na<span className="text-[#10B981]">N</span>
      </span>
    </div>
  );
};

