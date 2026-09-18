import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * @typedef {import('../../services/db').Category} Category
 */

/**
 * Props for the row component
 * @typedef {Object} CategoryItemProps
 * @property {Category} cat - Category object
 * @property {(id: number) => void} onDelete - Delete function
 * @property {(cat: Category) => void} onEditName - Edit name function
 * @property {boolean} isLast - Is the element the last one
 * @property {boolean} [isDragging] - Is the element currently being dragged
 * @property {React.CSSProperties} [style] - Styles (for Dnd transform)
 * @property {Object} [dragListeners] - Dnd event listeners (SyntheticListenerMap)
 */

/* --- 1. Visual Row Component --- */
/**
 * Use forwardRef specifying props type and element type (HTMLDivElement)
 * @type {React.ForwardRefExoticComponent<CategoryItemProps & React.RefAttributes<HTMLDivElement>>}
 */
const CategoryItem = React.forwardRef(({
    cat,
    onDelete,
    onEditName,
    isLast,
    isDragging,
    style,
    dragListeners,
    ...props
}, ref) => {

    // Base container styles
    const baseClasses = "relative flex items-center justify-between pl-4 pr-0 h-[50px] bg-form-object transition-shadow select-none tap-transparent";

    // Active state styles (while dragging)
    const draggingClasses = isDragging
        ? "shadow-[0_8px_20px_rgba(0,0,0,0.25)] z-[999] opacity-100 rounded-[25px] border border-white/10"
        : "active:bg-gray-100 dark:active:bg-[#3a3a3c]";

    return (
        <div
            ref={ref}
            style={style} // Keep style only for transform (from dnd-kit)
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            className={`${baseClasses} ${draggingClasses}`}
            {...props}
        >
            {/* --- Left: Delete Button --- */}
            <div className="relative z-20 flex items-center mr-3">
                <button
                    // @ts-ignore - cat.id might be undefined in types, but exists at runtime
                    onClick={() => onDelete && onDelete(cat.id)}
                    className="w-6 h-6 rounded-full bg-system-red flex items-center justify-center shrink-0 shadow-sm hover:brightness-90 transition-all border-none p-0 cursor-pointer active:scale-90"
                    aria-label="Delete category"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <svg width="14" height="2" viewBox="0 0 14 2" fill="none">
                        <rect width="14" height="2" rx="1" fill="white" />
                    </svg>
                </button>
            </div>

            {/* --- Center: Category Name --- */}
            <span className="flex-1 text-[17px] font-medium text-left overflow-hidden text-ellipsis whitespace-pre text-text-color select-none">
                {cat.name}
            </span>

            {/* --- Right: Info Button + Burger --- */}
            <div className="flex items-center h-full ml-3">
                {/* Info/Edit Button */}
                <button
                    onClick={() => onEditName && onEditName(cat)}
                    className="shrink-0 w-6 h-6 mr-3 p-0 rounded-full flex items-center justify-center bg-transparent text-system-blue cursor-pointer relative z-20 active:opacity-50"
                    aria-label="Edit name"
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="11" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </button>

                {/* --- BURGER HANDLE --- */}
                <div
                    {...dragListeners}
                    className="w-12 h-full flex items-center justify-center cursor-grab touch-none text-[#C7C7CC] active:text-[#8E8E93] border-l border-separator outline-none"
                    role="button"
                    aria-label="Drag to reorder category"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="9" x2="20" y2="9"></line>
                        <line x1="4" y1="15" x2="20" y2="15"></line>
                    </svg>
                </div>
            </div>

            {/* Separator */}
            {!isLast && !isDragging && (
                <div className="absolute bottom-0 right-[14px] left-[52px] h-0 border-b border-separator" />
            )}
        </div>
    );
});

/* --- 2. Sortable Wrapper --- */
/**
 * @param {CategoryItemProps} props
 */
function SortableCategoryItem({ cat, onDelete, onEditName, isLast }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: cat.id || 0 }); // id must not be undefined

    const modifiedTransform = transform ? {
        ...transform,
        scaleX: isDragging ? 1.02 : 1,
        scaleY: isDragging ? 1.02 : 1,
    } : null;

    const style = {
        transform: CSS.Transform.toString(modifiedTransform),
        transition,
        zIndex: isDragging ? 999 : 'auto',
        position: /** @type {React.CSSProperties['position']} */ ('relative'),
    };

    return (
        <CategoryItem
            ref={setNodeRef}
            style={style}
            cat={cat}
            onDelete={onDelete}
            onEditName={onEditName}
            isLast={isLast}
            isDragging={isDragging}
            dragListeners={listeners}
            {...attributes}
        />
    );
}

/**
 * List props
 * @typedef {Object} CategoryEditListProps
 * @property {Category[]} categories
 * @property {(id: number) => void} onDelete
 * @property {(cat: Category) => void} onEditName
 * @property {(newOrder: Category[]) => void} onReorder
 */

/* --- 3. Main List Component --- */
/**
 * @param {CategoryEditListProps} props
 */
export default function CategoryEditList({
    categories,
    onDelete,
    onEditName,
    onReorder
}) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 100,
                tolerance: 5,
            },
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const oldIndex = categories.findIndex((c) => c.id === active.id);
            const newIndex = categories.findIndex((c) => c.id === over.id);
            const newOrder = arrayMove(categories, oldIndex, newIndex);
            onReorder(newOrder);
        }
    };

    return (
        <div className="w-full max-w-[720px] mt-0 animate-fadeIn pb-10">
            <h2 className="text-xl font-bold mb-3 px-6 pt-10 text-text-color text-left">
                My Categories
            </h2>

            <div className="overflow-hidden rounded-[25px] bg-form-object mx-4 shadow-sm relative">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        // @ts-ignore - id might be undefined in type, but not in data
                        items={categories.map(c => c.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {categories.map((cat, index) => (
                            <SortableCategoryItem
                                // @ts-ignore
                                key={cat.id}
                                cat={cat}
                                onDelete={onDelete}
                                onEditName={onEditName}
                                isLast={index === categories.length - 1}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                {categories.length === 0 && (
                    <div className="flex items-center justify-center h-[50px] text-gray-500 text-[17px]">
                        No categories found
                    </div>
                )}
            </div>
        </div>
    );
}