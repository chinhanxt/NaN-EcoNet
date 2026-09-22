'use client';

import React, { FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import { modeEmitter } from '@gitroom/frontend/components/layout/mode.component';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  threadTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: FC<DeleteConfirmationModalProps> = ({
  isOpen,
  threadTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [cookieMode] = useCookie('mode', 'dark');
  const [isDark, setIsDark] = useState(true);

  // Sync theme state with cookie, DOM class (.dark/.light), and modeEmitter
  useEffect(() => {
    setMounted(true);

    const checkTheme = (override?: string) => {
      if (override) {
        setIsDark(override === 'dark');
        return;
      }
      if (typeof document !== 'undefined') {
        const isDocDark =
          document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark');
        const isDocLight =
          document.documentElement.classList.contains('light') ||
          document.body.classList.contains('light');

        if (isDocDark) {
          setIsDark(true);
        } else if (isDocLight) {
          setIsDark(false);
        } else {
          setIsDark(cookieMode !== 'light');
        }
      }
    };

    checkTheme();

    const handleModeChange = (newMode: string) => {
      checkTheme(newMode);
    };

    modeEmitter.on('mode', handleModeChange);

    // Watch for class attribute mutations on html and body
    const observer = new MutationObserver(() => {
      checkTheme();
    });

    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    return () => {
      modeEmitter.off('mode', handleModeChange);
      observer.disconnect();
    };
  }, [cookieMode]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 transition-all animate-in fade-in duration-200'
      )}
      style={{
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        className={clsx(
          'relative w-full max-w-[420px] rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden',
          isDark
            ? 'border border-white/10 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)]'
            : 'border border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
        )}
        style={{
          backgroundColor: isDark ? '#141824' : '#ffffff',
          color: isDark ? '#ffffff' : '#0e0e0e',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Accent Glows (Dark Mode Only) */}
        {isDark && (
          <>
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        {/* Close Button */}
        <button
          onClick={onCancel}
          type="button"
          className={clsx(
            'absolute top-4 right-4 p-1.5 rounded-lg transition-colors cursor-pointer',
            isDark
              ? 'text-white/40 hover:text-white hover:bg-white/10'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          )}
          title="Đóng (Esc)"
          aria-label="Đóng"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Warning Icon Badge & Title Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div
            className={clsx(
              'relative flex items-center justify-center w-12 h-12 rounded-xl shrink-0',
              isDark
                ? 'bg-red-500/10 border border-red-500/25 text-red-400 shadow-[0_0_24px_rgba(239,68,68,0.2)]'
                : 'bg-red-50 border border-red-200 text-red-600 shadow-sm'
            )}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <div>
            <h3
              id="delete-dialog-title"
              className={clsx(
                'text-base font-semibold tracking-tight',
                isDark ? 'text-white' : 'text-gray-900'
              )}
            >
              Xóa phiên trò chuyện này?
            </h3>
            <p
              className={clsx(
                'text-xs font-medium',
                isDark ? 'text-red-400/90' : 'text-red-600'
              )}
            >
              Hành động này không thể hoàn tác
            </p>
          </div>
        </div>

        {/* Body Description */}
        <p
          className={clsx(
            'text-[13px] leading-relaxed mb-4',
            isDark ? 'text-white/70' : 'text-gray-600'
          )}
        >
          Toàn bộ lịch sử tin nhắn và hình ảnh AI đã tạo trong phiên này sẽ bị xóa vĩnh viễn khỏi hệ thống NaN-Team.
        </p>

        {/* Target thread snippet badge */}
        <div
          className={clsx(
            'flex items-center gap-2.5 p-3 rounded-xl mb-6',
            isDark
              ? 'bg-white/[0.04] border border-white/[0.08]'
              : 'bg-gray-50 border border-gray-200/90'
          )}
        >
          <svg
            className={clsx('w-4 h-4 shrink-0', isDark ? 'text-white/40' : 'text-gray-400')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span
            className={clsx(
              'text-xs font-medium truncate select-none',
              isDark ? 'text-white/85' : 'text-gray-800'
            )}
          >
            {threadTitle || 'Phiên trò chuyện'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className={clsx(
              'flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer text-center disabled:opacity-50',
              isDark
                ? 'border border-white/10 bg-transparent hover:bg-white/[0.06] active:bg-white/[0.1] text-white/80 hover:text-white'
                : 'border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 hover:text-gray-900'
            )}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(239,68,68,0.25)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 border-0"
          >
            {isDeleting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <span>Xóa phiên chat</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
