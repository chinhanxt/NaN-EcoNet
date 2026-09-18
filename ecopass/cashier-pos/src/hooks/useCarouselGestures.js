import { useState, useRef, useCallback } from 'react';

/**
 * @param {number} val
 * @param {number} min
 * @param {number} max
 */
const clamp = (val, min, max) => Math.max(min, Math.min(val, max));

/**
 * @typedef {Object} CarouselGesturesParams
 * @property {number} itemCount - Total number of cards
 * @property {number} itemWidth - Width of one card (px)
 * @property {number} itemGap - Gap between cards (px)
 * @property {number} currentIndex - Current active index
 * @property {(newIndex: number) => void} onIndexChange - Callback on slide change
 */

/**
 * Hook for managing carousel gestures
 * @param {CarouselGesturesParams} params
 */
export const useCarouselGestures = ({
    itemCount,
    itemWidth,
    itemGap,
    currentIndex,
    onIndexChange
}) => {
    const [translateX, setTranslateX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Refs for gesture state without re-renders
    const touchStartX = useRef(0);
    const touchDeltaX = useRef(0);
    const pointerActive = useRef(false);
    const pointerId = useRef(null);
    const transitionDirection = useRef(0);

    // --- Helper Methods ---

    /** @param {number} direction */
    const changeSlide = (direction) => {
        if (itemCount !== 2) return;
        setIsAnimating(true);
        const newIndex = clamp(currentIndex + direction, 0, 1);
        if (newIndex !== currentIndex) {
            onIndexChange(newIndex);
        }
    };

    const resetState = useCallback(() => {
        pointerActive.current = false;
        pointerId.current = null;
        setIsSwiping(false);
        setIsAnimating(true);
        touchDeltaX.current = 0;
        setTranslateX(0);
    }, []);

    // --- Event Handlers ---

    /** @param {React.PointerEvent<HTMLDivElement>} e */
    const handlePointerDown = (e) => {
        // Ignore clicks on buttons inside the slide
        // @ts-ignore
        const targetButton = e.target && e.target.closest ? e.target.closest('button') : null;
        if (targetButton) return;

        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (itemCount <= 1) return;

        e.stopPropagation();

        pointerActive.current = true;
        pointerId.current = e.pointerId;
        touchStartX.current = (typeof e.clientX === 'number') ? e.clientX : 0;
        touchDeltaX.current = 0;

        setIsSwiping(true);
        setIsAnimating(false);

        try {
            // @ts-ignore
            e.target.setPointerCapture(e.pointerId);
        } catch (err) { /* ignore */ }
    };

    /** @param {React.PointerEvent<HTMLDivElement>} e */
    const handlePointerMove = (e) => {
        if (!isSwiping || !pointerActive.current) return;
        if (e.pointerId !== pointerId.current) return;
        if (e.cancelable) e.preventDefault();

        const clientX = (typeof e.clientX === 'number') ? e.clientX : touchStartX.current;
        let delta = clientX - touchStartX.current;
        touchDeltaX.current = delta;

        // Elastic resistance for 2-card carousel
        if (itemCount === 2) {
            if (currentIndex === 0 && delta > 0) delta = delta * 0.3;
            if (currentIndex === 1 && delta < 0) delta = delta * 0.3;
        }

        setTranslateX(delta);
    };

    /** @param {React.PointerEvent<HTMLDivElement>} e */
    const handlePointerUp = (e) => {
        if (!pointerActive.current) return;
        if (e.pointerId !== pointerId.current) return;

        pointerActive.current = false;
        setIsSwiping(false);
        setIsAnimating(true);

        const threshold = itemWidth * 0.15;
        let direction = 0;
        if (touchDeltaX.current < -threshold) direction = 1;
        else if (touchDeltaX.current > threshold) direction = -1;

        touchDeltaX.current = 0;

        if (itemCount === 2) {
            if (currentIndex === 0 && direction === -1) direction = 0;
            if (currentIndex === 1 && direction === 1) direction = 0;

            if (direction !== 0) {
                changeSlide(direction);
            }
            setTranslateX(0);

        } else if (itemCount > 2) {
            transitionDirection.current = direction;
            if (direction === 1) {
                setTranslateX(-(itemWidth + itemGap));
            } else if (direction === -1) {
                setTranslateX(itemWidth + itemGap);
            } else {
                setTranslateX(0);
            }
        } else {
            setTranslateX(0);
        }

        try {
            // @ts-ignore
            if (e.target.hasPointerCapture(e.pointerId)) {
                // @ts-ignore
                e.target.releasePointerCapture(e.pointerId);
            }
        } catch (err) { /* ignore */ }
        pointerId.current = null;
    };

    const handleTransitionEnd = () => {
        if (transitionDirection.current === 0) return;
        if (itemCount <= 2) return;

        const direction = transitionDirection.current;
        transitionDirection.current = 0;

        setIsAnimating(false);
        const newIndex = (currentIndex + direction + itemCount) % itemCount;
        onIndexChange(newIndex);
        setTranslateX(0);
    };

    /** @param {React.DragEvent<HTMLDivElement>} e */
    const handleDragStart = (e) => {
        e.preventDefault();
    };

    // Emergency reset (e.g. leaving page)
    const globalPointerCancel = useCallback(() => {
        if (pointerActive.current) {
            resetState();
        }
    }, [resetState]);

    return {
        // State
        translateX,
        isSwiping,
        isAnimating,
        touchDeltaX: touchDeltaX.current,

        // Handlers
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerUp,
            onPointerLeave: handlePointerUp,
            onDragStart: handleDragStart,
            onTransitionEnd: handleTransitionEnd
        },

        // Helpers
        globalPointerCancel
    };
};