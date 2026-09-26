import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../constants/bulky_constants.dart';
import '../../domain/models/bulky_item.dart';
import '../../domain/models/bulky_order.dart';
import '../../domain/pricing/pricing_engine.dart';

/// Local mock storage service for Smartbin Bulky Waste orders.
/// Persists order records in [SharedPreferences] as serialized JSON.
class MockBulkyStorage {
  static const String storageKey = 'smartbin_bulky_orders';

  SharedPreferences? preferences;

  MockBulkyStorage({this.preferences});

  Future<SharedPreferences> get _prefs async =>
      preferences ??= await SharedPreferences.getInstance();

  /// Retrieves all persisted bulky waste orders, ordered by creation date descending.
  Future<List<BulkyOrder>> getOrders() async {
    final prefs = await _prefs;
    final jsonString = prefs.getString(storageKey);
    if (jsonString == null || jsonString.trim().isEmpty) {
      return [];
    }

    try {
      final List<dynamic> decoded = jsonDecode(jsonString) as List<dynamic>;
      final orders = decoded
          .map((item) => BulkyOrder.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
      orders.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return orders;
    } catch (_) {
      return [];
    }
  }

  /// Retrieves a specific bulky order by ID.
  Future<BulkyOrder?> getOrderById(String orderId) async {
    final orders = await getOrders();
    for (final order in orders) {
      if (order.id == orderId) {
        return order;
      }
    }
    return null;
  }

  /// Saves or updates a bulky order in local storage.
  Future<void> saveOrder(BulkyOrder order) async {
    final orders = await getOrders();
    final index = orders.indexWhere((o) => o.id == order.id);

    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.insert(0, order);
    }

    await _persistOrders(orders);
  }

  /// Updates the order status and optionally payment status or assigned vehicle of a given order.
  Future<void> updateOrderStatus(
    String orderId,
    BulkyOrderStatus status, {
    BulkyPaymentStatus? paymentStatus,
    String? vehiclePlate,
  }) async {
    final orders = await getOrders();
    final index = orders.indexWhere((o) => o.id == orderId);
    if (index == -1) return;

    final existing = orders[index];
    final newPaymentStatus = paymentStatus ??
        ((status == BulkyOrderStatus.CONFIRMED || status == BulkyOrderStatus.SCHEDULED || status == BulkyOrderStatus.ASSIGNED) &&
                existing.paymentStatus == BulkyPaymentStatus.UNPAID
            ? BulkyPaymentStatus.DEPOSIT_HELD
            : (status == BulkyOrderStatus.COMPLETED
                ? BulkyPaymentStatus.PAID
                : existing.paymentStatus));

    final updated = existing.copyWith(
      status: status,
      paymentStatus: newPaymentStatus,
      vehiclePlate: vehiclePlate ?? existing.vehiclePlate,
      depositPaidAt: newPaymentStatus == BulkyPaymentStatus.DEPOSIT_HELD && existing.depositPaidAt == null
          ? DateTime.now()
          : existing.depositPaidAt,
    );

    orders[index] = updated;
    await _persistOrders(orders);
  }

  /// [Operator Action] Approves order with a finalized price, optional note,
  /// and transitions status to [BulkyOrderStatus.APPROVED_AWAITING_PAYMENT].
  Future<BulkyOrder?> approveWithFinalPrice(
    String orderId,
    int finalizedPriceVnd, {
    String? operatorNote,
  }) async {
    final orders = await getOrders();
    final index = orders.indexWhere((o) => o.id == orderId);
    if (index == -1) return null;

    final existing = orders[index];
    final updated = existing.copyWith(
      status: BulkyOrderStatus.APPROVED_AWAITING_PAYMENT,
      finalizedPriceVnd: finalizedPriceVnd,
      operatorNote: operatorNote ?? existing.operatorNote,
    );

    orders[index] = updated;
    await _persistOrders(orders);
    return updated;
  }

  /// [Operator Action] Rejects an order with a reason and marks as REJECTED.
  /// If deposit was held, payment status is updated to [BulkyPaymentStatus.REFUNDED].
  Future<BulkyOrder?> rejectOrderWithReason(
    String orderId,
    String reason,
  ) async {
    final orders = await getOrders();
    final index = orders.indexWhere((o) => o.id == orderId);
    if (index == -1) return null;

    final existing = orders[index];
    final newPaymentStatus = existing.paymentStatus == BulkyPaymentStatus.DEPOSIT_HELD
        ? BulkyPaymentStatus.REFUNDED
        : existing.paymentStatus;

    final updated = existing.copyWith(
      status: BulkyOrderStatus.REJECTED,
      paymentStatus: newPaymentStatus,
      operatorNote: reason,
    );

    orders[index] = updated;
    await _persistOrders(orders);
    return updated;
  }

