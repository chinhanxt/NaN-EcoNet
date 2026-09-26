import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bulky_item.dart';
import 'package:bulky_mobile/core/domain/models/bulky_order.dart';
import 'package:bulky_mobile/core/domain/pricing/pricing_engine.dart';
import 'package:bulky_mobile/core/services/storage/mock_bulky_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockBulkyStorage storage;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    storage = MockBulkyStorage();
  });

  group('MockBulkyStorage', () {
    test('1. seedInitialOrdersIfEmpty populates realistic Vietnamese orders when empty', () async {
      final initialOrders = await storage.getOrders();
      expect(initialOrders, isEmpty);

      await storage.seedInitialOrdersIfEmpty();

      final orders = await storage.getOrders();
      expect(orders.length, 3);

      // Order 1: CONFIRMED awaiting dispatch
      final confirmedOrder = orders.firstWhere(
        (o) => o.status == BulkyOrderStatus.CONFIRMED,
      );
      expect(confirmedOrder.paymentStatus, BulkyPaymentStatus.DEPOSIT_HELD);
      expect(confirmedOrder.address, contains('Hồ Chí Minh'));

      // Order 2: SCHEDULED with deposit held
      final scheduledOrder = orders.firstWhere(
        (o) => o.status == BulkyOrderStatus.SCHEDULED,
      );
      expect(scheduledOrder.paymentStatus, BulkyPaymentStatus.DEPOSIT_HELD);
      expect(scheduledOrder.vehiclePlate, isNotNull);
      expect(scheduledOrder.address, contains('Hồ Chí Minh'));
      expect(scheduledOrder.items.isNotEmpty, isTrue);
      expect(scheduledOrder.quote.minVnd, greaterThan(0));

      // Order 3: COMPLETED
      final completedOrder = orders.firstWhere(
        (o) => o.status == BulkyOrderStatus.COMPLETED,
      );
      expect(completedOrder.paymentStatus, BulkyPaymentStatus.PAID);
      expect(completedOrder.address, contains('Hồ Chí Minh'));
      expect(completedOrder.items.isNotEmpty, isTrue);

      // Calling seed again should NOT duplicate orders
      await storage.seedInitialOrdersIfEmpty();
      final reloadedOrders = await storage.getOrders();
      expect(reloadedOrders.length, 3);
    });

    test('2. saveOrder saves and updates orders in storage', () async {
      final item = const BulkyItem(
        id: 'item-test-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa góc nỉ',
        quantity: 1,
        material: MaterialType.STANDARD,
      );

      final quote = PricingEngine.calculateQuote(items: [item]);

      final order = BulkyOrder(
        id: 'order-test-101',
        items: [item],
        quote: quote,
        address: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        pickupDate: '2026-09-28',
        status: BulkyOrderStatus.AWAITING_PAYMENT,
        paymentStatus: BulkyPaymentStatus.UNPAID,
        createdAt: DateTime(2026, 9, 24, 10, 0),
        contactName: 'Phạm Minh Tuấn',
        contactPhone: '0988776655',
      );

      await storage.saveOrder(order);

      final fetchedOrders = await storage.getOrders();
      expect(fetchedOrders.length, 1);
      expect(fetchedOrders.first.id, 'order-test-101');
      expect(fetchedOrders.first.contactName, 'Phạm Minh Tuấn');

      // Update the existing order
      final updatedOrder = order.copyWith(
        contactName: 'Phạm Minh Tuấn (VIP)',
        address: '74 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      );
      await storage.saveOrder(updatedOrder);

      final afterUpdate = await storage.getOrders();
      expect(afterUpdate.length, 1);
      expect(afterUpdate.first.contactName, 'Phạm Minh Tuấn (VIP)');
      expect(afterUpdate.first.address, contains('74 Lê Thánh Tôn'));
    });

    test('3. getOrderById retrieves specific order or null if not found', () async {
      await storage.seedInitialOrdersIfEmpty();
      final allOrders = await storage.getOrders();
      final targetId = allOrders.first.id;

      final found = await storage.getOrderById(targetId);
      expect(found, isNotNull);
      expect(found!.id, targetId);

      final notFound = await storage.getOrderById('non-existent-order-id');
      expect(notFound, isNull);
    });

    test('4. updateOrderStatus updates status, paymentStatus and persists changes', () async {
      final item = const BulkyItem(
        id: 'item-test-2',
        category: BulkyCategory.MATTRESS,
        displayName: 'Đệm cao su Kymdan',
        quantity: 1,
        material: MaterialType.STANDARD,
      );
      final quote = PricingEngine.calculateQuote(items: [item]);

      final order = BulkyOrder(
        id: 'order-status-test',
        items: [item],
        quote: quote,
        address: '10 Hai Bà Trưng, Quận 1',
        pickupDate: '2026-09-27',
        status: BulkyOrderStatus.AWAITING_PAYMENT,
        paymentStatus: BulkyPaymentStatus.UNPAID,
        createdAt: DateTime(2026, 9, 24, 14, 0),
      );

      await storage.saveOrder(order);

      // Transition to CONFIRMED with DEPOSIT_HELD
      await storage.updateOrderStatus(
        'order-status-test',
        BulkyOrderStatus.CONFIRMED,
        paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
      );

      final fetched = await storage.getOrderById('order-status-test');
      expect(fetched, isNotNull);
      expect(fetched!.status, BulkyOrderStatus.CONFIRMED);
      expect(fetched.paymentStatus, BulkyPaymentStatus.DEPOSIT_HELD);
      expect(fetched.depositPaidAt, isNotNull);
    });

    test('5. approveWithFinalPrice updates finalizedPriceVnd, operatorNote, and status to APPROVED_AWAITING_PAYMENT', () async {
      final item = const BulkyItem(
        id: 'item-review-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa góc lớn',
      );
      final quote = PricingEngine.calculateQuote(items: [item]);
      final order = BulkyOrder(
        id: 'order-approve-test',
        items: [item],
        quote: quote,
        address: '15 Lê Duẩn, Quận 1',
        pickupDate: '2026-10-02',
        status: BulkyOrderStatus.PENDING_REVIEW,
        paymentStatus: BulkyPaymentStatus.UNPAID,
        createdAt: DateTime(2026, 9, 25, 8, 0),
      );

      await storage.saveOrder(order);

      final updated = await storage.approveWithFinalPrice(
        'order-approve-test',
        250000,
        operatorNote: 'Đã duyệt giá trọn gói 250.000đ sau khi kiểm tra hình ảnh',
      );

      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.APPROVED_AWAITING_PAYMENT);
      expect(updated.finalizedPriceVnd, 250000);
      expect(updated.operatorNote, 'Đã duyệt giá trọn gói 250.000đ sau khi kiểm tra hình ảnh');

      // Verify persisted in storage
      final stored = await storage.getOrderById('order-approve-test');
      expect(stored!.status, BulkyOrderStatus.APPROVED_AWAITING_PAYMENT);
      expect(stored.finalizedPriceVnd, 250000);
      expect(stored.operatorNote, contains('Đã duyệt giá trọn gói'));
    });

    test('6. rejectOrderWithReason updates operatorNote, status to REJECTED, and refunds deposit if held', () async {
      final item = const BulkyItem(
        id: 'item-reject-1',
        category: BulkyCategory.OTHER,
        displayName: 'Thùng sơn cũ và hóa chất',
      );
      final quote = PricingEngine.calculateQuote(items: [item]);
      final orderWithDeposit = BulkyOrder(
        id: 'order-reject-deposit',
        items: [item],
        quote: quote,
        address: '20 Võ Văn Tần, Quận 3',
        pickupDate: '2026-10-03',
        status: BulkyOrderStatus.CONFIRMED,
        paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
        createdAt: DateTime(2026, 9, 25, 9, 0),
      );

      await storage.saveOrder(orderWithDeposit);

      final updated = await storage.rejectOrderWithReason(
        'order-reject-deposit',
        'Phát hiện chất thải nguy hại không nằm trong danh mục thu gom',
      );

      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.REJECTED);
      expect(updated.operatorNote, contains('chất thải nguy hại'));
      expect(updated.paymentStatus, BulkyPaymentStatus.REFUNDED);

      final stored = await storage.getOrderById('order-reject-deposit');
      expect(stored!.status, BulkyOrderStatus.REJECTED);
      expect(stored.paymentStatus, BulkyPaymentStatus.REFUNDED);

      // Also test order without deposit (UNPAID)
      final unpaidOrder = BulkyOrder(
        id: 'order-reject-unpaid',
        items: [item],
        quote: quote,
        address: '22 Võ Văn Tần, Quận 3',
        pickupDate: '2026-10-03',
        status: BulkyOrderStatus.PENDING_REVIEW,
        paymentStatus: BulkyPaymentStatus.UNPAID,
        createdAt: DateTime(2026, 9, 25, 9, 30),
      );
      await storage.saveOrder(unpaidOrder);

      final updatedUnpaid = await storage.rejectOrderWithReason(
        'order-reject-unpaid',
        'Hình ảnh mờ, không xác định được kích thước',
      );
      expect(updatedUnpaid!.status, BulkyOrderStatus.REJECTED);
      expect(updatedUnpaid.paymentStatus, BulkyPaymentStatus.UNPAID);
    });

    test('7. reportOnSiteDiscrepancy updates onSiteAdjustedPriceVnd, onSiteDiscrepancyNote, and status to DISCREPANCY_PENDING', () async {
      final item = const BulkyItem(
        id: 'item-disc-1',
        category: BulkyCategory.CABINET,
        displayName: 'Tủ gỗ',
      );
      final quote = PricingEngine.calculateQuote(items: [item]);
      final order = BulkyOrder(
        id: 'order-disc-test',
        items: [item],
        quote: quote,
        address: '40 Hai Bà Trưng, Quận 1',
        pickupDate: '2026-10-04',
        status: BulkyOrderStatus.IN_PROGRESS,
        paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
        finalizedPriceVnd: 150000,
        createdAt: DateTime(2026, 9, 25, 10, 0),
      );

      await storage.saveOrder(order);

      final updated = await storage.reportOnSiteDiscrepancy(
        'order-disc-test',
        220000,
        'Thực tế có thêm 01 tủ sắt phụ, cần xe tải thu gom hỗ trợ',
      );

      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.DISCREPANCY_PENDING);
      expect(updated.onSiteAdjustedPriceVnd, 220000);
      expect(updated.onSiteDiscrepancyNote, contains('tủ sắt phụ'));

      final stored = await storage.getOrderById('order-disc-test');
      expect(stored!.status, BulkyOrderStatus.DISCREPANCY_PENDING);
      expect(stored.onSiteAdjustedPriceVnd, 220000);
      expect(stored.onSiteDiscrepancyNote, contains('tủ sắt phụ'));
    });

    test('8. respondToOnSiteDiscrepancy handles accept true (updates finalizedPrice) and accept false (clears discrepancy note)', () async {
      final item = const BulkyItem(
        id: 'item-disc-2',
        category: BulkyCategory.TABLE,
        displayName: 'Bàn họp đá',
      );
      final quote = PricingEngine.calculateQuote(items: [item]);
      final baseOrder = BulkyOrder(
        id: 'order-respond-accept',
        items: [item],
        quote: quote,
        address: '50 Nam Kỳ Khởi Nghĩa, Quận 1',
        pickupDate: '2026-10-04',
        status: BulkyOrderStatus.DISCREPANCY_PENDING,
        paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
        finalizedPriceVnd: 180000,
        onSiteAdjustedPriceVnd: 260000,
        onSiteDiscrepancyNote: 'Khối lượng vượt 40%',
        createdAt: DateTime(2026, 9, 25, 11, 0),
      );

      await storage.saveOrder(baseOrder);

      // Case A: accept = true
      final accepted = await storage.respondToOnSiteDiscrepancy(
        'order-respond-accept',
        accept: true,
      );
      expect(accepted, isNotNull);
      expect(accepted!.status, BulkyOrderStatus.IN_PROGRESS);
      expect(accepted.finalizedPriceVnd, 260000);

      // Case B: accept = false
      final rejectDiscOrder = baseOrder.copyWith(id: 'order-respond-reject');
      await storage.saveOrder(rejectDiscOrder);

      final rejected = await storage.respondToOnSiteDiscrepancy(
        'order-respond-reject',
        accept: false,
      );
      expect(rejected, isNotNull);
      expect(rejected!.status, BulkyOrderStatus.IN_PROGRESS);
      expect(rejected.finalizedPriceVnd, 180000); // Retains original finalized price
      expect(rejected.onSiteDiscrepancyNote, isNull); // Discrepancy note is cleared
    });

    test('9. rejectOnSiteSafetyViolation sets REJECTED_ON_SITE, rejection reason, calloutFee, and refunds deposit', () async {
      final item = const BulkyItem(
        id: 'item-danger',
        category: BulkyCategory.OTHER,
        displayName: 'Vật liệu dễ cháy nổ',
      );
      final quote = PricingEngine.calculateQuote(items: [item]);
      final order = BulkyOrder(
        id: 'order-danger-test',
        items: [item],
        quote: quote,
        address: '99 Pasteur, Quận 3',
        pickupDate: '2026-10-05',
        status: BulkyOrderStatus.IN_PROGRESS,
        paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
        createdAt: DateTime(2026, 9, 25, 12, 0),
      );

      await storage.saveOrder(order);

      final updated = await storage.rejectOnSiteSafetyViolation(
        'order-danger-test',
        'Phát hiện bình gas mini lẫn trong rác, nguy cơ cháy nổ cao',
        calloutFee: 60000,
      );

      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.REJECTED_ON_SITE);
      expect(updated.paymentStatus, BulkyPaymentStatus.REFUNDED);
      expect(updated.onSiteRejectionReason, contains('bình gas mini'));
      expect(updated.calloutFeeVnd, 60000);

      final stored = await storage.getOrderById('order-danger-test');
      expect(stored!.status, BulkyOrderStatus.REJECTED_ON_SITE);
      expect(stored.paymentStatus, BulkyPaymentStatus.REFUNDED);
      expect(stored.onSiteRejectionReason, contains('bình gas mini'));
      expect(stored.calloutFeeVnd, 60000);
    });
  });
}
