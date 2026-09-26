import 'package:flutter/foundation.dart';
import '../../../core/constants/bulky_constants.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/services/storage/mock_bulky_storage.dart';
import '../../request_wizard/providers/booking_wizard_provider.dart';

/// Provider for managing customer bulky waste orders and coordinating with [MockBulkyStorage].
class OrdersProvider extends ChangeNotifier {
  final MockBulkyStorage _storage;

  List<BulkyOrder> _orders = [];
  bool _isLoading = false;
  String? _errorMessage;

  OrdersProvider({MockBulkyStorage? storage})
      : _storage = storage ?? MockBulkyStorage();

  List<BulkyOrder> get orders => List.unmodifiable(_orders);
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Orders awaiting payment, scheduled, or currently in progress.
  List<BulkyOrder> get activeOrders => _orders
      .where((o) =>
          o.status != BulkyOrderStatus.COMPLETED &&
          o.status != BulkyOrderStatus.CANCELLED &&
          o.status != BulkyOrderStatus.REJECTED &&
          o.status != BulkyOrderStatus.REJECTED_ON_SITE)
      .toList();

  /// Orders that have been completed.
  List<BulkyOrder> get completedOrders =>
      _orders.where((o) => o.status == BulkyOrderStatus.COMPLETED).toList();

  /// Orders submitted by citizens awaiting operator price approval.
  List<BulkyOrder> get pendingReviewOrders => _orders
      .where((o) => o.status == BulkyOrderStatus.PENDING_REVIEW)
      .toList();

  /// Orders with on-site discrepancy awaiting customer or operator resolution.
  List<BulkyOrder> get discrepancyPendingOrders => _orders
      .where((o) => o.status == BulkyOrderStatus.DISCREPANCY_PENDING)
      .toList();

