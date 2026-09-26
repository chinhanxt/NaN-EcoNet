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

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Role Workflow & RBAC Integration Tests (Task 5)', () {
    testWidgets(
      '1. BulkyAccountScreen seamlessly switches between Citizen, Operator, and Driver roles',
      (tester) async {
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

        // 1. Initially Citizen
        expect(auth.isCitizen, isTrue);
        expect(find.text('Tài Khoản Công Dân'), findsOneWidget);
        expect(find.text('Nguyễn Văn An'), findsOneWidget);
        expect(find.text('HH-78921'), findsOneWidget);
        expect(find.textContaining('120 Điểm Xanh'), findsOneWidget);

        // 2. Switch to Operator
        final opBtn = find.byKey(const Key('switch_role_operator_button'));
        expect(opBtn, findsOneWidget);
        await tester.tap(opBtn);
        await tester.pumpAndSettle();

        expect(auth.isOperator, isTrue);
        expect(find.text('Trần Thị Mai'), findsOneWidget);
        expect(find.text('NV-DP01'), findsOneWidget);
        expect(find.textContaining('ĐIỀU PHỐI VIÊN'), findsWidgets);

        // 3. Switch to Driver
        final drvBtn = find.byKey(const Key('switch_role_driver_button'));
        expect(drvBtn, findsOneWidget);
        await tester.tap(drvBtn);
        await tester.pumpAndSettle();

        expect(auth.isDriver, isTrue);
        expect(find.text('Nguyễn Văn Hùng'), findsOneWidget);
        expect(find.text('TX-51C889'), findsOneWidget);
        expect(find.textContaining('51C-889.21'), findsWidgets);
        expect(find.textContaining('TÀI XẾ THU GOM'), findsWidgets);

        // 4. Switch back to Citizen
        final ctzBtn = find.byKey(const Key('switch_role_citizen_button'));
        expect(ctzBtn, findsOneWidget);
        await tester.tap(ctzBtn);
        await tester.pumpAndSettle();

        expect(auth.isCitizen, isTrue);
        expect(find.text('Nguyễn Văn An'), findsOneWidget);
      },
    );

    testWidgets(
      '2. BulkyOperatorScreen displays KPI cards, role banner, and allows assigning truck 51C-889.21',
      (tester) async {
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

        // 1. Role banner & Live KPIs
        expect(find.textContaining('ĐIỀU PHỐI VIÊN ĐÔ THỊ'), findsOneWidget);
        expect(find.textContaining('Trần Thị Mai'), findsOneWidget);
        expect(find.text('Chờ xếp xe'), findsWidgets);
        expect(find.text('Đang di chuyển'), findsWidgets);
        expect(find.text('Đã hoàn tất'), findsWidgets);

        // 2. Pending orders list inspection
        final pendingCard = find.byKey(const Key('operator_pending_card_order-demo-confirmed'));
        expect(pendingCard, findsOneWidget);
        expect(find.textContaining('Xe tải thu gom 2.5T'), findsWidgets);

        // 3. Open Approval Dialog
        final openDialogBtn = find.byKey(const Key('open_assign_dialog_button_order-demo-confirmed'));
        expect(openDialogBtn, findsOneWidget);
        await tester.drag(pendingCard, const Offset(0, -250));
        await tester.pumpAndSettle();
        await tester.tap(openDialogBtn);
        await tester.pumpAndSettle();

        // Dialog rendered with truck 51C-889.21 option
        expect(find.text('Phê duyệt & Điều phối xe thu gom'), findsOneWidget);
        expect(find.textContaining('51C-889.21'), findsWidgets);

        // Confirm assignment in dialog
        final confirmAssignBtn = find.byKey(const Key('confirm_assign_dialog_button'));
        expect(confirmAssignBtn, findsOneWidget);
        await tester.tap(confirmAssignBtn);
        await tester.pumpAndSettle();

        // Verify order assigned to 51C-889.21 and status changed to SCHEDULED
        final assignedOrder = ordersProvider.getOrderById('order-demo-confirmed');
        expect(assignedOrder?.status, BulkyOrderStatus.SCHEDULED);
        expect(assignedOrder?.vehiclePlate, '51C-889.21');
      },
    );

    testWidgets(
      '3. BulkyDriverScreen displays driver banner, active trip card, 1-tap call, and status workflow',
      (tester) async {
        final storage = MockBulkyStorage();
        await storage.seedInitialOrdersIfEmpty();
        final ordersProvider = OrdersProvider(storage: storage);
        await ordersProvider.loadOrders();

        final auth = AuthProvider(initialUser: CitizenUser.demoDriver);

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

        // 1. Driver Banner & Vehicle info
        expect(find.textContaining('TÀI XẾ THU GOM CHUYÊN DỤNG'), findsOneWidget);
        expect(find.text('Nguyễn Văn Hùng'), findsWidgets);
        expect(find.textContaining('51C-889.21'), findsWidgets);
        expect(find.textContaining('Xe tải 2.5T'), findsWidgets);

        // 2. Active Trip Card & 1-tap call button
        final callButton = find.byKey(const Key('driver_call_customer_button_order-demo-scheduled'));
        expect(callButton, findsOneWidget);
        await tester.scrollUntilVisible(callButton, 100);
        await tester.tap(callButton);
        await tester.pump();
        expect(find.textContaining('Đang kết nối cuộc gọi'), findsOneWidget);

        // Hide snackbar before proceeding
        ScaffoldMessenger.of(tester.element(find.byType(Scaffold))).hideCurrentSnackBar();
        await tester.pumpAndSettle();

        // 3. Status update: [🚗 Đang đến điểm thu gom] -> IN_PROGRESS
        final startBtn = find.byKey(const Key('driver_start_collection_button_order-demo-scheduled'));
        expect(startBtn, findsOneWidget);
        expect(find.textContaining('Đang đến điểm thu gom'), findsOneWidget);

        await tester.scrollUntilVisible(startBtn, 100);
        await tester.tap(startBtn);
        await tester.pumpAndSettle();

        expect(ordersProvider.getOrderById('order-demo-scheduled')?.status, BulkyOrderStatus.IN_PROGRESS);

        // 4. Status update: [✓ Hoàn tất bốc xếp & Cân rác] -> COMPLETED
        final completeBtn = find.byKey(const Key('driver_complete_collection_button_order-demo-scheduled'));
        expect(completeBtn, findsOneWidget);
        expect(find.textContaining('Hoàn tất bốc xếp & Cân rác'), findsOneWidget);

        // Scroll to complete button if necessary
        ScaffoldMessenger.of(tester.element(find.byType(Scaffold))).hideCurrentSnackBar();
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(completeBtn, 100);

        await tester.tap(completeBtn);
        await tester.pumpAndSettle();

        expect(ordersProvider.getOrderById('order-demo-scheduled')?.status, BulkyOrderStatus.COMPLETED);
      },
    );
  });
}
