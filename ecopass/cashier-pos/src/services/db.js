/**
 * @typedef {Object} Category
 * @property {number} [id]
 * @property {string} name
 * @property {number} order
 * @property {number | null} currentCardId
 * @property {number} createdAt
 */

/**
 * @typedef {Object} QRCode
 * @property {number} [id]
 * @property {number} categoryId
 * @property {string} title
 * @property {string} qrData
 * @property {string} qrImageDataUrl
 * @property {number} timestamp
 */

const DB_NAME = "QRCodeDB";
const CATEGORIES_STORE = "Categories";
const QRCODES_STORE = "QRCodes";

/* --- IndexedDB helpers + schema/migration --- */

/**
 * Opens connection to DB.
 * @returns {Promise<IDBDatabase>}
 */
export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      // Cast target to IDBOpenDBRequest so TS sees the result field
      const req = /** @type {IDBOpenDBRequest} */ (event.target);
      const db = req.result;

      if (!db.objectStoreNames.contains(CATEGORIES_STORE)) {
        db.createObjectStore(CATEGORIES_STORE, { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(QRCODES_STORE)) {
        const qStore = db.createObjectStore(QRCODES_STORE, { keyPath: "id", autoIncrement: true });
        qStore.createIndex("byCategory", "categoryId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/* ==================================================================================
   CRUD: CATEGORIES
   ================================================================================== */

/**
 * Load all categories
 * @returns {Promise<Category[]>}
 */
export const getAllCategories = async () => {
  const db = await openDB();
  const tx = db.transaction(CATEGORIES_STORE, "readonly");
  const store = tx.objectStore(CATEGORIES_STORE);

  return new Promise((resolve) => {
    /** @type {Category[]} */
    const result = [];
    const req = store.openCursor();

    req.onsuccess = (e) => {
      const cursor = /** @type {IDBRequest<IDBCursorWithValue>} */ (e.target).result;
      if (cursor) {
        result.push(cursor.value);
        cursor.continue();
      } else {
        result.sort((a, b) => (a.order || 0) - (b.order || 0));
        resolve(result);
      }
    };
    req.onerror = () => resolve([]);
  });
};

/**
 * Create category
 * @param {string | null} [customName]
 * @returns {Promise<Category>}
 */
export const createCategory = async (customName = null) => {
  const all = await getAllCategories();
  const order = all.length + 1;
  const now = Date.now();

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORIES_STORE, "readwrite");
    const store = tx.objectStore(CATEGORIES_STORE);

    /** @type {Category} */
    const newCatTemplate = { name: '', order, currentCardId: null, createdAt: now };
    const req = store.add(newCatTemplate);

    req.onsuccess = (e) => {
      const id = /** @type {number} */ (/** @type {IDBRequest} */ (e.target).result);
      // Use customName if provided, otherwise generate "Category N"
      const finalName = customName ? customName : `Category ${id}`;

      /** @type {Category} */
      const updated = { id, name: finalName, order, currentCardId: null, createdAt: now };
      const putReq = store.put(updated);

      putReq.onsuccess = () => {
        resolve(updated);
      };
      putReq.onerror = (err) => reject(err);
    };

    req.onerror = (err) => reject(err);
    tx.onabort = () => reject(new Error("Transaction aborted"));
    tx.onerror = (e) => {
      const target = /** @type {IDBRequest} */ (e.target);
      reject(target.error || new Error('Transaction error'));
    };
  });
};

/**
 * Raw Add Category (for Import)
 * @param {Category} categoryData
 * @param {number} newOrder
 * @returns {Promise<Category>}
 */
export const addImportedCategoryToDB = async (categoryData, newOrder) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORIES_STORE, "readwrite");
    const store = tx.objectStore(CATEGORIES_STORE);

    // Remove old ID to trigger autoIncrement
    const { id, ...dataWithoutId } = categoryData;

    // Overwrite order and reset currentCardId (will be updated later)
    /** @type {Category} */
    const newCategory = {
      // @ts-ignore - TS might complain about spread, but it's safe here
      ...dataWithoutId,
      name: categoryData.name, // Explicitly specify required fields
      createdAt: categoryData.createdAt || Date.now(),
      order: newOrder,
      currentCardId: null
    };

    const req = store.add(newCategory);

    req.onsuccess = (e) => {
      const newId = /** @type {number} */ (/** @type {IDBRequest} */ (e.target).result);
      // Return full object with new ID
      resolve({ ...newCategory, id: newId });
    };
    req.onerror = (e) => reject(e);
  });
};

/**
 * Update category name
 * @param {number} categoryId
 * @param {string} newName
 * @returns {Promise<Category | null>}
 */
