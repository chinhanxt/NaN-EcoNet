'use client';

import { FC } from 'react';

const Spinner: FC<{
  type?: string;
  color?: string;
  width?: number;
  height?: number;
}> = ({ color = '#10B981', width = 56, height = 56 }) => {
  const size = Math.min(width, height);
  const borderWidth = Math.max(3, Math.round(size / 10));

  return (
    <div
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid rgba(16, 185, 129, 0.15)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      }}
    />
  );
};

export { Spinner as default };

export const LoadingComponent: FC<{
  width?: number;
  height?: number;
}> = () => {
  return (
    <div className="flex-1 w-full h-full p-[24px] flex flex-col gap-[20px] select-none animate-pulse bg-newBgColorInner rounded-[12px]">
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between pb-[16px] border-b border-newBorder/40">
        <div className="flex items-center gap-[12px]">
          <div className="h-[28px] w-[140px] rounded-[6px] bg-newBorder/60" />
          <div className="h-[24px] w-[60px] rounded-[4px] bg-emerald-500/20" />
        </div>
        <div className="flex items-center gap-[10px]">
          <div className="h-[36px] w-[110px] rounded-[6px] bg-newBorder/40" />
          <div className="h-[36px] w-[36px] rounded-[6px] bg-newBorder/40" />
        </div>
      </div>

      {/* Grid of Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px] flex-1">
        {[1, 2, 3].map((card) => (
          <div
            key={card}
            className="flex flex-col gap-[14px] p-[18px] rounded-[8px] bg-newBorder/15 border border-newBorder/30"
          >
            <div className="flex items-center justify-between">
              <div className="w-[38px] h-[38px] rounded-[6px] bg-emerald-500/15 flex items-center justify-center">
                <div className="w-[18px] h-[18px] rounded bg-emerald-500/30" />
              </div>
              <div className="w-[20px] h-[20px] rounded bg-newBorder/40" />
            </div>
            <div className="h-[18px] w-[65%] rounded-[4px] bg-newBorder/60" />
            <div className="h-[12px] w-[90%] rounded-[4px] bg-newBorder/40" />
            <div className="h-[12px] w-[75%] rounded-[4px] bg-newBorder/30" />
            <div className="mt-auto h-[32px] w-full rounded-[6px] bg-newBorder/20 border border-dashed border-newBorder/40" />
          </div>
        ))}
      </div>
    </div>
  );
};