  /// [Driver Action] Reports an on-site discrepancy (e.g. additional volume or items).
  /// Updates on-site adjusted price and discrepancy note, setting status to [BulkyOrderStatus.DISCREPANCY_PENDING].
  Future<BulkyOrder?> reportOnSiteDiscrepancy(
    String orderId,
    int adjustedPriceVnd,
    String note,
  ) async {
    final orders = await getOrders();
    final index = orders.indexWhere((o) => o.id == orderId);
    if (index == -1) return null;

    final existing = orders[index];
    final updated = existing.copyWith(
      status: BulkyOrderStatus.DISCREPANCY_PENDING,
      onSiteAdjustedPriceVnd: adjustedPriceVnd,
      onSiteDiscrepancyNote: note,
    );

    orders[index] = updated;
    await _persistOrders(orders);
    return updated;
  }

  /// [Customer / Operator Action] Responds to on-site discrepancy report.
  /// If accept is true: sets finalizedPriceVnd to onSiteAdjustedPriceVnd and returns status to IN_PROGRESS.
  /// If accept is false: keeps original finalizedPriceVnd, clears discrepancy note, and returns status to IN_PROGRESS.
  Future<BulkyOrder?> respondToOnSiteDiscrepancy(
    String orderId, {
    required bool accept,
  }) async {
    final orders = await getOrders();
    final index = orders.indexWhere((o) => o.id == orderId);
    if (index == -1) return null;

    final existing = orders[index];
    final BulkyOrder updated;
    if (accept) {
      updated = existing.copyWith(
        status: BulkyOrderStatus.IN_PROGRESS,
        finalizedPriceVnd: existing.onSiteAdjustedPriceVnd ?? existing.finalizedPriceVnd,
      );
    } else {
      updated = BulkyOrder(
        id: existing.id,
        items: existing.items,
        quote: existing.quote,
        address: existing.address,
        pickupDate: existing.pickupDate,
        status: BulkyOrderStatus.IN_PROGRESS,
        paymentStatus: existing.paymentStatus,
        hasElevator: existing.hasElevator,
        floorNumber: existing.floorNumber,
        requiresDisassembly: existing.requiresDisassembly,
        vehiclePlate: existing.vehiclePlate,
        createdAt: existing.createdAt,
        depositPaidAt: existing.depositPaidAt,
        contactName: existing.contactName,
        contactPhone: existing.contactPhone,
        note: existing.note,
        imageUri: existing.imageUri,
        finalizedPriceVnd: existing.finalizedPriceVnd,
        operatorNote: existing.operatorNote,
        onSiteAdjustedPriceVnd: null,
        onSiteDiscrepancyNote: null,
        onSiteRejectionReason: existing.onSiteRejectionReason,
        calloutFeeVnd: existing.calloutFeeVnd,
      );
    }

    orders[index] = updated;
    await _persistOrders(orders);
    return updated;
  }

  /// [Driver Action] Rejects collection on-site due to safety violation (hazardous waste, structural danger, etc.).
  /// Updates on-site rejection reason, callout fee, sets status to [BulkyOrderStatus.REJECTED_ON_SITE],
  /// and sets payment status to [BulkyPaymentStatus.REFUNDED].
  Future<BulkyOrder?> rejectOnSiteSafetyViolation(
    String orderId,
    String reason, {
    int calloutFee = 50000,
  }) async {
    final orders = await getOrders();
    final index = orders.indexWhere((o) => o.id == orderId);
    if (index == -1) return null;

    final existing = orders[index];
    final updated = existing.copyWith(
      status: BulkyOrderStatus.REJECTED_ON_SITE,
      paymentStatus: BulkyPaymentStatus.REFUNDED,
      onSiteRejectionReason: reason,
      calloutFeeVnd: calloutFee,
    );

    orders[index] = updated;
    await _persistOrders(orders);
    return updated;
  }

