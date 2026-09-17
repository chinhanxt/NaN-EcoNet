import React, { useState, useEffect, useRef } from 'react';

/**
 * @typedef {Object} FixedButtonsProps
 * @property {() => void} onEditMode
 * @property {() => void} onOpenForm
 * @property {() => void} [onExport]
 * @property {() => void} [onImport]
 * @property {() => void} [onAddQR]
 * @property {boolean} [hasCategories]
 * @property {boolean} [isEditMode]
 */

/**
 * @param {FixedButtonsProps} props
 */
export default function FixedButtons({
  onEditMode,    // Toggle Edit Mode
  onOpenForm,    // Add Category
  onExport,      // Export
  onImport,      // Import
  onAddQR,       // FAB
  hasCategories = false,
  isEditMode = false
}) {

  // --- Left button animation logic (3/4) ---
  const targetLeftButton = isEditMode ? '4' : (hasCategories ? '3' : '4');
  const [currentLeftBtn, setCurrentLeftBtn] = useState(targetLeftButton);
  const [isExpanded, setIsExpanded] = useState(true);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      setCurrentLeftBtn(targetLeftButton);
      isFirstRender.current = false;
      return;
    }
    if (targetLeftButton !== currentLeftBtn) {
      setIsExpanded(false);
      const timer = setTimeout(() => {
        setCurrentLeftBtn(targetLeftButton);
        setIsExpanded(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasCategories, isEditMode, currentLeftBtn, targetLeftButton]);

  // --- Styles (Tailwind classes) ---

  // Base glass style
  const glassClasses = "bg-glass-bg backdrop-blur-[12px] text-text-color border-[0.5px] border-[rgba(128,128,128,0.2)]";
  const liquidEffect = "transform transition-all duration-[200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[1.08] active:brightness-110 dark:active:brightness-125 active:shadow-[0_10px_25px_rgba(0,0,0,0.15),inset_0_0_15px_rgba(255,255,255,0.3)] dark:active:shadow-[0_10px_25px_rgba(0,0,0,0.4),inset_0_0_15px_rgba(255,255,255,0.15)] will-change-transform";

  // Active "Done" button style
  const activeDoneClasses = "bg-[rgb(from_var(--system-blue)_r_g_b_/_0.75)] backdrop-blur-[12px] text-white border-[0.5px] border-[rgba(128,128,128,0.2)] shadow-[0_2px_5px_rgba(0,0,0,0.1)]";

  // FAB style
  const fabClasses = "bg-[rgb(from_var(--system-blue)_r_g_b_/_0.75)] backdrop-blur-[12px] text-white border-none shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-center";

  const handleLeftClick = () => {
    if (currentLeftBtn === '3' && onExport) onExport();
    if (currentLeftBtn === '4' && onImport) onImport();
  };

  const translateDistance = '-55px';

  // Common SVG icon settings
  /** @type {React.SVGProps<SVGSVGElement>} */
  const iconProps = {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  return (
    <>
      {/* --- TOP GROUP --- */}
      <div
        className="fixed z-30 flex items-center gap-[11px] right-4"
        style={{
          top: 'calc(env(safe-area-inset-top) + 12px)',
        }}
      >
        {/* PILL CONTAINER (Buttons 3/4 and 2) */}
        <div
          className={`relative shadow-sm transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] z-50 rounded-[22px] overflow-hidden ${glassClasses} ${liquidEffect}`}
          style={{
            width: isExpanded ? '104px' : '44px',
            height: '44px',
          }}
        >
          {/* BUTTON 2 (RIGHT) -> ADD CATEGORY */}
          <button
            className="absolute top-0 right-0 h-full flex items-center justify-center hover:brightness-90 transition-all border-none bg-transparent p-0 z-20 w-[44px]"
            onClick={onOpenForm}
            aria-label="Add Category"
          >
            <svg
              {...iconProps}
              style={{ transform: 'translate(-0.5px, 0px)' }}
            >
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
              <path d="M14 17.5H21M17.5 14V21" />
            </svg>
          </button>

          {/* BUTTON 3/4 (LEFT) -> IMPORT / EXPORT */}
          <button
            className="absolute top-0 left-0 h-full flex items-center justify-center hover:brightness-90 transition-all border-none bg-transparent p-0 z-10 w-[44px] pr-0"
            style={{
              opacity: isExpanded ? 1 : 0,
              transition: 'opacity 0.15s ease-in-out',
            }}
            onClick={handleLeftClick}
            aria-label={currentLeftBtn === '3' ? "Export backup" : "Import backup"}
          >
            <span key={currentLeftBtn} className="flex items-center justify-center animate-fadeIn">
              {currentLeftBtn === '3' ? (
                <svg {...iconProps}>
                  <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              ) : (
                <svg {...iconProps}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
            </span>
          </button>
        </div>

        {/* CONTAINER FOR BUTTON 1 (Edit / Done) */}
        <div className="relative w-[44px] h-[44px] z-40">
          {/* Edit Mode Button Wrapper */}
          <div
            className="absolute inset-0 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{
              transform: isEditMode ? `translateX(${translateDistance}) scale(0.8)` : 'translateX(0) scale(1)',
              opacity: isEditMode ? 0 : 1,
              pointerEvents: isEditMode ? 'none' : 'auto',
            }}
          >
            {/* Edit Mode Button */}
            <button
              className={`w-full h-full flex items-center justify-center shadow-sm p-0 m-0 rounded-full ${glassClasses} ${liquidEffect}`}
              onClick={onEditMode}
              aria-label="Edit"
            >
              <svg {...iconProps} style={{ transform: 'translate(1px, -1px)' }}>
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
            </button>
          </div>

          {/* Checkmark Button Wrapper */}
          <div
            className="absolute inset-0 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{
              transform: isEditMode ? 'translateX(0) scale(1)' : `translateX(${translateDistance}) scale(0.8)`,
              opacity: isEditMode ? 1 : 0,
              pointerEvents: isEditMode ? 'auto' : 'none',
            }}
          >
            {/* Сheckmark Button */}
            <button
              className={`w-full h-full flex items-center justify-center p-0 m-0 rounded-full ${activeDoneClasses} ${liquidEffect}`}
              onClick={onEditMode}
              aria-label="Done editing"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="translate-y-[1px]">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      {hasCategories && !isEditMode && (
        <div className="fixed z-30 bottom-6 right-6 w-[50px] h-[50px] animate-fadeIn">
          <button
            className={`w-full h-full p-0 m-0 rounded-full ${fabClasses} ${liquidEffect}`}
            onClick={onAddQR}
            aria-label="Add new QR code"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5V19M5 12H19" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}