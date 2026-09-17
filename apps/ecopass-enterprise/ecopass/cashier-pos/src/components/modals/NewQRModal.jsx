import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import TextareaAutosize from 'react-textarea-autosize';
import FormModal from '../ui/FormModal';
import TitleFitIndicator from '../ui/TitleFitIndicator';
import QRScanButtons from '../domain/QRScanButtons';

/**
 * @typedef {import('../../services/db').Category} Category
 */

/**
 * Scanner object from useQRScanner hook
 * @typedef {Object} ScannerHook
 * @property {boolean} isCameraOpen
 * @property {(isOpen: boolean) => void} setIsCameraOpen
 * @property {string | null} qrCode
 * @property {() => void} resetQrCode
 * @property {React.MutableRefObject<HTMLVideoElement | null>} videoRef
 * @property {() => void} handleVideoPlaying
 * @property {(e: React.TouchEvent) => void} handleTouchStart
 * @property {(e: React.TouchEvent) => void} handleTouchMove
 * @property {() => void} handleStopBtnClick
 * @property {() => void} handleScanBtnClick
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} handleImageScan
 */

/**
 * @typedef {Object} NewQRModalProps
 * @property {boolean} isOpen
 * @property {() => void} onClose
 * @property {(data: any) => void} onSubmit
 * @property {Category[]} categories
 * @property {number | string} [defaultCategoryId]
 * @property {ScannerHook} scanner
 */

/**
 * Modal for creating a new QR code
 * @param {NewQRModalProps} props
 */
export default function NewQRModal({
    isOpen,
    onClose,
    onSubmit,
    categories,
    defaultCategoryId,
    scanner // Object from useQRScanner hook
}) {
    const [title, setTitle] = useState('');
    const [data, setData] = useState('');
    const [categoryId, setCategoryId] = useState(/** @type {string | number} */(''));
    const [isTitleIndicatorVisible, setIsTitleIndicatorVisible] = useState(false);

    /** @type {React.MutableRefObject<SVGSVGElement | null>} */
    const svgRef = useRef(null);
    /** @type {React.MutableRefObject<HTMLInputElement | null>} */
    const fileInputRef = useRef(null); // Ref for local gallery input

    // Initialize on open
    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setData('');
            setCategoryId(defaultCategoryId || (categories[0]?.id) || '');
        }
    }, [isOpen, defaultCategoryId, categories]);

    // Watch for scan result from scanner prop
    useEffect(() => {
        if (isOpen && scanner.qrCode) {
            setData(scanner.qrCode);
            scanner.resetQrCode();
        }
    }, [isOpen, scanner.qrCode, scanner]);

    const handleSave = () => {
        if (!svgRef.current) return;
        onSubmit({
            title,
            qrData: data,
            categoryId,
            svgRef: svgRef.current
        });
    };

    // FOCUS LOGIC
    /** @param {React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>} e */
    const handleInputFocus = (e) => {
        // @ts-ignore
        const el = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (e.target);
        const valLength = el.value.length;
        // Move cursor to end and scroll
        setTimeout(() => {
            // @ts-ignore
            if (el.setSelectionRange) {
                el.setSelectionRange(valLength, valLength);
            }
            if (el.tagName === 'TEXTAREA') {
                el.scrollTop = el.scrollHeight;
            } else {
                el.scrollLeft = el.scrollWidth;
            }
        }, 0);
    };

    /** @param {React.KeyboardEvent<HTMLInputElement>} e */
    const handleEnterBlur = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const target = /** @type {HTMLInputElement} */ (e.target);
            if (target.value.trim().length > 0) target.blur();
        }
    };

    // Gallery button click handler
    const handleGalleryClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => { onClose(); scanner.setIsCameraOpen(false); }}
            onSubmit={handleSave}
            title="New QR"
            isDoneDisabled={!title.trim() || !data.trim()}
            disableScroll={false}
        >
            <div className="flex flex-col mt-0 w-full max-w-[350px] mx-auto space-y-4">

                {/* Hidden input for gallery */}
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={scanner.handleImageScan}
                />

                {/* SVG Generator (Hidden) */}
                {data && (
                    <div className="hidden">
                        <QRCodeSVG
                            ref={svgRef}
                            value={data}
                            size={1000}
                            level="H"
                            style={{ width: 200, height: 200 }}
                        />
                    </div>
                )}

                {/* Inputs */}
                <div className="flex flex-col bg-form-object rounded-[25px] overflow-hidden">
                    <div className="relative">
                        <TitleFitIndicator text={title} onStatusChange={setIsTitleIndicatorVisible} />
                        <input
                            type="text"
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                            onFocus={handleInputFocus}
                            onKeyDown={handleEnterBlur}
                            aria-label="QR Code Title"
                            className={`w-full bg-transparent border-none outline-none text-[17px] text-text-color placeholder-input-placeholder py-3 leading-tight transition-all duration-200 ${isTitleIndicatorVisible ? 'pl-4 pr-10' : 'px-4'}`}
                        />
                        <div className="absolute bottom-0 right-0 left-4 border-b border-separator pointer-events-none"></div>
                    </div>
                    <div className="relative">
                        <TextareaAutosize
                            placeholder="QR Code Data"
                            value={data}
                            onChange={(e) => setData(e.target.value)}
                            onFocus={handleInputFocus}
                            minRows={4}
                            maxRows={8}
                            aria-label="QR Code Data Content"
                            className="w-full bg-transparent border-none outline-none text-[17px] text-text-color placeholder-input-placeholder px-4 py-3 resize-none leading-tight"
                        />
                    </div>
                </div>

                {/* Scanner Area */}
                <div className="w-full flex flex-col items-center justify-center">
                    {scanner.isCameraOpen ? (
                        <div className="relative w-full flex flex-col items-center">
                            <video
                                ref={scanner.videoRef}
                                className="w-[281px] h-[281px] rounded-card object-cover shadow-sm mb-4 border-[0.5px] border-gray-500/20"
                                playsInline autoPlay muted
                                // @ts-ignore
                                onPlaying={scanner.handleVideoPlaying}
                                onTouchStart={scanner.handleTouchStart}
                                onTouchMove={scanner.handleTouchMove}
                            />
                            <QRScanButtons
                                isScanning={true}
                                onStopClick={scanner.handleStopBtnClick}
                                onCameraClick={() => { }}
                                onGalleryClick={() => { }}
                            />
                        </div>
                    ) : (
                        <div className="w-full">
                            <QRScanButtons
                                isScanning={false}
                                onCameraClick={scanner.handleScanBtnClick}
                                onGalleryClick={handleGalleryClick}
                                onStopClick={() => { }}
                            />
                        </div>
                    )}
                </div>

                {/* Category Selector */}
                <div className="bg-form-object rounded-[25px] h-[50px] flex items-center px-4 justify-between relative">
                    <span className="text-[17px] font-medium text-text-color whitespace-nowrap mr-2">Category</span>
                    <div className="flex-1 flex items-center justify-end min-w-0">
                        <span className="text-[17px] text-list-name overflow-hidden text-ellipsis whitespace-pre mr-1 text-right">
                            {categories.find(c => c.id == categoryId)?.name || 'Select...'}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="select-base absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                            aria-label="Select Category"
                        >
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name.replace(/ /g, '\u00A0')}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </FormModal>
    );
}