import { createSelector } from '@reduxjs/toolkit';
import { BULKY_CAPABILITIES } from '../services/bulkyServiceContract.js';
import { ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS } from '../domain/constants.js';

export const selectBulkyState = (state) => state.bulky || {};

export const selectCanReadBulky = (state) =>
  Boolean(selectBulkyState(state).capabilities?.includes(BULKY_CAPABILITIES.VIEW_BULKY_ORDERS));

export const selectCanManageBulky = (state) =>
  Boolean(selectBulkyState(state).capabilities?.includes(BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS));

export const selectCanDispatchBulky = (state) =>
  Boolean(selectBulkyState(state).capabilities?.includes(BULKY_CAPABILITIES.DISPATCH_BULKY_ORDERS));

export const selectActiveBulkyUser = (state) => selectBulkyState(state).activeUser || null;

export const selectIsDispatcher = (state) => {
  const user = selectActiveBulkyUser(state);
  return user?.role === 'DISPATCHER' || user?.role === 'ADMIN' || selectCanDispatchBulky(state);
};

const EMPTY_NOTIFICATIONS = [];

export const selectBulkyNotifications = (state) =>
  selectBulkyState(state).notifications || EMPTY_NOTIFICATIONS;

export const selectRoleNotifications = createSelector(
  [selectBulkyNotifications, selectActiveBulkyUser],
  (all, activeUser) => {
    const role = activeUser?.role || 'CITIZEN';
    if (role === 'ADMIN') return all;
    return all.filter((n) => n.targetRole === role || n.targetRole === 'ALL');
  },
);

export const selectUnreadNotificationsCount = createSelector(
  [selectRoleNotifications],
  (roleNotifs) => roleNotifs.filter((n) => !n.read).length,
);

export const selectBulkyCatalog = (state) => selectBulkyState(state).catalog || [];

export const selectBulkyDraft = (state) => selectBulkyState(state).draft || null;

export const selectBulkyOrderIds = (state) => selectBulkyState(state).orderIds || [];
export const selectBulkyOrdersById = (state) => selectBulkyState(state).ordersById || {};

export const selectBulkyOrders = createSelector(
  [selectBulkyOrderIds, selectBulkyOrdersById],
  (orderIds, ordersById) => orderIds.map((id) => ordersById[id]).filter(Boolean),
);

export const selectBulkyOrderById = (state, orderId) =>
  selectBulkyState(state).ordersById?.[orderId] || null;

export const selectOrderActions = (state, orderId) => {
  const canManage = selectCanManageBulky(state);
  const order = selectBulkyOrderById(state, orderId);
  if (!order) {
    return {
      canEdit: false,
      canPay: false,
      canReschedule: false,
      canCancel: false,
      needsReview: false,
    };
  }

  const status = order.orderStatus;
  const isCancellable =
    canManage &&
    [
      ORDER_STATUS.DRAFT,
      ORDER_STATUS.NEEDS_INFO,
      ORDER_STATUS.MANUAL_REVIEW,
      ORDER_STATUS.AWAITING_PAYMENT,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.ASSIGNED,
    ].includes(status);

  return {
    canEdit: canManage && status === ORDER_STATUS.DRAFT,
    canPay: canManage && status === ORDER_STATUS.AWAITING_PAYMENT,
    canReschedule: canManage && [ORDER_STATUS.CONFIRMED, ORDER_STATUS.ASSIGNED].includes(status),
    canCancel: isCancellable,
    needsReview: status === ORDER_STATUS.MANUAL_REVIEW,
  };
};

export const selectPaymentState = (state, orderId) => {
  const order = selectBulkyOrderById(state, orderId);
  if (!order) return { payment: null, isPaid: false, isPending: false, isFailed: false };

  const bulky = selectBulkyState(state);
  let payment = null;
  if (order.acceptedPayment?.paymentAttemptId) {
    payment = bulky.paymentsById[order.acceptedPayment.paymentAttemptId] || order.acceptedPayment;
  }

  return {
    payment,
    isPaid: order.paymentStatus === PAYMENT_STATUS.SUCCESS,
    isPending: order.paymentStatus === PAYMENT_STATUS.PENDING,
    isFailed: order.paymentStatus === PAYMENT_STATUS.FAILED,
  };
};

export const selectRefundProgress = (state, orderId) => {
  const order = selectBulkyOrderById(state, orderId);
  const bulky = selectBulkyState(state);

  let refund = null;
  if (orderId) {
    refund = Object.values(bulky.refundsById || {}).find((r) => r.orderId === orderId);
  }

  const hasRefund = Boolean(
    refund || (order && order.refundStatus && order.refundStatus !== REFUND_STATUS.NONE),
  );

  return {
    hasRefund,
    refund: refund || null,
    status: refund?.status || order?.refundStatus || REFUND_STATUS.NONE,
    amountVnd: refund?.amountVnd || order?.acceptedQuote?.totalVnd || 0,
  };
};
