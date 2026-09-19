import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { bulkyReducer, setBulkyCapabilities, switchBulkyUser } from './bulkySlice.js';
import { createBulkyThunks } from './index.js';
import {
  selectCanReadBulky,
  selectCanManageBulky,
  selectOrderActions,
  selectPaymentState,
  selectRefundProgress,
  selectBulkyNotifications,
  selectRoleNotifications,
  selectUnreadNotificationsCount,
} from './selectors.js';
import { BULKY_CAPABILITIES } from '../services/bulkyServiceContract.js';
import { ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS } from '../domain/constants.js';

describe('Bulky Redux store & selectors', () => {
  let mockServices;
  let thunks;
  let store;

  beforeEach(() => {
    mockServices = {
      catalog: {
        listAcceptedItems: async () => [{ code: 'SOFA', displayName: 'Sofa' }],
      },
      orders: {
        list: async () => ({
          items: [{ orderId: 'ord-1', householdId: 'hh-1', orderStatus: ORDER_STATUS.CONFIRMED }],
          nextCursor: null,
        }),
        get: async (id) => ({
          orderId: id,
          orderStatus: ORDER_STATUS.CONFIRMED,
          paymentStatus: PAYMENT_STATUS.SUCCESS,
        }),
        createDraft: async (input) => ({
          orderId: 'ord-new',
          orderStatus: ORDER_STATUS.DRAFT,
          ...input,
        }),
        confirmItems: async (id, input) => ({
          orderId: id,
          orderStatus: ORDER_STATUS.DRAFT,
          confirmedItems: input.confirmedItems,
        }),
      },
      quotes: {
        reserveAndCreate: async (orderId) => ({
          order: {
            orderId,
            orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
            activeQuoteId: 'q-1',
            activeHoldId: 'h-1',
          },
          quote: { quoteId: 'q-1', totalVnd: 150000 },
          hold: { holdId: 'h-1', status: 'ACTIVE' },
        }),
      },
      payments: {
        start: async (orderId, quoteId) => ({
          paymentAttemptId: 'pay-1',
          orderId,
          quoteId,
          amountVnd: 150000,
          status: 'PENDING',
        }),
        simulateResult: async (id) => ({
          payment: { paymentAttemptId: id, status: 'SUCCESS' },
          order: {
            orderId: 'ord-1',
            orderStatus: ORDER_STATUS.CONFIRMED,
            paymentStatus: PAYMENT_STATUS.SUCCESS,
            acceptedPayment: { paymentAttemptId: id, status: 'SUCCESS' },
          },
          hold: { holdId: 'h-1', status: 'CONSUMED' },
        }),
      },
      changes: {
        requestCancellation: async (id) => ({
          order: {
            orderId: id,
            orderStatus: ORDER_STATUS.CANCELLED,
            refundStatus: REFUND_STATUS.REQUESTED,
          },
          refund: {
            refundId: 'ref-1',
            orderId: id,
            amountVnd: 150000,
            status: REFUND_STATUS.REQUESTED,
          },
        }),
      },
      notifications: {
        list: async () => [
          {
            id: 'notif-1',
            targetRole: 'DISPATCHER',
            title: 'Yêu cầu dời ngày mới',
            read: false,
          },
          {
            id: 'notif-2',
            targetRole: 'CITIZEN',
            title: 'Đã duyệt yêu cầu',
            read: true,
          },
        ],
        markAsRead: async () => ({ success: true }),
        markAllAsRead: async () => ({ success: true }),
      },
    };

    thunks = createBulkyThunks(mockServices);

    store = configureStore({
      reducer: {
        bulky: bulkyReducer,
      },
    });
  });

  describe('Initial state & capabilities', () => {
    it('initializes with empty normalized collections and handles capability selectors', () => {
      const state = store.getState();
      expect(state.bulky.orderIds).toEqual([]);
      expect(state.bulky.ordersById).toEqual({});
      expect(selectCanReadBulky(state)).toBe(false);
      expect(selectCanManageBulky(state)).toBe(false);

      store.dispatch(
        setBulkyCapabilities([
          BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
        ]),
      );

      const updatedState = store.getState();
      expect(selectCanReadBulky(updatedState)).toBe(true);
      expect(selectCanManageBulky(updatedState)).toBe(true);
    });
  });

  describe('Thunks execution and normalization', () => {
    it('fetches catalog and populates catalog items', async () => {
      await store.dispatch(thunks.fetchCatalog());
      const state = store.getState();
      expect(state.bulky.catalog).toHaveLength(1);
      expect(state.bulky.catalog[0].code).toBe('SOFA');
    });

    it('fetches orders and normalizes ordersById and orderIds', async () => {
      await store.dispatch(thunks.fetchOrders());
      const state = store.getState();
      expect(state.bulky.orderIds).toContain('ord-1');
      expect(state.bulky.ordersById['ord-1'].orderStatus).toBe(ORDER_STATUS.CONFIRMED);
    });

    it('reserves quote and hold, storing quotesById and holdsById normalized', async () => {
      await store.dispatch(
        thunks.reserveQuoteAndHold({ orderId: 'ord-1', requestedDate: '2026-09-20' }),
      );
      const state = store.getState();
      expect(state.bulky.quotesById['q-1']).toBeDefined();
      expect(state.bulky.holdsById['h-1']).toBeDefined();
      expect(state.bulky.ordersById['ord-1'].activeQuoteId).toBe('q-1');
    });

    it('cancels order and stores refund record in refundsById', async () => {
      await store.dispatch(thunks.cancelOrder({ orderId: 'ord-1', reason: 'Không cần nữa' }));
      const state = store.getState();
      expect(state.bulky.ordersById['ord-1'].orderStatus).toBe(ORDER_STATUS.CANCELLED);
      expect(state.bulky.refundsById['ref-1']).toBeDefined();
      expect(state.bulky.refundsById['ref-1'].amountVnd).toBe(150000);
    });
  });

  describe('Selectors', () => {
    it('computes selectOrderActions according to order state', () => {
      store.dispatch(
        setBulkyCapabilities([
          BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
        ]),
      );

      const draftState = {
        bulky: {
          ...store.getState().bulky,
          ordersById: {
            'o-draft': { orderId: 'o-draft', orderStatus: ORDER_STATUS.DRAFT },
            'o-awaiting': { orderId: 'o-awaiting', orderStatus: ORDER_STATUS.AWAITING_PAYMENT },
            'o-confirmed': { orderId: 'o-confirmed', orderStatus: ORDER_STATUS.CONFIRMED },
            'o-completed': { orderId: 'o-completed', orderStatus: ORDER_STATUS.COMPLETED },
          },
        },
      };

      expect(selectOrderActions(draftState, 'o-draft').canEdit).toBe(true);
      expect(selectOrderActions(draftState, 'o-awaiting').canPay).toBe(true);
      expect(selectOrderActions(draftState, 'o-confirmed').canCancel).toBe(true);
      expect(selectOrderActions(draftState, 'o-completed').canCancel).toBe(false);
    });

    it('computes selectRefundProgress for orders with refunds', async () => {
      await store.dispatch(thunks.cancelOrder({ orderId: 'ord-1', reason: 'Hoàn tiền test' }));
      const state = store.getState();
      const progress = selectRefundProgress(state, 'ord-1');
      expect(progress.hasRefund).toBe(true);
      expect(progress.refund.amountVnd).toBe(150000);
      expect(progress.status).toBe(REFUND_STATUS.REQUESTED);
    });

    it('computes selectPaymentState for orders with payment', async () => {
      await store.dispatch(
        thunks.simulatePaymentResult({ paymentAttemptId: 'pay-1', result: 'SUCCESS' }),
      );
      const state = store.getState();
      const paymentState = selectPaymentState(state, 'ord-1');
      expect(paymentState.isPaid).toBe(true);
      expect(paymentState.isFailed).toBe(false);
    });
  });

  describe('Notifications state and selectors', () => {
    it('fetches notifications and filters by role correctly', async () => {
      await store.dispatch(thunks.fetchNotifications());
      let state = store.getState();
      expect(selectBulkyNotifications(state)).toHaveLength(2);

      // Default role is CITIZEN
      expect(selectRoleNotifications(state)).toHaveLength(1);
      expect(selectRoleNotifications(state)[0].id).toBe('notif-2');
      expect(selectUnreadNotificationsCount(state)).toBe(0);

      // Switch to DISPATCHER
      store.dispatch(
        switchBulkyUser({
          id: 'disp-1',
          name: 'Điều Phối Viên',
          role: 'DISPATCHER',
        }),
      );
      state = store.getState();
      expect(selectRoleNotifications(state)).toHaveLength(1);
      expect(selectRoleNotifications(state)[0].id).toBe('notif-1');
      expect(selectUnreadNotificationsCount(state)).toBe(1);

      // Switch to ADMIN sees all
      store.dispatch(
        switchBulkyUser({
          id: 'admin-1',
          name: 'Quản Trị Viên',
          role: 'ADMIN',
        }),
      );
      state = store.getState();
      expect(selectRoleNotifications(state)).toHaveLength(2);
    });

    it('marks notification as read and marks all as read', async () => {
      await store.dispatch(thunks.fetchNotifications());
      store.dispatch(
        switchBulkyUser({
          id: 'disp-1',
          name: 'Điều Phối Viên',
          role: 'DISPATCHER',
        }),
      );

      let state = store.getState();
      expect(selectUnreadNotificationsCount(state)).toBe(1);

      await store.dispatch(thunks.markNotificationRead('notif-1'));
      state = store.getState();
      expect(selectUnreadNotificationsCount(state)).toBe(0);

      // Reset and mark all as read
      await store.dispatch(thunks.fetchNotifications());
      await store.dispatch(thunks.markAllNotificationsRead('DISPATCHER'));
      state = store.getState();
      expect(selectUnreadNotificationsCount(state)).toBe(0);
    });
  });

  describe('Error handling & serializability', () => {
    it('captures serialized error when service throws', async () => {
      mockServices.orders.get = async () => {
        const err = new Error('Not found');
        err.code = 'FORBIDDEN';
        throw err;
      };

      await expect(store.dispatch(thunks.fetchOrderById('non-existent'))).rejects.toThrow(
        'Not found',
      );
      const state = store.getState();
      expect(state.bulky.requestsByKey['orders/fetchOrderById/non-existent'].status).toBe('error');
      expect(state.bulky.requestsByKey['orders/fetchOrderById/non-existent'].error.message).toBe(
        'Not found',
      );
    });
  });
});
