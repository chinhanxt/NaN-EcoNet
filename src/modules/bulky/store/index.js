import {
  setCatalogItems,
  setOrdersList,
  upsertOrder,
  upsertQuote,
  upsertHold,
  upsertPayment,
  upsertRefund,
  upsertChangeRequest,
  setBulkyDraft,
  setRequestLoading,
  setRequestSuccess,
  setRequestError,
  setNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './bulkySlice.js';

export * from './bulkySlice.js';
export * from './selectors.js';

const executeThunk = async (dispatch, requestKey, fn) => {
  const contextId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  dispatch(setRequestLoading({ key: requestKey, contextId }));
  try {
    const result = await fn();
    dispatch(setRequestSuccess({ key: requestKey, contextId }));
    return result;
  } catch (err) {
    dispatch(
      setRequestError({
        key: requestKey,
        error: { message: err.message, code: err.code || 'UNKNOWN' },
        contextId,
      }),
    );
    throw err;
  }
};

export function createBulkyThunks(services) {
  return {
    resolveSafetyReview: (orderId, input, key) => async (dispatch) => {
      return executeThunk(dispatch, `reviews/resolveSafetyReview/${orderId}`, async () => {
        const order = await services.reviews.resolveSafetyReview(orderId, input, key);
        dispatch(upsertOrder(order));
        return order;
      });
    },

    setManualPrice: (orderId, input) => async (dispatch) => {
      return executeThunk(dispatch, `reviews/setPrice/${orderId}`, async () => {
        const order = await services.reviews.setPrice(orderId, input);
        dispatch(upsertOrder(order));
        return order;
      });
    },
    fetchCatalog: () => async (dispatch) => {
      return executeThunk(dispatch, 'catalog/fetchCatalog', async () => {
        const items = await services.catalog.listAcceptedItems();
        dispatch(setCatalogItems(items));
        return items;
      });
    },

    fetchOrders: (cursor) => async (dispatch) => {
      return executeThunk(dispatch, 'orders/fetchOrders', async () => {
        const res = await services.orders.list(cursor);
        dispatch(setOrdersList(res));
        return res;
      });
    },

    fetchOrderById: (orderId) => async (dispatch) => {
      return executeThunk(dispatch, `orders/fetchOrderById/${orderId}`, async () => {
        const order = await services.orders.get(orderId);
        dispatch(upsertOrder(order));
        return order;
      });
    },

    createDraftOrder: (input, key) => async (dispatch) => {
      return executeThunk(dispatch, 'orders/createDraftOrder', async () => {
        const order = await services.orders.createDraft(input, key);
        dispatch(upsertOrder(order));
        dispatch(setBulkyDraft(order));
        return order;
      });
    },

    updateDraftOrder: (orderId, input, key) => async (dispatch) => {
      return executeThunk(dispatch, `orders/updateDraftOrder/${orderId}`, async () => {
        const order = await services.orders.updateDraft(orderId, input, key);
        dispatch(upsertOrder(order));
        dispatch(setBulkyDraft(order));
        return order;
      });
    },

    confirmOrderItems: (orderId, input, key) => async (dispatch) => {
      return executeThunk(dispatch, `orders/confirmOrderItems/${orderId}`, async () => {
        const order = await services.orders.confirmItems(orderId, input, key);
        dispatch(upsertOrder(order));
        return order;
      });
    },

    reserveQuoteAndHold:
      ({ orderId, requestedDate, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `quotes/reserveQuoteAndHold/${orderId}`, async () => {
          const res = await services.quotes.reserveAndCreate(orderId, requestedDate, key);
          if (res.order) dispatch(upsertOrder(res.order));
          if (res.quote) dispatch(upsertQuote(res.quote));
          if (res.hold) dispatch(upsertHold(res.hold));
          return res;
        });
      },

    startOrderPayment:
      ({ orderId, quoteId, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `payments/startOrderPayment/${orderId}`, async () => {
          const attempt = await services.payments.start(orderId, quoteId, key);
          dispatch(upsertPayment(attempt));
          return attempt;
        });
      },

    simulatePaymentResult:
      ({ paymentAttemptId, result, key }) =>
      async (dispatch) => {
        return executeThunk(
          dispatch,
          `payments/simulatePaymentResult/${paymentAttemptId}`,
          async () => {
            const res = await services.payments.simulateResult(paymentAttemptId, result, key);
            if (res.payment) dispatch(upsertPayment(res.payment));
            if (res.order) dispatch(upsertOrder(res.order));
            if (res.hold) dispatch(upsertHold(res.hold));
            return res;
          },
        );
      },

    rescheduleOrder:
      ({ orderId, requestedDate, reason, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `changes/rescheduleOrder/${orderId}`, async () => {
          const res = await services.changes.requestReschedule(orderId, requestedDate, reason, key);
          if (res.order) dispatch(upsertOrder(res.order));
          if (res.changeRequest) dispatch(upsertChangeRequest(res.changeRequest));
          return res;
        });
      },

    cancelOrder:
      ({ orderId, reason, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `changes/cancelOrder/${orderId}`, async () => {
          const res = await services.changes.requestCancellation(orderId, reason, key);
          if (res.order) dispatch(upsertOrder(res.order));
          if (res.refund) dispatch(upsertRefund(res.refund));
          if (res.changeRequest) dispatch(upsertChangeRequest(res.changeRequest));
          return res;
        });
      },

    acceptChangeOffer:
      ({ changeRequestId, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `changes/acceptChangeOffer/${changeRequestId}`, async () => {
          const res = await services.changes.acceptOffer(changeRequestId, key);
          if (res.order) dispatch(upsertOrder(res.order));
          if (res.changeRequest) dispatch(upsertChangeRequest(res.changeRequest));
          if (res.refund) dispatch(upsertRefund(res.refund));
          return res;
        });
      },

    rejectChangeOffer:
      ({ changeRequestId, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `changes/rejectChangeOffer/${changeRequestId}`, async () => {
          const res = await services.changes.rejectOffer(changeRequestId, key);
          if (res.order) dispatch(upsertOrder(res.order));
          if (res.changeRequest) dispatch(upsertChangeRequest(res.changeRequest));
          return res;
        });
      },

    resolveProviderFailure:
      ({ orderId, choice, offeredDate, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `changes/resolveProviderFailure/${orderId}`, async () => {
          const res = await services.changes.resolveProviderFailure(
            orderId,
            choice,
            offeredDate,
            key,
          );
          if (res.order) dispatch(upsertOrder(res.order));
          if (res.refund) dispatch(upsertRefund(res.refund));
          if (res.hold) dispatch(upsertHold(res.hold));
          return res;
        });
      },

    acceptLatePaymentSlot:
      ({ orderId, offeredHoldId, key }) =>
      async (dispatch) => {
        return executeThunk(dispatch, `latePayments/acceptLatePaymentSlot/${orderId}`, async () => {
          const res = await services.latePayments.acceptRevalidatedSlot(
            orderId,
            offeredHoldId,
            key,
          );
          if (res.order) dispatch(upsertOrder(res.order));
          if (res.hold) dispatch(upsertHold(res.hold));
          return res;
        });
      },

    acceptLatePaymentAlternative:
      ({ orderId, selectedDate, key }) =>
      async (dispatch) => {
        return executeThunk(
          dispatch,
          `latePayments/acceptLatePaymentAlternative/${orderId}`,
          async () => {
            const res = await services.latePayments.acceptAlternativeDate(
              orderId,
              selectedDate,
              key,
            );
            if (res.order) dispatch(upsertOrder(res.order));
            if (res.hold) dispatch(upsertHold(res.hold));
            return res;
          },
        );
      },

    chooseLatePaymentRefund:
      ({ orderId, key }) =>
      async (dispatch) => {
        return executeThunk(
          dispatch,
          `latePayments/chooseLatePaymentRefund/${orderId}`,
          async () => {
            const res = await services.latePayments.chooseRefund(orderId, key);
            if (res.order) dispatch(upsertOrder(res.order));
            if (res.refund) dispatch(upsertRefund(res.refund));
            return res;
          },
        );
      },

    fetchNotifications: (role) => async (dispatch) => {
      return executeThunk(dispatch, 'notifications/fetchNotifications', async () => {
        if (!services.notifications) return [];
        const notifs = await services.notifications.list(role);
        dispatch(setNotifications(notifs));
        return notifs;
      });
    },

    markNotificationRead: (notificationId) => async (dispatch) => {
      return executeThunk(dispatch, `notifications/markRead/${notificationId}`, async () => {
        if (services.notifications) {
          await services.notifications.markAsRead(notificationId);
        }
        dispatch(markNotificationRead(notificationId));
        return { success: true };
      });
    },

    markAllNotificationsRead: (role) => async (dispatch) => {
      return executeThunk(dispatch, 'notifications/markAllRead', async () => {
        if (services.notifications) {
          await services.notifications.markAllAsRead(role);
        }
        dispatch(markAllNotificationsRead());
        return { success: true };
      });
    },
  };
}
