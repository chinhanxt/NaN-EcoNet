import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bulky_mobile/features/auth/models/citizen_user.dart';
import 'package:bulky_mobile/features/auth/providers/auth_provider.dart';
import 'package:bulky_mobile/features/citizen_home/screens/citizen_home_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget createTestWidget({
    AuthProvider? authProvider,
    ValueChanged<int>? onNavigateTab,
  }) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider ?? AuthProvider(initialUser: CitizenUser.demoCitizen),
        ),
      ],
      child: MaterialApp(
        home: CitizenHomeScreen(
          onNavigateTab: onNavigateTab,
        ),
      ),
    );
  }

  group('CitizenHomeScreen Widget Tests', () {
    testWidgets('1. Renders Header, Greeting, IoT Telemetry, Schedule, and Eco Impact',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Top App Bar
      expect(find.text('SMARTBIN CITIZEN'), findsOneWidget);
      expect(find.byKey(const Key('home_notifications_button')), findsOneWidget);
      expect(find.text('2'), findsOneWidget); // Badge notification count

      // Greeting Banner
      expect(find.textContaining('Xin chào,', findRichText: true), findsOneWidget);
      expect(find.textContaining('Nguyễn Văn An', findRichText: true), findsOneWidget);
      expect(find.textContaining('HH-78921', findRichText: true), findsOneWidget);

      // THÙNG RÁC THÔNG MINH GIA ĐÌNH card has been removed per citizen UI simplification
      expect(find.text('THÙNG RÁC THÔNG MINH GIA ĐÌNH'), findsNothing);

      // Card: Weekly Schedule Strip & Today's Schedule (Deepthi)
      expect(find.text('LỊCH THU GOM HÔM NAY'), findsOneWidget);
      expect(find.text('T2'), findsOneWidget);
      expect(find.text('T3'), findsOneWidget);
      expect(find.text('T4'), findsOneWidget);
      expect(find.text('T5'), findsOneWidget);
      expect(find.text('T6'), findsOneWidget);
      expect(find.text('T7'), findsOneWidget);
      expect(find.text('CN'), findsOneWidget);
      expect(find.text('Hôm nay'), findsOneWidget);
      expect(find.text('Rác sinh hoạt & Tái chế định kỳ'), findsOneWidget);
      expect(find.textContaining('🍏 Hữu cơ'), findsOneWidget);
      expect(find.textContaining('♻️ Tái chế'), findsOneWidget);
      expect(find.textContaining('08:00 - 10:00'), findsOneWidget);
      expect(find.textContaining('🚚 Xe số 03 đang đến thu gom • Cách bạn 1.2 km'), findsOneWidget);

      // Quick Actions Header & 4 Grid Cards
      expect(find.text('HÀNH ĐỘNG NHANH'), findsOneWidget);
      expect(find.byKey(const Key('quick_action_bulky_booking')), findsOneWidget);
      expect(find.byKey(const Key('quick_action_billing')), findsOneWidget);
      expect(find.byKey(const Key('quick_action_rewards')), findsOneWidget);
      expect(find.byKey(const Key('quick_action_complaint')), findsOneWidget);

      // Card 3: Eco Impact (LazyInterface)
      expect(find.text('ĐÓNG GÓP MÔI TRƯỜNG (Eco Impact)'), findsOneWidget);
      expect(find.text('34.5 kg'), findsOneWidget);
      expect(find.text('6.8 kg CO₂'), findsOneWidget);
      expect(find.textContaining('0.4 cây xanh'), findsOneWidget);
    });

    testWidgets('2. Tapping bulky booking action tile triggers tab navigation',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      int? navigatedTab;
      await tester.pumpWidget(
        createTestWidget(
          onNavigateTab: (index) => navigatedTab = index,
        ),
      );
      await tester.pumpAndSettle();

      final bulkyAction = find.byKey(const Key('quick_action_bulky_booking'));
      expect(bulkyAction, findsOneWidget);
      await tester.ensureVisible(bulkyAction);
      await tester.tap(bulkyAction);
      await tester.pumpAndSettle();

      expect(navigatedTab, 1); // Tab 1 is Thu gom
    });

    testWidgets('3. Tapping billing quick action opens monthly billing sheet',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final billingAction = find.byKey(const Key('quick_action_billing'));
      await tester.ensureVisible(billingAction);
      await tester.tap(billingAction);
      await tester.pumpAndSettle();

      expect(find.text('💳 Phí Dịch Vụ Vệ Sinh Môi Trường'), findsOneWidget);
      expect(find.text('Tháng 09/2026'), findsOneWidget);
      expect(find.text('45.000 đ / tháng'), findsOneWidget);
      expect(find.textContaining('ĐÃ THANH TOÁN'), findsOneWidget);

      // Close sheet
      await tester.tap(find.text('Đóng'));
      await tester.pumpAndSettle();
      expect(find.text('💳 Phí Dịch Vụ Vệ Sinh Môi Trường'), findsNothing);
    });

    testWidgets('4. Tapping rewards action opens eco rewards exchange sheet',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final rewardsAction = find.byKey(const Key('quick_action_rewards'));
      await tester.ensureVisible(rewardsAction);
      await tester.tap(rewardsAction);
      await tester.pumpAndSettle();

      expect(find.textContaining('🎁 Đổi Điểm Xanh'), findsOneWidget);
      expect(find.text('Highlands Coffee'), findsOneWidget);
      expect(find.text('Phúc Long Tea & Coffee'), findsOneWidget);

      // Tap exchange
      await tester.tap(find.text('Đổi quà').first);
      await tester.pumpAndSettle();

      expect(find.textContaining('thành công'), findsOneWidget);
    });

    testWidgets('5. Tapping complaint quick action opens feedback dialog',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final complaintAction = find.byKey(const Key('quick_action_complaint'));
      await tester.ensureVisible(complaintAction);
      await tester.tap(complaintAction);
      await tester.pumpAndSettle();

      expect(find.text('Phản Ánh Thùng Rác'), findsOneWidget);
      expect(find.text('Thùng quá tải'), findsOneWidget);
      expect(find.text('Bị bốc mùi hôi'), findsOneWidget);

      // Submit feedback
      await tester.tap(find.text('Gửi phản ánh'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Đã gửi phản ánh'), findsOneWidget);
    });

    testWidgets('6. Tapping notifications bell button opens notifications sheet',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      final bellButton = find.byKey(const Key('home_notifications_button'));
      await tester.tap(bellButton);
      await tester.pumpAndSettle();

      expect(find.text('🔔 Thông Báo Mới (2)'), findsOneWidget);
      expect(find.text('Xe số 03 đang đến thu gom'), findsOneWidget);
      expect(find.text('+20 Điểm Xanh đã cộng vào ví'), findsOneWidget);
    });

    testWidgets('7. Weekly schedule strip highlights today and displays waste category badges',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Check all 7 days in the horizontal strip
      expect(find.text('T2'), findsOneWidget);
      expect(find.text('T3'), findsOneWidget);
      expect(find.text('T4'), findsOneWidget);
      expect(find.text('T5'), findsOneWidget);
      expect(find.text('T6'), findsOneWidget);
      expect(find.text('T7'), findsOneWidget);
      expect(find.text('CN'), findsOneWidget);
      expect(find.text('Hôm nay'), findsOneWidget);

      // Check waste categories
      expect(find.text('🍏 Hữu cơ'), findsOneWidget);
      expect(find.text('♻️ Tái chế'), findsOneWidget);

      // Check proximity card and ETA
      expect(find.textContaining('Xe số 03 đang đến thu gom'), findsOneWidget);
      expect(find.textContaining('1.2 km'), findsOneWidget);
    });
  });
}