  /// Seeds 2 realistic Vietnamese demonstration orders if storage is currently empty.
  Future<void> seedInitialOrdersIfEmpty() async {
    final existingOrders = await getOrders();
    if (existingOrders.isNotEmpty) {
      return;
    }

    // 1. Order 1: SCHEDULED with deposit held
    final itemsOrder1 = [
      const BulkyItem(
        id: 'seed-item-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa da góc chữ L',
        quantity: 1,
        lengthCm: 220,
        widthCm: 150,
        heightCm: 85,
        material: MaterialType.STANDARD,
        requiresDisassembly: true,
      ),
      const BulkyItem(
        id: 'seed-item-2',
        category: BulkyCategory.TABLE,
        displayName: 'Bàn trà mặt kính',
        quantity: 1,
        lengthCm: 100,
        widthCm: 60,
        heightCm: 45,
        material: MaterialType.LIGHT,
      ),
    ];

    final quoteOrder1 = PricingEngine.calculateQuote(
      items: itemsOrder1,
      requiresDisassembly: true,
      floorNumber: 2,
      hasElevator: true,
      now: DateTime(2026, 9, 23, 14, 30),
    );

    final scheduledOrder = BulkyOrder(
      id: 'order-demo-scheduled',
      items: itemsOrder1,
      quote: quoteOrder1,
      address: '123 Nguyễn Thị Minh Khai, Phường 6, Quận 3, TP. Hồ Chí Minh',
      pickupDate: '2026-09-26',
      status: BulkyOrderStatus.SCHEDULED,
      paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
      hasElevator: true,
      floorNumber: 2,
      requiresDisassembly: true,
      vehiclePlate: '51C-889.21',
      createdAt: DateTime(2026, 9, 23, 14, 30),
      depositPaidAt: DateTime(2026, 9, 23, 14, 45),
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901234567',
      note: 'Hẻm xe tải 2.5 tấn vào được, vui lòng gọi trước 15 phút.',
    );

    // 2. Order 2: COMPLETED
    final itemsOrder2 = [
      const BulkyItem(
        id: 'seed-item-3',
        category: BulkyCategory.MATTRESS,
        displayName: 'Đệm lò xo cũ 1m8',
        quantity: 1,
        lengthCm: 200,
        widthCm: 180,
        heightCm: 25,
        material: MaterialType.STANDARD,
      ),
      const BulkyItem(
        id: 'seed-item-4',
        category: BulkyCategory.CABINET,
        displayName: 'Tủ quần áo gỗ ép 3 cánh',
        quantity: 1,
        lengthCm: 180,
        widthCm: 120,
        heightCm: 60,
        material: MaterialType.STANDARD,
      ),
    ];

    final quoteOrder2 = PricingEngine.calculateQuote(
      items: itemsOrder2,
      requiresDisassembly: false,
      floorNumber: 0,
      hasElevator: false,
      now: DateTime(2026, 9, 19, 9, 15),
    );

    final completedOrder = BulkyOrder(
      id: 'order-demo-completed',
      items: itemsOrder2,
      quote: quoteOrder2,
      address: '45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      pickupDate: '2026-09-20',
      status: BulkyOrderStatus.COMPLETED,
      paymentStatus: BulkyPaymentStatus.PAID,
      hasElevator: false,
      floorNumber: 0,
      requiresDisassembly: false,
      vehiclePlate: '51D-432.10',
      createdAt: DateTime(2026, 9, 19, 9, 15),
      depositPaidAt: DateTime(2026, 9, 19, 9, 25),
      contactName: 'Trần Thị Mai',
      contactPhone: '0918765432',
      note: 'Đã tập kết sẵn ở sân tầng trệt.',
    );

    // 3. Order 3: CONFIRMED (Awaiting dispatch & vehicle assignment)
    final itemsOrder3 = [
      const BulkyItem(
        id: 'seed-item-5',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa góc phòng khách',
        quantity: 1,
        lengthCm: 200,
        widthCm: 90,
        heightCm: 80,
        material: MaterialType.STANDARD,
      ),
      const BulkyItem(
        id: 'seed-item-6',
        category: BulkyCategory.CABINET,
        displayName: 'Tủ giày dép gỗ MDF',
        quantity: 1,
        lengthCm: 100,
        widthCm: 40,
        heightCm: 110,
        material: MaterialType.STANDARD,
      ),
    ];

    final quoteOrder3 = PricingEngine.calculateQuote(
      items: itemsOrder3,
      requiresDisassembly: false,
      floorNumber: 1,
      hasElevator: true,
      now: DateTime(2026, 9, 24, 10, 0),
    );

    final confirmedOrder = BulkyOrder(
      id: 'order-demo-confirmed',
      items: itemsOrder3,
      quote: quoteOrder3,
      address: '72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      pickupDate: '2026-09-27',
      status: BulkyOrderStatus.CONFIRMED,
      paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
      hasElevator: true,
      floorNumber: 1,
      requiresDisassembly: false,
      createdAt: DateTime(2026, 9, 24, 10, 0),
      depositPaidAt: DateTime(2026, 9, 24, 10, 15),
      contactName: 'Lê Hoàng Nam',
      contactPhone: '0938.999.888',
      note: 'Đã thanh toán cọc giữ chỗ 150.000đ, sẵn sàng đón xe thu gom.',
    );

    await _persistOrders([confirmedOrder, scheduledOrder, completedOrder]);
  }

  /// Clears all stored orders (useful for testing and reset).
  Future<void> clear() async {
    final prefs = await _prefs;
    await prefs.remove(storageKey);
  }

  Future<void> _persistOrders(List<BulkyOrder> orders) async {
    final prefs = await _prefs;
    final encoded = jsonEncode(orders.map((o) => o.toJson()).toList());
    await prefs.setString(storageKey, encoded);
  }
}
