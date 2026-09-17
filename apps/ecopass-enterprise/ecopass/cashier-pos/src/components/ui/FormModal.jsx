import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';

/* --- IOS CHECK UTILITY --- */
const isIOS = typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent || '') &&
  !/** @type {any} */ (window).MSStream;

/* --- BODY SCROLL LOCK HOOK --- */
/**
 * @param {boolean} isOpen
 * @param {boolean} isKeyboardOpen
 */
const useBodyScrollLock = (isOpen, isKeyboardOpen) => {
  const savedScrollY = useRef(0);

  useLayoutEffect(() => {
    if (isOpen) {
      savedScrollY.current = window.scrollY;
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    if (isIOS) {
      if (isKeyboardOpen) {
        const scrollY = savedScrollY.current;
        const originalPosition = document.body.style.position;
        const originalTop = document.body.style.top;
        const originalWidth = document.body.style.width;
        const originalOverflow = document.body.style.overflowY;

        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflowY = 'hidden';

        return () => {
          document.body.style.position = originalPosition;
          document.body.style.top = originalTop;
          document.body.style.width = originalWidth;
          document.body.style.overflowY = originalOverflow;
          window.scrollTo(0, scrollY);
        };
      } else {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, savedScrollY.current);
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    } else {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isKeyboardOpen]);
};

/**
 * @typedef {Object} FormModalProps
 * @property {boolean} isOpen - Is modal open
 * @property {() => void} onClose - Close handler
 * @property {() => void} onSubmit - Submit handler
 * @property {string} title - Modal title
 * @property {boolean} isDoneDisabled - Is "Done" button disabled
 * @property {boolean} [disableScroll] - Disable scroll inside content (default false)
 * @property {React.ReactNode} children - Modal content
 */

/**
 * Modal with mobile gestures and keyboard support
 * @param {FormModalProps} props
 */
export default function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  isDoneDisabled,
  disableScroll = false,
  children
}) {
  const [show, setShow] = useState(false);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const contentRef = useRef(null);

  // --- HEIGHT & KEYBOARD STATE CALCULATION ---
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const isKeyboardOpen = viewportHeight < windowHeight * 0.85;

  useBodyScrollLock(isOpen, isKeyboardOpen);

  /* --- BLUR FUNCTION --- */
  const blurActive = () => {
    try {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } catch (e) { /* ignore */ }
  };

  /* --- WATCH KEYBOARD STATE CHANGE --- */
  const wasKeyboardOpenRef = useRef(false);

  useEffect(() => {
    if (!isKeyboardOpen && wasKeyboardOpenRef.current) {
      blurActive();
    }
    wasKeyboardOpenRef.current = isKeyboardOpen;
  }, [isKeyboardOpen]);

  /* --- ANDROID BACK GESTURE LOGIC --- */
  useEffect(() => {
    if (!isOpen) return;
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid) return;

    let historyPushed = false;
    let closedByBackButton = false;

    const handlePopState = () => {
      closedByBackButton = true;
      if (onClose) onClose();
    };

    const timer = setTimeout(() => {
      window.history.pushState({ modalOpen: true }, '', '');
      historyPushed = true;
      window.addEventListener('popstate', handlePopState);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (historyPushed) {
        window.removeEventListener('popstate', handlePopState);
        if (!closedByBackButton) {
          try {
            window.history.back();
          } catch (e) { }
        }
      }
    };
  }, [isOpen]);

  // --- SCREEN RESIZE TRACKING ---
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }

      if (isIOS && isKeyboardOpen && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);

    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, isKeyboardOpen]);

  /* --- Gesture Logic --- */
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const closeWithBlur = () => {
    blurActive();
    onClose && onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      setDragOffset(0);
      wasKeyboardOpenRef.current = false;
    } else {
      const timer = setTimeout(() => {
        setShow(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  /** @param {React.TouchEvent} e */
  const handleTouchStart = (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    if (!disableScroll && contentRef.current && contentRef.current.scrollTop > 0) {
      return;
    }

    blurActive(); // Hide keyboard only if touching header "flesh", not buttons
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  /** @param {React.TouchEvent} e */
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touchY = e.touches[0].clientY;
    const diff = touchY - startY.current;
    if (diff > 0) setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragOffset > 100) {
      closeWithBlur();
      setDragOffset(0);
    } else {
      setDragOffset(0);
    }
  };

  const handleBackdropClick = () => {
    blurActive();
    closeWithBlur();
  };

  /** @param {React.MouseEvent} e */
  const handleHeaderClick = (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.tagName !== 'BUTTON' && !target.closest('button')) {
      blurActive();
    }
  };

  /** @param {React.MouseEvent} e */
  const handleCloseMouseDown = (e) => {
    // preventDefault important to keep focus
    e.preventDefault();
    closeWithBlur();
  };

  /** @param {React.MouseEvent} e */
  const handleSubmitMouseDown = (e) => {
    if (!isDoneDisabled) {
      e.preventDefault(); // Prevent focus loss before submit
      onSubmit();
    }
  };

  if (!show && !isOpen) return null;

  const animationClass = isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0';

  const dragStyle = {
    transform: (isOpen && dragOffset > 0) ? `translateY(${dragOffset}px)` : undefined,
    transition: isDragging
      ? 'none'
      : `transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease-out, height ${isKeyboardOpen ? '0.4s' : '0s'} cubic-bezier(0.2, 0.8, 0.2, 1)`
  };

  const scrollClasses = disableScroll
    ? 'overflow-hidden'
    : 'overflow-y-auto overscroll-y-contain no-scrollbar';

  return (
    <div className={`fixed inset-0 z-50 flex items-start justify-center ${isOpen ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 invisible'}`}
        onClick={handleBackdropClick}
        style={{
          transform: 'translate3d(0, 0, 0)',
          willChange: 'opacity'
        }}
      />

      <div
        className={`
          relative w-full
          bg-form-bg
          rounded-t-modal
          sm:rounded-modal
          shadow-2xl 
          border-t border-card-bg
          flex flex-col transform ${animationClass}
        `}
        style={{
          marginTop: 'env(safe-area-inset-top)',
          height: `calc(${viewportHeight}px - env(safe-area-inset-top))`,
          willChange: 'height, transform',
          ...dragStyle
        }}
      >
        {/* --- HEADER --- */}
        <div
          className="shrink-0 rounded-t-modal touch-none cursor-grab active:cursor-grabbing bg-form-bg z-10"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleHeaderClick}
        >
          <div className="flex items-center justify-between px-4 py-3">

            {/* --- CLOSE BUTTON --- */}
            <button
              onMouseDown={handleCloseMouseDown}
              className={`
                w-[44px] h-[44px] rounded-full p-0 
                flex items-center justify-center 
                hover:brightness-95 transition-all cursor-pointer active:scale-95
                bg-glass-bg backdrop-blur-md border-[0.5px] border-[rgba(128,128,128,0.2)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-text-color
              `}
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Title */}
            <h2 className="text-[17px] font-bold text-center flex-1 truncate px-2 text-text-color select-none pointer-events-none font-sans">
              {title || 'Form'}
            </h2>

            {/* --- DONE BUTTON --- */}
            <button
              onMouseDown={handleSubmitMouseDown}
              disabled={isDoneDisabled}
              className={`
                w-[44px] h-[44px] rounded-full p-0
                flex items-center justify-center 
                transition-all shadow-[0_2px_5px_rgba(0,0,0,0.1)] text-white
                backdrop-blur-md border-[0.5px] border-[rgba(128,128,128,0.2)]
                ${isDoneDisabled
                  ? 'bg-neutral-400/75 dark:bg-neutral-700/75 cursor-not-allowed'
                  : 'bg-[rgb(from_var(--system-blue)_r_g_b_/_0.75)] cursor-pointer hover:brightness-110 active:scale-95'
                }
              `}
              aria-label="Submit"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="translate-y-[1px]"
              >
                <path d="M4 12l5 5L20 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* --- CONTENT --- */}
        <div
          ref={contentRef}
          className={`
            flex-1 w-full bg-form-bg sm:rounded-b-modal
            ${scrollClasses}
          `}
          style={{ touchAction: disableScroll ? 'none' : 'pan-y' }}
        >
          <div className={`flex flex-col ${!disableScroll ? 'min-h-[101%]' : 'h-full'}`}>
            <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
              {children}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}