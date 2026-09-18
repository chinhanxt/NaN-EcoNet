import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import QRCodeCard from '../QRCodeCard';
import { useCarouselGestures } from '../../../hooks/useCarouselGestures';
import './CategoryCarousel.css';

/**
 * @typedef {import('../../../services/db').Category} Category
 * @typedef {import('../../../services/db').QRCode} QRCode
 */

/**
 * @param {QRCode[]} cards
 * @param {number | null | undefined} initialCardId
 * @returns {number}
 */
const findInitialIndex = (cards, initialCardId) => {
  if (!initialCardId || !cards || cards.length === 0) return 0;
  const index = cards.findIndex(c => c.id === initialCardId);
  return index === -1 ? 0 : index;
};

/**
 * @param {number} val
 * @param {number} min
 * @param {number} max
 */
const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
const CARD_GAP = 20;

const calculateCardWidth = () => {
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  const targetWidth = screenWidth - 67;
  return clamp(targetWidth, 315, 345);
};

/**
 * @typedef {Object} CategoryCarouselProps
 * @property {Category} category
 * @property {QRCode[]} cards
 * @property {(categoryId: number, cardId: number) => void} onCardChange
 * @property {(text: string) => void} onCopy
 * @property {(card: QRCode) => void} onEdit
 */
export default function CategoryCarousel({ category, cards, onCardChange, onCopy, onEdit }) {
  const totalCards = cards.length;
  const [cardWidth, setCardWidth] = useState(calculateCardWidth);
  const [currentIndex, setCurrentIndex] = useState(() => findInitialIndex(cards, category.currentCardId));
  const [isReady, setIsReady] = useState(false);

  const carouselRef = useRef(null);

  // --- Logic 1: Resizing ---
  useEffect(() => {
    const handleResize = () => {
      setCardWidth(calculateCardWidth());
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      setIsReady(true);
    });
  }, []);

  // --- Logic 2: Sync with Props ---
  useEffect(() => {
    const newIndex = findInitialIndex(cards, category.currentCardId);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  // --- Logic 3: Gestures Hook ---

  const handleIndexChange = (newIndex) => {
    setCurrentIndex(newIndex);
    // @ts-ignore
    onCardChange(category.id, cards[newIndex].id);
  };

  const {
    translateX,
    isSwiping,
    isAnimating,
    touchDeltaX, // Can be used for precise duration calculation if needed
    handlers,
    globalPointerCancel
  } = useCarouselGestures({
    itemCount: totalCards,
    itemWidth: cardWidth,
    itemGap: CARD_GAP,
    currentIndex,
    onIndexChange: handleIndexChange
  });

  // --- Logic 4: Global events cleanup ---
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        globalPointerCancel();
      }
    };

    // Subscribe to global events to reset swipe state if cursor leaves or browser is minimized
    window.addEventListener('pointerup', globalPointerCancel);
    window.addEventListener('pointercancel', globalPointerCancel);
    window.addEventListener('pagehide', globalPointerCancel);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pointerup', globalPointerCancel);
      window.removeEventListener('pointercancel', globalPointerCancel);
      window.removeEventListener('pagehide', globalPointerCancel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [globalPointerCancel]);


  // --- Logic 5: Rendering ---

  if (totalCards === 0) {
    const qrSize = Math.min(cardWidth * 0.82, 281);
    const placeholderHeight = qrSize + 146;

    return (
      <div
        className="rounded-[26px] border-2 border-dashed border-gray-300/50 dark:border-gray-600/50 flex items-center justify-center text-gray-400 mx-auto py-5 box-border transition-all duration-200"
        style={{
          width: `${cardWidth}px`,
          height: `${placeholderHeight}px`
        }}
        role="status"
        aria-label={`No cards in category ${category.name}`}
      >
        <span className="text-lg font-medium opacity-50 select-none">
          No cards
        </span>
      </div>
    );
  }

  /** @type {QRCode[]} */
  let slidesToRender = [];
  let activeRenderedIndex = 0;

  if (totalCards === 1) {
    slidesToRender = [cards[0]];
    activeRenderedIndex = 0;
  } else if (totalCards === 2) {
    slidesToRender = [cards[0], cards[1]];
    activeRenderedIndex = currentIndex;
  } else {
    /** @param {number} offset */
    const getIdx = (offset) => (currentIndex + offset + totalCards) % totalCards;
    slidesToRender = [
      cards[getIdx(-2)],
      cards[getIdx(-1)],
      cards[currentIndex],
      cards[getIdx(1)],
      cards[getIdx(2)],
    ];
    activeRenderedIndex = 2;
  }

  const uxMode = totalCards === 1 ? 'ux-1' : totalCards === 2 ? 'ux-2' : 'ux-multi';
  const activeCardCenterPx = (activeRenderedIndex * (cardWidth + CARD_GAP)) + (cardWidth / 2);
  const carouselWidth = carouselRef.current ? carouselRef.current.offsetWidth : cardWidth;

  // Calculate animation duration (tied to DOM element width)
  const distance = Math.abs(touchDeltaX || 0);
  const frac = Math.min(1, distance / (carouselWidth || 1));
  const duration = Math.round(200 + 400 * frac);

  const trackStyle = {
    willChange: 'transform',
    transform: `translate3d(calc(50% - ${activeCardCenterPx}px + ${translateX}px), 0, 0)`,
    transition: (isAnimating && !isSwiping)
      ? `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
      : 'none'
  };

  return (
    <>
      <div
        ref={carouselRef}
        className={`carousel-viewport ${uxMode}`}
        style={{
          touchAction: 'pan-y',
          userSelect: 'none',
          // @ts-ignore
          WebkitUserSelect: 'none',
          opacity: isReady ? 1 : 0.99
        }}
        // Spread all event handlers from hook
        {...handlers}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${category.name} QR codes`}
      >
        <div
          className={`carousel-track ${uxMode}`}
          style={trackStyle}
          role="list"
        >
          {slidesToRender.map((card, relativeIndex) => {
            return (
              <div
                className={`carousel-slide ${uxMode}`}
                key={`${card.id}-pos-${relativeIndex}`}
                style={{
                  pointerEvents: isSwiping ? 'none' : 'auto',
                  width: `${cardWidth}px`
                }}
                role="listitem"
                aria-hidden={!(relativeIndex === activeRenderedIndex)}
              >
                <QRCodeCard
                  qrObject={card}
                  onCopy={onCopy}
                  onEdit={onEdit}
                  title={card.title ?? 'Code name'}
                  cardWidthStyle={cardWidth}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}