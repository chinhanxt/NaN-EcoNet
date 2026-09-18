import React from 'react';

/**
 * Import QRCode type from DB service so VS Code knows the object structure.
 * @typedef {import('../../services/db').QRCode} QRCode
 */

/**
 * Component Props
 * @typedef {Object} QRCodeCardProps
 * @property {QRCode | null} qrObject - Object with QR code data
 * @property {(text: string) => void} onCopy - Callback on copy action
 * @property {(qr: QRCode) => void} [onEdit] - Callback on info/edit button click (optional)
 * @property {string} [title] - Card title (default "Code name")
 * @property {number | string} [cardWidthStyle] - Card width (for dynamic resize)
 */

/**
 * Card displaying QR code and action buttons.
 * @param {QRCodeCardProps} props
 * @returns {React.JSX.Element | null}
 */
export default function QRCodeCard({
  qrObject,
  onCopy,
  onEdit,
  title = "Code name",
  cardWidthStyle
}) {

  if (!qrObject) return null;
  const imageUrl = qrObject.qrImageDataUrl;

  return (
    <div
      className="relative rounded-[26px] mx-auto overflow-hidden flex flex-col items-center transition-all duration-200 py-5 min-h-[400px] bg-card-bg text-text-color"
      style={{
        // Keep width inline as it is calculated dynamically
        width: cardWidthStyle ? `${cardWidthStyle}px` : '345px'
      }}
      aria-label="QR card"
    >
      {/* Header */}
      <div className="w-full relative px-4 box-border flex justify-center">
        <h3 className="m-0 w-full text-[28px] font-bold text-center leading-8 overflow-hidden text-ellipsis whitespace-pre px-2">
          {title}
        </h3>
      </div>

      {/* Content (QR image) */}
      <div className="mt-5 mb-2.5 w-full flex items-center justify-center flex-1 overflow-hidden">
        {imageUrl ? (
          <div className="w-[82%] max-w-[281px] bg-white p-3 rounded-card flex items-center justify-center box-border">

            <img
              src={imageUrl}
              alt="QR code"
              className="w-full h-auto block rounded-none [image-rendering:pixelated]"
            />
          </div>
        ) : (
          <div className="w-[80%] aspect-square flex items-center justify-center text-gray-500">
            Image not found
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="w-full flex items-center justify-center gap-5 mt-3 mb-1">

        {/* Copy Button */}
        <button
          type="button"
          onClick={() => onCopy(qrObject.qrData)}
          className="p-0 w-7 h-7 rounded-full bg-transparent border-0 cursor-pointer flex items-center justify-center transition-opacity hover:opacity-60 active:scale-95 text-system-blue"
          aria-label="Copy Data"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <g transform="translate(12, 10.5) scale(1.15) translate(-12, -12)">
              <rect x="6" y="9" width="10" height="12" rx="2" />
              <path d="M9 9V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H16" />
            </g>
          </svg>
        </button>

        {/* Info Button */}
        <button
          type="button"
          // @ts-ignore - TS might complain onEdit is undefined, but && check handles runtime
          onClick={() => onEdit && onEdit(qrObject)}
          className="p-0 w-7 h-7 rounded-full bg-transparent border-0 cursor-pointer flex items-center justify-center transition-colors active:scale-95 text-system-blue active:opacity-50"
          aria-label="Card Details"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="11"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>

      </div>
    </div>
  );
}