export const updateCategoryName = async (categoryId, newName) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORIES_STORE, "readwrite");
    const store = tx.objectStore(CATEGORIES_STORE);

    const getReq = store.get(categoryId);
    getReq.onsuccess = (e) => {
      /** @type {Category} */
      const data = /** @type {IDBRequest} */ (e.target).result;
      if (!data) {
        resolve(null);
        return;
      }
      data.name = newName;
      const putReq = store.put(data);
      putReq.onsuccess = () => resolve(data);
      putReq.onerror = (err) => reject(err);
    };
    getReq.onerror = (err) => reject(err);
  });
};

/**
 * Delete category and all its QR codes
 * @param {number} categoryId
 * @returns {Promise<void>}
 */
export const deleteCategory = async (categoryId) => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([CATEGORIES_STORE, QRCODES_STORE], "readwrite");
    const catStore = tx.objectStore(CATEGORIES_STORE);
    const qStore = tx.objectStore(QRCODES_STORE);
    const index = qStore.index("byCategory");

    const getCatReq = catStore.get(categoryId);
    getCatReq.onsuccess = (ev) => {
      /** @type {Category} */
      const cat = /** @type {IDBRequest} */ (ev.target).result;
      const deletedOrder = cat ? (cat.order || 0) : null;

      catStore.delete(categoryId);

      const range = IDBKeyRange.only(categoryId);
      const cursorReq = index.openCursor(range);

      cursorReq.onsuccess = (ce) => {
        const cursor = /** @type {IDBRequest<IDBCursor>} */ (ce.target).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      cursorReq.onerror = (e) => {
        console.error('Cursor error while deleting category qrcodes', e);
      };

      if (deletedOrder != null) {
        const catCursorReq = catStore.openCursor();
        catCursorReq.onsuccess = (cEv) => {
          const c = /** @type {IDBRequest<IDBCursorWithValue>} */ (cEv.target).result;
          if (c) {
            /** @type {Category} */
            const value = c.value;
            if ((value.order || 0) > deletedOrder) {
              value.order = (value.order || 0) - 1;
              c.update(value);
            }
            c.continue();
          }
        };
        catCursorReq.onerror = (err) => {
          console.error('Error while reindexing categories after delete', err);
        };
      }
    };

    getCatReq.onerror = (e) => {
      // Fallback logic
      try { catStore.delete(categoryId); } catch (_) { }
      const range = IDBKeyRange.only(categoryId);
      const cursorReq = index.openCursor(range);
      cursorReq.onsuccess = (ce) => {
        const cursor = /** @type {IDBRequest<IDBCursor>} */ (ce.target).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      cursorReq.onerror = () => { };
    };

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => {
      const target = /** @type {IDBRequest} */ (e.target);
      reject(target.error || e);
    };
    tx.onabort = () => reject(new Error('Transaction aborted'));
  });
};

/**
 * Mass update order
 * @param {Category[]} newCategories
 * @returns {Promise<void>}
 */
export const updateCategoriesOrder = async (newCategories) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORIES_STORE, "readwrite");
    const store = tx.objectStore(CATEGORIES_STORE);

    // Iterate through all categories and update their order
    newCategories.forEach((cat, index) => {
      /** @type {Category} */
      const updatedCat = { ...cat, order: index + 1 };
      store.put(updatedCat);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
};

/**
 * Update category.currentCardId
 * @param {number} categoryId
 * @param {number | null} cardId
 * @returns {Promise<Category | null>}
 */
export const updateCategoryCurrentCard = async (categoryId, cardId) => {
  const db = await openDB();
  const tx = db.transaction(CATEGORIES_STORE, "readwrite");
  const store = tx.objectStore(CATEGORIES_STORE);
  return new Promise((resolve, reject) => {
    const getReq = store.get(categoryId);
    getReq.onsuccess = (ev) => {
      /** @type {Category} */
      const cat = /** @type {IDBRequest} */ (ev.target).result;
      if (!cat) {
        resolve(null);
        return;
      }
      cat.currentCardId = cardId;
      const putReq = store.put(cat);
      putReq.onsuccess = () => resolve(cat);
      putReq.onerror = (e) => reject(e);
    };
    getReq.onerror = (e) => reject(e);
  });
};

/* ==================================================================================
   CRUD: QR CODES
   ================================================================================== */

/**
 * Save a QR code into QRCodes store
 * @param {Object} params
 * @param {number} params.categoryId
 * @param {string} [params.title]
 * @param {string} params.qrData
 * @param {string} params.qrImageDataUrl
 * @returns {Promise<QRCode>}
 */
export const saveQRCodeToDB = async ({ categoryId, title = "Untitled", qrData, qrImageDataUrl }) => {
  const db = await openDB();
  const tx = db.transaction(QRCODES_STORE, "readwrite");
  const store = tx.objectStore(QRCODES_STORE);
  const now = Date.now();
  return new Promise((resolve, reject) => {
    /** @type {QRCode} */
    const newQR = { categoryId, title, qrData, qrImageDataUrl, timestamp: now };
    const req = store.add(newQR);
    req.onsuccess = (e) => {
      const id = /** @type {number} */ (/** @type {IDBRequest} */ (e.target).result);
      resolve({ ...newQR, id });
    };
    req.onerror = (err) => reject(err);
  });
};

/**
 * Raw Add QR (for Import)
 * @param {QRCode} qrData
 * @param {number} newCategoryId
 * @returns {Promise<QRCode>}
 */
export const addImportedQRToDB = async (qrData, newCategoryId) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QRCODES_STORE, "readwrite");
    const store = tx.objectStore(QRCODES_STORE);

    const { id, ...dataWithoutId } = qrData;

    // Use ID of the new category
    /** @type {QRCode} */
    const newQR = {
      // @ts-ignore
      ...dataWithoutId,
      title: qrData.title,
      qrData: qrData.qrData,
      qrImageDataUrl: qrData.qrImageDataUrl,
      timestamp: qrData.timestamp || Date.now(),
      categoryId: newCategoryId
    };

    const req = store.add(newQR);

    req.onsuccess = (e) => {
      const newId = /** @type {number} */ (/** @type {IDBRequest} */ (e.target).result);
      resolve({ ...newQR, id: newId });
    };
    req.onerror = (e) => reject(e);
  });
};

