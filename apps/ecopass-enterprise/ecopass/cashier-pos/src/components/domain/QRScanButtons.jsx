import React from 'react';

/**
 * @typedef {Object} QRScanButtonsProps
 * @property {boolean} isScanning
 * @property {() => void} onCameraClick
 * @property {() => void} onGalleryClick
 * @property {() => void} onStopClick
 */

/**
 * @param {QRScanButtonsProps} props
 */
export default function QRScanButtons({
  isScanning,
  onCameraClick,
  onGalleryClick,
  onStopClick
}) {
  // Common styles for "glass" effect
  const glassClasses = "bg-glass-bg backdrop-blur-[12px] text-text-color border-[0.5px] border-[rgba(128,128,128,0.2)]";
  const liquidEffect = "transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[1.08] active:brightness-110 dark:active:brightness-125 active:shadow-[0_10px_25px_rgba(0,0,0,0.15),inset_0_0_15px_rgba(255,255,255,0.3)] dark:active:shadow-[0_10px_25px_rgba(0,0,0,0.4),inset_0_0_15px_rgba(255,255,255,0.15)] will-change-transform";

  // Common SVG styles
  const svgClasses = "w-6 h-6 stroke-[1.5]";

  // Explicit type to ensure correct string union types (e.g. strokeLinecap="round")
  /** @type {React.SVGProps<SVGSVGElement>} */
  const svgAttrs = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  return (
    <div className="flex justify-center items-center w-full relative z-20">

      {isScanning ? (
        /* --- STATE: SCANNING (Stop Button) --- */
        <button
          className={`flex items-center justify-center p-0 m-0 w-[44px] h-[44px] rounded-full ${glassClasses} ${liquidEffect}`}
          onClick={onStopClick}
          aria-label="Stop scanning"
        >
          <div
            className="w-[14px] h-[14px] rounded-[3px] bg-system-red shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          />
        </button>
      ) : (
        /* --- STATE: IDLE (Pill Container) --- */
        <div
          className={`flex overflow-hidden shadow-sm ${glassClasses} ${liquidEffect} w-[104px] h-[44px] rounded-[22px]`}
        >
          <button
            className="flex-1 h-full flex items-center justify-center hover:brightness-90 transition-all border-none rounded-none p-0 m-0 bg-transparent"
            onClick={onCameraClick}
            aria-label="Scan with camera"
          >
            <svg {...svgAttrs} className={svgClasses}>
              <path d="M20 6H17L16 4H8L7 6H4C2.89543 6 2 6.89543 2 8V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V8C22 6.89543 21.1046 6 20 6Z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          <button
            className="flex-1 h-full flex items-center justify-center hover:brightness-90 transition-all border-none rounded-none p-0 m-0 bg-transparent"
            onClick={onGalleryClick}
            aria-label="Pick from gallery"
          >
            <svg {...svgAttrs} className={svgClasses}>
              <defs>
                <clipPath id="gallery-frame-clip">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                </clipPath>
              </defs>
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <g clipPath="url(#gallery-frame-clip)">
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15L16 10L5 21" />
              </g>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}