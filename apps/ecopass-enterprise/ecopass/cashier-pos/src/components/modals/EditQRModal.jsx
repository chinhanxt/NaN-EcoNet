import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import TextareaAutosize from 'react-textarea-autosize';
import FormModal from '../ui/FormModal';
import TitleFitIndicator from '../ui/TitleFitIndicator';
import QRScanButtons from '../domain/QRScanButtons';

/**
 * @typedef {import('../../services/db').Category} Category
 * @typedef {import('../../services/db').QRCode} QRCode
 */

/**
 * Scanner object returned by useQRScanner hook
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
 * @typedef {Object} EditQRModalProps
 * @property {boolean} isOpen
 * @property {() => void} onClose
 * @property {(data: any) => void} onSubmit
 * @property {(id: number) => void} onDelete
 * @property {QRCode | null} card
 * @property {Category[]} categories
 * @property {ScannerHook} scanner
 */

/**
 * Modal for editing/creating QR code
 * @param {EditQRModalProps} props
 */
export default function EditQRModal({
    isOpen,
    onClose,
    onSubmit,
    onDelete,
    card,
    categories,
    scanner
}) {
    const [title, setTitle] = useState('');
    const [data, setData] = useState('');
    const [categoryId, setCategoryId] = useState(/** @type {string | number} */(''));
    const [isTitleIndicatorVisible, setIsTitleIndicatorVisible] = useState(false);

    /** @type {React.MutableRefObject<SVGSVGElement | null>} */
    const svgRef = useRef(null);
    /** @type {React.MutableRefObject<HTMLInputElement | null>} */
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && card) {
            setTitle(card.title || '');
            setData(card.qrData || '');
            setCategoryId(card.categoryId);
        }
    }, [isOpen, card]);

    useEffect(() => {
        if (isOpen && scanner.qrCode) {
            setData(scanner.qrCode);
            scanner.resetQrCode();
        }
    }, [isOpen, scanner.qrCode, scanner]);

    const handleSave = () => {
        if (!card) return;
        onSubmit({
            id: card.id,
            title,
            qrData: data,
            categoryId,
            svgRef: svgRef.current
        });
    };

    const handleDelete = () => {
        if (card && card.id) onDelete(card.id);
    };

    /** @param {React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>} e */
    const handleInputFocus = (e) => {
        // @ts-ignore - TS sometimes does not see HTMLTextAreaElement correctly in generic event
        const el = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (e.target);
        const valLength = el.value.length;
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

    const handleGalleryClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => { onClose(); scanner.setIsCameraOpen(false); }}
            onSubmit={handleSave}
            title="Details"
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

                {/* Hidden SVG */}
                {data && (
                    <div className="hidden">
                        <QRCodeSVG ref={svgRef} value={data} size={1000} level="H" style={{ width: 200, height: 200 }} />
                    </div>
                )}

                {/* Inputs Block */}
                <div className="flex flex-col bg-form-object rounded-[25px] overflow-hidden">
                    <div className="relative">
                        <TitleFitIndicator text={title} onStatusChange={setIsTitleIndicatorVisible} />
                        <input
                            type="text"
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onFocus={handleInputFocus}
                            onKeyDown={handleEnterBlur}
                            aria-label="QR Code Title"
                            className={`w-full bg-transparent border-none outline-none text-[17px] text-text-color placeholder-input-placeholder py-3 leading-tight transition-all duration-200 ${isTitleIndicatorVisible ? 'pl-4 pr-10' : 'px-4'}`}
                        />
                        {/* Separator */}
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

                {/* Scanner */}
                <div className="w-full flex flex-col items-center justify-center">
                    {scanner.isCameraOpen ? (
                        <div className="relative w-full flex flex-col items-center">
                            <video
                                ref={scanner.videoRef}
                                className="w-[281px] h-[281px] rounded-card object-cover shadow-sm mb-4 border-[0.5px] border-gray-500/20"
                                playsInline
                                autoPlay
                                muted
                                // @ts-ignore - React SyntheticEvent vs Native Event mismatch
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

                {/* Category Select */}
                <div className="bg-form-object rounded-[25px] h-[50px] flex items-center px-4 justify-between relative">
                    <span className="text-[17px] font-medium text-text-color whitespace-nowrap mr-2">Category</span>
                    <div className="flex-1 flex items-center justify-end min-w-0">
                        <span className="text-[17px] text-list-name overflow-hidden text-ellipsis whitespace-pre mr-1 text-right">
                            {categories.find(c => c.id == categoryId)?.name || 'Select...'}
                        </span>
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

                {/* Delete Button */}
                <div className="w-full flex justify-center pt-4 pb-2">
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="flex items-center justify-center shadow-sm hover:brightness-90 transition-all active:scale-95 border-none p-0 cursor-pointer w-[44px] h-[44px] rounded-full bg-glass-bg backdrop-blur-md border-[0.5px] border-gray-500/20 text-system-red"
                        aria-label="Delete"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6H21" /><path d="M19 6V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V6" /><path d="M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" /><path d="M10 11V17" /><path d="M14 11V17" />
                        </svg>
                    </button>
                </div>
            </div>
        </FormModal>
    );
}