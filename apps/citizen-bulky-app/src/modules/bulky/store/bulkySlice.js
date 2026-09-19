import { createSlice } from '@reduxjs/toolkit';
import { BULKY_PERSONAS, BULKY_STORAGE_KEYS } from '../services/bulkyServiceContract.js';

export const getInitialActiveUser = () => {
  try {
    if (typeof window !== 'undefined' && window?.localStorage) {
      const raw = window.localStorage.getItem(BULKY_STORAGE_KEYS.ACTIVE_USER);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return BULKY_PERSONAS[0];
};

const initialState = {
  activeUser: null,
  capabilities: [],
  catalog: [],
  draft: null,
  ordersById: {},
  orderIds: [],
  quotesById: {},
  holdsById: {},
  paymentsById: {},
  refundsById: {},
  changeRequestsById: {},
  latePaymentResolutionsById: {},
  pagination: { cursor: null, hasMore: false },
  requestsByKey: {},
  activeRequestContexts: {},
  notifications: [],
};

export const bulkySlice = createSlice({
  name: 'bulky',
  initialState,
  reducers: {
    setBulkyCapabilities(state, action) {
      state.capabilities = action.payload || [];
    },
    switchBulkyUser(state, action) {
      const persona = action.payload || BULKY_PERSONAS[0];
      state.activeUser = persona;
      state.capabilities = persona.capabilities || [];
      try {
        if (typeof window !== 'undefined' && window?.localStorage) {
          window.localStorage.setItem(BULKY_STORAGE_KEYS.ACTIVE_USER, JSON.stringify(persona));
        }
      } catch {}
    },
    setBulkyDraft(state, action) {
      state.draft = action.payload;
    },
    clearBulkyDraft(state) {
      state.draft = null;
    },
    setRequestLoading(state, action) {
      const { key, contextId } = action.payload;
      state.requestsByKey[key] = { status: 'loading', error: null };
      if (contextId) {
        state.activeRequestContexts[key] = contextId;
      }
    },
    setRequestSuccess(state, action) {
      const { key, contextId } = action.payload;
      if (
        contextId &&
        state.activeRequestContexts[key] &&
        state.activeRequestContexts[key] !== contextId
      ) {
        return; // ignore stale response
      }
      state.requestsByKey[key] = { status: 'success', error: null };
    },
    setRequestError(state, action) {
      const { key, error, contextId } = action.payload;
      if (
        contextId &&
        state.activeRequestContexts[key] &&
        state.activeRequestContexts[key] !== contextId
      ) {
        return;
      }
      state.requestsByKey[key] = {
        status: 'error',
        error: {
          message: error?.message || 'Unknown error',
          code: error?.code || 'UNKNOWN',
        },
      };
    },
    setCatalogItems(state, action) {
      state.catalog = action.payload || [];
    },
    setOrdersList(state, action) {
      const { items = [], nextCursor } = action.payload;
      for (const order of items) {
        if (!state.ordersById[order.orderId]) {
          state.orderIds.push(order.orderId);
        }
        state.ordersById[order.orderId] = order;
      }
      state.pagination = { cursor: nextCursor || null, hasMore: Boolean(nextCursor) };
    },
    upsertOrder(state, action) {
      const order = action.payload;
      if (!order?.orderId) return;
      if (!state.ordersById[order.orderId]) {
        state.orderIds.unshift(order.orderId);
      }
      state.ordersById[order.orderId] = {
        ...state.ordersById[order.orderId],
        ...order,
      };
    },
    upsertQuote(state, action) {
      const quote = action.payload;
      if (!quote?.quoteId) return;
      state.quotesById[quote.quoteId] = quote;
    },
    upsertHold(state, action) {
      const hold = action.payload;
      if (!hold?.holdId) return;
      state.holdsById[hold.holdId] = hold;
    },
    upsertPayment(state, action) {
      const payment = action.payload;
      if (!payment?.paymentAttemptId) return;
      state.paymentsById[payment.paymentAttemptId] = payment;
    },
    upsertRefund(state, action) {
      const refund = action.payload;
      if (!refund?.refundId) return;
      state.refundsById[refund.refundId] = refund;
    },
    upsertChangeRequest(state, action) {
      const cr = action.payload;
      if (!cr?.changeRequestId) return;
      state.changeRequestsById[cr.changeRequestId] = cr;
    },
    upsertLatePaymentResolution(state, action) {
      const res = action.payload;
      if (!res?.latePaymentResolutionId) return;
      state.latePaymentResolutionsById[res.latePaymentResolutionId] = res;
    },
    setNotifications(state, action) {
      state.notifications = action.payload || [];
    },
    addNotification(state, action) {
      const notif = action.payload;
      if (!notif?.id) return;
      state.notifications = [notif, ...state.notifications.filter((n) => n.id !== notif.id)];
    },
    markNotificationRead(state, action) {
      const id = action.payload;
      const target = state.notifications.find((n) => n.id === id);
      if (target) target.read = true;
    },
    markAllNotificationsRead(state) {
      state.notifications.forEach((n) => {
        n.read = true;
      });
    },
    resetBulkyState() {
      return initialState;
    },
  },
});

export const {
  setBulkyCapabilities,
  switchBulkyUser,
  setBulkyDraft,
  clearBulkyDraft,
  setRequestLoading,
  setRequestSuccess,
  setRequestError,
  setCatalogItems,
  setOrdersList,
  upsertOrder,
  upsertQuote,
  upsertHold,
  upsertPayment,
  upsertRefund,
  upsertChangeRequest,
  upsertLatePaymentResolution,
  setNotifications,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  resetBulkyState,
} = bulkySlice.actions;

export const bulkyReducer = bulkySlice.reducer;
