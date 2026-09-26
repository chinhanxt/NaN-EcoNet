import { describe, expect, it } from 'vitest';
import { calculateQuote } from './pricing.js';
import { DEFAULT_PRICE_BOOK } from '../services/mock/mockSeed.js';

const input = {
  confirmedItems: [
    {
      catalogItemCode: 'SOFA',
      sizeCode: 'LARGE',
      quantity: 2,
      material: 'HEAVY',
      estimatedWeightKg: 999,
    },
  ],
  handlingConditions: {
    placement: 'UPPER_FLOOR',
    floorNumber: 3,
    hasLift: false,
    requiresDisassembly: true,
  },
  serviceArea: 'D5',
  priceBook: DEFAULT_PRICE_BOOK,
  now: '2026-09-23T00:00:00Z',
};

describe('item and size pricing', () => {
  it('charges each item by its selected size and stair handling by floor, without inferred mass', () => {
    const quote = calculateQuote(input);
    expect(quote.totalVnd).toBe(615000); // 2 x 250000 + 3 x 20000 + 30000 + 25000
    expect(quote.pricingBasis).toBe('ITEM_SIZE');
    expect(quote.estimatedRange).toBeUndefined();
    expect(quote.tolerancePolicy).toBeUndefined();
    expect(quote.lineItems[0]).toMatchObject({ sizeCode: 'LARGE', unitPriceVnd: 250000 });
  });

  it.each([
    [{ placement: 'UPPER_FLOOR', floorNumber: 3, hasLift: true }, 525000],
    [{ placement: 'CURBSIDE', floorNumber: 3, hasLift: false }, 525000],
  ])(
    'does not bill stairs when items use a suitable lift or are already at the curb',
    (handlingConditions, total) => {
      expect(calculateQuote({ ...input, handlingConditions }).totalVnd).toBe(total);
    },
  );

  it.each([
    { catalogItemCode: 'OTHER', sizeCode: 'SMALL', quantity: 1 },
    { catalogItemCode: 'SOFA', sizeCode: 'OVERSIZE', quantity: 1 },
    { catalogItemCode: 'SOFA', quantity: 1 },
    { catalogItemCode: 'SOFA', sizeCode: 'SMALL', quantity: 1, oversize: true },
  ])('does not invent a price for an item needing staff review: %j', (item) => {
    expect(() => calculateQuote({ ...input, confirmedItems: [item] })).toThrow(/nhân viên/i);
  });

  it('rejects zero quantity and unsupported service areas', () => {
    expect(() =>
      calculateQuote({ ...input, confirmedItems: [{ ...input.confirmedItems[0], quantity: 0 }] }),
    ).toThrow();
    expect(() => calculateQuote({ ...input, serviceArea: 'UNKNOWN' })).toThrow();
  });
});