/**
 * Update QR code
 * @param {QRCode} params
 * @returns {Promise<QRCode>}
 */
export const updateQRCodeInDB = async ({ id, categoryId, title, qrData, qrImageDataUrl }) => {
  const db = await openDB();
  const tx = db.transaction(QRCODES_STORE, "readwrite");
  const store = tx.objectStore(QRCODES_STORE);

  return new Promise((resolve, reject) => {
    // 1. Fetch old record to preserve timestamp
    // @ts-ignore
    const getReq = store.get(id);

    getReq.onsuccess = (e) => {
      /** @type {QRCode} */
      const oldData = /** @type {IDBRequest} */ (e.target).result;
      if (!oldData) {
        reject(new Error("Card not found"));
        return;
      }

      // 2. Update fields
      /** @type {QRCode} */
      const updatedData = {
        ...oldData,
        categoryId: Number(categoryId), // Important if category changed
        title: title,
        qrData: qrData,
        qrImageDataUrl: qrImageDataUrl || oldData.qrImageDataUrl
      };

      // 3. Save back (put updates if key exists)
      const putReq = store.put(updatedData);

      putReq.onsuccess = () => resolve(updatedData);
      putReq.onerror = (err) => reject(err);
    };

    getReq.onerror = (err) => reject(err);
  });
};

/**
 * Load ALL QR codes for a specific categoryId
 * @param {number} categoryId
 * @returns {Promise<QRCode[]>}
 */
export const getAllQRCodesForCategory = async (categoryId) => {
  const db = await openDB();
  const store = db.transaction(QRCODES_STORE, "readonly").objectStore(QRCODES_STORE);
  const index = store.index("byCategory");
  const range = IDBKeyRange.only(categoryId);

  return new Promise((resolve) => {
    /** @type {QRCode[]} */
    const result = [];
    const cursorReqNext = index.openCursor(range);
    cursorReqNext.onsuccess = (ev) => {
      const cursor = /** @type {IDBRequest<IDBCursorWithValue>} */ (ev.target).result;
      if (cursor) {
        result.push(cursor.value);
        cursor.continue();
      } else {
        result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(result);
      }
    };
    cursorReqNext.onerror = () => resolve([]);
  });
};

/**
 * Helper: Get ALL QR codes (Global)
 * @returns {Promise<QRCode[]>}
 */
export const getAllQRCodesGlobal = async () => {
  const db = await openDB();
  const tx = db.transaction(QRCODES_STORE, "readonly");
  const store = tx.objectStore(QRCODES_STORE);
  return new Promise((resolve) => {
    /** @type {QRCode[]} */
    const result = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = /** @type {IDBRequest<IDBCursorWithValue>} */ (e.target).result;
      if (cursor) {
        result.push(cursor.value);
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    req.onerror = () => resolve([]);
  });
};

/**
 * Delete single QR by id
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteQRCodeById = async (id) => {
  const db = await openDB();
  const tx = db.transaction(QRCODES_STORE, "readwrite");
  const store = tx.objectStore(QRCODES_STORE);
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
};