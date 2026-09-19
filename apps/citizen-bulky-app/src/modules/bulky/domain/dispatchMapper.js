import {
  ACCEPTED_ITEM_TYPES,
  DISPATCH_EVENT_TYPE,
  ORDER_STATUS,
  PAYMENT_STATUS,
} from './constants.js';
import { BulkyServiceError } from './errors.js';

const fail = (message) => {
  throw new BulkyServiceError('VALIDATION', message);
};
const paid = (order) =>
  order.paymentStatus === PAYMENT_STATUS.SUCCESS ||
  order.acceptedPayment?.status === PAYMENT_STATUS.SUCCESS;
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const validate = (order, allowCancelled = false) => {
  if (
    !order?.orderId ||
    !order.householdId ||
    !Number.isInteger(order.confirmationVersion) ||
    order.confirmationVersion < 1
  )
    fail('Missing confirmation identity');
  const status = order.orderStatus;
  const allowed = [
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.ASSIGNED,
    ORDER_STATUS.IN_PROGRESS,
    ORDER_STATUS.COMPLETED,
  ];
  if (!allowed.includes(status) && !(allowCancelled && status === ORDER_STATUS.CANCELLED))
    throw new BulkyServiceError('CONFLICT', 'Order is not committed');
  if (!paid(order)) throw new BulkyServiceError('CONFLICT', 'Order was not paid');
  if (
    status === ORDER_STATUS.CANCELLED &&
    (!order.cancelledFromStatus || !allowed.includes(order.cancelledFromStatus))
  )
    throw new BulkyServiceError('CONFLICT', 'Cancellation lacks prior confirmation');
  const date =
    order.confirmedServiceWindow?.date || order.confirmedServiceWindow?.start?.slice(0, 10);
  const location = order.serviceLocation;
  const quote = order.acceptedQuote;
  const payment = order.acceptedPayment;
  if (
    !validDate(date) ||
    !location?.address ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    !order.confirmedServiceWindow
  )
    fail('Invalid service commitment');
  if (
    !quote ||
    !Number.isInteger(quote.totalVnd) ||
    quote.totalVnd < 0 ||
    !payment?.transactionReference
  )
    fail('Invalid accepted payment or quote');
  if (
    typeof order.handlingConditions?.hasLift !== 'boolean' ||
    !Number.isInteger(order.handlingConditions?.floorNumber) ||
    order.handlingConditions.floorNumber < 0
  )
    fail('Invalid handling conditions');
  if (!Array.isArray(order.confirmedItems) || !order.confirmedItems.length)
    fail('Missing confirmed items');
  for (const item of order.confirmedItems)
    if (
      !ACCEPTED_ITEM_TYPES.includes(item.catalogItemCode) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )
      fail('Invalid confirmed item');
  return { date, location, quote, payment };
};

export function toDispatchBulkyWasteOrder(order) {
  const { date, location, quote, payment } = validate(order);
  const counts = order.confirmedItems.reduce((map, item) => {
    map[item.catalogItemCode] = (map[item.catalogItemCode] || 0) + item.quantity;
    return map;
  }, {});
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const itemType = ranked.length > 1 && ranked[0][1] === ranked[1][1] ? 'OTHER' : ranked[0][0];
  return {
    orderId: order.orderId,
    householdId: order.householdId,
    itemType,
    itemsCount: Object.values(counts).reduce((sum, value) => sum + value, 0),
    pickupDate: date,
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
    hasElevator: order.handlingConditions.hasLift,
    floor: order.handlingConditions.floorNumber,
    totalPriceVnd: quote.totalVnd,
    isPaid: true,
    paymentTransactionId: payment.transactionReference,
    status: order.orderStatus === ORDER_STATUS.COMPLETED ? 'COLLECTED' : 'PAID_CONFIRMED',
  };
}

export function createDispatchEvent(order, type, now) {
  if (!now) fail('Injected now is required');
  if (!Object.values(DISPATCH_EVENT_TYPE).includes(type)) fail('Unknown event type');
  validate(order, type === DISPATCH_EVENT_TYPE.CANCEL);
  if (type === DISPATCH_EVENT_TYPE.UPSERT) {
    if (order.orderStatus === ORDER_STATUS.CANCELLED)
      throw new BulkyServiceError('CONFLICT', 'Cancelled order cannot upsert');
    return {
      eventId: `${order.orderId}:${order.confirmationVersion}:UPSERT`,
      type,
      orderId: order.orderId,
      confirmationVersion: order.confirmationVersion,
      occurredAt: now,
      order: toDispatchBulkyWasteOrder(order),
    };
  }
  if (order.orderStatus !== ORDER_STATUS.CANCELLED)
    throw new BulkyServiceError('CONFLICT', 'CANCEL requires cancelled order');
  return {
    eventId: `${order.orderId}:${order.confirmationVersion}:CANCEL`,
    type,
    orderId: order.orderId,
    confirmationVersion: order.confirmationVersion,
    occurredAt: now,
    cancellation: { reason: order.cancellationReason || 'CANCELLED' },
  };
}
