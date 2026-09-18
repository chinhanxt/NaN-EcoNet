import { useState, useEffect, useCallback } from 'react';
import {
    getAllCategories,
    getAllQRCodesForCategory,
    createCategory,
    deleteCategory,
    updateCategoriesOrder,
    updateCategoryCurrentCard
} from '../services/db';

/**
 * @typedef {import('../services/db').Category} Category
 * @typedef {import('../services/db').QRCode} QRCode
 */

export const useAppData = () => {
    // --- STATE ---

    /** @type {[Category[], React.Dispatch<React.SetStateAction<Category[]>>]} */
    const [categories, setCategories] = useState([]);

    /** * Dictionary where key is category ID, value is array of QR codes
     * @type {[Record<number, QRCode[]>, React.Dispatch<React.SetStateAction<Record<number, QRCode[]>>>]} 
     */
    const [categoryCardLists, setCategoryCardLists] = useState({});

    /** @type {[number | null, React.Dispatch<React.SetStateAction<number | null>>]} */
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);

    /** * State for delete modal
     * @type {[Category | null, React.Dispatch<React.SetStateAction<Category | null>>]} 
     */
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    // --- RELOAD FUNCTION (Heavy) ---
    const reloadCategories = useCallback(async () => {
        try {
            const all = await getAllCategories();
            const cardListPromises = all.map(cat => getAllQRCodesForCategory(Number(cat.id)));
            const allCardLists = await Promise.all(cardListPromises);

            /** @type {Record<number, QRCode[]>} */
            const newCardMap = {};
            for (let i = 0; i < all.length; i++) {
                const cat = all[i];
                if (cat.id !== undefined) {
                    newCardMap[cat.id] = allCardLists[i] || [];
                }
            }

            setCategories(all);
            setCategoryCardLists(newCardMap);

            // Default category selection logic if none selected
            if (all.length > 0) {
                setSelectedCategoryId(prev => {
                    // If already selected and exists - keep it, otherwise pick first
                    const exists = all.find(c => c.id === prev);
                    // @ts-ignore - all[0].id exists due to length > 0 check
                    return exists ? prev : all[0].id;
                });
            } else {
                setSelectedCategoryId(null);
            }
        } catch (error) {
            console.error("Failed to reload categories:", error);
        }
    }, []);

    // --- INITIAL LOAD ---
    useEffect(() => {
        let mounted = true;
        (async () => {
            await reloadCategories();
            if (!mounted) return;
        })();
        return () => { mounted = false; };
    }, [reloadCategories]);

    // --- ACTIONS ---

    // 1. Add Category
    /**
     * @param {string} name
     * @returns {Promise<Category | undefined>}
     */
    const handleAddCategory = useCallback(async (name) => {
        const nameToSave = name.trim();
        if (!nameToSave) return;

        try {
            const cat = await createCategory(nameToSave);
            await reloadCategories();
            // @ts-ignore - ID exists after creation
            setSelectedCategoryId(cat.id); // Switch to new category immediately
            return cat;
        } catch (e) {
            console.error("Error creating category", e);
            throw e;
        }
    }, [reloadCategories]);

    // 2. Delete Category
    /**
     * @param {number} categoryId
     */
    const handleDeleteCategory = useCallback(async (categoryId) => {
        try {
            await deleteCategory(categoryId);
            await reloadCategories();
        } catch (e) {
            console.error("Error deleting category", e);
        }
    }, [reloadCategories]);

    // 3. Reorder Categories
    /**
     * @param {Category[]} newOrderedList
     */
    const handleReorderCategories = useCallback(async (newOrderedList) => {
        // Optimistic UI update
        setCategories(newOrderedList);
        try {
            await updateCategoriesOrder(newOrderedList);
        } catch (e) {
            console.error("Error reordering categories:", e);
            // Reload real data on error
            await reloadCategories();
        }
    }, [reloadCategories]);

    // 4. Change Current Card (Carousel swipe)
    /**
     * @param {number} categoryId
     * @param {number | null} newCardId
     */
    const handleCardChange = useCallback(async (categoryId, newCardId) => {
        try {
            await updateCategoryCurrentCard(categoryId, newCardId);

            // Update UI immediately (e.g., to save position on reload)
            setCategories(prev => prev.map(cat =>
                cat.id === categoryId ? { ...cat, currentCardId: newCardId } : cat
            ));
        } catch (error) {
            console.error("Failed to update current card id:", error);
        }
    }, []);

    return {
        // State
        categories,
        categoryCardLists,
        selectedCategoryId,
        categoryToDelete,

        // Setters (exposed if component needs manual control)
        setSelectedCategoryId,
        setCategoryToDelete,

        // Functions
        reloadCategories,
        handleAddCategory,
        handleDeleteCategory,
        handleReorderCategories,
        handleCardChange
    };
};

export default useAppData;