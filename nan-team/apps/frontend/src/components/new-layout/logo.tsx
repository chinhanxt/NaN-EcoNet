'use client';

import React from 'react';
import Link from 'next/link';

export const Logo = () => {
  return (
    <Link
      href="/launches"
      className="mt-[6px] min-w-[56px] min-h-[56px] flex flex-col items-center justify-center group cursor-pointer select-none"
      title="NaN"
    >
      <div className="relative w-[38px] h-[38px] rounded-[11px] bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] flex items-center justify-center shadow-lg shadow-emerald-600/30 border border-emerald-400/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-emerald-600/45 group-active:scale-95">
        {/* Subtle Ambient Hover Glow */}
        <div className="absolute inset-0 rounded-[11px] bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Modern Geometric Enterprise Brandmark */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 group-hover:scale-105"
        >
          {/* Top Layer - Omnichannel Stack */}
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
      <span className="text-[12px] font-black tracking-wider text-current font-sans uppercase mt-[4px]">
        Na<span className="text-[#10B981]">N</span>
      </span>
    </Link>
  );
};

