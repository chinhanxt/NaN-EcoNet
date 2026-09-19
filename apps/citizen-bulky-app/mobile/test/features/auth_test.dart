import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bulky_mobile/features/auth/providers/auth_provider.dart';
import 'package:bulky_mobile/features/auth/screens/bulky_account_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('AuthProvider Unit Tests', () {
    test('1. starts with demo user or authenticated by default', () {
      final auth = AuthProvider();
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentUser?.name, 'Nguyễn Văn An');
      expect(auth.currentUser?.householdId, 'HH-78921');
    });

    test('2. logout clears user state', () async {
      final auth = AuthProvider();
      await auth.logout();

      expect(auth.isAuthenticated, isFalse);
      expect(auth.currentUser, isNull);
    });

    test('3. login with phone and password sets user', () async {
      final auth = AuthProvider();
      await auth.logout();

      final success = await auth.login('0988777666', 'secret');
      expect(success, isTrue);
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentUser?.phone, '0988777666');
      expect(auth.currentUser?.householdId, contains('7666'));
    });

    test('4. loginDemo restores demo user', () async {
      final auth = AuthProvider();
      await auth.logout();
      expect(auth.isAuthenticated, isFalse);

      await auth.loginDemo();
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentUser?.name, 'Nguyễn Văn An');
    });
  });

  group('BulkyAccountScreen Widget Tests', () {
    testWidgets('1. renders logged-in profile card and citizen details', (tester) async {
      final auth = AuthProvider();

      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<AuthProvider>.value(
            value: auth,
            child: const BulkyAccountScreen(),
          ),
        ),
      );

      expect(find.text('Tài Khoản Công Dân'), findsOneWidget);
      expect(find.text('Nguyễn Văn An'), findsOneWidget);
      expect(find.text('0912.345.678'), findsOneWidget);
      expect(find.text('HH-78921'), findsOneWidget);
      expect(find.byKey(const Key('logout_button')), findsOneWidget);
    });

    testWidgets('2. tapping logout button opens confirmation dialog and logs out', (tester) async {
      final auth = AuthProvider();

      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<AuthProvider>.value(
            value: auth,
            child: const BulkyAccountScreen(),
          ),
        ),
      );

      // Scroll to logout button and tap
      await tester.scrollUntilVisible(find.byKey(const Key('logout_button')), 100);
      await tester.tap(find.byKey(const Key('logout_button')));
      await tester.pumpAndSettle();

      expect(find.text('Đăng Xuất'), findsOneWidget);
      expect(find.text('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng Smartbin Bulky?'), findsOneWidget);

      // Confirm logout
      await tester.tap(find.byKey(const Key('confirm_logout_button')));
      await tester.pumpAndSettle();

      expect(auth.isAuthenticated, isFalse);
      expect(find.text('Đăng Nhập Tài Khoản Công Dân'), findsOneWidget);
      expect(find.byKey(const Key('login_submit_button')), findsOneWidget);
    });

    testWidgets('3. quick demo login restores authenticated profile in UI', (tester) async {
      final auth = AuthProvider();
      await auth.logout();

      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<AuthProvider>.value(
            value: auth,
            child: const BulkyAccountScreen(),
          ),
        ),
      );

      expect(find.text('Đăng Nhập Tài Khoản Công Dân'), findsOneWidget);
      expect(find.byKey(const Key('login_quick_demo_button')), findsOneWidget);

      // Tap quick login demo
      await tester.tap(find.byKey(const Key('login_quick_demo_button')));
      await tester.pumpAndSettle();

      expect(auth.isAuthenticated, isTrue);
      expect(find.text('Nguyễn Văn An'), findsOneWidget);
    });
  });
}
