import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/services/storage/mock_bulky_storage.dart';
import 'package:bulky_mobile/features/auth/models/citizen_user.dart';
import 'package:bulky_mobile/features/auth/providers/auth_provider.dart';
import 'package:bulky_mobile/features/auth/screens/bulky_account_screen.dart';
import 'package:bulky_mobile/features/driver/screens/bulky_driver_screen.dart';
import 'package:bulky_mobile/features/operator/screens/bulky_operator_screen.dart';
import 'package:bulky_mobile/features/orders/providers/orders_provider.dart';
import 'package:bulky_mobile/features/request_wizard/providers/booking_wizard_provider.dart';
import 'package:bulky_mobile/features/scan/providers/scan_provider.dart';
import 'package:bulky_mobile/main.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Role-Based Flow Unit Tests (AuthProvider & OrdersProvider)', () {
    test('1. AuthProvider supports role switching and role properties', () async {
      final auth = AuthProvider();
      expect(auth.currentRole, UserRole.citizen);
      expect(auth.isCitizen, isTrue);
      expect(auth.isOperator, isFalse);
      expect(auth.isDriver, isFalse);
      expect(auth.currentUser?.name, 'Nguyễn Văn An');

      // Switch to Operator
      await auth.switchRole(UserRole.operator);
      expect(auth.currentRole, UserRole.operator);
      expect(auth.isOperator, isTrue);
      expect(auth.currentUser?.name, 'Trần Thị Mai');
      expect(auth.currentUser?.staffCode, 'NV-DP01');

      // Switch to Driver
      await auth.switchRole(UserRole.driver);
      expect(auth.currentRole, UserRole.driver);
      expect(auth.isDriver, isTrue);
      expect(auth.currentUser?.name, 'Nguyễn Văn Hùng');
      expect(auth.currentUser?.vehiclePlate, '51C-889.21');

      // Switch back to Citizen
      await auth.switchRole(UserRole.citizen);
      expect(auth.currentRole, UserRole.citizen);
      expect(auth.isCitizen, isTrue);
    });

    test('2. Phone login recognizes staff roles automatically', () async {
      final auth = AuthProvider();

      // Operator phone
      await auth.login('0908.111.222', '123456');
      expect(auth.isOperator, isTrue);
      expect(auth.currentUser?.name, 'Trần Thị Mai');

      // Driver phone
      await auth.login('0909123456', '123456');
      expect(auth.isDriver, isTrue);
      expect(auth.currentUser?.name, 'Nguyễn Văn Hùng');

      // Citizen demo phone
      await auth.login('0912.345.678', '123456');
      expect(auth.isCitizen, isTrue);
      expect(auth.currentUser?.name, 'Nguyễn Văn An');
    });

    test('3. Complete End-to-End order status transition by Operator and Driver', () async {
      final storage = MockBulkyStorage();
      await storage.seedInitialOrdersIfEmpty();
      final ordersProvider = OrdersProvider(storage: storage);
      await ordersProvider.loadOrders();

      // Find the confirmed order
      final confirmedOrder = ordersProvider.orders.firstWhere(
        (o) => o.status == BulkyOrderStatus.CONFIRMED,
      );
      final testOrderId = confirmedOrder.id;

      // Operator assigns driver & vehicle: CONFIRMED -> SCHEDULED
      await ordersProvider.assignDriverAndSchedule(
        testOrderId,
        vehiclePlate: '51C-889.21',
      );

      final scheduledOrder = ordersProvider.getOrderById(testOrderId);
      expect(scheduledOrder?.status, BulkyOrderStatus.SCHEDULED);
      expect(scheduledOrder?.vehiclePlate, '51C-889.21');

      // Driver starts collection trip: SCHEDULED -> IN_PROGRESS
      await ordersProvider.startCollection(testOrderId);

      final inProgressOrder = ordersProvider.getOrderById(testOrderId);
      expect(inProgressOrder?.status, BulkyOrderStatus.IN_PROGRESS);

      // Driver completes collection: IN_PROGRESS -> COMPLETED
      await ordersProvider.completeCollection(testOrderId);

      final completedOrder = ordersProvider.getOrderById(testOrderId);
      expect(completedOrder?.status, BulkyOrderStatus.COMPLETED);
      expect(completedOrder?.paymentStatus, BulkyPaymentStatus.PAID);
    });
  });

  group('Role-Based UI & Screens Widget Tests', () {
    testWidgets('1. BulkyHomeScreen switches navigation tabs dynamically per role', (tester) async {
      final auth = AuthProvider();

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<ScanProvider>(create: (_) => ScanProvider()),
            ChangeNotifierProvider<BookingWizardProvider>(create: (_) => BookingWizardProvider()),
            ChangeNotifierProvider<OrdersProvider>(create: (_) => OrdersProvider()..loadOrders()),
          ],
          child: const MaterialApp(
            home: BulkyHomeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Default: Citizen tabs
      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Thu gom'), findsOneWidget);
      expect(find.text('Đơn & Phí'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      // Switch to Operator role
      await auth.switchRole(UserRole.operator);
      await tester.pumpAndSettle();

      expect(find.text('Điều phối xe'), findsOneWidget);
      expect(find.text('Tất cả đơn'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      // Switch to Driver role
      await auth.switchRole(UserRole.driver);
      await tester.pumpAndSettle();

      expect(find.text('Lộ trình xe'), findsOneWidget);
      expect(find.text('Lịch sử chuyến'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);
    });

    testWidgets('2. BulkyOperatorScreen renders header, KPIs and triggers vehicle assignment', (tester) async {
      final storage = MockBulkyStorage();
      await storage.seedInitialOrdersIfEmpty();
      final ordersProvider = OrdersProvider(storage: storage);
      await ordersProvider.loadOrders();

      final auth = AuthProvider(initialUser: CitizenUser.demoOperator);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<OrdersProvider>.value(value: ordersProvider),
          ],
          child: const MaterialApp(
            home: BulkyOperatorScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Operator Header
      expect(find.text('Trung Tâm Điều Phối VSMT'), findsOneWidget);
      expect(find.textContaining('Trần Thị Mai'), findsOneWidget);
      expect(find.text('Chờ xếp xe'), findsOneWidget);
      expect(find.text('Đang di chuyển'), findsOneWidget);
      expect(find.text('Đã hoàn tất'), findsOneWidget);

      // Verify pending order card & assign button
      final assignButton = find.byKey(const Key('assign_driver_button_order-demo-confirmed'));
      expect(assignButton, findsOneWidget);

      // Tap assign vehicle button
      await tester.tap(assignButton);
      await tester.pumpAndSettle();

      // Verify status moved to SCHEDULED
      final order = ordersProvider.getOrderById('order-demo-confirmed');
      expect(order?.status, BulkyOrderStatus.SCHEDULED);
      expect(order?.vehiclePlate, '51C-889.21');
    });

    testWidgets('3. BulkyDriverScreen renders active tasks and confirms collection flow for BulkyDriver', (tester) async {
      final storage = MockBulkyStorage();
      await storage.seedInitialOrdersIfEmpty();
      final ordersProvider = OrdersProvider(storage: storage);
      await ordersProvider.loadOrders();

      final auth = AuthProvider(initialUser: CitizenUser.demoBulkyDriver);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<OrdersProvider>.value(value: ordersProvider),
          ],
          child: const MaterialApp(
            home: BulkyDriverScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Bulky Driver Header
      expect(find.text('Lộ Trình Thu Gom Hiện Trường'), findsOneWidget);
      expect(find.text('Lê Hoàng Long'), findsOneWidget);
      expect(find.textContaining('51D-924.58'), findsWidgets);

      // Active order order-demo-scheduled is waiting
      final startTripButton = find.byKey(const Key('driver_start_collection_button_order-demo-scheduled'));
      expect(startTripButton, findsOneWidget);
      await tester.scrollUntilVisible(startTripButton, 100);

      // Tap start trip
      await tester.tap(startTripButton);
      await tester.pumpAndSettle();

      expect(ordersProvider.getOrderById('order-demo-scheduled')?.status, BulkyOrderStatus.IN_PROGRESS);

      // Complete button should now appear
      final completeButton = find.byKey(const Key('driver_complete_collection_button_order-demo-scheduled'));
      expect(completeButton, findsOneWidget);

      // Hide snackbar and scroll to complete button
      ScaffoldMessenger.of(tester.element(find.byType(Scaffold))).hideCurrentSnackBar();
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(completeButton, 100);

      // Tap complete
      await tester.tap(completeButton);
      await tester.pumpAndSettle();

      expect(ordersProvider.getOrderById('order-demo-scheduled')?.status, BulkyOrderStatus.COMPLETED);
    });

    testWidgets('4. BulkyAccountScreen role switcher buttons switch roles instantly', (tester) async {
      final auth = AuthProvider();

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: const MaterialApp(
            home: BulkyAccountScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(auth.isCitizen, isTrue);
      expect(find.byKey(const Key('switch_role_operator_button')), findsOneWidget);

      // Tap switch to operator
      await tester.tap(find.byKey(const Key('switch_role_operator_button')));
      await tester.pumpAndSettle();

      expect(auth.isOperator, isTrue);
      expect(find.text('Trần Thị Mai'), findsOneWidget);
      expect(find.text('NV-DP01'), findsOneWidget);

      // Tap switch to regular driver
      await tester.tap(find.byKey(const Key('switch_role_driver_button')));
      await tester.pumpAndSettle();

      expect(auth.isDriver, isTrue);
      expect(find.text('Nguyễn Văn Hùng'), findsOneWidget);
      expect(find.text('TX-51C889'), findsOneWidget);

      // Tap switch to bulky driver
      await tester.tap(find.byKey(const Key('switch_role_driver_bulky_button')));
      await tester.pumpAndSettle();

      expect(auth.isBulkyDriver, isTrue);
      expect(find.text('Lê Hoàng Long'), findsOneWidget);
      expect(find.text('TX-CK924'), findsOneWidget);
    });

    testWidgets('5. BulkyDriverScreen renders regular waste tasks for regular driver Nguyễn Văn Hùng and confirms collection', (tester) async {
      final storage = MockBulkyStorage();
      await storage.seedInitialOrdersIfEmpty();
      final ordersProvider = OrdersProvider(storage: storage);
      await ordersProvider.loadOrders();

      final auth = AuthProvider(initialUser: CitizenUser.demoRegularDriver);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: auth),
            ChangeNotifierProvider<OrdersProvider>.value(value: ordersProvider),
          ],
          child: const MaterialApp(
            home: BulkyDriverScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Regular Driver Header
      expect(find.text('Lộ Trình Thu Gom Hiện Trường'), findsOneWidget);
      expect(find.text('Nguyễn Văn Hùng'), findsOneWidget);
      expect(find.textContaining('51C-889.21'), findsWidgets);
      expect(find.textContaining('TÀI XẾ THU GOM RÁC SINH HOẠT'), findsOneWidget);

      // Verify regular stops
      expect(find.text('Thùng rác công cộng #SH-01'), findsWidgets);
      expect(find.byKey(const Key('regular_stop_card_sh-01')), findsOneWidget);
      expect(find.textContaining('Cư dân báo thùng đầy qua App'), findsWidgets);

      // Tap confirm collection on stop 1
      final confirmBtn = find.byKey(const Key('confirm_regular_collection_button_sh-01'));
      expect(confirmBtn, findsOneWidget);
      await tester.scrollUntilVisible(confirmBtn, 100);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      // Verify completed section shows
      expect(find.text('Đã hoàn tất ép rác hôm nay'), findsOneWidget);
      expect(find.text('Đã ép tải'), findsOneWidget);
    });
  });
}
