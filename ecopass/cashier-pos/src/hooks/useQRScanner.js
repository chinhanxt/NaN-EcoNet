import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader } from '@zxing/library';

/**
 * @typedef {import('@zxing/library').Result} ZXingResult
 * @typedef {import('@zxing/library').Exception} ZXingException
 */

const useQRScanner = () => {
    // --- STATE ---
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
    const [qrCode, setQrCode] = useState(null); // Scan result
    const [debugMsg, setDebugMsg] = useState('');

    // --- REFS ---
    /** @type {React.MutableRefObject<HTMLVideoElement | null>} */
    const videoRef = useRef(null);
    /** @type {React.MutableRefObject<BrowserMultiFormatReader | null>} */
    const codeReaderRef = useRef(null);
    const scanningStopped = useRef(false);

    // Zoom Refs
    /** @type {React.MutableRefObject<MediaStreamTrack | null>} */
    const zoomTrackRef = useRef(null);
    const zoomSettingsRef = useRef({ min: 1, max: 1, step: 0.1 });
    const pinchStartDistRef = useRef(0);
    const pinchStartZoomRef = useRef(1);
    const zoomTargetRef = useRef(1);
    const zoomBusyRef = useRef(false);

    /* --- INTERNAL: START CAMERA --- */
    const startCameraScan = useCallback(async () => {
        console.log('Starting camera scanner...');
        scanningStopped.current = false;
        zoomTrackRef.current = null;
        zoomBusyRef.current = false;

        // Reset previous reader if exists
        if (codeReaderRef.current) {
            try { codeReaderRef.current.reset(); } catch (e) { /* ignore */ }
            codeReaderRef.current = null;
        }

        const videoEl = videoRef.current;
        if (!videoEl) {
            console.warn('Video element not mounted yet.');
            return;
        }

        try {
            videoEl.playsInline = true;
            videoEl.muted = true;
            videoEl.autoplay = true;
        } catch (e) { /* not critical */ }

        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        /**
         * @param {ZXingResult | undefined | null} result
         * @param {ZXingException | undefined | null} err
         */
        const onResult = (result, err) => {
            if (scanningStopped.current) return;
            if (result) {
                scanningStopped.current = true;
                const text = result.getText();
                console.log(`QR detected (camera): ${text}`);
                setQrCode(text);
                setIsCameraOpen(false);
                try { codeReader.reset(); } catch (e) { /* ignore */ }
            } else if (err) {
                if (err.name !== 'NotFoundException') {
                    console.error('ZXing scan error:', err);
                    setDebugMsg(err.message);
                }
            }
        };

        // 1. Try generic decode
        try {
            // @ts-ignore - Library types sometimes conflict with null/undefined deviceId
            const startPromise = codeReader.decodeFromVideoDevice(null, videoEl, onResult);
            if (startPromise && typeof startPromise.then === 'function') {
                startPromise.catch((err) => {
                    console.warn('decodeFromVideoDevice rejected:', err);
                    tryFallbackDecode(codeReader, videoEl, onResult);
                });
            }
            try { await videoEl.play(); } catch (e) { /* ignore */ }
        } catch (err) {
            console.warn('decodeFromVideoDevice threw:', err);
            tryFallbackDecode(codeReader, videoEl, onResult);
        }
    }, []);

    // Helper for fallback
    const tryFallbackDecode = (codeReader, videoEl, onResult) => {
        try {
            const constraints = { video: { facingMode: { ideal: 'environment' } } };
            const p = codeReader.decodeFromConstraints(constraints, videoEl, onResult);
            if (p && typeof p.then === 'function') {
                p.catch((err) => {
                    console.error('Fallback decodeFromConstraints failed:', err);
                });
            }
            try { videoEl.play().catch(() => { }); } catch (e) {/*ignore*/ }
        } catch (err) {
            console.error('Fallback decodeFromConstraints threw:', err);
        }
    };

    /* --- PUBLIC: HANDLERS --- */

    const handleScanBtnClick = useCallback(() => {
        // Reset state before starting
        setQrCode(null);
        scanningStopped.current = false;

        // Reset reader
        if (codeReaderRef.current) {
            try { codeReaderRef.current.reset(); } catch (e) { /* ignore */ }
            codeReaderRef.current = null;
        }

        // Cleanup video tracks
        const v = videoRef.current;
        if (v && v.srcObject) {
            try {
                // @ts-ignore - srcObject is usually MediaStream
                const tracks = v.srcObject.getTracks ? v.srcObject.getTracks() : [];
                tracks.forEach((/** @type {MediaStreamTrack} */ t) => { try { t.stop(); } catch (e) {/*ignore*/ } });
                v.srcObject = null;
            } catch (e) { /* ignore */ }
        }

        setIsCameraOpen(true);
    }, []);

    const handleStopBtnClick = useCallback(() => {
        setIsCameraOpen(false);
    }, []);

    /* --- ZOOM LOGIC --- */
    const handleVideoPlaying = useCallback(() => {
        const videoEl = videoRef.current;
        // @ts-ignore - TS might not know about getVideoTracks on srcObject
        if (!videoEl || !videoEl.srcObject || !videoEl.srcObject.getVideoTracks) return;

        // @ts-ignore
        const track = videoEl.srcObject.getVideoTracks()[0];
        if (!track) return;
        if (!track.getCapabilities) {
            console.log("Browser doesn't support getCapabilities for media tracks.");
            return;
        }
        const capabilities = track.getCapabilities();
        // @ts-ignore - zoom property is not standard in all browsers
        if (capabilities.zoom) {
            zoomTrackRef.current = track;
            // @ts-ignore
            const min = capabilities.zoom.min;
            // @ts-ignore
            const max = capabilities.zoom.max;
            // @ts-ignore
            const step = (capabilities.zoom.step && capabilities.zoom.step > 0) ? capabilities.zoom.step : 0.1;
            const settings = track.getSettings();
            // @ts-ignore
            const current = settings.zoom || min;
            zoomSettingsRef.current = { min, max, step };
            zoomTargetRef.current = current;
            console.log("Zoom capabilities detected:", zoomSettingsRef.current, "Current:", current);
        }
    }, []);

    const applyZoomThrottled = useCallback(async (zoomValue) => {
        if (!zoomTrackRef.current) return;
        zoomTargetRef.current = zoomValue;
        if (zoomBusyRef.current) return;
        zoomBusyRef.current = true;
        try {
            const targetToApply = zoomTargetRef.current;
            await zoomTrackRef.current.applyConstraints({
                // @ts-ignore - advanced constraints are hard to type
                advanced: [{ zoom: targetToApply }]
            });
        } catch (err) {
            console.warn("Zoom apply failed", err);
        } finally {
            zoomBusyRef.current = false;
            const settings = zoomTrackRef.current.getSettings();
            // @ts-ignore
            const currentZoomOnCamera = settings.zoom;
            const diff = Math.abs(currentZoomOnCamera - zoomTargetRef.current);
            if (diff >= zoomSettingsRef.current.step) {
                applyZoomThrottled(zoomTargetRef.current);
            }
        }
    }, []);

    const handleTouchStart = useCallback((/** @type {React.TouchEvent} */ e) => {
        if (e.touches.length === 2 && zoomTrackRef.current) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            pinchStartDistRef.current = dist;
            pinchStartZoomRef.current = zoomTargetRef.current;
        }
    }, []);

    const handleTouchMove = useCallback((/** @type {React.TouchEvent} */ e) => {
        if (e.touches.length === 2 && zoomTrackRef.current) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const startDist = pinchStartDistRef.current;
            if (!startDist || startDist === 0) return;
            const ratio = currentDist / startDist;
            let rawZoom = pinchStartZoomRef.current * ratio;
            const { min, max, step } = zoomSettingsRef.current;
            if (rawZoom < min) rawZoom = min;
            if (rawZoom > max) rawZoom = max;
            let newZoom = Math.round(rawZoom / step) * step;
            newZoom = Number(newZoom.toFixed(2));
            applyZoomThrottled(newZoom);
        }
    }, [applyZoomThrottled]);

    /* --- IMAGE FILE SCANNING --- */
    const handleImageScan = useCallback((/** @type {React.ChangeEvent<HTMLInputElement>} */ event) => {
        // Stop camera if open
        setIsCameraOpen(false);
        console.log('Scanning image...');

        const file = event.target.files && event.target.files[0];
        if (!file) return;

        // Clear value to allow re-selecting same file
        event.target.value = '';

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageDataUrl = /** @type {string} */ (e.target?.result);
            if (!imageDataUrl) return;

            const zxReader = new BrowserMultiFormatReader();

            zxReader.decodeFromImageUrl(imageDataUrl)
                .then(result => {
                    const text = result.getText();
                    setQrCode(text);
                    console.log(`Image scanned: ${text}`);
                    zxReader.reset();
                })
                .catch(err => {
                    console.log('Full image decoding failed. Attempting to crop and scan with jsQR...', err);
                    // Fallback to Canvas/jsQR cropping logic
                    const image = new Image();
                    image.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = image.width;
                        canvas.height = image.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;

                        ctx.drawImage(image, 0, 0);
                        const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(fullImageData.data, canvas.width, canvas.height);

                        if (code) {
                            // jsQR returns an object where data is a string
                            setQrCode(code.data);
                            console.log(`Image scanned (jsQR): ${code.data}`);
                        } else {
                            console.log("QR code not detected in the image.");
                        }
                    };
                    image.src = imageDataUrl;
                });
        };
        reader.readAsDataURL(file);
    }, []);

    /* --- EFFECTS --- */
    useEffect(() => {
        if (isCameraOpen) {
            startCameraScan();
        } else {
            // Cleanup when closed
            if (codeReaderRef.current) {
                try { codeReaderRef.current.reset(); } catch (e) { }
                codeReaderRef.current = null;
            }
            zoomTrackRef.current = null;
        }
    }, [isCameraOpen, startCameraScan]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (codeReaderRef.current) {
                try { codeReaderRef.current.reset(); } catch (e) { /* ignore */ }
                codeReaderRef.current = null;
            }
        };
    }, []);

    // Function to reset result (to allow re-scanning)
    const resetQrCode = useCallback(() => {
        setQrCode(null);
    }, []);

    return {
        isCameraOpen,
        setIsCameraOpen,
        qrCode,
        resetQrCode,
        debugMsg,

        // Refs for Elements
        videoRef,

        // Handlers
        handleScanBtnClick, // Starts the flow
        handleStopBtnClick, // Stops the flow
        handleImageScan,    // Process file

        // Video/Zoom internal handlers (to be attached to <video>)
        handleVideoPlaying,
        handleTouchStart,
        handleTouchMove
    };
};

export default useQRScanner;