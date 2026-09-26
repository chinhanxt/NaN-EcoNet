import 'package:flutter_test/flutter_test.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bulky_order.dart';
import 'package:bulky_mobile/core/domain/models/bulky_quote.dart';

BulkyQuote _createDummyQuote() {
  final now = DateTime.now();
  return BulkyQuote(
    quoteId: 'quote-test-123',
    itemsBreakdown: const [],
    subtotalMinVnd: 200000,
    subtotalMaxVnd: 250000,
    depositHoldVnd: 100000,
    minVnd: 220000,
    maxVnd: 270000,
    tolerancePolicy: const TolerancePolicy(allowedMaxVnd: 310500),
    createdAt: now,
    expiresAt: now.add(const Duration(minutes: 30)),
  );
}

void main() {
  group('BulkyOrderStatus & BulkyOrder Model Extensions', () {
    test('contains new workflow statuses with Vietnamese labels', () {
      expect(BulkyOrderStatus.PENDING_REVIEW.displayName, 'Chờ điều phối viên duyệt giá');
      expect(BulkyOrderStatus.APPROVED_AWAITING_PAYMENT.displayName, 'Đã duyệt giá • Chờ đặt cọc');
      expect(BulkyOrderStatus.DISCREPANCY_PENDING.displayName, 'Chờ duyệt phát sinh tại chỗ');
      expect(BulkyOrderStatus.REJECTED_ON_SITE.displayName, 'Từ chối tại hiện trường');
      expect(BulkyOrderStatus.REJECTED.displayName, 'Đã từ chối');
    });

    test('BulkyOrder serializes and deserializes new workflow fields', () {
      final now = DateTime.now();
      final order = BulkyOrder(
        id: 'order-workflow-test',
        items: const [],
        quote: _createDummyQuote(),
        address: '123 Test St',
        pickupDate: '2026-09-30',
        status: BulkyOrderStatus.APPROVED_AWAITING_PAYMENT,
        createdAt: now,
        finalizedPriceVnd: 250000,
        operatorNote: 'Đã xác nhận bàn gỗ ép',
        onSiteAdjustedPriceVnd: 350000,
        onSiteDiscrepancyNote: 'Phát sinh thêm nệm',
        onSiteRejectionReason: 'Bình gas rác cấm',
        calloutFeeVnd: 50000,
      );

      final json = order.toJson();
      final restored = BulkyOrder.fromJson(json);

      expect(restored.status, BulkyOrderStatus.APPROVED_AWAITING_PAYMENT);
      expect(restored.finalizedPriceVnd, 250000);
      expect(restored.operatorNote, 'Đã xác nhận bàn gỗ ép');
      expect(restored.onSiteAdjustedPriceVnd, 350000);
      expect(restored.onSiteDiscrepancyNote, 'Phát sinh thêm nệm');
      expect(restored.onSiteRejectionReason, 'Bình gas rác cấm');
      expect(restored.calloutFeeVnd, 50000);
    });

    test('BulkyOrder copyWith updates new workflow fields correctly', () {
      final now = DateTime.now();
      final initial = BulkyOrder(
        id: 'order-1',
        items: const [],
        quote: _createDummyQuote(),
        address: '456 Test Ave',
        pickupDate: '2026-10-01',
        createdAt: now,
      );

      final updated = initial.copyWith(
        status: BulkyOrderStatus.PENDING_REVIEW,
        finalizedPriceVnd: 110000,
        operatorNote: 'Ghi chú',
        onSiteAdjustedPriceVnd: 130000,
        onSiteDiscrepancyNote: 'Ghi chú phát sinh',
        onSiteRejectionReason: 'Lý do từ chối',
        calloutFeeVnd: 30000,
      );

      expect(updated.status, BulkyOrderStatus.PENDING_REVIEW);
      expect(updated.finalizedPriceVnd, 110000);
      expect(updated.operatorNote, 'Ghi chú');
      expect(updated.onSiteAdjustedPriceVnd, 130000);
      expect(updated.onSiteDiscrepancyNote, 'Ghi chú phát sinh');
      expect(updated.onSiteRejectionReason, 'Lý do từ chối');
      expect(updated.calloutFeeVnd, 30000);
    });
  });
}
