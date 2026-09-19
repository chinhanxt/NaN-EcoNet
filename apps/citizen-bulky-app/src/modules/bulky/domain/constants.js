const freeze = (value) => Object.freeze(value);

export const ORDER_STATUS = freeze({
  DRAFT: 'DRAFT',
  NEEDS_INFO: 'NEEDS_INFO',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});
export const PAYMENT_STATUS = freeze({
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});
export const REFUND_STATUS = freeze({
  NONE: 'NONE',
  REQUESTED: 'REQUESTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});
export const HOLD_STATUS = freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  RELEASED: 'RELEASED',
  CONSUMED: 'CONSUMED',
});
export const AI_DECISION = freeze({
  SUGGESTED: 'SUGGESTED',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});
export const CHANGE_DECISION = freeze({
  ALLOWED: 'ALLOWED',
  REVIEW: 'REVIEW',
  REJECTED: 'REJECTED',
});
export const DISPATCH_EVENT_TYPE = freeze({ UPSERT: 'UPSERT', CANCEL: 'CANCEL' });
export const ACCEPTED_ITEM_TYPES = freeze(['SOFA', 'MATTRESS', 'CABINET', 'TABLE', 'OTHER']);

export const MATERIAL_TYPES = freeze({
  LIGHT: 'LIGHT',
  STANDARD: 'STANDARD',
  HEAVY: 'HEAVY',
});

export const MATERIAL_FACTORS = freeze({
  LIGHT: freeze({
    code: 'LIGHT',
    label: '🪶 Nhựa / Ván ép / Mút',
    priceFactor: 0.85,
    weightFactor: 0.7,
  }),
  STANDARD: freeze({
    code: 'STANDARD',
    label: '🪵 Gỗ MDF / Tiêu chuẩn',
    priceFactor: 1,
    weightFactor: 1,
  }),
  HEAVY: freeze({
    code: 'HEAVY',
    label: '🪨 Gỗ đặc / Mặt đá / Kính',
    priceFactor: 1.35,
    weightFactor: 1.8,
  }),
});
