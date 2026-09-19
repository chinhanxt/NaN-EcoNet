import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/services/ai/ai_recognition_result.dart';
import 'package:bulky_mobile/core/services/ai/gemini_vision_service.dart';
import 'package:bulky_mobile/core/services/storage/mock_bulky_storage.dart';
import 'package:bulky_mobile/features/scan/providers/scan_provider.dart';
import 'package:bulky_mobile/features/request_wizard/providers/booking_wizard_provider.dart';
import 'package:bulky_mobile/features/orders/providers/orders_provider.dart';

class MockHttpClient extends http.BaseClient {
  final Future<http.Response> Function(http.BaseRequest) handler;
  MockHttpClient(this.handler);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await handler(request);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('ScanProvider', () {
    test('1. initial state and reset', () {
      final provider = ScanProvider();
      expect(provider.isScanning, isFalse);
      expect(provider.imageBytes, isNull);
      expect(provider.result, isNull);
      expect(provider.selectedBoxIndex, isNull);
      expect(provider.errorMessage, isNull);
      expect(provider.hasResult, isFalse);

      provider.selectBox(1);
      expect(provider.selectedBoxIndex, 1);

      provider.reset();
      expect(provider.selectedBoxIndex, isNull);
    });

    test('2. scanImage successful recognition updates state and bounding boxes', () async {
      final mockPayload = {
        'candidates': [
          {
            'content': {
              'parts': [
                {
                  'text': jsonEncode({
                    'decision': 'SUGGESTED',
                    'confidence': 0.95,
                    'containsHazardousWaste': false,
                    'explanation': 'Đã nhận diện 01 ghế sofa da và 01 bàn trà gỗ',
                    'items': [
                      {
                        'itemType': 'SOFA',
                        'displayName': 'Sofa da 3 chỗ',
                        'suggestedQuantity': 1,
                        'dimensionsCm': {'length': 200, 'width': 90, 'height': 85},
                        'disassemblyNeeded': true,
                        'box_2d': [100, 100, 700, 800],
                        'confidence': 0.96,
                        'suggestedMaterial': 'STANDARD'
                      }
                    ],
                    'boundingBoxes': [
                      {
                        'box_2d': [100, 100, 700, 800],
                        'displayName': 'Sofa da 3 chỗ',
                        'confidence': 0.96,
                        'itemType': 'SOFA',
                        'isHazardous': false,
                        'suggestedMaterial': 'STANDARD'
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      };

      final client = MockHttpClient((req) async {
        return http.Response(jsonEncode(mockPayload), 200, headers: {
          'content-type': 'application/json; charset=utf-8',
        });
      });

      final service = GeminiVisionService(client: client);
      final provider = ScanProvider(visionService: service);

      final dummyBytes = Uint8List.fromList([1, 2, 3, 4]);
      await provider.scanImage(dummyBytes, client: client);

      expect(provider.isScanning, isFalse);
      expect(provider.imageBytes, dummyBytes);
      expect(provider.hasResult, isTrue);
      expect(provider.result!.items.length, 1);
      expect(provider.result!.items.first.category, BulkyCategory.SOFA);
      expect(provider.result!.items.first.displayName, 'Sofa da 3 chỗ');
      expect(provider.result!.boundingBoxes.length, 1);
      expect(provider.errorMessage, isNull);
    });

    test('3. scanImage sets errorMessage when AI service reports error', () async {
      final client = MockHttpClient((req) async {
        return http.Response('Service Unavailable', 503);
      });

      final service = GeminiVisionService(client: client);
      final provider = ScanProvider(visionService: service);

      final dummyBytes = Uint8List.fromList([1, 2, 3]);
      await provider.scanImage(dummyBytes, client: client);

      expect(provider.isScanning, isFalse);
      expect(provider.result, isNotNull);
      expect(provider.result!.decision, AiDecision.MANUAL_REVIEW);
      expect(provider.errorMessage, contains('quá tải'));
    });
  });

  group('BookingWizardProvider', () {
    test('1. initFromScan populates items and calculates live quote', () {
      final provider = BookingWizardProvider();

      final items = [
        const BulkyItem(
          id: 'item-1',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa văng',
          quantity: 1,
          material: MaterialType.STANDARD,
        ),
      ];
      final boxes = [
        const BoundingBox(
          ymin: 100,
          xmin: 100,
          ymax: 700,
          xmax: 800,
          displayName: 'Sofa văng',
          category: BulkyCategory.SOFA,
        ),
      ];

      final scanResult = AiRecognitionResult(
        decision: AiDecision.SUGGESTED,
        requiresManualReview: false,
        explanation: 'Nhận diện sofa',
        items: items,
        boundingBoxes: boxes,
      );

      final dummyBytes = Uint8List.fromList([1, 2, 3]);
      provider.initFromScan(scanResult, dummyBytes);

      expect(provider.items.length, 1);
      expect(provider.imageBytes, dummyBytes);
      expect(provider.currentQuote, isNotNull);
      // Base sofa standard: 150.000 + area fee 25.000 = 175.000
      expect(provider.currentQuote!.minVnd, 175000);
      expect(provider.totalEstimatedWeightKg, 45.0);
    });

    test('2. updateItemMaterial 1-click recalculates quote dynamically', () {
      final provider = BookingWizardProvider();
      provider.addItem(const BulkyItem(
        id: 'item-table',
        category: BulkyCategory.TABLE,
        displayName: 'Bàn gỗ',
        quantity: 1,
        material: MaterialType.STANDARD, // 80.000 + 25.000 = 105.000
      ));

      expect(provider.currentQuote!.minVnd, 105000);
      expect(provider.items.first.material, MaterialType.STANDARD);

      // 1-Click upgrade to HEAVY (gỗ đặc / đá: factor 1.3 -> 104.000 + 25.000 = 129.000)
      provider.updateItemMaterial(0, MaterialType.HEAVY);
      expect(provider.items.first.material, MaterialType.HEAVY);
      expect(provider.currentQuote!.minVnd, 129000);

      // 1-Click downgrade to LIGHT (nhựa / ván nhẹ: factor 0.8 -> 64.000 + 25.000 = 89.000)
      provider.updateItemMaterial(0, MaterialType.LIGHT);
      expect(provider.items.first.material, MaterialType.LIGHT);
      expect(provider.currentQuote!.minVnd, 89000);
    });

    test('3. updateItemQuantity, addItem, removeItem triggers recalculations', () {
      final provider = BookingWizardProvider();

      provider.addItem(const BulkyItem(
        id: 'item-mattress',
        category: BulkyCategory.MATTRESS,
        displayName: 'Đệm đơn',
        quantity: 1,
        material: MaterialType.STANDARD, // 100.000
      ));

      expect(provider.currentQuote!.subtotalMinVnd, 100000);

      // Increase quantity to 2 -> 200.000
      provider.updateItemQuantity(0, 2);
      expect(provider.items.first.quantity, 2);
      expect(provider.currentQuote!.subtotalMinVnd, 200000);

      // Add second item
      provider.addItem(const BulkyItem(
        id: 'item-chair',
        category: BulkyCategory.TABLE,
        displayName: 'Ghế làm việc',
        quantity: 1,
        material: MaterialType.STANDARD, // 80.000
      ));
      expect(provider.items.length, 2);
      expect(provider.currentQuote!.subtotalMinVnd, 280000);

      // Remove first item
      provider.removeItem(0);
      expect(provider.items.length, 1);
      expect(provider.items.first.displayName, 'Ghế làm việc');
      expect(provider.currentQuote!.subtotalMinVnd, 80000);
    });

    test('4. logistics options (disassembly, floor, elevator) update surcharges', () {
      final provider = BookingWizardProvider();
      provider.addItem(const BulkyItem(
        id: 'item-cabinet',
        category: BulkyCategory.CABINET,
        displayName: 'Tủ 3 buồng',
        quantity: 1,
        material: MaterialType.STANDARD, // 120.000 + 25.000 = 145.000
      ));

      expect(provider.currentQuote!.minVnd, 145000);
      expect(provider.currentQuote!.disassemblyFee, 0);
      expect(provider.currentQuote!.floorHandlingFee, 0);

      // Disassembly needed (+30.000)
      provider.setLogistics(requiresDisassembly: true);
      expect(provider.requiresDisassembly, isTrue);
      expect(provider.currentQuote!.disassemblyFee, 30000);
      expect(provider.currentQuote!.minVnd, 175000);

      // Floor 3 without elevator (+20.000 * 3 = 60.000)
      provider.setLogistics(floorNumber: 3, hasElevator: false);
      expect(provider.currentQuote!.floorHandlingFee, 60000);
      expect(provider.currentQuote!.minVnd, 235000);

      // Has elevator -> floorHandlingFee becomes 0
      provider.setLogistics(hasElevator: true);
      expect(provider.currentQuote!.floorHandlingFee, 0);
      expect(provider.currentQuote!.minVnd, 175000);
    });

    test('5. 3-step navigation and validation logic', () {
      final provider = BookingWizardProvider();

      expect(provider.currentStep, 0);
      // Cannot advance step 0 without items
      expect(provider.canGoNext(), isFalse);
      expect(provider.nextStep(), isFalse);

      // Add item -> can advance to step 1
      provider.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa',
      ));
      expect(provider.canGoNext(), isTrue);
      expect(provider.nextStep(), isTrue);
      expect(provider.currentStep, 1);

      // Step 1: needs address and pickup date
      expect(provider.canGoNext(), isFalse);
      provider.setCustomerInfo(
        address: '123 Cách Mạng Tháng 8, Quận 10',
        date: '2026-09-29',
        name: 'Hoàng Nam',
        phone: '0909123456',
      );
      expect(provider.canGoNext(), isTrue);
      expect(provider.nextStep(), isTrue);
      expect(provider.currentStep, 2);

      // Step 2: Review step
      expect(provider.canGoNext(), isTrue);

      // Back navigation
      expect(provider.prevStep(), isTrue);
      expect(provider.currentStep, 1);
      expect(provider.prevStep(), isTrue);
      expect(provider.currentStep, 0);
      expect(provider.prevStep(), isFalse); // at step 0
    });
  });

  group('OrdersProvider', () {
    late MockBulkyStorage storage;
    late OrdersProvider ordersProvider;

    setUp(() {
      storage = MockBulkyStorage();
      ordersProvider = OrdersProvider(storage: storage);
    });

    test('1. loadOrders seeds initial orders and updates active/completed filters', () async {
      await ordersProvider.loadOrders();

      expect(ordersProvider.isLoading, isFalse);
      expect(ordersProvider.orders.length, 3);
      expect(ordersProvider.activeOrders.length, 2);
      expect(ordersProvider.completedOrders.length, 1);
      expect(ordersProvider.completedOrders.first.status, BulkyOrderStatus.COMPLETED);
    });

    test('2. createOrderFromWizard creates and saves order with AWAITING_PAYMENT', () async {
      await ordersProvider.loadOrders();

      final wizard = BookingWizardProvider();
      wizard.addItem(const BulkyItem(
        id: 'item-new',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa băng',
        quantity: 1,
        material: MaterialType.STANDARD,
      ));
      wizard.setCustomerInfo(
        address: '88 Hàm Nghi, Quận 1, TP. Hồ Chí Minh',
        date: '2026-09-30',
        name: 'Võ Thị Sáu',
        phone: '0933221100',
        notes: 'Hẻm xe tải vào được',
      );

      final newOrder = await ordersProvider.createOrderFromWizard(wizard);

      expect(newOrder.id, startsWith('order-'));
      expect(newOrder.status, BulkyOrderStatus.AWAITING_PAYMENT);
      expect(newOrder.paymentStatus, BulkyPaymentStatus.UNPAID);
      expect(newOrder.address, contains('Hàm Nghi'));
      expect(newOrder.contactName, 'Võ Thị Sáu');
      expect(newOrder.contactPhone, '0933221100');
      expect(newOrder.note, contains('Hẻm xe tải'));

      expect(ordersProvider.orders.length, 4);
      expect(ordersProvider.activeOrders.length, 3);

      // Verify persisted in storage
      final stored = await storage.getOrderById(newOrder.id);
      expect(stored, isNotNull);
      expect(stored!.address, newOrder.address);
    });

    test('3. simulateDepositPayment transitions order to CONFIRMED with DEPOSIT_HELD', () async {
      await ordersProvider.loadOrders();

      final wizard = BookingWizardProvider();
      wizard.addItem(const BulkyItem(
        id: 'item-p',
        category: BulkyCategory.TABLE,
        displayName: 'Bàn họp',
      ));
      wizard.setCustomerInfo(
        address: '50 Đồng Khởi, Quận 1',
        date: '2026-10-01',
      );

      final order = await ordersProvider.createOrderFromWizard(wizard);
      expect(order.status, BulkyOrderStatus.AWAITING_PAYMENT);

      await ordersProvider.simulateDepositPayment(order.id);

      final updated = ordersProvider.getOrderById(order.id);
      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.CONFIRMED);
      expect(updated.paymentStatus, BulkyPaymentStatus.DEPOSIT_HELD);
      expect(updated.depositPaidAt, isNotNull);

      // Check persisted in storage
      final inStorage = await storage.getOrderById(order.id);
      expect(inStorage!.status, BulkyOrderStatus.CONFIRMED);
      expect(inStorage.paymentStatus, BulkyPaymentStatus.DEPOSIT_HELD);
    });

    test('4. cancelOrder marks order as CANCELLED', () async {
      await ordersProvider.loadOrders();
      final targetId = ordersProvider.activeOrders.first.id;

      await ordersProvider.cancelOrder(targetId);

      final cancelled = ordersProvider.getOrderById(targetId);
      expect(cancelled, isNotNull);
      expect(cancelled!.status, BulkyOrderStatus.CANCELLED);
      expect(ordersProvider.activeOrders.any((o) => o.id == targetId), isFalse);
    });

    test('5. createOrderForReview creates order with PENDING_REVIEW and adds to pendingReviewOrders', () async {
      await ordersProvider.loadOrders();

      final wizard = BookingWizardProvider();
      wizard.addItem(const BulkyItem(
        id: 'item-wizard-review',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa bọc nỉ 3 chỗ',
        quantity: 1,
        material: MaterialType.STANDARD,
      ));
      wizard.setCustomerInfo(
        address: '100 Nguyễn Huệ, Quận 1',
        date: '2026-10-06',
        name: 'Trần Văn Nam',
        phone: '0912345678',
        notes: 'Chờ điều phối viên khảo sát hình ảnh',
      );

      final order = await ordersProvider.createOrderForReview(wizard);

      expect(order.status, BulkyOrderStatus.PENDING_REVIEW);
      expect(order.paymentStatus, BulkyPaymentStatus.UNPAID);
      expect(order.address, contains('Nguyễn Huệ'));
      expect(ordersProvider.orders.first.id, order.id);
      expect(ordersProvider.pendingReviewOrders.any((o) => o.id == order.id), isTrue);

      final stored = await storage.getOrderById(order.id);
      expect(stored, isNotNull);
      expect(stored!.status, BulkyOrderStatus.PENDING_REVIEW);
    });

    test('6. approveWithFinalPrice updates provider state and notifies listeners', () async {
      await ordersProvider.loadOrders();

      final wizard = BookingWizardProvider();
      wizard.addItem(const BulkyItem(
        id: 'item-app',
        category: BulkyCategory.CABINET,
        displayName: 'Tủ hồ sơ gỗ',
      ));
      wizard.setCustomerInfo(
        address: '12 Nguyễn Trãi, Quận 5',
        date: '2026-10-07',
      );
      final order = await ordersProvider.createOrderForReview(wizard);

      bool notified = false;
      ordersProvider.addListener(() {
        notified = true;
      });

      await ordersProvider.approveWithFinalPrice(
        order.id,
        300000,
        operatorNote: 'Giá chốt sau khi đối soát kích thước thực tế',
      );

      expect(notified, isTrue);
      final updated = ordersProvider.getOrderById(order.id);
      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.APPROVED_AWAITING_PAYMENT);
      expect(updated.finalizedPriceVnd, 300000);
      expect(updated.operatorNote, contains('Giá chốt sau khi đối soát'));
    });

    test('7. rejectOrderWithReason updates state to REJECTED and refunds deposit if held', () async {
      await ordersProvider.loadOrders();

      // Find an order with DEPOSIT_HELD
      final confirmedOrder = ordersProvider.orders.firstWhere(
        (o) => o.paymentStatus == BulkyPaymentStatus.DEPOSIT_HELD,
      );

      await ordersProvider.rejectOrderWithReason(
        confirmedOrder.id,
        'Địa chỉ nằm ngoài bán kính phục vụ',
      );

      final updated = ordersProvider.getOrderById(confirmedOrder.id);
      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.REJECTED);
      expect(updated.paymentStatus, BulkyPaymentStatus.REFUNDED);
      expect(updated.operatorNote, 'Địa chỉ nằm ngoài bán kính phục vụ');
    });

    test('8. reportOnSiteDiscrepancy updates state to DISCREPANCY_PENDING with note and price', () async {
      await ordersProvider.loadOrders();

      final targetOrder = ordersProvider.orders.first;
      await ordersProvider.reportOnSiteDiscrepancy(
        targetOrder.id,
        350000,
        'Khối lượng thực tế lớn hơn khai báo 25%',
      );

      final updated = ordersProvider.getOrderById(targetOrder.id);
      expect(updated, isNotNull);
      expect(updated!.status, BulkyOrderStatus.DISCREPANCY_PENDING);
      expect(updated.onSiteAdjustedPriceVnd, 350000);
      expect(updated.onSiteDiscrepancyNote, contains('25%'));
      expect(ordersProvider.discrepancyPendingOrders.any((o) => o.id == targetOrder.id), isTrue);
    });

    test('9. respondToOnSiteDiscrepancy accept true updates final price and accept false clears note', () async {
      await ordersProvider.loadOrders();

      final targetOrder = ordersProvider.orders.first;
      await ordersProvider.reportOnSiteDiscrepancy(
        targetOrder.id,
        400000,
        'Phụ thu thêm tầng 4 không thang máy',
      );

      // Accept discrepancy
      await ordersProvider.respondToOnSiteDiscrepancy(
        targetOrder.id,
        accept: true,
      );
      final accepted = ordersProvider.getOrderById(targetOrder.id);
      expect(accepted!.status, BulkyOrderStatus.IN_PROGRESS);
      expect(accepted.finalizedPriceVnd, 400000);

      // Report another discrepancy then reject it
      await ordersProvider.reportOnSiteDiscrepancy(
        targetOrder.id,
        500000,
        'Thêm rác phụ kiện',
      );
      await ordersProvider.respondToOnSiteDiscrepancy(
        targetOrder.id,
        accept: false,
      );
      final rejected = ordersProvider.getOrderById(targetOrder.id);
      expect(rejected!.status, BulkyOrderStatus.IN_PROGRESS);
      expect(rejected.finalizedPriceVnd, 400000); // remains previous final price
      expect(rejected.onSiteDiscrepancyNote, isNull);
    });

    test('10. rejectOnSiteSafetyViolation sets REJECTED_ON_SITE, reason, fee, and refunds deposit', () async {
      await ordersProvider.loadOrders();

      final targetOrder = ordersProvider.orders.first;
      await ordersProvider.rejectOnSiteSafetyViolation(
        targetOrder.id,
        'Rác chứa mảnh kính vỡ sắc nhọn chưa đóng gói an toàn',
        calloutFee: 50000,
      );

      final rejected = ordersProvider.getOrderById(targetOrder.id);
      expect(rejected, isNotNull);
      expect(rejected!.status, BulkyOrderStatus.REJECTED_ON_SITE);
      expect(rejected.paymentStatus, BulkyPaymentStatus.REFUNDED);
      expect(rejected.onSiteRejectionReason, contains('mảnh kính vỡ'));
      expect(rejected.calloutFeeVnd, 50000);
    });
  });
}
