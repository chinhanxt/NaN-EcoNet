import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../features/auth/models/citizen_user.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../main.dart';
import '../theme/bulky_colors.dart';

/// Reusable persistent bottom navigation bar across all sub-screens
/// (Quote, Payment, Order Detail) to ensure navigation tabs are never lost.
class BulkyAppBottomNavBar extends StatelessWidget {
  final int activeIndex;

  const BulkyAppBottomNavBar({
    super.key,
    this.activeIndex = 0,
  });

  @override
  Widget build(BuildContext context) {
    AuthProvider? auth;
    try {
      auth = Provider.of<AuthProvider>(context, listen: false);
    } catch (_) {}

    final role = auth?.currentRole ?? UserRole.citizen;

    List<BottomNavigationBarItem> navItems;
    switch (role) {
      case UserRole.citizen:
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

    final safeIndex = activeIndex < navItems.length ? activeIndex : 0;

    return Container(
      decoration: const BoxDecoration(
        color: BulkyColors.surface,
        border: Border(
          top: BorderSide(color: BulkyColors.border, width: 0.8),
        ),
      ),
      child: SafeArea(
        top: false,
        child: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          currentIndex: safeIndex,
          onTap: (index) {
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(
                builder: (_) => BulkyHomeScreen(initialTab: index),
              ),
              (route) => false,
            );
          },
          selectedItemColor: role == UserRole.driver
              ? const Color(0xFFEA580C)
              : (role == UserRole.operator ? const Color(0xFF6366F1) : BulkyColors.primary),
          unselectedItemColor: BulkyColors.textSecondary,
          items: navItems,
        ),
      ),
    );
  }
}
