import {
  getAllCategories,
  getAllQRCodesGlobal,
  addImportedCategoryToDB,
  addImportedQRToDB,
  updateCategoryCurrentCard
} from '../services/db';

/**
 * @typedef {import('../services/db').Category} Category
 * @typedef {import('../services/db').QRCode} QRCode
 */

/**
 * Backup file structure
 * @typedef {Object} BackupData
 * @property {number} version
 * @property {number} timestamp
 * @property {Category[]} categories
 * @property {QRCode[]} qrCodes
 */

/**
 * Data Export Logic (Backup)
 * @returns {Promise<string>} Result message for debug
 */
export const exportBackup = async () => {
  try {
    const allCategories = await getAllCategories();
    const allQRCodes = await getAllQRCodesGlobal();

    /** @type {BackupData} */
    const exportData = {
      version: 1,
      timestamp: Date.now(),
      categories: allCategories,
      qrCodes: allQRCodes
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const fileName = `my_qrs_backup_${new Date().toISOString().slice(0, 10)}.json`;

    // 1. Try using Native Share (iOS/Android)
    try {
      if (navigator.canShare && navigator.share) {
        const file = new File([jsonString], fileName, { type: "application/json" });
        /** @type {ShareData} */
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return 'Export via Share successful';
        }
      }
    } catch (shareError) {
      // Safe check for AbortError (user cancelled)
      if (shareError instanceof Error && shareError.name === 'AbortError') {
        return 'Share cancelled';
      }
      console.warn("Share API failed, falling back to download", shareError);
    }

    // 2. Fallback: Classic download
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return 'Export download started';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error("Export failed: " + msg);
  }
};

/**
 * Data Import Logic (Restore)
 * @param {File} file - File selected by user
 * @returns {Promise<string>} Success message
 */
export const importBackup = async (file) => {
  try {
    const text = await file.text();
    /** @type {BackupData} */
    const data = JSON.parse(text);

    if (!data.categories || !Array.isArray(data.categories)) {
      throw new Error("Invalid format: missing categories");
    }

    // 1. Determine initial order (append to end)
    const existingCategories = await getAllCategories();
    let maxOrder = existingCategories.reduce((max, cat) => Math.max(max, cat.order || 0), 0);

    /** @type {Record<number, number>} { oldId: newId } */
    const categoryIdMap = {};

    // 2. Import Categories
    for (const cat of data.categories) {
      // Skip categories without ID
      if (cat.id === undefined) continue;

      maxOrder++;
      const savedCat = await addImportedCategoryToDB(cat, maxOrder);

      // Map old ID to new ID
      if (savedCat.id !== undefined) {
        categoryIdMap[cat.id] = savedCat.id;
      }
    }

    // 3. Import QR codes and restore links
    if (data.qrCodes && Array.isArray(data.qrCodes)) {
      /** @type {Record<number, number>} { oldQrId: newQrId } */
      const qrIdMap = {};

      for (const qr of data.qrCodes) {
        if (qr.id === undefined) continue;

        const newCategoryId = categoryIdMap[qr.categoryId];
        if (!newCategoryId) continue; // Skip if category not found

        const savedQr = await addImportedQRToDB(qr, newCategoryId);
        if (savedQr.id !== undefined) {
          qrIdMap[qr.id] = savedQr.id;
        }
      }

      // 4. Update currentCardId for categories
      for (const cat of data.categories) {
        if (cat.id === undefined) continue;

        const oldQrId = cat.currentCardId;
        // If the old category had a selected card, map it to the new one
        if (oldQrId && qrIdMap[oldQrId]) {
          const newCatId = categoryIdMap[cat.id];
          const newQrId = qrIdMap[oldQrId];
          if (newCatId && newQrId) {
            await updateCategoryCurrentCard(newCatId, newQrId);
          }
        }
      }
    }

    return 'Import finished successfully';
  } catch (err) {
    throw err;
  }
};