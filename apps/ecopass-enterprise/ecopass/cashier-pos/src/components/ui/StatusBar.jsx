import React, { useEffect, useState } from 'react';

const StatusBar = () => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !/** @type {any} */ (window).MSStream;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (/** @type {any} */ (window.navigator).standalone === true);

    setShouldRender(isIOS && isStandalone);
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      // Use transform-gpu and will-change-transform for GPU optimization
      className="fixed top-0 left-0 right-0 z-40 pointer-events-none bg-glass-bg backdrop-blur-[20px] transform-gpu will-change-transform"
      style={{
        // Height is inline to support env() variables
        height: 'calc(env(safe-area-inset-top) + 30px)',

        // Masks are kept in style for reliability (complex gradient syntax)
        maskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 100%)',
      }}
    />
  );
};

export default StatusBar;