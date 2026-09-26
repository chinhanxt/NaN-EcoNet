import { BulkyServiceError } from './errors.js';
import { MATERIAL_FACTORS } from './constants.js';
import { ITEM_SIZES, needsItemReview, PRICE_CHANGE_NOTICE } from './itemSizes.js';

const asVnd = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0)
    throw new BulkyServiceError('VALIDATION', `${field} must be a non-negative integer`);
  return n;
};

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
};

export function calculateQuote({
  confirmedItems = [],
  handlingConditions = {},
  serviceArea,
  priceBook,
  now,
  serviceWindow,
  quoteTtlMinutes = 30,
}) {
  if (
    !priceBook?.version ||
    !serviceArea ||
    !now ||
    !Array.isArray(confirmedItems) ||
    !confirmedItems.length
  )
    throw new BulkyServiceError('VALIDATION', 'Incomplete quote input');
  const lineItems = [];
  const bySize = priceBook.pricingBasis === 'ITEM_SIZE';
  if (bySize && needsItemReview(confirmedItems)) {
    throw new BulkyServiceError(
      'MANUAL_REVIEW',
      'Cần nhân viên xác nhận kích thước hoặc báo giá riêng cho đồ vật này.',
    );
  }
  let subtotalVnd = 0;
  for (const item of confirmedItems) {
    const code = item.catalogItemCode || item.itemType;
    const quantity = asVnd(item.quantity, 'quantity');
    if (!quantity) throw new BulkyServiceError('VALIDATION', 'Số lượng phải lớn hơn 0');
    const defaultBasePrices = {
      SOFA: 150000,
      MATTRESS: 100000,
      CABINET: 120000,
      TABLE: 80000,
      OTHER: 60000,
    };
    const rawPrice =
      priceBook.items?.[code] !== undefined
        ? priceBook.items[code]
        : defaultBasePrices[code] || 60000;
    const baseUnitVnd = asVnd(rawPrice, `priceBook.items.${code}`);
    const material = item.material || 'STANDARD';
    const factor = MATERIAL_FACTORS[material]?.priceFactor || 1;

    const unitPriceVnd = bySize
      ? asVnd(priceBook.sizePrices?.[code]?.[item.sizeCode], 'sizePrice')
      : Math.round(baseUnitVnd * factor);
    const amountVnd = quantity * unitPriceVnd;
    const itemMinVnd = amountVnd;
    const itemMaxVnd = Math.round(amountVnd * 1.3);
    lineItems.push({
      code,
      label: bySize
        ? `${item.displayName || code} — ${ITEM_SIZES[code][item.sizeCode]}`
        : item.displayName || code,
      ...(bySize ? { sizeCode: item.sizeCode } : {}),
      ...(!bySize ? { material, itemMinVnd, itemMaxVnd } : {}),
      quantity,
      unitPriceVnd,
      amountVnd,
    });
    subtotalVnd += amountVnd;
  }
  const add = (code, label, amount) => {
    const amountVnd = asVnd(amount || 0, code);
    if (amountVnd) lineItems.push({ code, label, quantity: 1, unitPriceVnd: amountVnd, amountVnd });
    subtotalVnd += amountVnd;
  };
  const floor = asVnd(handlingConditions.floorNumber || 0, 'floorNumber');
  if (bySize) {
    if (handlingConditions.placement === 'UPPER_FLOOR' && !floor)
      throw new BulkyServiceError('VALIDATION', 'Vui lòng nhập tầng lầu');
    if (
      floor > 0 &&
      !handlingConditions.hasLift &&
      !['CURBSIDE', 'GROUND_FLOOR'].includes(handlingConditions.placement)
    )
      add('FLOOR_FEE', `Bốc xếp thang bộ (${floor} tầng)`, priceBook.floorFee * floor);
  } else if (floor > 0) add('FLOOR_FEE', 'Floor handling', priceBook.floorFee);
  if (handlingConditions.requiresDisassembly)
    add('DISASSEMBLY', 'Disassembly', priceBook.disassemblyFee);
  if (handlingConditions.vehicleClass)
    add('VEHICLE_FEE', 'Vehicle class', priceBook.vehicleFees?.[handlingConditions.vehicleClass]);
  const areaCode = typeof serviceArea === 'string' ? serviceArea : serviceArea.code;
  if (bySize && priceBook.serviceAreaFees?.[areaCode] === undefined)
    throw new BulkyServiceError('MANUAL_REVIEW', 'Cần nhân viên báo giá khu vực này.');
  add('SERVICE_AREA_FEE', 'Service area', priceBook.serviceAreaFees?.[areaCode]);
  const discountVnd = asVnd(priceBook.discountVnd || 0, 'discountVnd');
  const taxVnd = asVnd(priceBook.taxVnd || 0, 'taxVnd');
  if (discountVnd)
    lineItems.push({
      code: 'DISCOUNT',
      label: 'Discount',
      quantity: 1,
      unitPriceVnd: -discountVnd,
      amountVnd: -discountVnd,
    });
  if (taxVnd)
    lineItems.push({
      code: 'TAX',
      label: 'Tax',
      quantity: 1,
      unitPriceVnd: taxVnd,
      amountVnd: taxVnd,
    });
  const createdAt = now;
  const expiresAt = new Date(new Date(now).getTime() + quoteTtlMinutes * 60000).toISOString();
  const totalVnd = subtotalVnd - discountVnd + taxVnd;
  asVnd(totalVnd, 'totalVnd');
  const minVnd = totalVnd;
  const maxVnd = Math.round(minVnd * 1.3);
  const estimatedRange = {
    minVnd,
    maxVnd,
    depositHoldVnd: minVnd,
  };
  const tolerancePolicy = {
    allowedPercent: 15,
    message:
      'Miễn phí phụ thu nếu khối lượng hoặc kích thước thực tế sai lệch không quá ±15% so với khai báo.',
  };
  return {
    quoteId: `quote-${new Date(now).getTime()}`,
    priceBookVersion: priceBook.version,
    confirmedInputHash: stable({ confirmedItems, handlingConditions, serviceArea }),
    serviceWindow,
    lineItems,
    subtotalVnd,
    discountVnd,
    taxVnd,
    totalVnd,
    ...(bySize
      ? {
          pricingBasis: 'ITEM_SIZE',
          priceChangeNotice: PRICE_CHANGE_NOTICE,
          isDemo: priceBook.isDemo === true,
        }
      : { estimatedRange, tolerancePolicy }),
    currency: 'VND',
    scope: priceBook.scope || [],
    exclusions: priceBook.exclusions || [],
    cancellationPolicyVersion: priceBook.cancellationPolicyVersion || 'v1',
    status: 'ACTIVE',
    expiresAt,
    createdAt,
  };
}

export const isQuoteExpired = (quote, now) =>
  new Date(now).getTime() >= new Date(quote.expiresAt).getTime();
