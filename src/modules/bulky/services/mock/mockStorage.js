import { createDefaultSeed, DEFAULT_REPOSITORY_VERSION, DEFAULT_PRICE_BOOK } from './mockSeed.js';

export const REPOSITORY_STORAGE_KEY = 'smartbin:bulky:v1:repository';

export const getUserCacheKey = (userId) => `smartbin:bulky:v1:cache:${userId}`;
export const getUserOfflineDraftsKey = (userId) => `smartbin:bulky:v1:offline-drafts:${userId}`;

const clone = (value) => {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // fallback
    }
  }
  return JSON.parse(JSON.stringify(value));
};

export function createMockStorage({
  storage = typeof window !== 'undefined' ? window?.localStorage : null,
} = {}) {
  const fallbackStore = {};
  const backing = storage || {
    getItem: (key) => (key in fallbackStore ? fallbackStore[key] : null),
    setItem: (key, value) => {
      fallbackStore[key] = String(value);
    },
    removeItem: (key) => {
      delete fallbackStore[key];
    },
    clear: () => {
      for (const k of Object.keys(fallbackStore)) delete fallbackStore[k];
    },
  };

  const getRepository = () => {
    try {
      const raw = backing.getItem(REPOSITORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) {
          if (parsed.priceBook?.version === '2026.1') {
            parsed.priceBook = clone(DEFAULT_PRICE_BOOK);
            backing.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(parsed));
          }
          if (!parsed.priceBook?.items?.OTHER) {
            parsed.priceBook = {
              ...(parsed.priceBook || {}),
              items: {
                ...(parsed.priceBook?.items || {}),
                OTHER: 60000,
              },
            };
            backing.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(parsed));
          }
          if (parsed?.version === DEFAULT_REPOSITORY_VERSION) {
            if (!parsed.orders || Object.keys(parsed.orders).length === 0) {
              const seed = createDefaultSeed();
              parsed.orders = seed.orders;
              parsed.refunds = seed.refunds;
              parsed.changeRequests = seed.changeRequests;
              parsed.dispatchOutbox = seed.dispatchOutbox;
              parsed.notifications = seed.notifications;
              backing.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(parsed));
            } else if (!parsed.notifications) {
              parsed.notifications = createDefaultSeed().notifications;
              backing.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(parsed));
            }
            return clone(parsed);
          }
        }
      }
    } catch {
      // json parse error or invalid schema -> reseed
    }
    const seed = createDefaultSeed();
    backing.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(seed));
    return clone(seed);
  };

  const saveRepository = (repo) => {
    const data = clone(repo);
    data.version = DEFAULT_REPOSITORY_VERSION;
    backing.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(data));
    return clone(data);
  };

  const updateRepository = (updater) => {
    const current = getRepository();
    updater(current);
    return saveRepository(current);
  };

  const clearUserSession = (userId) => {
    if (!userId) return;
    backing.removeItem(getUserCacheKey(userId));
    backing.removeItem(getUserOfflineDraftsKey(userId));
  };

  const resetFixture = () => {
    const seed = createDefaultSeed();
    backing.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(seed));
    return clone(seed);
  };

  // Ensure repository exists
  getRepository();

  return {
    getRepository,
    saveRepository,
    updateRepository,
    clearUserSession,
    resetFixture,
    backing,
  };
}
