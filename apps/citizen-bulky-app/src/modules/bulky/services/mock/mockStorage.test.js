import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockStorage,
  REPOSITORY_STORAGE_KEY,
  getUserCacheKey,
  getUserOfflineDraftsKey,
} from './mockStorage.js';
import { DEFAULT_REPOSITORY_VERSION } from './mockSeed.js';

describe('mockStorage', () => {
  let memory;
  let backingStore;

  beforeEach(() => {
    backingStore = {};
    memory = {
      getItem: (key) => (key in backingStore ? backingStore[key] : null),
      setItem: (key, value) => {
        backingStore[key] = String(value);
      },
      removeItem: (key) => {
        delete backingStore[key];
      },
      clear: () => {
        backingStore = {};
      },
    };
  });

  it('initializes repository with correct repository version', () => {
    const storage = createMockStorage({ storage: memory });
    const repo = storage.getRepository();
    expect(repo.version).toBe(DEFAULT_REPOSITORY_VERSION);
    expect(repo.households).toBeDefined();
    expect(backingStore[REPOSITORY_STORAGE_KEY]).toBeDefined();
  });

  it('reseeds deterministically when repository data has a schema version mismatch', () => {
    backingStore[REPOSITORY_STORAGE_KEY] = JSON.stringify({ version: 'smartbin:bulky:legacy' });
    const storage = createMockStorage({ storage: memory });
    const repo = storage.getRepository();
    expect(repo.version).toBe(DEFAULT_REPOSITORY_VERSION);
    expect(repo.households).toBeDefined();
  });

  it('preserves deep-clone isolation between storage mutations and reads', () => {
    const storage = createMockStorage({ storage: memory });
    const repo1 = storage.getRepository();
    repo1.households['hh-test'] = { id: 'hh-test' };

    const repo2 = storage.getRepository();
    expect(repo2.households['hh-test']).toBeUndefined();

    storage.updateRepository((draft) => {
      draft.households['hh-saved'] = { id: 'hh-saved' };
    });

    const repo3 = storage.getRepository();
    expect(repo3.households['hh-saved']).toBeDefined();
  });

  it('upgrades only the active demo tariff while preserving accepted quotes and orders', () => {
    const storage = createMockStorage({ storage: memory });
    storage.updateRepository((repo) => {
      repo.priceBook = { version: '2026.1', items: { SOFA: 150000, OTHER: 60000 } };
      repo.orders.saved = {
        orderId: 'saved',
        acceptedQuote: { priceBookVersion: '2026.1', totalVnd: 175000 },
      };
    });
    const repo = storage.getRepository();
    expect(repo.priceBook.pricingBasis).toBe('ITEM_SIZE');
    expect(repo.orders.saved.acceptedQuote).toEqual({
      priceBookVersion: '2026.1',
      totalVnd: 175000,
    });
  });

  it('clears only per-user keys on clearUserSession, preserving durable repository and other users', () => {
    const storage = createMockStorage({ storage: memory });
    const u1CacheKey = getUserCacheKey('user-1');
    const u1DraftsKey = getUserOfflineDraftsKey('user-1');
    const u2CacheKey = getUserCacheKey('user-2');

    memory.setItem(u1CacheKey, JSON.stringify({ draft: 'draft-1' }));
    memory.setItem(u1DraftsKey, JSON.stringify({ offline: true }));
    memory.setItem(u2CacheKey, JSON.stringify({ draft: 'draft-2' }));

    storage.clearUserSession('user-1');

    expect(memory.getItem(u1CacheKey)).toBeNull();
    expect(memory.getItem(u1DraftsKey)).toBeNull();
    expect(memory.getItem(u2CacheKey)).not.toBeNull();
    expect(memory.getItem(REPOSITORY_STORAGE_KEY)).not.toBeNull();
  });
});
