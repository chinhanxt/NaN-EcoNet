import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/domain/models/bulky_order.dart';
import 'core/domain/models/bulky_quote.dart';
import 'core/theme/bulky_colors.dart';
import 'core/theme/bulky_theme.dart';
import 'features/auth/models/citizen_user.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/bulky_account_screen.dart';
import 'features/citizen_home/screens/citizen_home_screen.dart';
import 'features/driver/screens/bulky_driver_screen.dart';
import 'features/operator/screens/bulky_operator_screen.dart';
import 'features/orders/providers/orders_provider.dart';
import 'features/orders/screens/bulky_order_detail_screen.dart';
import 'features/orders/screens/bulky_orders_list_screen.dart';
import 'features/payment/screens/bulky_payment_screen.dart';
import 'features/quote/screens/bulky_quote_screen.dart';
import 'features/request_wizard/providers/booking_wizard_provider.dart';
import 'features/request_wizard/screens/bulky_booking_wizard_screen.dart';
import 'features/scan/providers/scan_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BulkyApp());
}

class BulkyApp extends StatelessWidget {
  const BulkyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider()..loadSession(),
        ),
        ChangeNotifierProvider<ScanProvider>(
          create: (_) => ScanProvider(),
        ),
        ChangeNotifierProvider<BookingWizardProvider>(
          create: (_) => BookingWizardProvider(),
        ),
        ChangeNotifierProvider<OrdersProvider>(
          create: (_) => OrdersProvider()..loadOrders(),
        ),
      ],
      child: MaterialApp(
        title: 'Smartbin Bulky',
        theme: BulkyTheme.lightTheme,
        debugShowCheckedModeBanner: false,
        initialRoute: '/',
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case '/':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) => const BulkyHomeScreen(),
              );
            case '/quote':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) {
                  if (settings.arguments is BulkyQuote) {
                    return BulkyQuoteScreen(quote: settings.arguments as BulkyQuote);
                  } else if (settings.arguments is BulkyOrder) {
                    return BulkyQuoteScreen(order: settings.arguments as BulkyOrder);
                  }
                  return const BulkyQuoteScreen();
                },
              );
            case '/payment':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) {
                  final orderId = settings.arguments as String?;
                  return BulkyPaymentScreen(orderId: orderId);
                },
              );
            case '/order-detail':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) {
                  final orderId = settings.arguments as String?;
                  return BulkyOrderDetailScreen(orderId: orderId);
                },
              );
            case '/orders':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) => const BulkyOrdersListScreen(),
              );
            case '/account':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) => const BulkyAccountScreen(),
              );
            case '/operator':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) => const BulkyOperatorScreen(),
              );
            case '/driver':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) => const BulkyDriverScreen(),
              );
            case '/wizard':
              return MaterialPageRoute(
                settings: settings,
                builder: (_) => const BulkyBookingWizardScreen(),
              );
            default:
              return MaterialPageRoute(
                settings: settings,
                builder: (_) => const BulkyHomeScreen(),
              );
          }
        },
      ),
    );
  }
}

class BulkyHomeScreen extends StatefulWidget {
  final int initialTab;

  const BulkyHomeScreen({
    super.key,
    this.initialTab = 0,
  });

  @override
  State<BulkyHomeScreen> createState() => _BulkyHomeScreenState();
}

class _BulkyHomeScreenState extends State<BulkyHomeScreen> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialTab;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final role = auth.currentRole;

    List<Widget> screens;
    List<BottomNavigationBarItem> navItems;

    switch (role) {
      case UserRole.citizen:
        screens = [
          CitizenHomeScreen(
            onNavigateTab: (tabIndex) {
              setState(() {
                _currentIndex = tabIndex;
              });
            },
          ),
          const BulkyBookingWizardScreen(),
          const BulkyOrdersListScreen(),
          const BulkyAccountScreen(),
        ];
        navItems = const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home_rounded),
            label: 'Trang chủ',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.chair_outlined),
            activeIcon: Icon(Icons.chair_rounded),
            label: 'Thu gom',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_outlined),
            activeIcon: Icon(Icons.receipt_long),
            label: 'Đơn & Phí',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline_rounded),
            activeIcon: Icon(Icons.person_rounded),
            label: 'Tài khoản',
          ),
        ];
        break;
      case UserRole.operator:
        screens = const [
          BulkyOperatorScreen(),
          BulkyOrdersListScreen(),
          BulkyAccountScreen(),
        ];
        navItems = const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard_rounded),
            label: 'Điều phối xe',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_outlined),
            activeIcon: Icon(Icons.receipt_long),
            label: 'Tất cả đơn',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.admin_panel_settings_outlined),
            activeIcon: Icon(Icons.admin_panel_settings_rounded),
            label: 'Tài khoản',
          ),
        ];
        break;
      case UserRole.driver:
        screens = const [
          BulkyDriverScreen(),
          BulkyOrdersListScreen(),
          BulkyAccountScreen(),
        ];
        navItems = const [
          BottomNavigationBarItem(
            icon: Icon(Icons.local_shipping_outlined),
            activeIcon: Icon(Icons.local_shipping_rounded),
            label: 'Lộ trình xe',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_outlined),
            activeIcon: Icon(Icons.receipt_long),
            label: 'Lịch sử chuyến',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline_rounded),
            activeIcon: Icon(Icons.person_rounded),
            label: 'Tài khoản',
          ),
        ];
        break;
    }

    final safeIndex = _currentIndex < screens.length ? _currentIndex : 0;

    return Scaffold(
      body: IndexedStack(
        index: safeIndex,
        children: screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: safeIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        selectedItemColor: role == UserRole.driver
            ? const Color(0xFFEA580C)
            : (role == UserRole.operator ? const Color(0xFF6366F1) : BulkyColors.primary),
        unselectedItemColor: BulkyColors.textSecondary,
        items: navItems,
      ),
    );
  }
}
