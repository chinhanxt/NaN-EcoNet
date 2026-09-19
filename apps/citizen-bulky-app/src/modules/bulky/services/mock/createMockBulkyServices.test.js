import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBulkyServices } from './createMockBulkyServices.js';
import { BULKY_CAPABILITIES, BULKY_ERROR_CODES } from '../bulkyServiceContract.js';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  HOLD_STATUS,
  REFUND_STATUS,
} from '../../domain/constants.js';

describe('createMockBulkyServices', () => {
  let memoryBacking;
  let memoryStorage;
  let membershipMap;
  let membershipResolver;
  const nowFixed = '2026-09-17T10:00:00.000Z';

  beforeEach(() => {
    memoryBacking = {};
    memoryStorage = {
      getItem: (k) => (k in memoryBacking ? memoryBacking[k] : null),
      setItem: (k, v) => {
        memoryBacking[k] = String(v);
      },
      removeItem: (k) => {
        delete memoryBacking[k];
      },
      clear: () => {
        memoryBacking = {};
      },
    };

    membershipMap = {
      'user-1:hh-1': {
        status: 'ACTIVE',
        capabilities: [
          BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
        ],
        household: {
          id: 'hh-1',
          name: 'Hộ gia đình Nguyễn Văn A',
          serviceLocations: [
            {
              id: 'loc-1',
              address: '123 Nguyen Trai, Phuong 3, Quan 5, TP.HCM',
              latitude: 10.756,
              longitude: 106.678,
              serviceArea: { code: 'D5' },
            },
          ],
        },
      },
      'user-read-only:hh-1': {
        status: 'ACTIVE',
        capabilities: [BULKY_CAPABILITIES.VIEW_BULKY_ORDERS],
        household: {
          id: 'hh-1',
          name: 'Hộ gia đình Nguyễn Văn A',
          serviceLocations: [
            {
              id: 'loc-1',
              address: '123 Nguyen Trai, Phuong 3, Quan 5, TP.HCM',
              latitude: 10.756,
              longitude: 106.678,
              serviceArea: { code: 'D5' },
            },
          ],
        },
      },
      'user-2:hh-2': {
        status: 'ACTIVE',
        capabilities: [
          BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
          BULKY_CAPABILITIES.MANAGE_BULKY_ORDERS,
        ],
        household: {
          id: 'hh-2',
          name: 'Hộ gia đình Trần Thị B',
          serviceLocations: [
            {
              id: 'loc-2',
              address: '456 Tran Hung Dao, Quan 1, TP.HCM',
              latitude: 10.762,
              longitude: 106.685,
              serviceArea: { code: 'D1' },
            },
          ],
        },
      },
    };

    membershipResolver = async (userId, householdId) => {
      const key = `${userId}:${householdId}`;
      if (membershipMap[key]) return membershipMap[key];
      // default household resolution for user
      for (const [k, val] of Object.entries(membershipMap)) {
        if (k.startsWith(`${userId}:`)) return val;
      }
      return null;
    };
  });

  const getServices = (userId = 'user-1', options = {}) =>
    createMockBulkyServices({
      userId,
      membershipResolver,
      storage: memoryStorage,
      now: () => options.now || nowFixed,
      scenario: options.scenario,
    });

  describe('Size pricing and manual review', () => {
    it('requires staff permission to price an exceptional item and keeps customer payment separate', async () => {
      const citizen = getServices();
      const draft = await citizen.orders.createDraft(
        { serviceLocationId: 'loc-1', requestedDate: '2026-09-25' },
        'staff-draft',
      );
      await citizen.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [{ catalogItemCode: 'OTHER', sizeCode: 'OVERSIZE', quantity: 1 }],
        },
        'staff-confirm',
      );
      const offer = { totalVnd: 450000, note: 'Thu gom tủ quá khổ, gồm vận chuyển và bốc xếp' };
      await expect(
        citizen.reviews.setPrice(draft.orderId, offer, 'denied-price'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      membershipMap['staff:hh-1'] = {
        ...membershipMap['user-1:hh-1'],
        capabilities: [
          BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
          BULKY_CAPABILITIES.DISPATCH_BULKY_ORDERS,
        ],
      };
      const staff = getServices('staff');
      const reviewed = await staff.reviews.setPrice(draft.orderId, offer, 'staff-price');
      expect(reviewed.orderStatus).toBe(ORDER_STATUS.NEEDS_INFO);
      expect(reviewed.paymentStatus).toBe(PAYMENT_STATUS.UNPAID);
      const { quote } = await citizen.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-25',
        'staff-quote',
      );
      expect(quote.totalVnd).toBe(450000);
      expect(quote.pricingBasis).toBe('MANUAL');
      expect(quote.estimatedRange).toBeUndefined();
    });
    it('persists selected size and holds unknown items for staff without allowing payment quotes', async () => {
      const services = getServices();
      const draft = await services.orders.createDraft(
        { serviceLocationId: 'loc-1', requestedDate: '2026-09-25' },
        'size-draft',
      );
      const confirmed = await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [{ catalogItemCode: 'SOFA', sizeCode: 'LARGE', quantity: 1 }],
        },
        'size-confirm',
      );
      expect(confirmed.confirmedItems[0].sizeCode).toBe('LARGE');
      const review = await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [{ catalogItemCode: 'OTHER', sizeCode: 'OVERSIZE', quantity: 1 }],
        },
        'review-confirm',
      );
      expect(review.orderStatus).toBe(ORDER_STATUS.MANUAL_REVIEW);
      expect((await services.orders.get(draft.orderId)).manualReviewReasons.length).toBeGreaterThan(
        0,
      );
      await expect(
        services.quotes.reserveAndCreate(draft.orderId, '2026-09-25', 'review-quote'),
      ).rejects.toMatchObject({ code: 'MANUAL_REVIEW' });
    });

    it('preserves recognition flags when confirming otherwise standard furniture', async () => {
      const services = getServices();
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-25',
          recognitionResult: { containsConstructionWaste: true },
        },
        'unsafe-draft',
      );
      const order = await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [{ catalogItemCode: 'SOFA', sizeCode: 'SMALL', quantity: 1 }],
        },
        'unsafe-confirm',
      );
      expect(order.orderStatus).toBe(ORDER_STATUS.MANUAL_REVIEW);
      await expect(
        services.quotes.reserveAndCreate(order.orderId, '2026-09-25', 'unsafe-quote'),
      ).rejects.toMatchObject({ code: 'MANUAL_REVIEW' });
    });
  });

  describe('Authorization and Session', () => {
    it('throws UNAUTHENTICATED when userId is missing or session was cleared', async () => {
      expect(() =>
        createMockBulkyServices({
          userId: null,
          membershipResolver,
          storage: memoryStorage,
        }),
      ).toThrow();

      const services = getServices('user-1');
      await services.session.clear();
      await expect(services.orders.list()).rejects.toMatchObject({
        code: BULKY_ERROR_CODES.UNAUTHENTICATED,
      });
    });

    it('rejects with FORBIDDEN when user has only VIEW capability attempting mutation', async () => {
      const services = getServices('user-read-only');
      await expect(
        services.orders.createDraft(
          {
            serviceLocationId: 'loc-1',
            requestedDate: '2026-09-20',
          },
          'key-1',
        ),
      ).rejects.toMatchObject({
        code: BULKY_ERROR_CODES.FORBIDDEN,
      });
    });

    it('immediately denies requests when membership is revoked mid-session', async () => {
      const services = getServices('user-1');
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'key-revocation-test',
      );
      expect(draft.orderId).toBeDefined();

      // Revoke membership
      membershipMap['user-1:hh-1'].status = 'REVOKED';

      await expect(services.orders.get(draft.orderId)).rejects.toMatchObject({
        code: BULKY_ERROR_CODES.FORBIDDEN,
      });
    });

    it('returns non-disclosing FORBIDDEN on foreign or non-existent orderId', async () => {
      const services = getServices('user-1');
      await expect(services.orders.get('non-existent-order-id')).rejects.toMatchObject({
        code: BULKY_ERROR_CODES.FORBIDDEN,
      });
    });
  });

  describe('Catalog and AI Recognition', () => {
    it('lists accepted bulky items with code, displayName and dimensions', async () => {
      const services = getServices('user-1');
      const items = await services.catalog.listAcceptedItems();
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.code === 'SOFA')).toBe(true);
    });

    it('returns suggested item on normal confidence recognition', async () => {
      const services = getServices('user-1');
      const res = await services.recognition.analyzeImages({
        images: [{ filename: 'sofa.jpg', sizeBytes: 1024 }],
      });
      expect(res.decision).toBeDefined();
      expect(res.items).toBeDefined();
    });

    it('returns manual review when scenario is AI_MANUAL_REVIEW or item is unsupported', async () => {
      const services = getServices('user-1', { scenario: 'AI_MANUAL_REVIEW' });
      const res = await services.recognition.analyzeImages({
        images: [{ filename: 'mystery.jpg', sizeBytes: 1024 }],
      });
      expect(res.requiresManualReview).toBe(true);
      expect(res.decision).toBe('MANUAL_REVIEW');
    });
  });

  describe('Orders lifecycle and idempotency', () => {
    it('creates draft with household location snapshot and rejects foreign location', async () => {
      const services = getServices('user-1');
      await expect(
        services.orders.createDraft(
          {
            serviceLocationId: 'foreign-loc',
            requestedDate: '2026-09-20',
          },
          'k1',
        ),
      ).rejects.toMatchObject({
        code: BULKY_ERROR_CODES.VALIDATION,
      });

      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k1',
      );
      expect(draft.householdId).toBe('hh-1');
      expect(draft.serviceLocation.address).toBe('123 Nguyen Trai, Phuong 3, Quan 5, TP.HCM');
      expect(draft.orderStatus).toBe(ORDER_STATUS.DRAFT);
    });

    it('returns same result on identical idempotencyKey retry', async () => {
      const services = getServices('user-1');
      const first = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'idemp-1',
      );
      const second = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'idemp-1',
      );
      expect(first.orderId).toBe(second.orderId);
    });

    it('confirms items and updates handling conditions', async () => {
      const services = getServices('user-1');
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k-items-1',
      );

      const updated = await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [
            {
              catalogItemCode: 'SOFA',
              sizeCode: 'SMALL',
              displayName: 'Sofa da 3 chỗ',
              quantity: 1,
              dimensionsCm: { length: 200, width: 90, height: 85 },
            },
          ],
          handlingConditions: {
            placement: 'UPPER_FLOOR',
            hasLift: true,
            floorNumber: 3,
            requiresDisassembly: false,
          },
        },
        'k-items-2',
      );

      expect(updated.confirmedItems).toHaveLength(1);
      expect(updated.handlingConditions.floorNumber).toBe(3);
    });

    it('lists orders with cursor pagination', async () => {
      const services = getServices('user-1');
      const res = await services.orders.list();
      expect(Array.isArray(res.items)).toBe(true);
      expect(res.nextCursor).toBeDefined();
    });
  });

  describe('Capacity, Quotes and Holds', () => {
    it('creates atomic quote and hold with reserveAndCreate', async () => {
      const services = getServices('user-1');
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k-reserve-1',
      );

      await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [
            {
              catalogItemCode: 'SOFA',
              sizeCode: 'SMALL',
              displayName: 'Sofa da 3 chỗ',
              quantity: 1,
              dimensionsCm: { length: 200, width: 90, height: 85 },
            },
          ],
          handlingConditions: {
            placement: 'GROUND_FLOOR',
            hasLift: true,
            floorNumber: 0,
            requiresDisassembly: false,
          },
        },
        'k-reserve-2',
      );

      const result = await services.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-20',
        'k-reserve-3',
      );

      expect(result.order.orderStatus).toBe(ORDER_STATUS.AWAITING_PAYMENT);
      expect(result.quote).toBeDefined();
      expect(result.quote.totalVnd).toBeGreaterThan(0);
      expect(result.hold).toBeDefined();
      expect(result.hold.status).toBe(HOLD_STATUS.ACTIVE);
    });

    it('rejects quote acceptance or payment when quote/hold has expired', async () => {
      let currentTime = '2026-09-17T10:00:00.000Z';
      const services = getServices('user-1', { now: currentTime });

      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k-exp-1',
      );

      await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [
            {
              catalogItemCode: 'MATTRESS',
              sizeCode: 'MEDIUM',
              quantity: 1,
              dimensionsCm: { length: 180, width: 160, height: 20 },
            },
          ],
          handlingConditions: { placement: 'GROUND_FLOOR', hasLift: true, floorNumber: 0 },
        },
        'k-exp-2',
      );

      const { quote } = await services.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-20',
        'k-exp-3',
      );

      // Fast forward past expiry (35 minutes later)
      const expiredServices = getServices('user-1', { now: '2026-09-17T10:35:00.000Z' });

      await expect(
        expiredServices.payments.start(draft.orderId, quote.quoteId, 'k-pay-start'),
      ).rejects.toMatchObject({
        code: BULKY_ERROR_CODES.SLOT_EXPIRED,
      });
    });
  });

  describe('Payment Simulation and Dispatch Outbox', () => {
    it('confirms order, consumes hold, and records dispatch outbox on successful payment', async () => {
      const services = getServices('user-1');
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k-pay-1',
      );

      await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [
            {
              catalogItemCode: 'SOFA',
              sizeCode: 'SMALL',
              quantity: 1,
              dimensionsCm: { length: 200, width: 90, height: 85 },
            },
          ],
          handlingConditions: { placement: 'GROUND_FLOOR', hasLift: true, floorNumber: 0 },
        },
        'k-pay-2',
      );

      const { quote } = await services.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-20',
        'k-pay-3',
      );
      const attempt = await services.payments.start(draft.orderId, quote.quoteId, 'k-pay-4');

      const simResult = await services.payments.simulateResult(
        attempt.paymentAttemptId,
        'SUCCESS',
        'k-pay-5',
      );

      expect(simResult.order.orderStatus).toBe(ORDER_STATUS.CONFIRMED);
      expect(simResult.order.paymentStatus).toBe(PAYMENT_STATUS.SUCCESS);
      expect(simResult.hold.status).toBe(HOLD_STATUS.CONSUMED);
      expect(simResult.dispatchEvent).toBeDefined();
      expect(simResult.dispatchEvent.type).toBe('UPSERT');
      expect(simResult.dispatchEvent.eventId).toBe(`${draft.orderId}:1:UPSERT`);

      // Duplicate callback replay
      const replay = await services.payments.simulateResult(
        attempt.paymentAttemptId,
        'SUCCESS',
        'k-pay-5',
      );
      expect(replay.order.orderStatus).toBe(ORDER_STATUS.CONFIRMED);
      expect(replay.dispatchEvent.eventId).toBe(`${draft.orderId}:1:UPSERT`);
    });

    it('creates latePaymentResolution on late success when hold expired', async () => {
      const services = getServices('user-1', { scenario: 'PAYMENT_LATE_SUCCESS' });
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k-late-1',
      );

      await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [
            {
              catalogItemCode: 'SOFA',
              sizeCode: 'SMALL',
              quantity: 1,
              dimensionsCm: { length: 200, width: 90, height: 85 },
            },
          ],
          handlingConditions: { placement: 'GROUND_FLOOR', hasLift: true, floorNumber: 0 },
        },
        'k-late-2',
      );

      const { quote } = await services.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-20',
        'k-late-3',
      );
      const attempt = await services.payments.start(draft.orderId, quote.quoteId, 'k-late-4');

      const lateResult = await services.payments.simulateResult(
        attempt.paymentAttemptId,
        'SUCCESS',
        'k-late-5',
      );

      expect(lateResult.order.orderStatus).toBe(ORDER_STATUS.AWAITING_PAYMENT);
      expect(lateResult.order.latePaymentResolution).toBeDefined();
      expect(lateResult.order.latePaymentResolution.status).toBe('CAPACITY_RECHECK_REQUIRED');
    });
  });

  describe('Changes, Cancellations and Refunds', () => {
    it('cancels order and requests full refund before cutoff', async () => {
      const services = getServices('user-1');
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k-can-1',
      );

      await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [
            {
              catalogItemCode: 'SOFA',
              sizeCode: 'SMALL',
              quantity: 1,
              dimensionsCm: { length: 200, width: 90, height: 85 },
            },
          ],
          handlingConditions: { placement: 'GROUND_FLOOR', hasLift: true, floorNumber: 0 },
        },
        'k-can-2',
      );

      const { quote } = await services.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-20',
        'k-can-3',
      );
      const attempt = await services.payments.start(draft.orderId, quote.quoteId, 'k-can-4');
      await services.payments.simulateResult(attempt.paymentAttemptId, 'SUCCESS', 'k-can-5');

      const cancelResult = await services.changes.requestCancellation(
        draft.orderId,
        'Khách đổi ý',
        'k-can-6',
      );

      expect(cancelResult.order.orderStatus).toBe(ORDER_STATUS.CANCELLED);
      expect(cancelResult.order.refundStatus).toBe(REFUND_STATUS.REQUESTED);
      expect(cancelResult.refund).toBeDefined();
      expect(cancelResult.refund.amountVnd).toBe(quote.totalVnd);
    });

    it('puts cancellation under review after cutoff passed', async () => {
      // Set now to be within cutoff window (e.g. less than 24h before pickup)
      const services = getServices('user-1', { now: '2026-09-19T18:00:00.000Z' });
      const draft = await services.orders.createDraft(
        {
          serviceLocationId: 'loc-1',
          requestedDate: '2026-09-20',
        },
        'k-postcut-1',
      );

      await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [
            {
              catalogItemCode: 'SOFA',
              sizeCode: 'SMALL',
              quantity: 1,
              dimensionsCm: { length: 200, width: 90, height: 85 },
            },
          ],
          handlingConditions: { placement: 'GROUND_FLOOR', hasLift: true, floorNumber: 0 },
        },
        'k-postcut-2',
      );

      const { quote } = await services.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-20',
        'k-postcut-3',
      );
      const attempt = await services.payments.start(draft.orderId, quote.quoteId, 'k-postcut-4');
      await services.payments.simulateResult(attempt.paymentAttemptId, 'SUCCESS', 'k-postcut-5');

      const cancelResult = await services.changes.requestCancellation(
        draft.orderId,
        'Khách đổi ý sát giờ',
        'k-postcut-6',
      );

      expect(cancelResult.order.orderStatus).toBe(ORDER_STATUS.CONFIRMED); // booking preserved
      expect(cancelResult.changeRequest.status).toBe('UNDER_REVIEW');
    });
  });

  describe('Role-based notifications', () => {
    it('creates dispatcher notification on review request, and notifies citizen upon resolution', async () => {
      const services = getServices('user-1', { now: '2026-09-19T18:00:00.000Z' });
      const draft = await services.orders.createDraft(
        { serviceLocationId: 'loc-1', requestedDate: '2026-09-20' },
        'k-notif-1',
      );
      await services.orders.confirmItems(
        draft.orderId,
        {
          confirmedItems: [{ catalogItemCode: 'SOFA', sizeCode: 'SMALL', quantity: 1 }],
          handlingConditions: { placement: 'CURBSIDE' },
        },
        'k-notif-2',
      );
      const { quote } = await services.quotes.reserveAndCreate(
        draft.orderId,
        '2026-09-20',
        'k-notif-3',
      );
      const attempt = await services.payments.start(draft.orderId, quote.quoteId, 'k-notif-4');
      await services.payments.simulateResult(attempt.paymentAttemptId, 'SUCCESS', 'k-notif-5');

      // Request reschedule within cutoff (enters UNDER_REVIEW)
      const res = await services.changes.requestReschedule(
        draft.orderId,
        '2026-09-22',
        'Cần dời ngày gấp [POST_CUTOFF]',
        'k-notif-6',
      );
      expect(res.changeRequest.status).toBe('UNDER_REVIEW');

      // Check dispatcher notifications
      const dispNotifs = await services.notifications.list('DISPATCHER');
      const reviewNotif = dispNotifs.find(
        (n) => n.changeRequestId === res.changeRequest.changeRequestId,
      );
      expect(reviewNotif).toBeDefined();
      expect(reviewNotif.type).toBe('RESCHEDULE_REQUESTED');
      expect(reviewNotif.read).toBe(false);

      // Dispatcher accepts offer
      membershipMap['staff:hh-1'] = {
        ...membershipMap['user-1:hh-1'],
        capabilities: [
          BULKY_CAPABILITIES.VIEW_BULKY_ORDERS,
          BULKY_CAPABILITIES.DISPATCH_BULKY_ORDERS,
        ],
      };
      await getServices('staff').changes.acceptOffer(
        res.changeRequest.changeRequestId,
        'k-notif-7',
      );

      // Dispatcher notification should now be read
      const updatedDispNotifs = await services.notifications.list('DISPATCHER');
      const updatedReviewNotif = updatedDispNotifs.find((n) => n.id === reviewNotif.id);
      expect(updatedReviewNotif.read).toBe(true);

      // Citizen receives approval notification
      const citizenNotifs = await services.notifications.list('CITIZEN');
      const citizenApprovalNotif = citizenNotifs.find(
        (n) => n.changeRequestId === res.changeRequest.changeRequestId,
      );
      expect(citizenApprovalNotif).toBeDefined();
      expect(citizenApprovalNotif.type).toBe('CHANGE_REQUEST_ACCEPTED');

      // Test marking notification as read
      await services.notifications.markAsRead(citizenApprovalNotif.id);
      const readNotifs = await services.notifications.list('CITIZEN');
      expect(readNotifs.find((n) => n.id === citizenApprovalNotif.id).read).toBe(true);
    });
  });

  describe('AbortSignal handling', () => {
    it('rejects with AbortError when AbortSignal is already aborted', async () => {
      const services = getServices('user-1');
      const controller = new AbortController();
      controller.abort();

      await expect(services.catalog.listAcceptedItems(controller.signal)).rejects.toThrow();
    });
  });
});
