import React, { useState, useEffect } from 'react';
import FormModal from '../ui/FormModal';

/**
 * Component props description
 * @typedef {Object} CreateCategoryModalProps
 * @property {boolean} isOpen - Is the modal open
 * @property {() => void} onClose - Close function
 * @property {(name: string) => void} onSubmit - Submit function (receives name)
 */

/**
 * Modal for creating a new category
 * @param {CreateCategoryModalProps} props
 */
export default function CreateCategoryModal({ isOpen, onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setName('');
            setIsInputFocused(true);
        }
    }, [isOpen]);

    const handleSubmit = () => {
        onSubmit(name);
    };

    // Focus logic (scroll to end)
    /**
     * @param {React.FocusEvent<HTMLInputElement>} e
     */
    const handleInputFocus = (e) => {
        setIsInputFocused(true);
        const el = e.target;
        const valLength = el.value.length;

        // Move cursor to end and scroll
        setTimeout(() => {
            // Check for method existence (TS knows it's HTMLInputElement, but safety doesn't hurt)
            if (el.setSelectionRange) {
                el.setSelectionRange(valLength, valLength);
                el.scrollLeft = el.scrollWidth;
            }
        }, 0);
    };

    /**
     * @param {React.KeyboardEvent<HTMLInputElement>} e
     */
    const handleEnterBlur = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const target = /** @type {HTMLInputElement} */ (e.target);
            if (target.value.trim().length > 0) {
                target.blur();
            }
        }
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={handleSubmit}
            title="New Category"
            isDoneDisabled={name.trim().length === 0}
            disableScroll={true}
        >
            <div className="flex flex-col items-center mt-4 w-full max-w-[350px] mx-auto">
                <div className="relative w-full rounded-[14px] p-1 flex items-center bg-input-bg">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleEnterBlur}
                        onFocus={handleInputFocus}
                        onBlur={() => setIsInputFocused(false)}
                        placeholder="Category Name"
                        aria-label="Category Name Input"
                        autoFocus
                        className={`
                            w-full bg-transparent border-none outline-none 
                            text-[19px] font-semibold text-text-color placeholder-input-placeholder 
                            py-3 text-center truncate
                            ${(isInputFocused || name.length === 0) ? 'pl-4 pr-12 indent-8' : 'px-4'}
                        `}
                    />
                    {name.length > 0 && isInputFocused && (
                        <button
                            type="button"
                            onClick={() => setName('')}
                            onMouseDown={(e) => e.preventDefault()}
                            className="absolute right-5 w-[22px] h-[22px] rounded-full bg-clear-btn flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer border-none p-0 z-10"
                            aria-label="Clear text"
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-input-bg">
                                <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </FormModal>
    );
}