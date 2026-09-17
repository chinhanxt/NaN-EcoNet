import React, { useState, useEffect, useRef } from 'react';

// Utility to calculate available width
const calculateAvailableWidth = () => {
  if (typeof window === 'undefined') return 280;
  const screenWidth = window.innerWidth;
  const targetWidth = screenWidth - 67;
  const cardWidth = Math.max(315, Math.min(targetWidth, 345));

  // CardWidth - (16px * 2 padding container) - (8px * 2 padding text) = -48px
  return cardWidth - 48;
};

export default function TitleFitIndicator({ text, onStatusChange }) {
  const [status, setStatus] = useState('hidden'); // 'hidden' | 'yellow' | 'red'
  const [maxWidth, setMaxWidth] = useState(calculateAvailableWidth());

  const measureRef = useRef(null);
  const measureNextRef = useRef(null);

  // 1. Watch for screen resize
  useEffect(() => {
    const handleResize = () => {
      setMaxWidth(calculateAvailableWidth());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Measurement logic
  useEffect(() => {
    const safeLength = 6;

    if (!text || text.length < safeLength) {
      if (status !== 'hidden') {
        setStatus('hidden');
        if (onStatusChange) onStatusChange(false);
      }
      return;
    }

    if (!measureRef.current || !measureNextRef.current) return;

    // Reading offsetWidth causes Reflow
    const currentWidth = measureRef.current.offsetWidth;
    const nextWidth = measureNextRef.current.offsetWidth;

    let newStatus = 'hidden';

    if (currentWidth > maxWidth) {
      newStatus = 'red';
    } else if (nextWidth > maxWidth) {
      newStatus = 'yellow';
    }

    if (newStatus !== status) {
      setStatus(newStatus);
      if (onStatusChange) {
        onStatusChange(newStatus !== 'hidden');
      }
    }

  }, [text, maxWidth, onStatusChange, status]);

  // Determine color classes based on status
  const bgClass = status === 'red'
    ? 'bg-[rgb(from_var(--system-red)_r_g_b_/_0.8)]'
    : 'bg-[rgb(from_var(--indicator-yellow)_r_g_b_/_0.8)]';

  return (
    <>
      {/* Visual Part */}
      <div
        aria-hidden="true"
        className={`
          absolute right-3 top-1/2 -translate-y-1/2 
          w-[20px] h-[20px] rounded-full 
          transition-all duration-300 ease-out
          backdrop-blur-[12px] border-[0.5px] border-[rgba(128,128,128,0.2)] 
          shadow-[0_2px_8px_rgba(0,0,0,0.1)]
          ${bgClass}
          ${status === 'hidden' ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}
        `}
      />

      {/* Hidden Part (Ruler for measurements) */}
      <div className="absolute invisible h-0 overflow-hidden whitespace-pre top-0 left-0 pointer-events-none">
        <span ref={measureRef} className="text-[28px] font-bold font-sans">
          {text || ''}
        </span>
        <span ref={measureNextRef} className="text-[28px] font-bold font-sans">
          {(text || '') + 'W'}
        </span>
      </div>
    </>
  );
}