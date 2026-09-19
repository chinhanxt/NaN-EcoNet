import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  HOLD_STATUS,
  AI_DECISION,
  CHANGE_DECISION,
  MATERIAL_TYPES,
  MATERIAL_FACTORS,
} from './constants.js';
import { BulkyServiceError } from './errors.js';
import { transitionOrder } from './transitions.js';
import { evaluateChangePolicy, settleChangeProposal, evaluateAiResult } from './policies.js';
import { calculateQuote, isQuoteExpired } from './pricing.js';
import { toDispatchBulkyWasteOrder, createDispatchEvent } from './dispatchMapper.js';

describe('bulky domain contracts', () => {
  it('freezes the public statuses and follows the complete order graph', () => {
    expect(Object.isFrozen(ORDER_STATUS)).toBe(true);
    expect(transitionOrder(ORDER_STATUS.DRAFT, 'SUBMIT')).toBe(ORDER_STATUS.NEEDS_INFO);
    expect(transitionOrder(ORDER_STATUS.NEEDS_INFO, 'READY_FOR_PAYMENT')).toBe(
      ORDER_STATUS.AWAITING_PAYMENT,
    );
    expect(transitionOrder(ORDER_STATUS.AWAITING_PAYMENT, 'PAYMENT_SUCCEEDED')).toBe(
      ORDER_STATUS.CONFIRMED,
    );
    expect(transitionOrder(ORDER_STATUS.CONFIRMED, 'ASSIGN')).toBe(ORDER_STATUS.ASSIGNED);
    expect(transitionOrder(ORDER_STATUS.ASSIGNED, 'START')).toBe(ORDER_STATUS.IN_PROGRESS);
    expect(transitionOrder(ORDER_STATUS.IN_PROGRESS, 'COMPLETE')).toBe(ORDER_STATUS.COMPLETED);
    expect(transitionOrder(ORDER_STATUS.IN_PROGRESS, 'CANCEL')).toBeNull();
  });

  it('keeps payment, refund, and hold states independent', () => {
    expect(PAYMENT_STATUS.SUCCESS).toBe('SUCCESS');
    expect(REFUND_STATUS.PROCESSING).toBe('PROCESSING');
    expect(HOLD_STATUS.EXPIRED).toBe('EXPIRED');
  });

  it('defines material types and factors with frozen metadata', () => {
    expect(Object.isFrozen(MATERIAL_TYPES)).toBe(true);
    expect(Object.isFrozen(MATERIAL_FACTORS)).toBe(true);
    expect(MATERIAL_TYPES).toEqual({
      LIGHT: 'LIGHT',
      STANDARD: 'STANDARD',
      HEAVY: 'HEAVY',
    });
    expect(MATERIAL_FACTORS.LIGHT.priceFactor).toBe(0.85);
    expect(MATERIAL_FACTORS.STANDARD.priceFactor).toBe(1.0);
    expect(MATERIAL_FACTORS.HEAVY.priceFactor).toBe(1.35);
  });

  it('recognizes stale holds by the injected clock', () => {
    expect(
      evaluateChangePolicy({
        order: { status: ORDER_STATUS.CONFIRMED, pickupDate: '2026-01-05' },
        requestedAt: '2026-01-01T10:00:00Z',
        now: '2026-01-01T10:00:01Z',
        policy: {},
      }).decision,
    ).toBe(CHANGE_DECISION.ALLOWED);
  });

  it('locks unknown or low-confidence AI results for manual review and never infers mass', () => {
    expect(evaluateAiResult({ itemType: 'ROCKET', confidence: 0.99, massKg: 999 })).toMatchObject({
      decision: AI_DECISION.MANUAL_REVIEW,
      requiresManualReview: true,
    });
    expect(
      evaluateAiResult({ itemType: 'ROCKET', confidence: 0.99, massKg: 999 }),
    ).not.toHaveProperty('massKg');
    expect(evaluateAiResult({ itemType: 'SOFA', confidence: 0.4 })).toMatchObject({
      decision: AI_DECISION.NEEDS_CONFIRMATION,
      requiresManualReview: false,
    });
    expect(evaluateAiResult({ itemType: 'SOFA', confidence: 0.99 })).not.toHaveProperty('massKg');
  });

  it('calculates integer VND totals from confirmed inputs and rejects inferred mass', () => {
    const quote = calculateQuote({
      confirmedItems: [{ itemType: 'SOFA', quantity: 2 }],
      handlingConditions: { floorNumber: 2, requiresDisassembly: true },
      serviceArea: 'A',
      priceBook: { version: 'v1', items: { SOFA: 100000 }, floorFee: 20000, disassemblyFee: 30000 },
      now: '2026-01-01T00:00:00Z',
    });
    expect(quote.totalVnd).toBe(250000);
    expect(Number.isInteger(quote.totalVnd)).toBe(true);
    expect(quote.expiresAt).toBe('2026-01-01T00:30:00.000Z');
    expect(isQuoteExpired(quote, '2026-01-01T00:30:00.000Z')).toBe(true);
  });

  it('calculates quote with material factors and estimated range', () => {
    const quote = calculateQuote({
      confirmedItems: [
        { catalogItemCode: 'TABLE', quantity: 1, material: 'HEAVY' },
        { catalogItemCode: 'CHAIR', quantity: 2, material: 'LIGHT' },
      ],
      handlingConditions: {},
      serviceArea: { code: 'D5' },
      priceBook: {
        version: 'v1',
        items: { TABLE: 100000, CHAIR: 50000 },
      },
      now: '2026-09-22T10:00:00.000Z',
    });

    expect(quote.estimatedRange).toBeDefined();
    expect(quote.estimatedRange.minVnd).toBeGreaterThan(0);
    expect(quote.estimatedRange.maxVnd).toBeGreaterThan(quote.estimatedRange.minVnd);
    expect(quote.estimatedRange.depositHoldVnd).toBe(quote.estimatedRange.minVnd);
    expect(quote.tolerancePolicy.allowedPercent).toBe(15);
    expect(quote.totalVnd).toBe(220000);
    expect(quote.estimatedRange.minVnd).toBe(220000);
    expect(quote.estimatedRange.maxVnd).toBe(286000);
    expect(quote.lineItems[0].material).toBe('HEAVY');
    expect(quote.lineItems[0].unitPriceVnd).toBe(135000);
    expect(quote.lineItems[1].material).toBe('LIGHT');
    expect(quote.lineItems[1].unitPriceVnd).toBe(42500);
  });

  it('hashes nested facts and includes the service-area fee', () => {
    const input = {
      confirmedItems: [{ catalogItemCode: 'SOFA', quantity: 1, dimensionsCm: { length: 2 } }],
      handlingConditions: {},
      serviceArea: { code: 'A' },
      priceBook: { version: 'v1', items: { SOFA: 100000 }, serviceAreaFees: { A: 25000 } },
      now: '2026-01-01T00:00:00Z',
    };
    const first = calculateQuote(input);
    const second = calculateQuote({
      ...input,
      confirmedItems: [{ ...input.confirmedItems[0], dimensionsCm: { length: 3 } }],
    });
    expect(first.totalVnd).toBe(125000);
    expect(first.confirmedInputHash).not.toBe(second.confirmedInputHash);
  });

  it('preserves old booking until a change is accepted and applies cutoff policy', () => {
    const order = {
      orderStatus: ORDER_STATUS.CONFIRMED,
      confirmedServiceWindow: { date: '2026-01-10' },
    };
    expect(
      evaluateChangePolicy({
        order,
        requestedAt: '2026-01-01T10:00:00Z',
        now: '2026-01-01T10:00:01Z',
        policy: { cutoffHours: 24 },
      }),
    ).toMatchObject({ decision: CHANGE_DECISION.ALLOWED, preservesCurrentBooking: true });
    expect(
      evaluateChangePolicy({
        order,
        requestedAt: '2026-01-09T10:00:00Z',
        now: '2026-01-09T10:00:01Z',
        policy: { cutoffHours: 24 },
      }),
    ).toMatchObject({ decision: CHANGE_DECISION.REVIEW, preservesCurrentBooking: true });
  });

  it('distinguishes unpaid cancellation, settled refund, and proposal settlement deltas', () => {
    const unpaid = evaluateChangePolicy({
      order: {
        orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
        confirmedServiceWindow: { date: '2026-01-10' },
        paymentStatus: PAYMENT_STATUS.UNPAID,
      },
      action: 'CANCEL',
      requestedAt: '2026-01-01T00:00:00Z',
      now: '2026-01-01T00:00:00Z',
      policy: { cutoffHours: 24 },
    });
    expect(unpaid.reason).toBe('RELEASE_HOLD_NO_REFUND');
    const settled = evaluateChangePolicy({
      order: {
        orderStatus: ORDER_STATUS.CONFIRMED,
        confirmedServiceWindow: { date: '2026-01-10' },
        paymentStatus: PAYMENT_STATUS.SUCCESS,
      },
      action: 'CANCEL',
      requestedAt: '2026-01-01T00:00:00Z',
      now: '2026-01-01T00:00:00Z',
      policy: { cutoffHours: 24 },
    });
    expect(settled.refundStatus).toBe(REFUND_STATUS.REQUESTED);
    const oldOrder = { orderStatus: ORDER_STATUS.CONFIRMED, acceptedQuote: { totalVnd: 100000 } };
    expect(
      settleChangeProposal({
        order: oldOrder,
        proposal: { status: 'ACCEPTED', hold: { status: 'ACTIVE' }, totalVnd: 100000 },
      }).outcome,
    ).toBe('EQUAL_PRICE');
    expect(
      settleChangeProposal({
        order: oldOrder,
        proposal: { status: 'ACCEPTED', hold: { status: 'ACTIVE' }, totalVnd: 150000 },
        settlement: { paymentStatus: PAYMENT_STATUS.UNPAID },
      }),
    ).toMatchObject({ accepted: false, preservesCurrentBooking: true });
    expect(
      settleChangeProposal({
        order: oldOrder,
        proposal: { status: 'ACCEPTED', hold: { status: 'ACTIVE' }, totalVnd: 50000 },
      }),
    ).toMatchObject({
      accepted: true,
      outcome: 'PARTIAL_REFUND_DUE',
    });
  });

  it('maps only paid confirmed orders and creates exact versioned event IDs', () => {
    const order = {
      orderId: 'b1',
      householdId: 'h1',
      orderStatus: ORDER_STATUS.CONFIRMED,
      paymentStatus: PAYMENT_STATUS.SUCCESS,
      confirmationVersion: 1,
      confirmedItems: [{ catalogItemCode: 'SOFA', quantity: 1 }],
      requestedDate: '2026-01-10',
      confirmedServiceWindow: { date: '2026-01-10' },
      serviceLocation: { address: 'A', latitude: 1, longitude: 2 },
      handlingConditions: { hasLift: true, floorNumber: 2 },
      acceptedQuote: { totalVnd: 100000 },
      acceptedPayment: { status: PAYMENT_STATUS.SUCCESS, transactionReference: 'tx1' },
    };
    expect(toDispatchBulkyWasteOrder(order)).toMatchObject({
      orderId: 'b1',
      isPaid: true,
      status: 'PAID_CONFIRMED',
    });
    expect(createDispatchEvent(order, 'UPSERT', '2026-01-01T00:00:00.000Z')).toMatchObject({
      eventId: 'b1:1:UPSERT',
      type: 'UPSERT',
    });
    expect(
      createDispatchEvent(
        {
          ...order,
          orderStatus: ORDER_STATUS.CANCELLED,
          cancelledFromStatus: ORDER_STATUS.CONFIRMED,
        },
        'CANCEL',
        '2026-01-01T00:00:00.000Z',
      ),
    ).toMatchObject({
      eventId: 'b1:1:CANCEL',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    expect(() =>
      toDispatchBulkyWasteOrder({
        ...order,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        acceptedPayment: { status: PAYMENT_STATUS.UNPAID },
      }),
    ).toThrow(BulkyServiceError);
  });
});
