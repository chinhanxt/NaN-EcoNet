import 'package:flutter/material.dart' hide MaterialType;
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bulky_item.dart';
import 'package:bulky_mobile/core/domain/models/bulky_order.dart';
import 'package:bulky_mobile/core/domain/models/bulky_quote.dart';
import 'package:bulky_mobile/core/domain/pricing/pricing_engine.dart';
import 'package:bulky_mobile/core/services/storage/mock_bulky_storage.dart';
import 'package:bulky_mobile/features/auth/models/citizen_user.dart';
import 'package:bulky_mobile/features/auth/providers/auth_provider.dart';
import 'package:bulky_mobile/features/orders/providers/orders_provider.dart';
import 'package:bulky_mobile/features/orders/screens/bulky_order_detail_screen.dart';
import 'package:bulky_mobile/features/orders/screens/bulky_orders_list_screen.dart';
import 'package:bulky_mobile/features/payment/screens/bulky_payment_screen.dart';
import 'package:bulky_mobile/features/payment/widgets/countdown_timer_widget.dart';
import 'package:bulky_mobile/features/quote/screens/bulky_quote_screen.dart';
import 'package:bulky_mobile/features/quote/widgets/tolerance_guarantee_banner.dart';
import 'package:bulky_mobile/features/request_wizard/providers/booking_wizard_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('ToleranceGuaranteeBanner Widget Tests', () {
    testWidgets('renders default tolerance banner copy and header', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ToleranceGuaranteeBanner(),
          ),
        ),
      );

      expect(find.text('Cam kết bảo vệ giá (Dung sai ±15%)'), findsOneWidget);
      expect(
        find.textContaining('Đảm bảo chi phí thực tế tại hiện trường không vượt quá 15%'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.verified_user_rounded), findsWidgets);
    });

    testWidgets('renders custom policy message and max ceiling amount when provided', (tester) async {
      const policy = TolerancePolicy(
        allowedPercent: 15,
        allowedMaxVnd: 250000,
        message: 'Chính sách bảo hiểm sai lệch kích thước tối đa 15%.',
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ToleranceGuaranteeBanner(policy: policy),
          ),
        ),
      );

      expect(find.text('Cam kết bảo vệ giá (Dung sai ±15%)'), findsOneWidget);
      expect(find.text('Chính sách bảo hiểm sai lệch kích thước tối đa 15%.'), findsOneWidget);
      expect(find.textContaining('250.000 đ'), findsOneWidget);
    });
  });

  group('CountdownTimerWidget Tests', () {
    testWidgets('renders initial time and decrements per periodic tick', (tester) async {
      var expiredCalled = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CountdownTimerWidget(
              initialDuration: const Duration(seconds: 3),
              onExpired: () {
                expiredCalled = true;
              },
            ),
          ),
        ),
      );

      expect(find.text('00:03'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('00:02'), findsOneWidget);

      await tester.pump(const Duration(seconds: 2));
      expect(find.text('00:00'), findsOneWidget);
      expect(expiredCalled, isTrue);
    });

    testWidgets('shows warning styling when duration is under 3 minutes', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CountdownTimerWidget(
              initialDuration: Duration(minutes: 2, seconds: 30),
            ),
          ),
        ),
      );

      expect(find.text('02:30'), findsOneWidget);
      // Warning text should be visible or styled
      final timerText = tester.widget<Text>(find.text('02:30'));
      expect(timerText.style?.color, isNotNull);
    });
  });

  group('BulkyQuoteScreen & Pricing Integration Tests', () {
    late BookingWizardProvider wizard;
    late OrdersProvider ordersProvider;

    setUp(() {
      wizard = BookingWizardProvider();
      ordersProvider = OrdersProvider();

      wizard.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa da 3 chỗ',
        quantity: 1,
        material: MaterialType.STANDARD,
      ));
      wizard.addItem(const BulkyItem(
        id: 'item-2',
        category: BulkyCategory.MATTRESS,
        displayName: 'Nệm cao su Kim Cương',
        quantity: 1,
        material: MaterialType.HEAVY,
      ));
      wizard.setCustomerInfo(
        name: 'Nguyễn Văn A',
        phone: '0901234567',
        address: '123 Nguyễn Thị Minh Khai, P. Bến Nghé, Q.1',
        date: '2026-10-15',
      );
      wizard.setLogistics(
        requiresDisassembly: true,
        floorNumber: 2,
        hasElevator: false,
      );
    });

    testWidgets('renders complete itemized quote, surcharges, deposit card and tolerance banner', (tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: wizard),
            ChangeNotifierProvider.value(value: ordersProvider),
          ],
          child: const MaterialApp(
            home: BulkyQuoteScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Báo Giá Dịch Vụ'), findsOneWidget);
      expect(find.text('Sofa da 3 chỗ'), findsOneWidget);
      expect(find.text('Nệm cao su Kim Cương'), findsOneWidget);

      // Material badges & icons
      expect(find.textContaining('MDF / Tiêu chuẩn'), findsOneWidget);
      expect(find.textContaining('Gỗ đặc / Đá'), findsOneWidget);

      // Surcharges section
      expect(find.text('Cước đồ vật'), findsOneWidget);
      expect(find.text('Phụ phí tháo dỡ'), findsOneWidget);
      expect(find.text('Phụ phí bốc vác thang bộ'), findsOneWidget);
      expect(find.text('Phí xe thu gom chuyên dụng'), findsOneWidget);
      expect(find.text('Tổng cước ước tính'), findsOneWidget);

      // Deposit hold card
      expect(find.textContaining('Cọc giữ chỗ xe:'), findsOneWidget);
      expect(find.text('Khấu trừ trực tiếp vào hoá đơn sau khi hoàn tất thu gom'), findsOneWidget);

      // Tolerance Guarantee Banner
      expect(find.byType(ToleranceGuaranteeBanner), findsOneWidget);

      // Proceed to payment button
      expect(find.byKey(const Key('proceed_to_payment_button')), findsOneWidget);
      expect(find.text('Tiến hành đặt cọc giữ chỗ'), findsOneWidget);
    });

    testWidgets('tapping proceed_to_payment_button creates order and navigates to payment', (tester) async {
      final routes = <String, WidgetBuilder>{
        '/payment': (context) {
          final orderId = ModalRoute.of(context)?.settings.arguments as String?;
          return Scaffold(
            body: Text('Payment Screen: $orderId'),
          );
        },
      };

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: wizard),
            ChangeNotifierProvider.value(value: ordersProvider),
          ],
          child: MaterialApp(
            home: const BulkyQuoteScreen(),
            routes: routes,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final proceedBtn = find.byKey(const Key('proceed_to_payment_button'));
      expect(proceedBtn, findsOneWidget);
      await tester.tap(proceedBtn);
      await tester.pumpAndSettle();

      expect(find.textContaining('Payment Screen: order-'), findsOneWidget);
      expect(ordersProvider.orders.isNotEmpty, isTrue);
    });
  });

  group('BulkyPaymentScreen Widget Tests', () {
    late OrdersProvider ordersProvider;
    late BulkyOrder testOrder;

    setUp(() {
      ordersProvider = OrdersProvider();
      final items = [
        const BulkyItem(
          id: 'item-1',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa da 3 chỗ',
          quantity: 1,
        ),
      ];
      final quote = PricingEngine.calculateQuote(items: items);
      testOrder = BulkyOrder(
        id: 'order-test-1234',
        items: items,
        quote: quote,
        address: '456 Lê Duẩn, Q.1',
        pickupDate: '2026-10-20',
        status: BulkyOrderStatus.AWAITING_PAYMENT,
        createdAt: DateTime.now(),
      );

      // Add testOrder manually or through custom setup
    });

    testWidgets('renders payment header, timer, bank details, and simulates payment', (tester) async {
      final storage = MockBulkyStorage();
      await storage.saveOrder(testOrder);
      ordersProvider = OrdersProvider(storage: storage);
      await ordersProvider.loadOrders();

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: ordersProvider),
          ],
          child: MaterialApp(
            home: BulkyPaymentScreen(orderId: testOrder.id),
            routes: {
              '/order-detail': (context) => const Scaffold(body: Text('Navigated To Order Detail')),
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Check header and countdown
      expect(find.text('Thanh Toán Tiền Cọc'), findsOneWidget);
      expect(find.byType(CountdownTimerWidget), findsOneWidget);
      expect(find.textContaining('Vui lòng hoàn tất thanh toán cọc trong vòng 15 phút'), findsOneWidget);

      // Check Order ID and Deposit Amount
      expect(find.textContaining('order-test-1234'), findsWidgets);
      expect(find.textContaining('Tiền cọc cần thanh toán'), findsOneWidget);

      // Check Payment methods tabs
      expect(find.text('VietQR (Chuyển khoản)'), findsOneWidget);
      expect(find.text('Ví MoMo'), findsOneWidget);

      // Transfer details
      expect(find.textContaining('MB Bank'), findsOneWidget);
      expect(find.textContaining('999888666'), findsOneWidget);
      expect(find.textContaining('CÔNG TY CP MÔI TRƯỜNG SMARTBIN'), findsOneWidget);

      // Tap confirm payment button
      final confirmBtn = find.byKey(const Key('confirm_payment_button'));
      expect(confirmBtn, findsOneWidget);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      // Verify order status updated to CONFIRMED
      expect(ordersProvider.getOrderById(testOrder.id)?.status, BulkyOrderStatus.CONFIRMED);
      expect(find.text('Navigated To Order Detail'), findsOneWidget);
    });
  });

  group('BulkyOrdersListScreen & BulkyOrderDetailScreen Tests', () {
    late OrdersProvider ordersProvider;
    late BulkyOrder order1;
    late BulkyOrder order2;

    setUp(() async {
      final items = [
        const BulkyItem(
          id: 'item-1',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa da 3 chỗ',
          quantity: 1,
        ),
      ];
      final quote = PricingEngine.calculateQuote(items: items);

      order1 = BulkyOrder(
        id: 'order-active-1',
        items: items,
        quote: quote,
        address: '10 Hai Bà Trưng, P. Bến Nghé, Q.1',
        pickupDate: '2026-10-25',
        status: BulkyOrderStatus.CONFIRMED,
        paymentStatus: BulkyPaymentStatus.DEPOSIT_HELD,
        createdAt: DateTime.now(),
      );

      order2 = BulkyOrder(
        id: 'order-done-2',
        items: items,
        quote: quote,
        address: '25 Nguyễn Huệ, P. Bến Nghé, Q.1',
        pickupDate: '2026-10-20',
        status: BulkyOrderStatus.COMPLETED,
        paymentStatus: BulkyPaymentStatus.PAID,
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      );

      final storage = MockBulkyStorage();
      await storage.saveOrder(order1);
      await storage.saveOrder(order2);

      ordersProvider = OrdersProvider(storage: storage);
      await ordersProvider.loadOrders();
    });

    testWidgets('BulkyOrdersListScreen displays order cards, tabs filter, and card tap navigates', (tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: ordersProvider),
          ],
          child: MaterialApp(
            home: const BulkyOrdersListScreen(),
            routes: {
              '/order-detail': (context) {
                final orderId = ModalRoute.of(context)?.settings.arguments as String?;
                return Scaffold(body: Text('Order Detail Screen: $orderId'));
              },
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Đơn Của Tôi'), findsOneWidget);
      expect(find.text('Tất cả'), findsOneWidget);
      expect(find.text('Đang xử lý'), findsOneWidget);
      expect(find.text('Đã hoàn tất'), findsOneWidget);

      // Verify order cards are shown with 18px border radius
      final cardFinder = find.byKey(const Key('order_card_order-active-1'));
      expect(cardFinder, findsOneWidget);
      expect(find.byKey(const Key('order_card_order-done-2')), findsOneWidget);

      final cardInkWell = tester.widget<InkWell>(cardFinder);
      expect(cardInkWell.borderRadius, BorderRadius.circular(18));

      // Tap tab 'Đã hoàn tất'
      await tester.tap(find.text('Đã hoàn tất'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('order_card_order-done-2')), findsOneWidget);
      expect(find.byKey(const Key('order_card_order-active-1')), findsNothing);

      // Tap card to navigate
      await tester.tap(find.byKey(const Key('order_card_order-done-2')));
      await tester.pumpAndSettle();

      expect(find.text('Order Detail Screen: order-done-2'), findsOneWidget);
    });

    testWidgets('BulkyOrderDetailScreen displays 5-step timeline, vehicle info, pending banner and cancel dialog', (tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: ordersProvider),
          ],
          child: MaterialApp(
            home: BulkyOrderDetailScreen(orderId: order1.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chi Tiết Đơn Hàng'), findsOneWidget);
      expect(find.textContaining('order-active-1'), findsWidgets);

      // Citizen pending approval banner
      expect(find.text('Đang chờ Tổ điều phối VSMT kiểm duyệt'), findsOneWidget);
      expect(find.textContaining('Hồ sơ đơn order-active-1 đang được cán bộ kiểm tra'), findsOneWidget);

      // 5-step timeline check
      expect(find.text('Đã đặt cọc'), findsOneWidget);
      expect(find.text('Kiểm duyệt & Phê duyệt'), findsOneWidget);
      expect(find.text('Đã xếp lịch xe tải & Tài xế'), findsOneWidget);
      expect(find.text('Đang đến lấy rác'), findsOneWidget);
      expect(find.text('Hoàn tất thu gom'), findsOneWidget);

      // Vehicle & Driver Info Card with call button
      expect(find.textContaining('Biển số xe:'), findsOneWidget);
      expect(find.textContaining('Tài xế:'), findsOneWidget);
      expect(find.textContaining('Đội Vệ Sinh Môi Trường Đô Thị Q.1'), findsOneWidget);
      expect(find.byKey(const Key('call_driver_button')), findsOneWidget);

      // Cancel order button
      final cancelBtn = find.text('Hủy đơn hàng');
      expect(cancelBtn, findsOneWidget);
      await tester.ensureVisible(cancelBtn);
      await tester.pumpAndSettle();
      await tester.tap(cancelBtn);
      await tester.pumpAndSettle();

      // Confirmation dialog
      expect(find.text('Xác nhận hủy đơn'), findsOneWidget);
      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();

      // Verify order cancelled
      expect(ordersProvider.getOrderById(order1.id)?.status, BulkyOrderStatus.CANCELLED);
    });

    testWidgets('BulkyOrderDetailScreen renders Operator review card and triggers approval', (tester) async {
      final auth = AuthProvider(initialUser: CitizenUser.demoOperator);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: ordersProvider),
          ],
          child: MaterialApp(
            home: BulkyOrderDetailScreen(orderId: order1.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Operator Review Card
      expect(find.text('Kiểm Duyệt Hồ Sơ'), findsOneWidget);
      expect(find.text('Tổ Điều Phối'), findsOneWidget);
      expect(find.text('✓ Phê duyệt & Điều xe tải'), findsOneWidget);
      expect(find.text('Từ chối'), findsOneWidget);

      // Citizen pending banner should NOT be displayed for Operator
      expect(find.text('Đang chờ Tổ điều phối VSMT kiểm duyệt'), findsNothing);

      // Tap approve
      final approveBtn = find.byKey(Key('operator_approve_button_${order1.id}'));
      expect(approveBtn, findsOneWidget);
      await tester.tap(approveBtn);
      await tester.pumpAndSettle();

      // Verify order transitioned to SCHEDULED
      expect(ordersProvider.getOrderById(order1.id)?.status, BulkyOrderStatus.SCHEDULED);
    });

    testWidgets('BulkyOrderDetailScreen Operator can reject order with deposit refund', (tester) async {
      final auth = AuthProvider(initialUser: CitizenUser.demoOperator);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: ordersProvider),
          ],
          child: MaterialApp(
            home: BulkyOrderDetailScreen(orderId: order1.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap reject
      final rejectBtn = find.byKey(Key('operator_reject_button_${order1.id}'));
      expect(rejectBtn, findsOneWidget);
      await tester.tap(rejectBtn);
      await tester.pumpAndSettle();

      // Verify reject dialog
      expect(find.text('Từ chối đơn thu gom'), findsOneWidget);
      expect(find.byKey(const Key('confirm_reject_button')), findsOneWidget);
      await tester.tap(find.byKey(const Key('confirm_reject_button')));
      await tester.pumpAndSettle();

      // Verify order cancelled and refunded
      final updated = ordersProvider.getOrderById(order1.id);
      expect(updated?.status, BulkyOrderStatus.CANCELLED);
      expect(updated?.paymentStatus, BulkyPaymentStatus.REFUNDED);
    });
  });
}
