import 'package:flutter/material.dart' hide MaterialType;
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/services/ai/ai_recognition_result.dart';
import 'package:bulky_mobile/core/theme/bulky_theme.dart';
import 'package:bulky_mobile/core/services/storage/mock_bulky_storage.dart';
import 'package:bulky_mobile/features/orders/providers/orders_provider.dart';
import 'package:bulky_mobile/features/scan/providers/scan_provider.dart';
import 'package:bulky_mobile/features/scan/widgets/bulky_camera_preview.dart';
import 'package:bulky_mobile/features/request_wizard/providers/booking_wizard_provider.dart';
import 'package:bulky_mobile/features/request_wizard/widgets/material_survey_chips.dart';
import 'package:bulky_mobile/features/request_wizard/widgets/live_pricing_bottom_bar.dart';
import 'package:bulky_mobile/features/request_wizard/screens/bulky_booking_wizard_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget createTestApp({
  required BookingWizardProvider wizardProvider,
  ScanProvider? scanProvider,
  OrdersProvider? ordersProvider,
  Map<String, WidgetBuilder>? routes,
  Widget? child,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<BookingWizardProvider>.value(value: wizardProvider),
      ChangeNotifierProvider<ScanProvider>.value(
        value: scanProvider ?? ScanProvider(),
      ),
      ChangeNotifierProvider<OrdersProvider>.value(
        value: ordersProvider ?? OrdersProvider(),
      ),
    ],
    child: MaterialApp(
      theme: BulkyTheme.lightTheme,
      routes: routes ?? {},
      home: child ?? const BulkyBookingWizardScreen(),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('MaterialSurveyChips Widget', () {
    testWidgets('renders all 3 material options with icons, labels, and price deltas',
        (tester) async {
      MaterialType selected = MaterialType.STANDARD;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return MaterialSurveyChips(
                  selectedMaterial: selected,
                  onMaterialChanged: (mat) {
                    setState(() {
                      selected = mat;
                    });
                  },
                );
              },
            ),
          ),
        ),
      );

      // Verify all 3 options exist
      expect(find.textContaining('Nhựa'), findsOneWidget);
      expect(find.textContaining('-20%'), findsOneWidget);

      expect(find.textContaining('Tiêu chuẩn'), findsOneWidget);
      expect(find.textContaining('Gốc'), findsOneWidget);

      expect(find.textContaining('Gỗ đặc'), findsOneWidget);
      expect(find.textContaining('+30%'), findsOneWidget);

      // Tap HEAVY chip
      await tester.tap(find.textContaining('+30%'));
      await tester.pumpAndSettle();

      expect(selected, MaterialType.HEAVY);
    });
  });

  group('LivePricingBottomBar Widget', () {
    testWidgets('displays estimated price range, deposit hold, and disabled next button when empty',
        (tester) async {
      final wizardProvider = BookingWizardProvider();

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
          child: const Scaffold(
            bottomNavigationBar: LivePricingBottomBar(),
          ),
        ),
      );

      // When items are empty, button is disabled
      final nextButton = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Tiếp tục'),
      );
      expect(nextButton.onPressed, isNull);

      // Add item to enable button
      wizardProvider.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa da',
        material: MaterialType.STANDARD,
      ));
      await tester.pumpAndSettle();

      // Quote: 150.000 (Sofa) + 25.000 (Area) = 175.000 Min, 227.500 Max (~227.500 đ)
      expect(find.textContaining('175.000 đ'), findsWidgets);
      expect(find.textContaining('Cọc giữ chỗ: 175.000 đ'), findsOneWidget);

      final nextButtonEnabled = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Tiếp tục'),
      );
      expect(nextButtonEnabled.onPressed, isNotNull);
    });
  });

  group('BulkyBookingWizardScreen Integration Tests', () {
    testWidgets('1. Step switching between step 0, 1, 2 with full validation',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      final scanProvider = ScanProvider();

      // Start with 1 item so Step 0 can proceed
      wizardProvider.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.SOFA,
        displayName: 'Ghế sofa dài',
        quantity: 1,
        material: MaterialType.STANDARD,
      ));

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
          scanProvider: scanProvider,
        ),
      );
      await tester.pumpAndSettle();

      // In Step 0: Items & Camera
      expect(find.text('1: Đồ vật & Ảnh'), findsWidgets);
      expect(find.text('Ghế sofa dài'), findsOneWidget);

      // Tap "Tiếp tục" to advance to Step 1
      await tester.tap(find.widgetWithText(ElevatedButton, 'Tiếp tục'));
      await tester.pumpAndSettle();

      expect(wizardProvider.currentStep, 1);
      expect(find.text('2: Địa điểm'), findsWidgets);

      // On Step 1: "Tiếp tục" should be disabled until address & date are entered
      final nextButtonOnStep1 = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Tiếp tục'),
      );
      expect(nextButtonOnStep1.onPressed, isNull);

      // Use quick chip for address
      final addressChip = find.textContaining('123 Nguyễn Thị Minh Khai');
      expect(addressChip, findsOneWidget);
      await tester.ensureVisible(addressChip);
      await tester.tap(addressChip);
      await tester.pumpAndSettle();

      // Use quick chip for date "Ngày mai"
      final tomorrowChip = find.text('Ngày mai');
      expect(tomorrowChip, findsOneWidget);
      await tester.ensureVisible(tomorrowChip);
      await tester.tap(tomorrowChip);
      await tester.pumpAndSettle();

      // Now "Tiếp tục" is enabled
      final nextButtonEnabled = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Tiếp tục'),
      );
      expect(nextButtonEnabled.onPressed, isNotNull);

      // Advance to Step 2
      await tester.tap(find.widgetWithText(ElevatedButton, 'Tiếp tục'));
      await tester.pumpAndSettle();

      expect(wizardProvider.currentStep, 2);
      expect(find.text('3: Xác nhận'), findsWidgets);

      // Verify Step 2 Review summary elements
      expect(find.textContaining('123 Nguyễn Thị Minh Khai'), findsWidgets);
      expect(find.textContaining(TOLERANCE_MESSAGE), findsOneWidget);
      expect(find.textContaining('Cọc giữ chỗ'), findsWidgets);

      // Test "Quay lại" to Step 1
      await tester.tap(find.text('Quay lại'));
      await tester.pumpAndSettle();
      expect(wizardProvider.currentStep, 1);

      // Test "Quay lại" to Step 0
      await tester.tap(find.text('Quay lại'));
      await tester.pumpAndSettle();
      expect(wizardProvider.currentStep, 0);
    });

    testWidgets('2. Tapping HEAVY material chip updates price and weight dynamically',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      final scanProvider = ScanProvider();

      // Initial standard item: Table (80.000 + 25.000 = 105.000, 20.0 kg)
      wizardProvider.addItem(const BulkyItem(
        id: 'table-1',
        category: BulkyCategory.TABLE,
        displayName: 'Bàn gỗ phòng ăn',
        quantity: 1,
        material: MaterialType.STANDARD,
      ));

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
          scanProvider: scanProvider,
        ),
      );
      await tester.pumpAndSettle();

      // Verify initial weight and price
      expect(find.textContaining('20.0 kg'), findsWidgets);
      expect(find.textContaining('105.000 đ'), findsWidgets);

      // Tap HEAVY chip (+30%)
      final heavyChip = find.textContaining('+30%');
      expect(heavyChip, findsOneWidget);
      await tester.ensureVisible(heavyChip);
      await tester.tap(heavyChip);
      await tester.pumpAndSettle();

      // Standard Table (80k * 1.3 = 104k + 25k area = 129k, weight 20 * 1.4 = 28.0 kg)
      expect(wizardProvider.items.first.material, MaterialType.HEAVY);
      expect(find.textContaining('28.0 kg'), findsWidgets);
      expect(find.textContaining('129.000 đ'), findsWidgets);
    });

    testWidgets('3. Auto-filling items from AI scan via "Quét với AI" trigger',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      final scanProvider = ScanProvider();

      // Set mock AI recognition result on scanProvider
      final mockResult = AiRecognitionResult(
        decision: AiDecision.SUGGESTED,
        requiresManualReview: false,
        explanation: 'Nhận diện thành công 2 món phế thải',
        items: const [
          BulkyItem(
            id: 'ai-item-1',
            category: BulkyCategory.SOFA,
            displayName: 'Sofa góc bọc da',
            quantity: 1,
            material: MaterialType.STANDARD,
          ),
          BulkyItem(
            id: 'ai-item-2',
            category: BulkyCategory.CABINET,
            displayName: 'Tủ quần áo gỗ 2 cánh',
            quantity: 1,
            material: MaterialType.STANDARD,
          ),
        ],
        boundingBoxes: const [
          BoundingBox(
            ymin: 100,
            xmin: 100,
            ymax: 500,
            xmax: 500,
            displayName: 'Sofa góc bọc da',
            category: BulkyCategory.SOFA,
          ),
        ],
      );

      // Set scan provider result and valid png bytes
      scanProvider.setScanResult(
        mockResult,
        kPresetSamplePngBytes,
      );

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
          scanProvider: scanProvider,
        ),
      );
      await tester.pumpAndSettle();

      // Trigger "Quét với AI"
      final aiSyncButton = find.textContaining('Quét với AI');
      expect(aiSyncButton, findsOneWidget);
      await tester.ensureVisible(aiSyncButton);
      await tester.tap(aiSyncButton);
      await tester.pumpAndSettle();

      // Items from AI recognition result should now be in the list
      expect(wizardProvider.items.length, 2);
      expect(find.text('Sofa góc bọc da'), findsOneWidget);
      expect(find.text('Tủ quần áo gỗ 2 cánh'), findsOneWidget);
    });

    testWidgets('4. Quantity stepper and Add/Remove item updates list and pricing',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      final scanProvider = ScanProvider();

      wizardProvider.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.MATTRESS,
        displayName: 'Đệm lò xo',
        quantity: 1,
        material: MaterialType.STANDARD, // 100.000 + 25.000 area = 125.000
      ));

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
          scanProvider: scanProvider,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('1'), findsWidgets);
      expect(wizardProvider.items.first.quantity, 1);

      // Increment quantity: tap '+'
      final addIcon = find.byIcon(Icons.add);
      await tester.ensureVisible(addIcon);
      await tester.tap(addIcon);
      await tester.pumpAndSettle();

      expect(wizardProvider.items.first.quantity, 2);
      // 2x 100.000 = 200.000 + 25.000 area = 225.000
      expect(find.textContaining('225.000 đ'), findsWidgets);

      // Tap "Thêm món đồ"
      final addItemBtn = find.text('Thêm món đồ');
      await tester.ensureVisible(addItemBtn);
      await tester.tap(addItemBtn);
      await tester.pumpAndSettle();

      expect(wizardProvider.items.length, 2);

      // Remove second item
      final deleteButtons = find.byIcon(Icons.delete_outline);
      expect(deleteButtons, findsNWidgets(2));
      await tester.ensureVisible(deleteButtons.last);
      await tester.tap(deleteButtons.last);
      await tester.pumpAndSettle();

      expect(wizardProvider.items.length, 1);
    });

    testWidgets('5. Logistics handling toggles update surcharges in Step 2',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      wizardProvider.addItem(const BulkyItem(
        id: 'item-sofa',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa',
        material: MaterialType.STANDARD, // 150.000 + 25.000 = 175.000
      ));

      // Advance to step 1
      wizardProvider.nextStep();
      expect(wizardProvider.currentStep, 1);

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
        ),
      );
      await tester.pumpAndSettle();

      expect(wizardProvider.requiresDisassembly, isFalse);
      expect(wizardProvider.currentQuote!.disassemblyFee, 0);

      // Toggle Disassembly switch
      final disassemblyTile = find.textContaining('Tháo dỡ đồ (+30.000 đ)');
      expect(disassemblyTile, findsOneWidget);
      await tester.ensureVisible(disassemblyTile);
      await tester.tap(disassemblyTile);
      await tester.pumpAndSettle();

      expect(wizardProvider.requiresDisassembly, isTrue);
      // 150.000 + 30.000 (disassembly) + 25.000 (area) = 205.000
      expect(wizardProvider.currentQuote!.minVnd, 205000);
      expect(find.textContaining('205.000 đ'), findsWidgets);
    });

    testWidgets('6. Quick category selector adds preset bulky item to wizard',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
        ),
      );
      await tester.pumpAndSettle();

      expect(wizardProvider.items.isEmpty, isTrue);

      // Tap quick add sofa button
      final quickAddSofa = find.byKey(const Key('quick_add_sofa_button'));
      expect(quickAddSofa, findsOneWidget);
      await tester.tap(quickAddSofa);
      await tester.pumpAndSettle();

      // Verify sofa was added
      expect(wizardProvider.items.length, 1);
      expect(wizardProvider.items.first.category, BulkyCategory.SOFA);
      expect(wizardProvider.items.first.displayName, 'Sofa da phòng khách');
      expect(wizardProvider.items.first.material, MaterialType.STANDARD);
    });

    testWidgets('7. Curbside vs Inside Home pickup updates floorNumber and surcharges',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      wizardProvider.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.CABINET,
        displayName: 'Tủ gỗ',
        material: MaterialType.STANDARD,
      ));

      // Advance to step 1 (logistics)
      wizardProvider.nextStep();
      expect(wizardProvider.currentStep, 1);

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
        ),
      );
      await tester.pumpAndSettle();

      // Tap Inside Pickup
      final insideBtn = find.byKey(const Key('inside_pickup_choice'));
      expect(insideBtn, findsOneWidget);
      await tester.ensureVisible(insideBtn);
      await tester.tap(insideBtn);
      await tester.pumpAndSettle();

      // Floor stepper should now be active, floorNumber starts at 1
      expect(wizardProvider.floorNumber, 1);

      // Now tap Curbside Pickup
      final curbsideBtn = find.byKey(const Key('curbside_pickup_choice'));
      expect(curbsideBtn, findsOneWidget);
      await tester.ensureVisible(curbsideBtn);
      await tester.tap(curbsideBtn);
      await tester.pumpAndSettle();

      // Curbside sets floorNumber to 0 (free)
      expect(wizardProvider.floorNumber, 0);
      expect(wizardProvider.currentQuote!.floorHandlingFee, 0);
    });

    testWidgets('8. Tapping price breakdown trigger opens transparency modal bottom sheet',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      wizardProvider.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa da',
        material: MaterialType.STANDARD,
      ));

      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
        ),
      );
      await tester.pumpAndSettle();

      // Tap the breakdown drawer button
      final drawerBtn = find.byKey(const Key('price_breakdown_drawer_button'));
      expect(drawerBtn, findsOneWidget);
      await tester.tap(drawerBtn);
      await tester.pumpAndSettle();

      // Modal bottom sheet should appear with detailed breakdown
      expect(find.textContaining('Chi Tiết Bảng Cước'), findsOneWidget);
      expect(find.textContaining('±15%'), findsOneWidget);
      expect(find.text('Đã hiểu bảng cước'), findsOneWidget);

      // Tap close button in bottom sheet
      await tester.tap(find.text('Đã hiểu bảng cước'));
      await tester.pumpAndSettle();

      // Sheet should be dismissed
      expect(find.textContaining('Chi Tiết Bảng Cước'), findsNothing);
    });

    testWidgets('9. Tapping GỬI YÊU CẦU XÉT DUYỆT at Step 2 creates PENDING_REVIEW order and navigates to order-detail',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final wizardProvider = BookingWizardProvider();
      final storage = MockBulkyStorage();
      final ordersProvider = OrdersProvider(storage: storage);

      // Add item and logistics details
      wizardProvider.addItem(const BulkyItem(
        id: 'item-1',
        category: BulkyCategory.SOFA,
        displayName: 'Ghế sofa da',
        quantity: 1,
        material: MaterialType.STANDARD,
      ));
      wizardProvider.setCustomerInfo(
        name: 'Nguyễn Văn Cư Dân',
        phone: '0901234567',
        address: '123 Nguyễn Thị Minh Khai, Q.1',
        date: '2026-10-15',
        timeSlot: '09:00 - 11:00',
      );

      // Advance directly to step 2 (Review)
      wizardProvider.goToStep(2);
      expect(wizardProvider.currentStep, 2);

      String? navigatedOrderId;
      await tester.pumpWidget(
        createTestApp(
          wizardProvider: wizardProvider,
          ordersProvider: ordersProvider,
          routes: {
            '/order-detail': (context) {
              navigatedOrderId = ModalRoute.of(context)?.settings.arguments as String?;
              return Scaffold(
                body: Text('Chi tiết đơn hàng: $navigatedOrderId'),
              );
            },
          },
        ),
      );
      await tester.pumpAndSettle();

      // Verify explanation banner in step_review_summary
      expect(
        find.text(
          'Đơn hàng sẽ được chuyển đến Điều phối viên để kiểm tra và chốt mức giá chính xác. Bạn chỉ cần thanh toán cọc sau khi đơn được phê duyệt.',
        ),
        findsOneWidget,
      );

      // Verify CTA button label
      final ctaFinder = find.widgetWithText(ElevatedButton, 'GỬI YÊU CẦU XÉT DUYỆT');
      expect(ctaFinder, findsOneWidget);
      expect(find.byKey(const Key('wizard_submit_review_button')), findsOneWidget);
      expect(find.byKey(const Key('wizard_next_button')), findsOneWidget);

      // Tap CTA button
      await tester.tap(ctaFinder);
      for (int i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      // Verify SnackBar shown
      expect(
        find.text(
          'Đã gửi yêu cầu xét duyệt thành công! Điều phối viên sẽ kiểm tra và chốt giá sớm nhất.',
        ),
        findsOneWidget,
      );

      await tester.pumpAndSettle();

      // Verify order created with PENDING_REVIEW status
      expect(ordersProvider.orders.length, 1);
      final createdOrder = ordersProvider.orders.first;
      expect(createdOrder.status, BulkyOrderStatus.PENDING_REVIEW);
      expect(createdOrder.paymentStatus, BulkyPaymentStatus.UNPAID);
      expect(createdOrder.address, '123 Nguyễn Thị Minh Khai, Q.1');
      expect(createdOrder.items.first.displayName, 'Ghế sofa da');

      // Verify navigation to /order-detail with created order id
      expect(navigatedOrderId, createdOrder.id);
      expect(find.text('Chi tiết đơn hàng: ${createdOrder.id}'), findsOneWidget);
    });
  });
}
