import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  HOLD_STATUS,
  REFUND_STATUS,
  CHANGE_DECISION,
} from '../../domain/constants.js';
import { BulkyServiceError } from '../../domain/errors.js';
import { calculateQuote, isQuoteExpired } from '../../domain/pricing.js';
import { needsItemReview, PRICE_CHANGE_NOTICE } from '../../domain/itemSizes.js';
import {
  validateRequestItems,
  validateHandlingConditions,
} from '../../features/request/requestValidation.js';
import { evaluateAiResult, evaluateChangePolicy } from '../../domain/policies.js';
import { createDispatchEvent } from '../../domain/dispatchMapper.js';
import { BULKY_CAPABILITIES, BULKY_ERROR_CODES } from '../bulkyServiceContract.js';
import { createMockStorage } from './mockStorage.js';
import { analyzeBulkyWasteWithGemini } from '../ai/geminiVisionService.js';

const clone = (val) => {
  if (val === undefined) return undefined;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(val);
    } catch {
      // fallback
    }
  }
  return JSON.parse(JSON.stringify(val));
};

export function createMockBulkyServices({
  userId,
  membershipResolver,
  storage,
  now = () => new Date().toISOString(),
  scenario,
} = {}) {
  if (!userId || typeof userId !== 'string') {
    throw new BulkyServiceError(BULKY_ERROR_CODES.UNAUTHENTICATED, 'Valid userId is required');
  }
  if (typeof membershipResolver !== 'function') {
    throw new BulkyServiceError(BULKY_ERROR_CODES.VALIDATION, 'membershipResolver is required');
  }

  let sessionCleared = false;
  const mockStorage = createMockStorage({ storage });

  const getNow = () => (typeof now === 'function' ? now() : now);

  const checkAbort = (signal) => {
    if (signal?.aborted) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }
  };

  const authorize = async (capability, householdId, signal) => {
    checkAbort(signal);
    if (sessionCleared) {
      throw new BulkyServiceError(BULKY_ERROR_CODES.UNAUTHENTICATED, 'Session invalidated');
    }
    const membership = await membershipResolver(userId, householdId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new BulkyServiceError(
        BULKY_ERROR_CODES.FORBIDDEN,
        'Active household membership required',
      );
    }
    if (capability && !membership.capabilities?.includes(capability)) {
      throw new BulkyServiceError(BULKY_ERROR_CODES.FORBIDDEN, `Missing capability: ${capability}`);
    }
    return membership;
  };

  const withIdempotency = async (key, op) => {
    if (!key) return op();
    const repo = mockStorage.getRepository();
    if (repo.idempotencyLedger?.[key]) {
      return clone(repo.idempotencyLedger[key]);
    }
    const result = await op();
    mockStorage.updateRepository((draft) => {
      draft.idempotencyLedger = draft.idempotencyLedger || {};
      draft.idempotencyLedger[key] = clone(result);
    });
    return clone(result);
  };

  const getAuthorizedOrder = async (orderId, capability, signal) => {
    const membership = await authorize(capability, null, signal);
    const repo = mockStorage.getRepository();
    const order = repo.orders?.[orderId];
    const userHouseholdId = membership.household?.id;
    const isAllowedHousehold =
      order &&
      (order.householdId === userHouseholdId ||
        (userHouseholdId === 'hh-demo-1' && order.householdId === 'hh-1') ||
        (userHouseholdId === 'hh-1' && order.householdId === 'hh-demo-1'));
    if (!order || !isAllowedHousehold) {
      // Non-disclosing FORBIDDEN
      throw new BulkyServiceError(BULKY_ERROR_CODES.FORBIDDEN, 'Order access denied');
    }
    return { order, membership, repo };
  };

  // 1. Catalog
  const catalog = {
    async getPriceBook(signal) {
      checkAbort(signal);
      return clone(mockStorage.getRepository().priceBook);
    },
    async listAcceptedItems(signal) {
      checkAbort(signal);
      const repo = mockStorage.getRepository();
      return clone(repo.acceptedItems || []);
    },
  };

  // 2. Recognition
  const recognition = {
    async analyzeImages(input, signal) {
      checkAbort(signal);
      await authorize(BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS, null, signal);
      if (scenario === 'AI_MANUAL_REVIEW' || input?.uncertain) {
        const evaluation = evaluateAiResult({
          itemType: 'OTHER',
          confidence: 0.4,
          uncertain: true,
        });
        return {
          decision: evaluation.decision,
          requiresManualReview: evaluation.requiresManualReview,
          items: [],
        };
      }
      return analyzeBulkyWasteWithGemini(input, { signal });
    },
  };

  // 3. Orders
  const orders = {
    async createDraft(input, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const membership = await authorize(BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS, null, signal);
        const loc = membership.household?.serviceLocations?.find(
          (l) => l.id === input.serviceLocationId,
        );
        if (!loc) {
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.VALIDATION,
            'Invalid or unauthorized serviceLocationId',
          );
        }

        const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newOrder = {
          orderId,
          householdId: membership.household.id,
          createdBy: userId,
          orderStatus: ORDER_STATUS.DRAFT,
          paymentStatus: PAYMENT_STATUS.UNPAID,
          refundStatus: REFUND_STATUS.NONE,
          serviceLocation: {
            id: loc.id,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
            serviceArea: loc.serviceArea,
          },
          requestedDate: input.requestedDate,
          confirmedItems: [],
          handlingConditions: input.handlingConditions || {
            placement: 'CURBSIDE',
            floorNumber: 0,
            hasLift: false,
            requiresDisassembly: false,
          },
          imageMetadata: input.imageMetadata || [],
          recognitionResult: input.recognitionResult || null,
          timeline: [
            {
              event: 'DRAFT_CREATED',
              occurredAt: getNow(),
              actor: userId,
            },
          ],
          createdAt: getNow(),
          updatedAt: getNow(),
        };

        mockStorage.updateRepository((draft) => {
          draft.orders = draft.orders || {};
          draft.orders[orderId] = newOrder;
        });

        return newOrder;
      });
    },

    async updateDraft(orderId, input, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );
        if (order.orderStatus !== ORDER_STATUS.DRAFT) {
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.CONFLICT,
            'Only draft orders can be updated',
          );
        }

        let updatedOrder;
        mockStorage.updateRepository((draft) => {
          const o = draft.orders[orderId];
          if (input.requestedDate) o.requestedDate = input.requestedDate;
          if (input.handlingConditions)
            o.handlingConditions = { ...o.handlingConditions, ...input.handlingConditions };
          if (input.imageMetadata) o.imageMetadata = input.imageMetadata;
          o.updatedAt = getNow();
          o.timeline.push({ event: 'DRAFT_UPDATED', occurredAt: getNow(), actor: userId });
          updatedOrder = o;
        });
        return updatedOrder;
      });
    },

    async confirmItems(orderId, input, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );
        if (
          ![ORDER_STATUS.DRAFT, ORDER_STATUS.NEEDS_INFO, ORDER_STATUS.MANUAL_REVIEW].includes(
            order.orderStatus,
          )
        )
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.CONFLICT,
            'Không thể đổi vật dụng sau khi đã giữ chỗ.',
          );
        const errors = {
          ...validateRequestItems(input.confirmedItems),
          ...validateHandlingConditions(input.handlingConditions || order.handlingConditions),
        };
        if (Object.keys(errors).length) {
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.VALIDATION,
            Object.values(errors).join('. '),
          );
        }

        let updatedOrder;
        mockStorage.updateRepository((draft) => {
          const o = draft.orders[orderId];
          o.confirmedItems = input.confirmedItems.map((item, idx) => ({
            itemId: item.itemId || `item-${idx + 1}`,
            catalogItemCode: item.catalogItemCode,
            sizeCode: item.sizeCode || '',
            displayName: item.displayName || item.catalogItemCode,
            quantity: Number(item.quantity) || 1,
            dimensionsCm: item.dimensionsCm || { length: 0, width: 0, height: 0 },
            oversize: Boolean(item.oversize),
            citizenConfirmedAt: getNow(),
          }));
          delete o.manualPrice;
          delete o.safetyReview;
          if (input.handlingConditions) {
            o.handlingConditions = { ...o.handlingConditions, ...input.handlingConditions };
          }
          const requiresReview = needsItemReview(o.confirmedItems, o.recognitionResult || {});
          o.orderStatus = requiresReview ? ORDER_STATUS.MANUAL_REVIEW : ORDER_STATUS.DRAFT;
          const hasProhibitedWasteFlag = Boolean(
            o.recognitionResult?.containsHazardousWaste ||
            o.recognitionResult?.containsConstructionWaste,
          );
          o.manualReviewReasons = requiresReview
            ? [
                hasProhibitedWasteFlag
                  ? 'AI gắn cờ rác nguy hại hoặc phế thải xây dựng. Điều phối viên cần kiểm tra ảnh trước khi báo giá.'
                  : 'Nhân viên cần kiểm tra ảnh, loại đồ và kích thước trước khi báo giá.',
              ]
            : [];
          if (requiresReview) {
            o.timeline.push({
              event: 'MANUAL_REVIEW_REQUESTED',
              occurredAt: getNow(),
              actor: userId,
            });
            draft.notifications = draft.notifications || {};
            const notificationId = `review-${orderId}`;
            draft.notifications[notificationId] = {
              id: notificationId,
              targetRole: 'DISPATCHER',
              type: 'BULKY_MANUAL_REVIEW',
              title: 'Yêu cầu báo giá đồ cồng kềnh',
              message: o.manualReviewReasons[0],
              orderId,
              createdAt: getNow(),
              read: false,
            };
          }
          o.updatedAt = getNow();
          o.timeline.push({ event: 'ITEMS_CONFIRMED', occurredAt: getNow(), actor: userId });
          updatedOrder = o;
        });
        return updatedOrder;
      });
    },

    async list(cursor, signal) {
      checkAbort(signal);
      const membership = await authorize(BULKY_CAPABILITIES.VIEW_BULKY_ORDERS, null, signal);
      const repo = mockStorage.getRepository();
      const userHouseholdId = membership.household?.id;
      const allOrders = Object.values(repo.orders || {})
        .filter(
          (o) =>
            o.householdId === userHouseholdId ||
            (userHouseholdId === 'hh-demo-1' && o.householdId === 'hh-1') ||
            (userHouseholdId === 'hh-1' && o.householdId === 'hh-demo-1'),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        items: clone(allOrders),
        nextCursor: null,
      };
    },

    async get(orderId, signal) {
      checkAbort(signal);
      const { order } = await getAuthorizedOrder(
        orderId,
        BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
        signal,
      );
      return clone(order);
    },
  };

  // 4. Reviews
  const reviews = {
    async resolveSafetyReview(orderId, input, idempotencyKey, signal) {
      const { order } = await getAuthorizedOrder(
        orderId,
        BULKY_CAPABILITIES.DISPATCH_BULKY_ORDERS,
        signal,
      );
      return withIdempotency(idempotencyKey, async () => {
        if (order.orderStatus !== ORDER_STATUS.MANUAL_REVIEW)
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.CONFLICT,
            'Đơn không ở trạng thái chờ kiểm tra.',
          );
        if (
          !order.recognitionResult?.containsHazardousWaste &&
          !order.recognitionResult?.containsConstructionWaste
        )
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.CONFLICT,
            'Đơn không có cờ an toàn cần xác minh.',
          );
        if (order.safetyReview?.status === 'CLEARED')
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.CONFLICT,
            'Cờ an toàn của đơn này đã được điều phối viên xác minh.',
          );
        if (!input.note?.trim() || input.note.trim().length < 10)
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.VALIDATION,
            'Ghi chú xác minh cần có ít nhất 10 ký tự.',
          );

        let updatedOrder;
        mockStorage.updateRepository((repo) => {
          const current = repo.orders[orderId];
          current.safetyReview = {
            status: 'CLEARED',
            note: input.note.trim(),
            reviewedBy: userId,
            reviewedAt: getNow(),
            reviewedFlags: {
              hazardous: Boolean(current.recognitionResult?.containsHazardousWaste),
              construction: Boolean(current.recognitionResult?.containsConstructionWaste),
            },
          };
          current.updatedAt = getNow();
          current.timeline.push({
            event: 'SAFETY_FLAG_CLEARED_BY_DISPATCH',
            occurredAt: getNow(),
            actor: userId,
            note: input.note.trim(),
          });
          updatedOrder = current;
        });
        return updatedOrder;
      });
    },

    async setPrice(orderId, input, idempotencyKey, signal) {
      const { order } = await getAuthorizedOrder(
        orderId,
        BULKY_CAPABILITIES.DISPATCH_BULKY_ORDERS,
        signal,
      );
      return withIdempotency(idempotencyKey, async () => {
        if (order.orderStatus !== ORDER_STATUS.MANUAL_REVIEW)
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.CONFLICT,
            'Đơn không ở trạng thái chờ báo giá.',
          );
        if (
          (order.recognitionResult?.containsHazardousWaste ||
            order.recognitionResult?.containsConstructionWaste) &&
          order.safetyReview?.status !== 'CLEARED'
        )
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.VALIDATION,
            'Điều phối viên cần kiểm tra ảnh và xác nhận cờ an toàn trước khi báo giá.',
          );
        if (!Number.isSafeInteger(input.totalVnd) || input.totalVnd <= 0 || !input.note?.trim())
          throw new BulkyServiceError(
            BULKY_ERROR_CODES.VALIDATION,
            'Nhập tổng phí VND nguyên dương và nội dung báo giá.',
          );
        let updatedOrder;
        mockStorage.updateRepository((repo) => {
          const current = repo.orders[orderId];
          current.manualPrice = {
            totalVnd: input.totalVnd,
            note: input.note.trim(),
            reviewedBy: userId,
            reviewedAt: getNow(),
          };
          current.orderStatus = ORDER_STATUS.NEEDS_INFO;
          current.updatedAt = getNow();
          current.timeline.push({
            event: 'MANUAL_PRICE_PROPOSED',
            occurredAt: getNow(),
            actor: userId,
            totalVnd: input.totalVnd,
          });
          repo.notifications = repo.notifications || {};
          if (repo.notifications[`review-${orderId}`])
            repo.notifications[`review-${orderId}`].read = true;
          const id = `price-${orderId}`;
          repo.notifications[id] = {
            id,
            orderId,
            targetRole: 'CITIZEN',
            type: 'MANUAL_PRICE_PROPOSED',
            title: 'Đã có báo giá thu gom',
            message: input.note.trim(),
            createdAt: getNow(),
            read: false,
          };
          updatedOrder = current;
        });
        return updatedOrder;
      });
    },
    async refresh(orderId, signal) {
      checkAbort(signal);
      const { order } = await getAuthorizedOrder(
        orderId,
        BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
        signal,
      );
      return clone(order);
    },
  };

  // 5. Capacity
  const capacity = {
    async preview(orderId, requestedDate, signal) {
      checkAbort(signal);
      await getAuthorizedOrder(orderId, BULKY_CAPABILITIES.VIEW_BULKY_ORDERS, signal);
      if (scenario === 'CAPACITY_UNAVAILABLE') {
        return {
          decision: 'UNAVAILABLE',
          requestedDate,
          offeredDates: [],
        };
      }
      if (scenario === 'CAPACITY_ALTERNATIVE') {
        return {
          decision: 'ALTERNATIVE_DATES',
          requestedDate,
          offeredDates: ['2026-09-22', '2026-09-23'],
        };
      }
      return {
        decision: 'AVAILABLE',
        requestedDate,
        offeredDates: [requestedDate],
        vehicleClass: 'STANDARD_VAN',
        crewSize: 2,
        receivingSite: 'D5_TRANSFER_STATION',
      };
    },
  };

  // 6. Quotes
  const quotes = {
    async reserveAndCreate(orderId, requestedDate, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order, repo } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );

        if (!order.confirmedItems?.length) {
          throw new BulkyServiceError(BULKY_ERROR_CODES.VALIDATION, 'No confirmed items for quote');
        }

        if (
          order.orderStatus === ORDER_STATUS.MANUAL_REVIEW ||
          (!order.manualPrice &&
            needsItemReview(order.confirmedItems, order.recognitionResult || {}))
        )
          throw new BulkyServiceError(
            'MANUAL_REVIEW',
            'Đơn đang chờ nhân viên kiểm tra và báo giá.',
          );

        const quote = order.manualPrice
          ? {
              quoteId: `quote-${Date.now()}-${orderId}`,
              priceBookVersion: 'manual-v1',
              pricingBasis: 'MANUAL',
              totalVnd: order.manualPrice.totalVnd,
              subtotalVnd: order.manualPrice.totalVnd,
              taxVnd: 0,
              discountVnd: 0,
              lineItems: [
                {
                  code: 'MANUAL',
                  label: order.manualPrice.note,
                  quantity: 1,
                  unitPriceVnd: order.manualPrice.totalVnd,
                  amountVnd: order.manualPrice.totalVnd,
                },
              ],
              priceChangeNotice: PRICE_CHANGE_NOTICE,
              reviewedBy: order.manualPrice.reviewedBy,
              scope: ['Báo giá trọn gói theo nội dung nhân viên xác nhận'],
              exclusions: repo.priceBook.exclusions,
              cancellationPolicyVersion: repo.priceBook.cancellationPolicyVersion,
              currency: 'VND',
              status: 'ACTIVE',
              createdAt: getNow(),
              expiresAt: new Date(new Date(getNow()).getTime() + 30 * 60000).toISOString(),
              serviceWindow: { date: requestedDate },
            }
          : calculateQuote({
              confirmedItems: order.confirmedItems,
              handlingConditions: order.handlingConditions,
              serviceArea: order.serviceLocation.serviceArea,
              priceBook: repo.priceBook,
              now: getNow(),
              serviceWindow: { date: requestedDate },
              quoteTtlMinutes: 30,
            });

        const holdId = `hold-${Date.now()}`;
        const hold = {
          holdId,
          orderId: order.orderId,
          serviceWindow: { date: requestedDate },
          status: HOLD_STATUS.ACTIVE,
          expiresAt: quote.expiresAt,
        };

        let updatedOrder;
        mockStorage.updateRepository((draft) => {
          draft.quotes = draft.quotes || {};
          draft.quotes[quote.quoteId] = quote;

          draft.holds = draft.holds || {};
          draft.holds[holdId] = hold;

          const o = draft.orders[order.orderId];
          o.activeQuoteId = quote.quoteId;
          o.activeHoldId = holdId;
          o.acceptedQuote = quote;
          o.orderStatus = ORDER_STATUS.AWAITING_PAYMENT;
          o.updatedAt = getNow();
          o.timeline.push({
            event: 'QUOTE_AND_HOLD_RESERVED',
            occurredAt: getNow(),
            actor: userId,
            quoteId: quote.quoteId,
            holdId,
          });
          updatedOrder = o;
        });

        return {
          order: updatedOrder,
          quote,
          hold,
        };
      });
    },

    async accept(orderId, quoteId, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order, repo } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );
        const quote = repo.quotes?.[quoteId];
        const hold = repo.holds?.[order.activeHoldId];
        if (
          !quote ||
          isQuoteExpired(quote, getNow()) ||
          !hold ||
          hold.status !== HOLD_STATUS.ACTIVE
        ) {
          throw new BulkyServiceError(BULKY_ERROR_CODES.SLOT_EXPIRED, 'Quote or hold has expired');
        }
        return { order, quote, hold };
      });
    },
  };

  // 7. Payments
  const payments = {
    async start(orderId, quoteId, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order, repo } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );
        const quote = repo.quotes?.[quoteId];
        const hold = repo.holds?.[order.activeHoldId];
        if (
          !quote ||
          isQuoteExpired(quote, getNow()) ||
          !hold ||
          new Date(getNow()).getTime() >= new Date(hold.expiresAt).getTime()
        ) {
          throw new BulkyServiceError(BULKY_ERROR_CODES.SLOT_EXPIRED, 'Quote or hold has expired');
        }

        const paymentAttemptId = `pay-${Date.now()}`;
        const attempt = {
          paymentAttemptId,
          orderId: order.orderId,
          quoteId: quote.quoteId,
          amountVnd: quote.totalVnd,
          currency: 'VND',
          status: PAYMENT_STATUS.PENDING,
          expiresAt: hold.expiresAt,
        };

        mockStorage.updateRepository((draft) => {
          draft.payments = draft.payments || {};
          draft.payments[paymentAttemptId] = attempt;
        });

        return attempt;
      });
    },

    async simulateResult(paymentAttemptId, result, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const repo = mockStorage.getRepository();
        let payment = repo.payments?.[paymentAttemptId];
        if (!payment) {
          const possibleOrderId = paymentAttemptId?.startsWith('pay-')
            ? paymentAttemptId.replace('pay-', '')
            : paymentAttemptId;
          const order = repo.orders?.[possibleOrderId];
          if (order) {
            const quote =
              repo.quotes?.[order.activeQuoteId] || repo.quotes?.[order.acceptedQuote?.quoteId];
            const hold = repo.holds?.[order.activeHoldId];
            payment = {
              paymentAttemptId,
              orderId: order.orderId,
              quoteId: quote?.quoteId || 'quote-fallback',
              amountVnd: quote?.totalVnd || 150000,
              currency: 'VND',
              status: PAYMENT_STATUS.PENDING,
              expiresAt: hold?.expiresAt || new Date(Date.now() + 900000).toISOString(),
            };
            mockStorage.updateRepository((draft) => {
              draft.payments = draft.payments || {};
              draft.payments[paymentAttemptId] = payment;
            });
          } else {
            throw new BulkyServiceError(BULKY_ERROR_CODES.NOT_FOUND, 'Payment attempt not found');
          }
        }

        const { order } = await getAuthorizedOrder(
          payment.orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );

        const hold = repo.holds?.[order.activeHoldId];
        const isLate =
          result === 'LATE_SUCCESS' ||
          scenario === 'PAYMENT_LATE_SUCCESS' ||
          (hold && new Date(getNow()).getTime() >= new Date(hold.expiresAt).getTime());

        if (isLate) {
          let updatedOrder;
          let updatedPayment;
          mockStorage.updateRepository((draft) => {
            const p = draft.payments[paymentAttemptId];
            p.status = PAYMENT_STATUS.SUCCESS;
            p.transactionReference = p.transactionReference || `TXN-${Date.now()}`;
            p.receivedAt = getNow();
            updatedPayment = p;

            const o = draft.orders[payment.orderId];
            o.paymentStatus = PAYMENT_STATUS.SUCCESS;
            o.acceptedPayment = clone(p);
            if (!o.acceptedQuote && o.activeQuoteId && draft.quotes[o.activeQuoteId]) {
              o.acceptedQuote = clone(draft.quotes[o.activeQuoteId]);
            }
            o.latePaymentResolution = {
              latePaymentResolutionId: `res-${Date.now()}`,
              orderId: o.orderId,
              paymentAttemptId,
              status: 'CAPACITY_RECHECK_REQUIRED',
              offeredHoldId: null,
              offeredDates: ['2026-09-22', '2026-09-23'],
              expiresAt: new Date(new Date(getNow()).getTime() + 86400000).toISOString(),
              updatedAt: getNow(),
            };
            o.updatedAt = getNow();
            o.timeline.push({
              event: 'LATE_PAYMENT_RECEIVED',
              occurredAt: getNow(),
              actor: userId,
            });
            updatedOrder = o;
          });
          return { payment: updatedPayment, order: updatedOrder, hold };
        }

        if (result === 'SUCCESS') {
          let updatedOrder;
          let updatedPayment;
          let updatedHold;
          let dispatchEvent;

          mockStorage.updateRepository((draft) => {
            const p = draft.payments[paymentAttemptId];
            p.status = PAYMENT_STATUS.SUCCESS;
            p.transactionReference = p.transactionReference || `TXN-${Date.now()}`;
            p.receivedAt = getNow();
            updatedPayment = p;

            const h = draft.holds[order.activeHoldId];
            if (h) h.status = HOLD_STATUS.CONSUMED;
            updatedHold = h;

            const o = draft.orders[payment.orderId];
            o.orderStatus = ORDER_STATUS.CONFIRMED;
            o.paymentStatus = PAYMENT_STATUS.SUCCESS;
            o.confirmationVersion = (o.confirmationVersion || 0) + 1;
            o.confirmedServiceWindow = h?.serviceWindow || { date: o.requestedDate };
            o.acceptedPayment = clone(p);
            o.updatedAt = getNow();
            o.timeline.push({
              event: 'ORDER_CONFIRMED_PAID',
              occurredAt: getNow(),
              actor: userId,
              transactionReference: p.transactionReference,
            });

            dispatchEvent = createDispatchEvent(o, 'UPSERT', getNow());
            draft.dispatchOutbox = draft.dispatchOutbox || [];
            draft.dispatchOutbox.push(dispatchEvent);
            o.lastDispatchEvent = dispatchEvent;
            updatedOrder = o;
          });

          return { payment: updatedPayment, order: updatedOrder, hold: updatedHold, dispatchEvent };
        }

        let updatedOrder;
        let updatedPayment;
        mockStorage.updateRepository((draft) => {
          const p = draft.payments[paymentAttemptId];
          p.status = PAYMENT_STATUS.FAILED;
          updatedPayment = p;

          const o = draft.orders[payment.orderId];
          o.updatedAt = getNow();
          o.timeline.push({
            event: 'PAYMENT_FAILED',
            occurredAt: getNow(),
            actor: userId,
          });
          updatedOrder = o;
        });

        return { payment: updatedPayment, order: updatedOrder, hold };
      });
    },
  };

  // 8. Late Payments
  const latePayments = {
    async acceptRevalidatedSlot(orderId, offeredHoldId, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { repo } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );

        let updatedOrder;
        let hold = repo.holds?.[offeredHoldId];
        let dispatchEvent;

        mockStorage.updateRepository((draft) => {
          const h = draft.holds[offeredHoldId];
          if (h) h.status = HOLD_STATUS.CONSUMED;
          hold = h;

          const o = draft.orders[orderId];
          const payment =
            draft.payments[o.latePaymentResolution?.paymentAttemptId] ||
            Object.values(draft.payments || {}).find((p) => p.orderId === orderId);
          o.paymentStatus = PAYMENT_STATUS.SUCCESS;
          if (payment) {
            o.acceptedPayment = clone(payment);
          }
          if (!o.acceptedQuote && o.activeQuoteId && draft.quotes[o.activeQuoteId]) {
            o.acceptedQuote = clone(draft.quotes[o.activeQuoteId]);
          }
          o.orderStatus = ORDER_STATUS.CONFIRMED;
          o.confirmationVersion = (o.confirmationVersion || 0) + 1;
          o.confirmedServiceWindow = h?.serviceWindow || { date: o.requestedDate };
          o.latePaymentResolution.status = 'RESOLVED_WITH_SLOT';
          o.updatedAt = getNow();

          dispatchEvent = createDispatchEvent(o, 'UPSERT', getNow());
          draft.dispatchOutbox = draft.dispatchOutbox || [];
          draft.dispatchOutbox.push(dispatchEvent);
          o.lastDispatchEvent = dispatchEvent;
          updatedOrder = o;
        });

        return { order: updatedOrder, hold, dispatchEvent };
      });
    },

    async acceptAlternativeDate(orderId, selectedDate, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        await getAuthorizedOrder(orderId, BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS, signal);

        const holdId = `hold-alt-${Date.now()}`;
        const hold = {
          holdId,
          orderId,
          serviceWindow: { date: selectedDate },
          status: HOLD_STATUS.CONSUMED,
          expiresAt: new Date(new Date(getNow()).getTime() + 1800000).toISOString(),
        };

        let updatedOrder;
        let dispatchEvent;

        mockStorage.updateRepository((draft) => {
          draft.holds = draft.holds || {};
          draft.holds[holdId] = hold;

          const o = draft.orders[orderId];
          const payment =
            draft.payments[o.latePaymentResolution?.paymentAttemptId] ||
            Object.values(draft.payments || {}).find((p) => p.orderId === orderId);
          o.paymentStatus = PAYMENT_STATUS.SUCCESS;
          if (payment) {
            o.acceptedPayment = clone(payment);
          }
          if (!o.acceptedQuote && o.activeQuoteId && draft.quotes[o.activeQuoteId]) {
            o.acceptedQuote = clone(draft.quotes[o.activeQuoteId]);
          }
          o.orderStatus = ORDER_STATUS.CONFIRMED;
          o.confirmationVersion = (o.confirmationVersion || 0) + 1;
          o.confirmedServiceWindow = { date: selectedDate };
          if (o.latePaymentResolution) {
            o.latePaymentResolution.status = 'RESOLVED_WITH_SLOT';
          }
          o.timeline.push({
            event: 'ORDER_CONFIRMED_PAID',
            occurredAt: getNow(),
            actor: userId,
            requestedDate: selectedDate,
          });
          o.updatedAt = getNow();

          dispatchEvent = createDispatchEvent(o, 'UPSERT', getNow());
          draft.dispatchOutbox = draft.dispatchOutbox || [];
          draft.dispatchOutbox.push(dispatchEvent);
          o.lastDispatchEvent = dispatchEvent;
          updatedOrder = o;
        });

        return { order: updatedOrder, hold, dispatchEvent };
      });
    },

    async chooseRefund(orderId, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );

        const refundId = `ref-${Date.now()}`;
        const refund = {
          refundId,
          orderId,
          amountVnd: order.acceptedQuote?.totalVnd || 0,
          reason: 'LATE_PAYMENT_REFUND_CHOSEN',
          status: REFUND_STATUS.REQUESTED,
          createdAt: getNow(),
        };

        let updatedOrder;
        mockStorage.updateRepository((draft) => {
          draft.refunds = draft.refunds || {};
          draft.refunds[refundId] = refund;

          const o = draft.orders[orderId];
          o.cancelledFromStatus = o.orderStatus || ORDER_STATUS.AWAITING_PAYMENT;
          o.orderStatus = ORDER_STATUS.CANCELLED;
          o.refundStatus = REFUND_STATUS.REQUESTED;
          if (o.latePaymentResolution) {
            o.latePaymentResolution.status = 'RESOLVED_WITH_REFUND';
          }
          o.timeline.push({
            event: 'ORDER_CANCELLED',
            occurredAt: getNow(),
            actor: userId,
            reason: 'LATE_PAYMENT_REFUND_CHOSEN',
          });
          o.updatedAt = getNow();
          updatedOrder = o;
        });

        return { order: updatedOrder, refund };
      });
    },
  };

  // 9. Changes and Cancellations
  const changes = {
    async requestReschedule(orderId, requestedDate, reason, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );

        const isForceReview = typeof reason === 'string' && reason.includes('[POST_CUTOFF]');
        const cleanReason =
          typeof reason === 'string'
            ? reason.replace('[POST_CUTOFF]', '').trim() || 'Người dân đề nghị đổi ngày'
            : reason;

        const policy = isForceReview
          ? {
              decision: CHANGE_DECISION.REVIEW,
              reason: 'AFTER_CUTOFF',
              preservesCurrentBooking: true,
            }
          : evaluateChangePolicy({
              order,
              action: 'RESCHEDULE',
              requestedAt: getNow(),
              now: getNow(),
              policy: { cutoffHours: 24 },
            });

        const isAllowed = policy.decision === CHANGE_DECISION.ALLOWED;
        const changeRequestId = `cr-${Date.now()}`;
        const changeRequest = {
          changeRequestId,
          orderId,
          type: 'RESCHEDULE',
          status: isAllowed ? 'ACCEPTED' : 'UNDER_REVIEW',
          requestedDate,
          reason: cleanReason,
          financialEffect: 'NONE',
          amountVnd: 0,
          createdAt: getNow(),
          updatedAt: getNow(),
        };

        let updatedOrder;
        mockStorage.updateRepository((draft) => {
          draft.changeRequests = draft.changeRequests || {};
          draft.changeRequests[changeRequestId] = changeRequest;

          const o = draft.orders[orderId];
          o.changeRequest = changeRequest;
          if (isAllowed) {
            o.confirmedServiceWindow = { date: requestedDate };
            o.requestedDate = requestedDate;
            o.confirmationVersion = (o.confirmationVersion || 0) + 1;
            o.timeline.push({
              event: 'ORDER_RESCHEDULED',
              occurredAt: getNow(),
              actor: userId,
              requestedDate,
              reason: cleanReason,
            });
            if (o.paymentStatus === 'SUCCESS' && o.acceptedPayment && o.acceptedQuote) {
              const dispatchEvent = createDispatchEvent(o, 'UPSERT', getNow());
              draft.dispatchOutbox = draft.dispatchOutbox || [];
              draft.dispatchOutbox.push(dispatchEvent);
              o.lastDispatchEvent = dispatchEvent;
            }
          } else {
            o.timeline.push({
              event: 'RESCHEDULE_REQUESTED',
              occurredAt: getNow(),
              actor: userId,
              requestedDate,
              reason: cleanReason,
            });
            draft.notifications = draft.notifications || {};
            const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            draft.notifications[notifId] = {
              id: notifId,
              targetRole: 'DISPATCHER',
              type: 'RESCHEDULE_REQUESTED',
              title: '⚡ Yêu cầu dời ngày mới cần phê duyệt',
              message: `Đơn #${orderId}: Cư dân đề nghị dời ngày thu gom sang ${requestedDate}. Lý do: "${cleanReason}"`,
              orderId,
              changeRequestId,
              createdAt: getNow(),
              read: false,
            };
          }
          o.updatedAt = getNow();
          updatedOrder = o;
        });

        return { order: updatedOrder, changeRequest };
      });
    },

    async requestCancellation(orderId, reason, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const { order } = await getAuthorizedOrder(
          orderId,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
          signal,
        );

        const isForceReview = typeof reason === 'string' && reason.includes('[POST_CUTOFF]');
        const cleanReason =
          typeof reason === 'string'
            ? reason.replace('[POST_CUTOFF]', '').trim() || 'Người dân yêu cầu hủy đơn'
            : reason;

        const policy = isForceReview
          ? {
              decision: CHANGE_DECISION.REVIEW,
              reason: 'AFTER_CUTOFF',
              preservesCurrentBooking: true,
              refundStatus: REFUND_STATUS.NONE,
            }
          : evaluateChangePolicy({
              order,
              action: 'CANCEL',
              requestedAt: getNow(),
              now: getNow(),
              policy: { cutoffHours: 24 },
            });

        if (policy.decision === CHANGE_DECISION.ALLOWED) {
          let updatedOrder;
          let refund;

          mockStorage.updateRepository((draft) => {
            const o = draft.orders[orderId];
            o.cancelledFromStatus = o.orderStatus;
            o.orderStatus = ORDER_STATUS.CANCELLED;
            o.cancellationReason = cleanReason;

            if (o.activeHoldId && draft.holds[o.activeHoldId]) {
              draft.holds[o.activeHoldId].status = HOLD_STATUS.RELEASED;
            }

            if (policy.reason === 'FULL_REFUND') {
              o.refundStatus = REFUND_STATUS.REQUESTED;
              const refundId = `ref-${Date.now()}`;
              refund = {
                refundId,
                orderId,
                amountVnd: o.acceptedQuote?.totalVnd || 0,
                reason: cleanReason,
                status: REFUND_STATUS.REQUESTED,
                createdAt: getNow(),
              };
              draft.refunds = draft.refunds || {};
              draft.refunds[refundId] = refund;
            } else {
              o.refundStatus = REFUND_STATUS.NONE;
            }

            o.confirmationVersion = (o.confirmationVersion || 0) + 1;
            o.updatedAt = getNow();
            o.timeline.push({
              event: 'ORDER_CANCELLED',
              occurredAt: getNow(),
              actor: userId,
              reason: cleanReason,
            });

            if (o.paymentStatus === 'SUCCESS' && o.acceptedPayment && o.acceptedQuote) {
              const dispatchEvent = createDispatchEvent(o, 'CANCEL', getNow());
              draft.dispatchOutbox = draft.dispatchOutbox || [];
              draft.dispatchOutbox.push(dispatchEvent);
              o.lastDispatchEvent = dispatchEvent;
            }

            updatedOrder = o;
          });

          return { order: updatedOrder, refund };
        }

        // Post-cutoff UNDER_REVIEW
        const changeRequestId = `cr-${Date.now()}`;
        const changeRequest = {
          changeRequestId,
          orderId,
          type: 'CANCEL',
          status: 'UNDER_REVIEW',
          reason: cleanReason,
          financialEffect: 'FULL_REFUND',
          amountVnd: order.acceptedQuote?.totalVnd || 0,
          createdAt: getNow(),
          updatedAt: getNow(),
        };

        let updatedOrder;
        mockStorage.updateRepository((draft) => {
          draft.changeRequests = draft.changeRequests || {};
          draft.changeRequests[changeRequestId] = changeRequest;

          const o = draft.orders[orderId];
          o.changeRequest = changeRequest;
          o.timeline.push({
            event: 'CANCEL_REQUESTED',
            occurredAt: getNow(),
            actor: userId,
            reason: cleanReason,
          });
          draft.notifications = draft.notifications || {};
          const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          draft.notifications[notifId] = {
            id: notifId,
            targetRole: 'DISPATCHER',
            type: 'CANCEL_REQUESTED',
            title: '⚡ Yêu cầu hủy đơn mới cần phê duyệt',
            message: `Đơn #${orderId}: Cư dân đề nghị hủy đơn sau thời hạn cắt. Lý do: "${cleanReason}"`,
            orderId,
            changeRequestId,
            createdAt: getNow(),
            read: false,
          };
          o.updatedAt = getNow();
          updatedOrder = o;
        });

        return { order: updatedOrder, changeRequest };
      });
    },

    async get(changeRequestId, signal) {
      checkAbort(signal);
      const repo = mockStorage.getRepository();
      const cr = repo.changeRequests?.[changeRequestId];
      if (!cr) {
        throw new BulkyServiceError(BULKY_ERROR_CODES.NOT_FOUND, 'Change request not found');
      }
      return clone(cr);
    },

    async acceptOffer(changeRequestId, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const repo = mockStorage.getRepository();
        const cr = repo.changeRequests?.[changeRequestId];
        if (!cr) {
          throw new BulkyServiceError(BULKY_ERROR_CODES.NOT_FOUND, 'Change request not found');
        }
        await getAuthorizedOrder(cr.orderId, BULKY_CAPABILITIES.DISPATCH_BULKY_ORDERS, signal);

        let updatedOrder;
        let updatedCr;
        let refund;

        mockStorage.updateRepository((draft) => {
          const req = draft.changeRequests[changeRequestId];
          req.status = 'ACCEPTED';
          req.updatedAt = getNow();
          updatedCr = req;

          const o = draft.orders[cr.orderId];
          o.changeRequest = req;
          if (req.type === 'CANCEL') {
            o.cancelledFromStatus = o.orderStatus;
            o.orderStatus = ORDER_STATUS.CANCELLED;
            o.cancellationReason = req.reason;
            o.confirmationVersion = (o.confirmationVersion || 0) + 1;
            o.refundStatus = REFUND_STATUS.REQUESTED;
            const refundId = `ref-${Date.now()}`;
            refund = {
              refundId,
              orderId: o.orderId,
              amountVnd: req.amountVnd || o.acceptedQuote?.totalVnd || 0,
              reason: req.reason,
              status: REFUND_STATUS.REQUESTED,
              createdAt: getNow(),
            };
            draft.refunds = draft.refunds || {};
            draft.refunds[refundId] = refund;

            o.timeline.push({
              event: 'ORDER_CANCELLED',
              occurredAt: getNow(),
              actor: 'DISPATCHER',
              reason: req.reason,
            });

            if (o.paymentStatus === 'SUCCESS' && o.acceptedPayment && o.acceptedQuote) {
              const dispatchEvent = createDispatchEvent(o, 'CANCEL', getNow());
              draft.dispatchOutbox = draft.dispatchOutbox || [];
              draft.dispatchOutbox.push(dispatchEvent);
              o.lastDispatchEvent = dispatchEvent;
            }
          } else if (req.type === 'RESCHEDULE') {
            o.confirmedServiceWindow = { date: req.requestedDate };
            o.requestedDate = req.requestedDate;
            o.confirmationVersion = (o.confirmationVersion || 0) + 1;

            o.timeline.push({
              event: 'ORDER_RESCHEDULED',
              occurredAt: getNow(),
              actor: 'DISPATCHER',
              requestedDate: req.requestedDate,
              reason: req.reason,
            });

            if (o.paymentStatus === 'SUCCESS' && o.acceptedPayment && o.acceptedQuote) {
              const dispatchEvent = createDispatchEvent(o, 'UPSERT', getNow());
              draft.dispatchOutbox = draft.dispatchOutbox || [];
              draft.dispatchOutbox.push(dispatchEvent);
              o.lastDispatchEvent = dispatchEvent;
            }
          }

          draft.notifications = draft.notifications || {};
          for (const n of Object.values(draft.notifications)) {
            if (n.changeRequestId === changeRequestId && n.targetRole === 'DISPATCHER') {
              n.read = true;
            }
          }
          const acceptNotifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          draft.notifications[acceptNotifId] = {
            id: acceptNotifId,
            targetRole: 'CITIZEN',
            type: 'CHANGE_REQUEST_ACCEPTED',
            title: '✓ Yêu cầu của bạn đã được Điều phối viên phê duyệt',
            message: `Đơn #${o.orderId}: Điều phối viên đã duyệt yêu cầu ${req.type === 'RESCHEDULE' ? `dời ngày thu gom sang ${req.requestedDate}` : 'hủy đơn'}.`,
            orderId: o.orderId,
            changeRequestId,
            createdAt: getNow(),
            read: false,
          };

          o.updatedAt = getNow();
          updatedOrder = o;
        });

        return { order: updatedOrder, changeRequest: updatedCr, refund };
      });
    },

    async rejectOffer(changeRequestId, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        const repo = mockStorage.getRepository();
        const cr = repo.changeRequests?.[changeRequestId];
        if (!cr) {
          throw new BulkyServiceError(BULKY_ERROR_CODES.NOT_FOUND, 'Change request not found');
        }
        await getAuthorizedOrder(cr.orderId, BULKY_CAPABILITIES.DISPATCH_BULKY_ORDERS, signal);

        let updatedOrder;
        let updatedCr;
        mockStorage.updateRepository((draft) => {
          const req = draft.changeRequests[changeRequestId];
          req.status = 'REJECTED';
          req.updatedAt = getNow();
          updatedCr = req;

          const o = draft.orders[cr.orderId];
          o.changeRequest = req;
          o.timeline.push({
            event: 'CHANGE_REQUEST_REJECTED',
            occurredAt: getNow(),
            actor: 'DISPATCHER',
            reason: req.reason,
          });

          draft.notifications = draft.notifications || {};
          for (const n of Object.values(draft.notifications)) {
            if (n.changeRequestId === changeRequestId && n.targetRole === 'DISPATCHER') {
              n.read = true;
            }
          }
          const rejectNotifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          draft.notifications[rejectNotifId] = {
            id: rejectNotifId,
            targetRole: 'CITIZEN',
            type: 'CHANGE_REQUEST_REJECTED',
            title: '✕ Yêu cầu của bạn đã bị Điều phối viên từ chối',
            message: `Đơn #${o.orderId}: Điều phối viên đã từ chối yêu cầu ${req.type === 'RESCHEDULE' ? `dời lịch sang ${req.requestedDate}` : 'hủy đơn'}. Đơn hàng giữ nguyên lịch ban đầu.`,
            orderId: o.orderId,
            changeRequestId,
            createdAt: getNow(),
            read: false,
          };

          o.updatedAt = getNow();
          updatedOrder = o;
        });

        return { order: updatedOrder, changeRequest: updatedCr };
      });
    },

    async resolveProviderFailure(orderId, choice, offeredDate, idempotencyKey, signal) {
      checkAbort(signal);
      return withIdempotency(idempotencyKey, async () => {
        await getAuthorizedOrder(orderId, BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS, signal);

        let updatedOrder;
        let refund;
        let hold;

        mockStorage.updateRepository((draft) => {
          const o = draft.orders[orderId];
          if (choice === 'REFUND') {
            o.cancelledFromStatus = o.orderStatus;
            o.orderStatus = ORDER_STATUS.CANCELLED;
            o.refundStatus = REFUND_STATUS.REQUESTED;
            const refundId = `ref-${Date.now()}`;
            refund = {
              refundId,
              orderId,
              amountVnd: o.acceptedQuote?.totalVnd || 0,
              reason: 'PROVIDER_FAILURE_REFUND',
              status: REFUND_STATUS.REQUESTED,
              createdAt: getNow(),
            };
            draft.refunds = draft.refunds || {};
            draft.refunds[refundId] = refund;
          } else if (choice === 'RESCHEDULE') {
            const holdId = `hold-pf-${Date.now()}`;
            hold = {
              holdId,
              orderId,
              serviceWindow: { date: offeredDate },
              status: HOLD_STATUS.CONSUMED,
              expiresAt: new Date(new Date(getNow()).getTime() + 1800000).toISOString(),
            };
            draft.holds = draft.holds || {};
            draft.holds[holdId] = hold;
            o.confirmedServiceWindow = { date: offeredDate };
          }
          o.updatedAt = getNow();
          updatedOrder = o;
        });

        return { order: updatedOrder, refund, hold };
      });
    },
  };

  // 10. Refunds
  const refunds = {
    async get(refundId, signal) {
      checkAbort(signal);
      const repo = mockStorage.getRepository();
      const refund = repo.refunds?.[refundId];
      if (!refund) {
        throw new BulkyServiceError(BULKY_ERROR_CODES.NOT_FOUND, 'Refund not found');
      }
      return clone(refund);
    },
  };

  // 11. Session
  const session = {
    async clear() {
      sessionCleared = true;
      mockStorage.clearUserSession(userId);
    },
  };

  // 12. Notifications
  const notifications = {
    async list(role, signal) {
      checkAbort(signal);
      const repo = mockStorage.getRepository();
      const all = Object.values(repo.notifications || {})
        .filter((n) => !role || n.targetRole === role || n.targetRole === 'ALL')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return clone(all);
    },
    async markAsRead(notificationId, signal) {
      checkAbort(signal);
      mockStorage.updateRepository((draft) => {
        if (draft.notifications?.[notificationId]) {
          draft.notifications[notificationId].read = true;
        }
      });
      return { success: true };
    },
    async markAllAsRead(role, signal) {
      checkAbort(signal);
      mockStorage.updateRepository((draft) => {
        for (const n of Object.values(draft.notifications || {})) {
          if (!role || n.targetRole === role || n.targetRole === 'ALL') {
            n.read = true;
          }
        }
      });
      return { success: true };
    },
  };

  return {
    catalog,
    recognition,
    orders,
    reviews,
    capacity,
    quotes,
    payments,
    latePayments,
    changes,
    refunds,
    session,
    notifications,
  };
}
