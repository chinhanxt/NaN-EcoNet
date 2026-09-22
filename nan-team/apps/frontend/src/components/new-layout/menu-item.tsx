'use client';
import { FC, ReactNode, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

export const MenuItem: FC<{ label: string; icon: ReactNode; path: string; onClick?: () => void }> = ({
  label,
  icon,
  path,
  onClick,
}) => {
  const currentPath = usePathname();
  const router = useRouter();
  const isActive = currentPath.startsWith(path === '/agents' || path === '/agents/new' ? '/agents' : path);

  const handleWarmup = useCallback(() => {
    if (path && !path.startsWith('http') && !onClick) {
      try {
        router.prefetch(path);
        if (typeof window !== 'undefined') {
          fetch(path, { priority: 'low' }).catch(() => {});
        }
      } catch (e) {}
    }
  }, [path, onClick, router]);

  const className = clsx(
    'group w-full minCustom:h-[60px] custom:h-[48px] py-[9px] px-[6px] minCustom:gap-[5px] custom:gap-[3px] flex flex-col font-[600] items-center justify-center rounded-[18px] hover:text-textItemFocused hover:bg-boxFocused transition-all duration-200 ease-out hover:scale-[1.04] active:scale-[0.96] hover:shadow-[0_4px_16px_rgba(16,185,129,0.15)]',
    isActive
      ? 'text-textItemFocused bg-boxFocused border border-[#10B981]/30 shadow-[0_4px_18px_rgba(16,185,129,0.2)]'
      : 'text-textItemBlur'
  );

  const inner = (
    <>
      <div className="custom:scale-90 group-hover:scale-110 transition-transform duration-200 ease-out">
        {icon}
      </div>
      <div className="custom:text-[9px] minCustom:text-[10.5px] leading-[1.15] text-center font-[600] tracking-tight">
        {label}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} title={label} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      prefetch={true}
      href={path}
      title={label}
      onMouseEnter={handleWarmup}
      onPointerDown={handleWarmup}
      {...path.indexOf('http') === 0 && { target: '_blank' }}
      className={className}
    >
      {inner}
    </Link>
  );
};
