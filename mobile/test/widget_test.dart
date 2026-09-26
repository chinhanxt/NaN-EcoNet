import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bulky_mobile/main.dart';
import 'package:bulky_mobile/core/theme/bulky_colors.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('Smartbin Bulky app smoke test and bottom navigation', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const BulkyApp());
    await tester.pumpAndSettle();

    // Verify Citizen Home Dashboard elements are displayed on Tab 0
    expect(find.text('SMARTBIN CITIZEN'), findsOneWidget);
    expect(find.text('THÙNG RÁC THÔNG MINH GIA ĐÌNH'), findsNothing);
    expect(find.text('LỊCH THU GOM HÔM NAY'), findsOneWidget);
    expect(find.text('HÀNH ĐỘNG NHANH'), findsOneWidget);

    // Verify BottomNavigationBar tabs are displayed
    expect(find.text('Trang chủ'), findsOneWidget);
    expect(find.text('Thu gom'), findsOneWidget);
    expect(find.text('Đơn & Phí'), findsOneWidget);
    expect(find.text('Tài khoản'), findsOneWidget);

    // Switch to Tab 1: Thu gom
    await tester.tap(find.text('Thu gom'));
    await tester.pumpAndSettle();
    expect(find.text('Đặt Thu Gom Rác Cồng Kềnh'), findsOneWidget);

    // Switch to Tab 2: Đơn & Phí
    await tester.tap(find.text('Đơn & Phí'));
    await tester.pumpAndSettle();
    expect(find.text('Đơn Của Tôi'), findsOneWidget);

    // Switch to Tab 3: Tài khoản
    await tester.tap(find.text('Tài khoản'));
    await tester.pumpAndSettle();
    expect(find.text('Tài Khoản Công Dân'), findsOneWidget);
    expect(find.text('Nguyễn Văn An'), findsOneWidget);

    // Switch back to Tab 0: Trang chủ
    await tester.tap(find.text('Trang chủ'));
    await tester.pumpAndSettle();
    expect(find.text('SMARTBIN CITIZEN'), findsOneWidget);

    // Verify BulkyColors palette constants
    expect(BulkyColors.primary, const Color(0xFF059669));
    expect(BulkyColors.success, const Color(0xFF16A34A));
    expect(BulkyColors.background, const Color(0xFFF6FBF8));
  });
}
