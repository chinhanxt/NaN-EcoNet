'use client';

import React from 'react';

export const LaunchesSkeleton = () => {
  return (
    <div className="flex flex-1 w-full h-full gap-[10px] select-none animate-pulse">
      {/* 1. Left Channels Column Skeleton */}
      <div className="w-[260px] bg-newBgColorInner rounded-[12px] p-[20px] flex flex-col gap-[16px] border border-newBorder/30">
        {/* Channel Header */}
        <div className="flex items-center justify-between">
          <div className="h-[24px] w-[80px] rounded-[6px] bg-newBorder/60" />
          <div className="h-[24px] w-[24px] rounded-[6px] bg-newBorder/50" />
        </div>

        {/* Add Channel Button */}
        <div className="flex gap-[8px]">
          <div className="h-[42px] flex-1 rounded-[6px] bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center gap-[6px]">
            <div className="w-[14px] h-[14px] rounded-full bg-emerald-500/40" />
            <div className="w-[70px] h-[12px] rounded bg-emerald-500/30" />
          </div>
          <div className="h-[42px] w-[42px] rounded-[6px] bg-newBorder/40" />
        </div>

        {/* Empty state / Channel items skeleton */}
        <div className="flex-1 flex flex-col justify-center items-center py-[20px] gap-[14px]">
          <div className="w-[64px] h-[64px] rounded-[10px] bg-newBorder/40 flex items-center justify-center">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-newBorder/60" />
          </div>
          <div className="h-[18px] w-[120px] rounded-[4px] bg-newBorder/60" />
          <div className="h-[12px] w-[180px] rounded-[4px] bg-newBorder/40" />
          <div className="h-[12px] w-[140px] rounded-[4px] bg-newBorder/40" />
        </div>

        {/* Bottom Version */}
        <div className="h-[14px] w-[50px] mx-auto rounded bg-newBorder/30" />
      </div>

      {/* 2. Main Calendar Board Skeleton */}
      <div className="flex-1 bg-newBgColorInner rounded-[12px] p-[20px] flex flex-col gap-[14px] border border-newBorder/30 overflow-hidden">
        {/* Filters bar */}
        <div className="flex items-center justify-between pb-[12px] border-b border-newBorder/40">
          <div className="flex items-center gap-[10px]">
            <div className="h-[34px] w-[34px] rounded-[8px] bg-newBorder/50" />
            <div className="h-[34px] w-[210px] rounded-[8px] bg-newBorder/50" />
            <div className="h-[34px] w-[34px] rounded-[8px] bg-newBorder/50" />
            <div className="h-[34px] w-[80px] rounded-[8px] bg-newBorder/50" />
          </div>
          <div className="flex items-center gap-[8px]">
            <div className="h-[36px] w-[190px] rounded-[10px] bg-newBorder/50" />
            <div className="h-[36px] w-[70px] rounded-[10px] bg-newBorder/50" />
          </div>
        </div>

        {/* 7 Days Column Headers */}
        <div className="grid grid-cols-7 gap-[10px]">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-[6px] py-[10px] rounded-[14px] bg-newBorder/20 border border-newBorder/30"
            >
              <div className="h-[12px] w-[45px] rounded-[4px] bg-newBorder/50" />
              <div className="h-[16px] w-[75px] rounded-[4px] bg-newBorder/60" />
            </div>
          ))}
        </div>

        {/* Calendar Grid Slots */}
        <div className="flex-1 grid grid-cols-7 gap-[10px] mt-[4px]">
          {Array.from({ length: 7 }).map((_, col) => (
            <div key={col} className="flex flex-col gap-[8px] h-full">
              {Array.from({ length: 5 }).map((_, row) => (
                <div
                  key={row}
                  className="flex-1 min-h-[60px] rounded-[12px] border border-dashed border-newBorder/40 bg-newBorder/10 p-[8px] flex flex-col justify-between"
                >
                  <div className="h-[9px] w-[36px] rounded bg-newBorder/30" />
                  {col === 1 && row === 0 && (
                    <div className="h-[24px] w-full rounded-[8px] bg-emerald-500/15 border border-emerald-500/30 flex items-center px-[8px]">
                      <div className="w-[8px] h-[8px] rounded-full bg-emerald-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