  /// Loads orders from local storage, seeding initial realistic records if empty.
  Future<void> loadOrders() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _storage.seedInitialOrdersIfEmpty();
      _orders = await _storage.getOrders();
    } catch (e) {
      _errorMessage = 'Không thể tải danh sách đơn hàng: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Finds an order by its ID from memory.
  BulkyOrder? getOrderById(String orderId) {
    try {
      return _orders.firstWhere((o) => o.id == orderId);
    } catch (_) {
      return null;
    }
  }

  /// Creates a new order directly from the current [BookingWizardProvider] form state.
  Future<BulkyOrder> createOrderFromWizard(BookingWizardProvider wizard) async {
    final quote = wizard.currentQuote;
    if (quote == null) {
      throw StateError('Không thể tạo đơn hàng khi chưa có báo giá chi tiết.');
    }

    final newOrderId = 'order-${DateTime.now().millisecondsSinceEpoch}';

    final order = BulkyOrder(
      id: newOrderId,
      items: List.from(wizard.items),
      quote: quote,
      address: wizard.address,
      pickupDate: wizard.scheduledDate,
      status: BulkyOrderStatus.AWAITING_PAYMENT,
      paymentStatus: BulkyPaymentStatus.UNPAID,
      hasElevator: wizard.hasElevator,
      floorNumber: wizard.floorNumber,
      requiresDisassembly: wizard.requiresDisassembly,
      createdAt: DateTime.now(),
      contactName: wizard.contactName.trim().isNotEmpty
          ? wizard.contactName.trim()
          : null,
      contactPhone: wizard.contactPhone.trim().isNotEmpty
          ? wizard.contactPhone.trim()
          : null,
      note: wizard.notes.trim().isNotEmpty ? wizard.notes.trim() : null,
    );

    await _storage.saveOrder(order);
    _orders.insert(0, order);
    notifyListeners();

    return order;
  }

  /// Creates a new order directly from the current [BookingWizardProvider] with status PENDING_REVIEW.
  /// Used when citizen submits a booking for operator quote and price review before paying deposit.
  Future<BulkyOrder> createOrderForReview(BookingWizardProvider wizard) async {
    final quote = wizard.currentQuote;
    if (quote == null) {
      throw StateError('Không thể tạo đơn hàng khi chưa có báo giá chi tiết.');
    }

    final newOrderId = 'order-${DateTime.now().millisecondsSinceEpoch}';

    final order = BulkyOrder(
      id: newOrderId,
      items: List.from(wizard.items),
      quote: quote,
      address: wizard.address,
      pickupDate: wizard.scheduledDate,
      status: BulkyOrderStatus.PENDING_REVIEW,
      paymentStatus: BulkyPaymentStatus.UNPAID,
      hasElevator: wizard.hasElevator,
      floorNumber: wizard.floorNumber,
      requiresDisassembly: wizard.requiresDisassembly,
      createdAt: DateTime.now(),
      contactName: wizard.contactName.trim().isNotEmpty
          ? wizard.contactName.trim()
          : null,
      contactPhone: wizard.contactPhone.trim().isNotEmpty
          ? wizard.contactPhone.trim()
          : null,
      note: wizard.notes.trim().isNotEmpty ? wizard.notes.trim() : null,
    );

    await _storage.saveOrder(order);
    _orders.insert(0, order);
    notifyListeners();

    return order;
  }

  /// Simulates holding deposit payment for an order.
  /// Moves status to [BulkyOrderStatus.CONFIRMED] and payment to [BulkyPaymentStatus.DEPOSIT_HELD].
  Future<void> simulateDepositPayment(String orderId) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);
    final now = DateTime.now();

    await _storage.updateOrderStatus(
      orderId,
      BulkyOrderStatus.CONFIRMED,
      paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
    );

    if (index >= 0) {
      _orders[index] = _orders[index].copyWith(
        status: BulkyOrderStatus.CONFIRMED,
        paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
        depositPaidAt: now,
      );
      notifyListeners();
    }
  }

  /// Orders that have been confirmed and are awaiting dispatch by the operator.
  List<BulkyOrder> get pendingDispatchOrders => _orders
      .where((o) => o.status == BulkyOrderStatus.CONFIRMED)
      .toList();

  /// Orders assigned to a collection vehicle and on schedule or actively collecting.
  List<BulkyOrder> get driverAssignedOrders => _orders
      .where((o) =>
          o.status == BulkyOrderStatus.SCHEDULED ||
          o.status == BulkyOrderStatus.ASSIGNED ||
          o.status == BulkyOrderStatus.IN_PROGRESS)
      .toList();

  /// Filters orders for a specific collection vehicle plate number.
  List<BulkyOrder> getOrdersByVehicle(String vehiclePlate) => _orders
      .where((o) =>
          o.vehiclePlate != null &&
          o.vehiclePlate!.toLowerCase().contains(vehiclePlate.toLowerCase()))
      .toList();

  /// Cancels an order.
  Future<void> cancelOrder(String orderId) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    await _storage.updateOrderStatus(
      orderId,
      BulkyOrderStatus.CANCELLED,
    );

    if (index >= 0) {
      _orders[index] = _orders[index].copyWith(
        status: BulkyOrderStatus.CANCELLED,
      );
      notifyListeners();
    }
  }

  /// [Operator Action] Assigns vehicle/driver and marks order as SCHEDULED.
  Future<void> assignDriverAndSchedule(
    String orderId, {
    required String vehiclePlate,
  }) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    await _storage.updateOrderStatus(
      orderId,
      BulkyOrderStatus.SCHEDULED,
      vehiclePlate: vehiclePlate,
    );

    if (index >= 0) {
      _orders[index] = _orders[index].copyWith(
        status: BulkyOrderStatus.SCHEDULED,
        vehiclePlate: vehiclePlate,
      );
      notifyListeners();
    }
  }

  /// [Operator Action] Rejects an order with a reason and marks as CANCELLED with refunded deposit.
  Future<void> rejectOrder(String orderId, {required String reason}) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    await _storage.updateOrderStatus(
      orderId,
      BulkyOrderStatus.CANCELLED,
      paymentStatus: BulkyPaymentStatus.REFUNDED,
    );

    if (index >= 0) {
      _orders[index] = _orders[index].copyWith(
        status: BulkyOrderStatus.CANCELLED,
        paymentStatus: BulkyPaymentStatus.REFUNDED,
        note: reason,
      );
      notifyListeners();
    }
  }

  /// [Driver Action] Marks order as IN_PROGRESS (driver en route to pickup point).
  Future<void> startCollection(String orderId) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    await _storage.updateOrderStatus(
      orderId,
      BulkyOrderStatus.IN_PROGRESS,
    );

    if (index >= 0) {
      _orders[index] = _orders[index].copyWith(
        status: BulkyOrderStatus.IN_PROGRESS,
      );
      notifyListeners();
    }
  }

  /// [Driver Action] Confirms bulky waste collected and finalizes payment.
  Future<void> completeCollection(String orderId) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    await _storage.updateOrderStatus(
      orderId,
      BulkyOrderStatus.COMPLETED,
      paymentStatus: BulkyPaymentStatus.PAID,
    );

    if (index >= 0) {
      _orders[index] = _orders[index].copyWith(
        status: BulkyOrderStatus.COMPLETED,
        paymentStatus: BulkyPaymentStatus.PAID,
      );
      notifyListeners();
    }
  }

  /// [Operator Action] Approves order with a final price and optional note,
  /// transitioning status to [BulkyOrderStatus.APPROVED_AWAITING_PAYMENT].
  Future<void> approveWithFinalPrice(
    String orderId,
    int finalizedPriceVnd, {
    String? operatorNote,
  }) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    final updated = await _storage.approveWithFinalPrice(
      orderId,
      finalizedPriceVnd,
      operatorNote: operatorNote,
    );

    if (updated != null && index >= 0) {
      _orders[index] = updated;
      notifyListeners();
    }
  }

  /// [Operator Action] Rejects order with reason, marking status as [BulkyOrderStatus.REJECTED]
  /// and refunding deposit if previously held.
  Future<void> rejectOrderWithReason(String orderId, String reason) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    final updated = await _storage.rejectOrderWithReason(orderId, reason);

    if (updated != null && index >= 0) {
      _orders[index] = updated;
      notifyListeners();
    }
  }

  /// [Driver Action] Reports on-site discrepancy (extra volume, additional items),
  /// moving order status to [BulkyOrderStatus.DISCREPANCY_PENDING].
  Future<void> reportOnSiteDiscrepancy(
    String orderId,
    int adjustedPriceVnd,
    String note,
  ) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    final updated = await _storage.reportOnSiteDiscrepancy(
      orderId,
      adjustedPriceVnd,
      note,
    );

    if (updated != null && index >= 0) {
      _orders[index] = updated;
      notifyListeners();
    }
  }

  /// [Customer / Operator Action] Responds to on-site discrepancy report.
  /// If accept == true: final price is set to adjusted price and order resumes IN_PROGRESS.
  /// If accept == false: original finalized price is retained, discrepancy note cleared, and order resumes IN_PROGRESS.
  Future<void> respondToOnSiteDiscrepancy(
    String orderId, {
    required bool accept,
  }) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    final updated = await _storage.respondToOnSiteDiscrepancy(
      orderId,
      accept: accept,
    );

    if (updated != null && index >= 0) {
      _orders[index] = updated;
      notifyListeners();
    }
  }

  /// [Driver Action] Rejects collection on-site due to safety violation (hazardous materials, safety risks).
  /// Updates reason, minimal callout fee, sets status to [BulkyOrderStatus.REJECTED_ON_SITE],
  /// and refunds remaining deposit.
  Future<void> rejectOnSiteSafetyViolation(
    String orderId,
    String reason, {
    int calloutFee = 50000,
  }) async {
    if (_orders.isEmpty) {
      await loadOrders();
    }
    final index = _orders.indexWhere((o) => o.id == orderId);

    final updated = await _storage.rejectOnSiteSafetyViolation(
      orderId,
      reason,
      calloutFee: calloutFee,
    );

    if (updated != null && index >= 0) {
      _orders[index] = updated;
      notifyListeners();
    }
  }
}
