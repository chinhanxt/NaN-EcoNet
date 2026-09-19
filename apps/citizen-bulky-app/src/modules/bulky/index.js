// Public module exports for Dev 0 and consumers
export { bulkyRoutes } from './routes.jsx';

export {
  bulkySlice,
  bulkyReducer,
  setBulkyCapabilities,
  setBulkyDraft,
  clearBulkyDraft,
  resetBulkyState,
  createBulkyThunks,
  selectBulkyState,
  selectCanReadBulky,
  selectCanManageBulky,
  selectBulkyOrders,
  selectBulkyOrderById,
  selectBulkyDraft,
  selectBulkyCatalog,
  selectOrderActions,
  selectPaymentState,
  selectRefundProgress,
} from './store/index.js';

export { createMockBulkyServices } from './services/mock/createMockBulkyServices.js';

export {
  createMockStorage,
  REPOSITORY_STORAGE_KEY,
  getUserCacheKey,
  getUserOfflineDraftsKey,
} from './services/mock/mockStorage.js';

export {
  BULKY_CAPABILITIES,
  BULKY_ERROR_CODES,
  BULKY_STORAGE_KEYS,
} from './services/bulkyServiceContract.js';

export {
  ORDER_STATUS,
  PAYMENT_STATUS,
  HOLD_STATUS,
  REFUND_STATUS,
  AI_DECISION,
  CHANGE_DECISION,
  DISPATCH_EVENT_TYPE,
  ACCEPTED_ITEM_TYPES,
} from './domain/constants.js';

export {
  toDispatchBulkyWasteOrder,
  createDispatchEvent,
  getDispatchOutboxEvents,
} from './integration.js';

export { BulkyBookingPage } from './pages/BulkyBookingPage.jsx';
export { BulkyQuotePage } from './pages/BulkyQuotePage.jsx';
export { BulkyPaymentPage } from './pages/BulkyPaymentPage.jsx';
export { BulkyOrdersPage } from './pages/BulkyOrdersPage.jsx';
export { BulkyOrderDetailPage } from './pages/BulkyOrderDetailPage.jsx';
