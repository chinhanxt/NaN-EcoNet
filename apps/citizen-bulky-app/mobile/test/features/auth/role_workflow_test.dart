import 'package:flutter/material.dart' hide MaterialType;
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bulky_item.dart';
import 'package:bulky_mobile/core/domain/models/bulky_order.dart';
import 'package:bulky_mobile/core/domain/pricing/pricing_engine.dart';
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

        // 3. Switch to Driver (Regular Waste)
        final drvBtn = find.byKey(const Key('switch_role_driver_button'));
        expect(drvBtn, findsOneWidget);
        await tester.tap(drvBtn);
        await tester.pumpAndSettle();

        expect(auth.isDriver, isTrue);
        expect(auth.isRegularWasteDriver, isTrue);
        expect(find.text('Nguyễn Văn Hùng'), findsOneWidget);
        expect(find.text('TX-51C889'), findsOneWidget);
        expect(find.textContaining('51C-889.21'), findsWidgets);
        expect(find.textContaining('TÀI XẾ THU GOM RÁC SINH HOẠT'), findsWidgets);

        // 4. Switch to Driver (Bulky Waste)
        final drvBulkyBtn = find.byKey(const Key('switch_role_driver_bulky_button'));
        expect(drvBulkyBtn, findsOneWidget);
        await tester.tap(drvBulkyBtn);
        await tester.pumpAndSettle();

        expect(auth.isDriver, isTrue);
        expect(auth.isBulkyWasteDriver, isTrue);
        expect(find.text('Lê Hoàng Long'), findsOneWidget);
        expect(find.text('TX-CK924'), findsOneWidget);
        expect(find.textContaining('51D-924.58'), findsWidgets);
        expect(find.textContaining('TÀI XẾ THU GOM RÁC CỒNG KỀNH'), findsWidgets);

        // 5. Switch back to Citizen
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

        // 1. Driver Banner & Vehicle info
        expect(find.textContaining('TÀI XẾ THU GOM RÁC CỒNG KỀNH CHUYÊN DỤNG'), findsOneWidget);
        expect(find.text('Lê Hoàng Long'), findsWidgets);
        expect(find.textContaining('51D-924.58'), findsWidgets);
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

    testWidgets(
      '4. BulkyOperatorScreen reviews PENDING_REVIEW order, finalizes price with note, and approves to APPROVED_AWAITING_PAYMENT',
      (tester) async {
        final storage = MockBulkyStorage();
        await storage.seedInitialOrdersIfEmpty();

        const reviewItem = BulkyItem(
          id: 'test-review-item-1',
          category: BulkyCategory.CABINET,
          displayName: 'Tủ gỗ công nghiệp 2 cánh',
          quantity: 1,
          lengthCm: 180,
          widthCm: 100,
          heightCm: 50,
          material: MaterialType.STANDARD,
        );
        final quote = PricingEngine.calculateQuote(
          items: [reviewItem],
          floorNumber: 2,
          hasElevator: false,
          now: DateTime(2026, 9, 26, 9, 0),
        );
        final reviewOrder = BulkyOrder(
          id: 'order-test-pending-review',
          items: [reviewItem],
          quote: quote,
          address: '88 Hàm Nghi, Phường Bến Nghé, Quận 1',
          pickupDate: '2026-09-28',
          status: BulkyOrderStatus.PENDING_REVIEW,
          paymentStatus: BulkyPaymentStatus.UNPAID,
          hasElevator: false,
          floorNumber: 2,
          contactName: 'Hoàng Anh Tuấn',
          contactPhone: '0908112233',
          createdAt: DateTime(2026, 9, 26, 9, 0),
        );
        await storage.saveOrder(reviewOrder);

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

        // 1. Verify pending review section & card
        expect(find.text('Đơn chờ xét duyệt giá'), findsWidgets);
        expect(find.text('Hoàng Anh Tuấn • 0908112233'), findsOneWidget);
        expect(find.text('88 Hàm Nghi, Phường Bến Nghé, Quận 1'), findsOneWidget);
        expect(find.textContaining('Tủ gỗ công nghiệp 2 cánh'), findsOneWidget);
        expect(find.textContaining('Dải giá AI ước tính:'), findsOneWidget);

        // 2. Tap approve button to open approval dialog
        final approveBtn = find.byKey(const Key('operator_approve_pricing_button_order-test-pending-review'));
        expect(approveBtn, findsOneWidget);
        await tester.tap(approveBtn);
        await tester.pumpAndSettle();

        // 3. Verify approval dialog content
        expect(find.text('Phê duyệt & Chốt giá đơn hàng'), findsOneWidget);
        expect(find.byKey(const Key('finalized_price_input')), findsOneWidget);
        expect(find.byKey(const Key('operator_approval_note_input')), findsOneWidget);

        // 4. Input finalized price and note
        await tester.enterText(find.byKey(const Key('finalized_price_input')), '350000');
        await tester.enterText(
          find.byKey(const Key('operator_approval_note_input')),
          'Đã kiểm tra ảnh chụp, chấp nhận cước trọn gói tầng 2 thang bộ',
        );
        await tester.pumpAndSettle();

        // 5. Confirm approval
        final confirmBtn = find.byKey(const Key('confirm_pricing_approval_button'));
        expect(confirmBtn, findsOneWidget);
        await tester.tap(confirmBtn);
        await tester.pumpAndSettle();

        // 6. Verify updated order status & attributes
        final updatedOrder = ordersProvider.getOrderById('order-test-pending-review');
        expect(updatedOrder?.status, BulkyOrderStatus.APPROVED_AWAITING_PAYMENT);
        expect(updatedOrder?.finalizedPriceVnd, 350000);
        expect(
          updatedOrder?.operatorNote,
          'Đã kiểm tra ảnh chụp, chấp nhận cước trọn gói tầng 2 thang bộ',
        );
      },
    );

    testWidgets(
      '5. BulkyOperatorScreen rejects PENDING_REVIEW order with custom rejection reason',
      (tester) async {
        final storage = MockBulkyStorage();
        await storage.seedInitialOrdersIfEmpty();

        const reviewItem = BulkyItem(
          id: 'test-reject-item',
          category: BulkyCategory.OTHER,
          displayName: 'Bình ga cũ và can sơn hóa chất',
          quantity: 2,
          lengthCm: 50,
          widthCm: 50,
          heightCm: 50,
          material: MaterialType.HEAVY,
        );
        final quote = PricingEngine.calculateQuote(
          items: [reviewItem],
          floorNumber: 0,
          hasElevator: false,
          now: DateTime(2026, 9, 26, 9, 0),
        );
        final rejectOrder = BulkyOrder(
          id: 'order-test-reject',
          items: [reviewItem],
          quote: quote,
          address: '15 Lê Thánh Tôn, Quận 1',
          pickupDate: '2026-09-29',
          status: BulkyOrderStatus.PENDING_REVIEW,
          paymentStatus: BulkyPaymentStatus.UNPAID,
          contactName: 'Phạm Minh',
          createdAt: DateTime(2026, 9, 26, 9, 0),
        );
        await storage.saveOrder(rejectOrder);

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

        final rejectBtn = find.byKey(const Key('operator_reject_booking_button_order-test-reject'));
        expect(rejectBtn, findsOneWidget);
        await tester.tap(rejectBtn);
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('reject_reason_input')), findsOneWidget);
        await tester.enterText(
          find.byKey(const Key('reject_reason_input')),
          'Chứa chất thải nguy hại dễ cháy nổ không thuộc danh mục thu gom',
        );
        await tester.pumpAndSettle();

        final confirmRejectBtn = find.byKey(const Key('confirm_reject_button'));
        expect(confirmRejectBtn, findsOneWidget);
        await tester.tap(confirmRejectBtn);
        await tester.pumpAndSettle();

        final updatedOrder = ordersProvider.getOrderById('order-test-reject');
        expect(updatedOrder?.status, BulkyOrderStatus.REJECTED);
        expect(
          updatedOrder?.operatorNote,
          'Chứa chất thải nguy hại dễ cháy nổ không thuộc danh mục thu gom',
        );
      },
    );

    testWidgets(
      '6. BulkyDriverScreen allows driver to report on-site discrepancy and displays waiting banner',
      (tester) async {
        final storage = MockBulkyStorage();
        await storage.seedInitialOrdersIfEmpty();
        final ordersProvider = OrdersProvider(storage: storage);
        await ordersProvider.loadOrders();

        // Put order into IN_PROGRESS
        await ordersProvider.startCollection('order-demo-scheduled');

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

        // Verify IN_PROGRESS state
        expect(find.textContaining('Đã có mặt tại hiện trường'), findsOneWidget);

        // Find report discrepancy button
        final discrepancyBtn = find.byKey(const Key('driver_report_discrepancy_button_order-demo-scheduled'));
        expect(discrepancyBtn, findsOneWidget);
        await tester.scrollUntilVisible(discrepancyBtn, 100);
        await tester.tap(discrepancyBtn);
        await tester.pumpAndSettle();

        // Verify Discrepancy Dialog
        expect(find.byKey(const Key('discrepancy_price_input')), findsOneWidget);
        expect(find.byKey(const Key('discrepancy_note_input')), findsOneWidget);
        expect(find.byKey(const Key('confirm_report_discrepancy_button')), findsOneWidget);

        // Input adjusted price & note
        await tester.enterText(find.byKey(const Key('discrepancy_price_input')), '450000');
        await tester.enterText(find.byKey(const Key('discrepancy_note_input')), 'Phát sinh thêm 1 nệm và tủ sắt');
        await tester.pumpAndSettle();

        // Tap confirm button
        await tester.tap(find.byKey(const Key('confirm_report_discrepancy_button')));
        await tester.pumpAndSettle();

        // Verify order status and attributes in provider
        final updatedOrder = ordersProvider.getOrderById('order-demo-scheduled');
        expect(updatedOrder?.status, BulkyOrderStatus.DISCREPANCY_PENDING);
        expect(updatedOrder?.onSiteAdjustedPriceVnd, 450000);
        expect(updatedOrder?.onSiteDiscrepancyNote, 'Phát sinh thêm 1 nệm và tủ sắt');

        // Verify driver screen shows discrepancy pending banner
        expect(find.textContaining('Đang chờ cư dân duyệt cước phát sinh (450.000 đ)'), findsOneWidget);
      },
    );

    testWidgets(
      '7. BulkyDriverScreen allows driver to reject collection on-site for safety violations',
      (tester) async {
        final storage = MockBulkyStorage();
        await storage.seedInitialOrdersIfEmpty();
        final ordersProvider = OrdersProvider(storage: storage);
        await ordersProvider.loadOrders();

        // Put order into IN_PROGRESS
        await ordersProvider.startCollection('order-demo-scheduled');

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

        // Find safety reject button
        final safetyRejectBtn = find.byKey(const Key('driver_reject_safety_button_order-demo-scheduled'));
        expect(safetyRejectBtn, findsOneWidget);
        await tester.scrollUntilVisible(safetyRejectBtn, 100);
        await tester.tap(safetyRejectBtn);
        await tester.pumpAndSettle();

        // Verify Safety Rejection Dialog
        expect(find.textContaining('Khấu trừ 50.000 đ phí điều xe thực tế, hoàn lại phần cọc còn lại cho cư dân.'), findsOneWidget);
        expect(find.byKey(const Key('safety_rejection_reason_input')), findsOneWidget);
        expect(find.byKey(const Key('confirm_safety_rejection_button')), findsOneWidget);

        // Input safety rejection reason
        await tester.enterText(
          find.byKey(const Key('safety_rejection_reason_input')),
          'Phát hiện bình gas mini và hóa chất công nghiệp dễ cháy nổ',
        );
        await tester.pumpAndSettle();

        // Tap confirm button
        await tester.tap(find.byKey(const Key('confirm_safety_rejection_button')));
        await tester.pumpAndSettle();

        // Verify order status and attributes in provider
        final updatedOrder = ordersProvider.getOrderById('order-demo-scheduled');
        expect(updatedOrder?.status, BulkyOrderStatus.REJECTED_ON_SITE);
        expect(updatedOrder?.onSiteRejectionReason, 'Phát hiện bình gas mini và hóa chất công nghiệp dễ cháy nổ');
        expect(updatedOrder?.calloutFeeVnd, 50000);
      },
    );

    testWidgets(
      '8. BulkyDriverScreen for Regular Waste Driver displays regular stops and allows completing collection',
      (tester) async {
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

        // 1. Driver Banner for regular waste
        expect(find.textContaining('TÀI XẾ THU GOM RÁC SINH HOẠT'), findsOneWidget);
        expect(find.text('Nguyễn Văn Hùng'), findsWidgets);
        expect(find.textContaining('51C-889.21'), findsWidgets);
        expect(find.textContaining('Xe ép rác 5T'), findsWidgets);

        // 2. Regular waste stops displayed (SH-01, SH-02, etc.)
        final confirmBtn = find.byKey(const Key('confirm_regular_collection_button_sh-01'));
        await tester.scrollUntilVisible(confirmBtn, 100);
        await tester.pumpAndSettle();

        expect(find.textContaining('#SH-01'), findsWidgets);
        expect(find.textContaining('Cư dân báo thùng đầy qua App'), findsWidgets);

        // 3. Confirm collection at SH-01
        expect(confirmBtn, findsOneWidget);
        await tester.tap(confirmBtn);
        await tester.pumpAndSettle();

        // 4. Verify completed stop shows "Đã ép tải"
        expect(find.text('Đã ép tải'), findsOneWidget);
      },
    );
  });
}
