import { describe, it, expect } from 'vitest';
import {
  toDispatchBulkyWasteOrder,
  createDispatchEvent,
  getDispatchOutboxEvents,
} from './integration.js';
import { createMockStorage } from './services/mock/mockStorage.js';
import { ORDER_STATUS, PAYMENT_STATUS } from './domain/constants.js';

describe('Bulky Integration & Dev 2 handoff', () => {
  const validOrder = {
    orderId: 'b-ord-1',
    householdId: 'hh-1',
    confirmationVersion: 1,
    orderStatus: ORDER_STATUS.CONFIRMED,
    paymentStatus: PAYMENT_STATUS.SUCCESS,
    requestedDate: '2026-09-20',
    confirmedServiceWindow: { date: '2026-09-20' },
    serviceLocation: { address: '123 Nguyen Trai, Q5', latitude: 10.756, longitude: 106.678 },
    acceptedQuote: { totalVnd: 150000 },
    acceptedPayment: { transactionReference: 'TXN-999', status: PAYMENT_STATUS.SUCCESS },
    confirmedItems: [
      {
        catalogItemCode: 'SOFA',
        quantity: 1,
        dimensionsCm: { length: 200, width: 90, height: 85 },
      },
    ],
    handlingConditions: { placement: 'GROUND_FLOOR', floorNumber: 0, hasLift: true },
  };

  it('transforms paid confirmed order to exact Dev 2 BulkyWasteOrder schema', () => {
    const dispatchOrder = toDispatchBulkyWasteOrder(validOrder);
    expect(dispatchOrder).toEqual({
      orderId: 'b-ord-1',
      householdId: 'hh-1',
      itemType: 'SOFA',
      itemsCount: 1,
      pickupDate: '2026-09-20',
      address: '123 Nguyen Trai, Q5',
      latitude: 10.756,
      longitude: 106.678,
      hasElevator: true,
      floor: 0,
      totalPriceVnd: 150000,
      isPaid: true,
      paymentTransactionId: 'TXN-999',
      status: 'PAID_CONFIRMED',
    });
  });

  it('rejects unpaid order with CONFLICT when attempting Dev 2 dispatch', () => {
    const unpaidOrder = {
      ...validOrder,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      acceptedPayment: null,
    };
    expect(() => toDispatchBulkyWasteOrder(unpaidOrder)).toThrow();
  });

  it('creates typed versioned UPSERT and CANCEL events with exact eventId', () => {
    const upsertEvent = createDispatchEvent(validOrder, 'UPSERT', '2026-09-17T10:00:00.000Z');
    expect(upsertEvent.eventId).toBe('b-ord-1:1:UPSERT');
    expect(upsertEvent.type).toBe('UPSERT');
    expect(upsertEvent.order).toBeDefined();

    const cancelledOrder = {
      ...validOrder,
      orderStatus: ORDER_STATUS.CANCELLED,
      cancelledFromStatus: ORDER_STATUS.CONFIRMED,
      cancellationReason: 'Đổi lịch cá nhân',
    };
    const cancelEvent = createDispatchEvent(cancelledOrder, 'CANCEL', '2026-09-17T10:30:00.000Z');
    expect(cancelEvent.eventId).toBe('b-ord-1:1:CANCEL');
    expect(cancelEvent.type).toBe('CANCEL');
    expect(cancelEvent.cancellation.reason).toBe('Đổi lịch cá nhân');
  });

  it('reads and dedupes outbox events by eventId from mock storage', () => {
    const memory = {};
    const storage = createMockStorage({
      storage: {
        getItem: (k) => memory[k] || null,
        setItem: (k, v) => {
          memory[k] = String(v);
        },
        removeItem: (k) => {
          delete memory[k];
        },
      },
    });

    const event1 = createDispatchEvent(validOrder, 'UPSERT', '2026-09-17T10:00:00.000Z');
    storage.updateRepository((draft) => {
      draft.dispatchOutbox = [event1, event1]; // duplicate
    });

    const outbox = getDispatchOutboxEvents(storage);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].eventId).toBe('b-ord-1:1:UPSERT');
  });
});
