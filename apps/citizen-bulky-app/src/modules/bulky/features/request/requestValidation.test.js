import { describe, it, expect } from 'vitest';
import {
  validateRequestLocation,
  validateRequestItems,
  validateHandlingConditions,
  validateCanProceedToQuote,
  validateStepLogistics,
} from './requestValidation.js';

describe('requestValidation', () => {
  describe('validateRequestLocation', () => {
    it('returns error when serviceLocationId or requestedDate is missing', () => {
      expect(validateRequestLocation({})).toHaveProperty('serviceLocationId');
      expect(validateRequestLocation({ serviceLocationId: 'loc-1' })).toHaveProperty(
        'requestedDate',
      );
    });

    it('passes when valid location and date provided', () => {
      const res = validateRequestLocation({
        serviceLocationId: 'loc-1',
        requestedDate: '2026-09-20',
      });
      expect(Object.keys(res)).toHaveLength(0);
    });
  });

  describe('validateRequestItems', () => {
    it('rejects empty items array', () => {
      expect(validateRequestItems([])).toHaveProperty('confirmedItems');
    });

    it('rejects unsupported item codes or invalid quantity', () => {
      const res = validateRequestItems([{ catalogItemCode: 'RADIOACTIVE_WASTE', quantity: 0 }]);
      expect(res.confirmedItems).toBeDefined();
    });

    it('passes valid confirmed items', () => {
      const res = validateRequestItems([
        {
          catalogItemCode: 'SOFA',
          quantity: 1,
          dimensionsCm: { length: 200, width: 90, height: 85 },
        },
      ]);
      expect(Object.keys(res)).toHaveLength(0);
    });
  });

  describe('validateHandlingConditions', () => {
    it('validates floor number and elevator flag', () => {
      const invalid = validateHandlingConditions({ floorNumber: -1, hasLift: 'yes' });
      expect(invalid.floorNumber).toBeDefined();

      const valid = validateHandlingConditions({
        floorNumber: 2,
        hasLift: true,
        requiresDisassembly: false,
      });
      expect(Object.keys(valid)).toHaveLength(0);
    });
  });

  describe('validateCanProceedToQuote', () => {
    it('blocks quote when AI requires manual review or unsupported items are present', () => {
      const blockManual = validateCanProceedToQuote({
        confirmedItems: [{ catalogItemCode: 'SOFA', quantity: 1 }],
        aiResult: { requiresManualReview: true },
      });
      expect(blockManual.allowed).toBe(false);
      expect(blockManual.reason).toContain('review');

      const blockEmpty = validateCanProceedToQuote({
        confirmedItems: [],
        aiResult: { requiresManualReview: false },
      });
      expect(blockEmpty.allowed).toBe(false);
    });

    it('allows quote when items are valid and confirmed without manual review lock', () => {
      const allowed = validateCanProceedToQuote({
        confirmedItems: [{ catalogItemCode: 'SOFA', quantity: 1 }],
        aiResult: { requiresManualReview: false },
      });
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('validateStepLogistics', () => {
    it('combines location and handling condition validations', () => {
      const invalid = validateStepLogistics({
        serviceLocationId: '',
        requestedDate: '',
        handlingConditions: { floorNumber: -1 },
      });
      expect(invalid.serviceLocationId).toBeDefined();
      expect(invalid.requestedDate).toBeDefined();
      expect(invalid.floorNumber).toBeDefined();

      const valid = validateStepLogistics({
        serviceLocationId: 'loc-1',
        requestedDate: '2026-09-20',
        handlingConditions: { floorNumber: 2, hasLift: true },
      });
      expect(Object.keys(valid)).toHaveLength(0);
    });
  });
});
