import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../auth/providers/auth_provider.dart';

/// Citizen Home Screen adhering strictly to the Smartbin Citizen Dashboard mock.
/// Displays IoT Bin Telemetry, Daily Collection Schedule, Quick Action Grid,
/// and Eco Environmental Impact stats.
class CitizenHomeScreen extends StatelessWidget {
  final ValueChanged<int>? onNavigateTab;
  final int? todayWeekday;

  const CitizenHomeScreen({
    super.key,
    this.onNavigateTab,
    this.todayWeekday,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    final userName = user?.name ?? 'Nguyễn Văn An';
    final householdId = user?.householdId ?? 'HH-78921';
    final points = user?.rewardPoints ?? 120;

    return Scaffold(
      backgroundColor: BulkyColors.background,
      appBar: AppBar(
        backgroundColor: BulkyColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: BulkyColors.primary,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'SMARTBIN CITIZEN',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: BulkyColors.primary,
              ),
            ),
          ],
        ),
        actions: [
          // Notification Bell with Badge (2)
          IconButton(
            key: const Key('home_notifications_button'),
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_outlined, size: 24, color: BulkyColors.textPrimary),
                Positioned(
                  right: -4,
                  top: -2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: BulkyColors.error,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      '2',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            tooltip: 'Thông báo',
            onPressed: () => _showNotificationsSheet(context),
          ),
          // User Avatar / Profile Chip
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: InkWell(
              key: const Key('home_profile_avatar_chip'),
              onTap: () => onNavigateTab?.call(3), // Navigate to Account Tab
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: BulkyColors.primaryContainer,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: BulkyColors.primaryLight.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircleAvatar(
                      radius: 12,
                      backgroundColor: BulkyColors.primary,
                      child: Icon(Icons.person, size: 14, color: Colors.white),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      userName.split(' ').last,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Greeting Banner
            _buildGreetingHeader(userName, householdId),
            const SizedBox(height: 16),

            // Card 1: 🌟 THÙNG RÁC THÔNG MINH GIA ĐÌNH (IoT Telemetry)
            _buildIotTelemetryCard(context),
            const SizedBox(height: 16),

            // Card 2: 📅 LỊCH THU GOM TUẦN & HÔM NAY (Deepthi Concept)
            _buildWeeklyScheduleStrip(context),
            const SizedBox(height: 20),

            // Section: HÀNH ĐỘNG NHANH
            const Text(
              'HÀNH ĐỘNG NHANH',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
                color: BulkyColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),

            // 2x2 Action Cards Grid
            _buildQuickActionsGrid(context, points),
            const SizedBox(height: 20),

            // Card 3: 📊 ĐÓNG GÓP MÔI TRƯỜNG (Purrweb Eco Impact)
            _buildEcoImpactCard(context),
          ],
        ),
      ),
    );
  }

  /// Greeting Banner displaying resident name and household ID code
  Widget _buildGreetingHeader(String userName, String householdId) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: BulkyColors.border),
      ),
      child: Row(
        children: [
          const Text('👋', style: TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: const TextStyle(fontSize: 14, color: BulkyColors.textPrimary),
                children: [
                  const TextSpan(text: 'Xin chào, '),
                  TextSpan(
                    text: userName,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  TextSpan(
                    text: ' (Hộ $householdId)',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: BulkyColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Card 1: IoT Smart Bin Telemetry (Fill level, Odor, Update timestamp, Battery) - Nixtio
  Widget _buildIotTelemetryCard(BuildContext context) {
    const fillPercent = 68; // 68% fill level

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BulkyColors.border),
        boxShadow: BulkyColors.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Text('🌟 ', style: TextStyle(fontSize: 16)),
                  Text(
                    'THÙNG RÁC THÔNG MINH GIA ĐÌNH',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: BulkyColors.successBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: BulkyColors.success.withValues(alpha: 0.3)),
                ),
                child: const Text(
                  '📶 IoT Online',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Fill level visual bar with dynamic gradient
          Row(
            children: [
              const Text(
                'Mức đầy: ',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: BulkyColors.textPrimary),
              ),
              Expanded(
                child: Container(
                  height: 14,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: BulkyColors.border),
                  ),
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      return Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          width: constraints.maxWidth * (fillPercent / 100.0),
                          height: 14,
                          decoration: BoxDecoration(
                            gradient: BulkyColors.iotWarnGradient,
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                '$fillPercent%',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Odor badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: BulkyColors.successBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: BulkyColors.success.withValues(alpha: 0.25)),
            ),
            child: const Text(
              '🍃 Mùi: Bình thường',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: BulkyColors.success,
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 10),

          // Bottom telemetry status row
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.access_time_rounded, size: 14, color: BulkyColors.textSecondary),
                  SizedBox(width: 4),
                  Text(
                    'Cập nhật: 5 phút trước',
                    style: TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
                  ),
                ],
              ),
              Row(
                children: [
                  Icon(Icons.bolt_rounded, size: 16, color: BulkyColors.primary),
                  SizedBox(width: 4),
                  Text(
                    '⚡ Pin cảm biến: 92%',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: BulkyColors.primary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Card 2: Weekly Collection Schedule Strip (Deepthi N Anekal Concept)
  Widget _buildWeeklyScheduleStrip(BuildContext context) {
    final currentDay = todayWeekday ?? DateTime.now().weekday; // 1 = T2 ... 7 = CN
    const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BulkyColors.border),
        boxShadow: BulkyColors.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Text('📅 ', style: TextStyle(fontSize: 16)),
                  Text(
                    'LỊCH THU GOM HÔM NAY',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: BulkyColors.primaryContainer,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Lịch 7 ngày',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: BulkyColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 7-day horizontal strip
          Row(
            children: List.generate(7, (index) {
              final dayNum = index + 1;
              final isToday = (dayNum == currentDay);
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: index < 6 ? 6 : 0),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: isToday ? BulkyColors.primary : BulkyColors.background,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isToday ? BulkyColors.primary : BulkyColors.border,
                    ),
                    boxShadow: isToday
                        ? [
                            BoxShadow(
                              color: BulkyColors.primary.withValues(alpha: 0.3),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Column(
                    children: [
                      Text(
                        dayLabels[index],
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isToday ? FontWeight.bold : FontWeight.w600,
                          color: isToday ? Colors.white : BulkyColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      if (isToday)
                        const Text(
                          'Hôm nay',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        )
                      else
                        Container(
                          width: 4,
                          height: 4,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: BulkyColors.border,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 14),

          // Today collection category heading & badges
          const Text(
            'Rác sinh hoạt & Tái chế định kỳ',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: BulkyColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: BulkyColors.wasteOrganic.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: BulkyColors.wasteOrganic.withValues(alpha: 0.3)),
                ),
                child: const Text(
                  '🍏 Hữu cơ',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.wasteOrganic,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: BulkyColors.wasteRecyclable.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: BulkyColors.wasteRecyclable.withValues(alpha: 0.3)),
                ),
                child: const Text(
                  '♻️ Tái chế',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.wasteRecyclable,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: BulkyColors.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  '⏰ 08:00 - 10:00',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: BulkyColors.primaryDark,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Truck Proximity ETA card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: BulkyColors.primaryContainer,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: BulkyColors.primaryLight.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.local_shipping_rounded, color: BulkyColors.primary, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '🚚 Xe số 03 đang đến thu gom • Cách bạn 1.2 km',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.primaryDark,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Padding(
                  padding: EdgeInsets.only(left: 28),
                  child: Text(
                    'Ước tính khoảng 8 phút nữa sẽ đến ngõ của bạn',
                    style: TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.only(left: 28),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: const LinearProgressIndicator(
                      value: 0.75,
                      minHeight: 5,
                      backgroundColor: Colors.white,
                      valueColor: AlwaysStoppedAnimation<Color>(BulkyColors.primary),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 2x2 Grid of Quick Actions
  Widget _buildQuickActionsGrid(BuildContext context, int points) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildActionTile(
                key: const Key('quick_action_bulky_booking'),
                emoji: '🛋️',
                title: 'ĐẶT THU RÁC\nCỒNG KỀNH (AI)',
                subtitle: 'Quét camera & Báo giá',
                accentColor: BulkyColors.primary,
                bgColor: BulkyColors.primaryContainer,
                onTap: () => onNavigateTab?.call(1), // Switch to Tab 1: Thu gom
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildActionTile(
                key: const Key('quick_action_billing'),
                emoji: '💳',
                title: 'PHÍ THÁNG & NỢ',
                subtitle: 'Tháng 09: Đã trả (45k)',
                accentColor: const Color(0xFF0284C7),
                bgColor: const Color(0xFFE0F2FE),
                onTap: () => _showBillingDetailsSheet(context),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildActionTile(
                key: const Key('quick_action_rewards'),
                emoji: '🎁',
                title: 'ĐỔI ĐIỂM XANH',
                subtitle: '$points điểm • Hạng Bạc',
                accentColor: BulkyColors.warning,
                bgColor: BulkyColors.warningBg,
                onTap: () => _showEcoRewardsSheet(context, points),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildActionTile(
                key: const Key('quick_action_complaint'),
                emoji: '📢',
                title: 'PHẢN ÁNH THÙNG',
                subtitle: 'Bị bỏ sót / bốc mùi',
                accentColor: const Color(0xFFDC2626),
                bgColor: const Color(0xFFFEE2E2),
                onTap: () => _showCitizenFeedbackDialog(context),
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// Reusable Action Tile for the 2x2 grid (LazyInterface)
  Widget _buildActionTile({
    required Key key,
    required String emoji,
    required String title,
    required String subtitle,
    required Color accentColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      key: key,
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 122,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: BulkyColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: BulkyColors.border),
          boxShadow: BulkyColors.softShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: bgColor,
                    shape: BoxShape.circle,
                  ),
                  child: Text(emoji, style: const TextStyle(fontSize: 18)),
                ),
                Icon(Icons.arrow_forward_ios_rounded, size: 12, color: accentColor),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.textPrimary,
                    height: 1.2,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: accentColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Card 3: Environmental Contribution (LazyInterface Eco Impact)
  Widget _buildEcoImpactCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BulkyColors.primaryLight.withValues(alpha: 0.35)),
        boxShadow: BulkyColors.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Text('📊 ', style: TextStyle(fontSize: 16)),
              Text(
                'ĐÓNG GÓP MÔI TRƯỜNG (Eco Impact)',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Thành tích phân loại rác & bảo vệ lối sống xanh của hộ bạn:',
            style: TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: BulkyColors.primaryContainer,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: BulkyColors.primaryLight.withValues(alpha: 0.25)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('♻️', style: TextStyle(fontSize: 20)),
                          SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '34.5 kg',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: BulkyColors.primaryDark,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Rác phân loại tái chế',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: BulkyColors.textPrimary),
                      ),
                      SizedBox(height: 2),
                      Text(
                        '+12% so với tháng trước',
                        style: TextStyle(fontSize: 10, color: BulkyColors.primaryDark, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Color(0xFF86EFAC)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('🌳', style: TextStyle(fontSize: 20)),
                          SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '6.8 kg CO₂',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF15803D),
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Khí thải giảm thiểu',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: BulkyColors.textPrimary),
                      ),
                      SizedBox(height: 2),
                      Text(
                        '~0.4 cây xanh tương đương',
                        style: TextStyle(fontSize: 10, color: Color(0xFF15803D), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Sheet: Notification Drawer
  void _showNotificationsSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: BulkyColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '🔔 Thông Báo Mới (2)',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const Divider(),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: BulkyColors.primaryContainer,
                child: Icon(Icons.local_shipping, color: BulkyColors.primary),
              ),
              title: const Text('Xe số 03 đang đến thu gom', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: const Text('Dự kiến tới địa chỉ của bạn lúc 08:30 sáng nay. Vui lòng đặt rác đúng nơi quy định.'),
              contentPadding: EdgeInsets.zero,
            ),
            const Divider(),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: BulkyColors.warningBg,
                child: Icon(Icons.card_giftcard, color: BulkyColors.warning),
              ),
              title: const Text('+20 Điểm Xanh đã cộng vào ví', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: const Text('Cảm ơn bạn đã chủ động phân loại rác tái chế tuần qua.'),
              contentPadding: EdgeInsets.zero,
            ),
          ],
        ),
      ),
    );
  }

  /// Sheet: Monthly Waste Billing Details with Tabs (Current bill, History, Welfare policy)
  void _showBillingDetailsSheet(BuildContext context) {
    int activeTab = 0; // 0: Kỳ cước 09/2026, 1: Lịch sử hóa đơn, 2: Chính sách an sinh

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.8,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: BulkyColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    '💳 Phí Dịch Vụ Vệ Sinh Môi Trường',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const Divider(),
              const SizedBox(height: 6),

              // Segmented Tab Selector
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    ChoiceChip(
                      label: const Text('Kỳ cước Tháng 09'),
                      selected: activeTab == 0,
                      selectedColor: BulkyColors.primaryLight.withValues(alpha: 0.15),
                      backgroundColor: BulkyColors.background,
                      side: BorderSide(
                        color: activeTab == 0 ? BulkyColors.primary : BulkyColors.border,
                      ),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: activeTab == 0 ? FontWeight.bold : FontWeight.normal,
                        color: activeTab == 0 ? BulkyColors.primary : BulkyColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) setSheetState(() => activeTab = 0);
                      },
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('Lịch sử hóa đơn (3)'),
                      selected: activeTab == 1,
                      selectedColor: BulkyColors.primaryLight.withValues(alpha: 0.15),
                      backgroundColor: BulkyColors.background,
                      side: BorderSide(
                        color: activeTab == 1 ? BulkyColors.primary : BulkyColors.border,
                      ),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: activeTab == 1 ? FontWeight.bold : FontWeight.normal,
                        color: activeTab == 1 ? BulkyColors.primary : BulkyColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) setSheetState(() => activeTab = 1);
                      },
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('Chính sách an sinh'),
                      selected: activeTab == 2,
                      selectedColor: BulkyColors.primaryLight.withValues(alpha: 0.15),
                      backgroundColor: BulkyColors.background,
                      side: BorderSide(
                        color: activeTab == 2 ? BulkyColors.primary : BulkyColors.border,
                      ),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: activeTab == 2 ? FontWeight.bold : FontWeight.normal,
                        color: activeTab == 2 ? BulkyColors.primary : BulkyColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) setSheetState(() => activeTab = 2);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              Expanded(
                child: SingleChildScrollView(
                  child: activeTab == 0
                      ? _buildCurrentBillingTab(ctx)
                      : activeTab == 1
                          ? _buildBillingHistoryTab()
                          : _buildWelfarePolicyTab(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentBillingTab(BuildContext ctx) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildBillingRow('Kỳ cước:', 'Tháng 09/2026'),
        _buildBillingRow('Hộ gia đình:', 'Nguyễn Văn An (HH-78921)'),
        _buildBillingRow('Định mức rác:', 'Hộ gia đình tiêu chuẩn (<5 người)'),
        _buildBillingRow('Số tiền niêm yết:', '45.000 đ / tháng'),
        _buildBillingRow('Mã biên lai:', 'BL-202609-0881'),
        _buildBillingRow('Ngày thanh toán:', '05/09/2026 lúc 08:30'),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: BulkyColors.successBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: BulkyColors.success.withValues(alpha: 0.3)),
          ),
          child: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: BulkyColors.success, size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Trạng thái: ĐÃ THANH TOÁN (Qua VietQR / MoMo)',
                  style: TextStyle(fontWeight: FontWeight.bold, color: BulkyColors.success, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(
                      content: Text('✓ Đã tải biên lai điện tử Tháng 09/2026 về máy!'),
                      backgroundColor: BulkyColors.primary,
                    ),
                  );
                },
                icon: const Icon(Icons.download_rounded, size: 16),
                label: const Text('Tải biên lai PDF'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: BulkyColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Đóng'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBillingHistoryTab() {
    final history = [
      {'period': 'Tháng 08/2026', 'amount': '45.000 đ', 'paidAt': '05/08/2026', 'code': 'BL-202608-0722'},
      {'period': 'Tháng 07/2026', 'amount': '45.000 đ', 'paidAt': '04/07/2026', 'code': 'BL-202607-0619'},
      {'period': 'Tháng 06/2026', 'amount': '45.000 đ', 'paidAt': '02/06/2026', 'code': 'BL-202606-0512'},
    ];

    return Column(
      children: history.map((item) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: BulkyColors.background,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: BulkyColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item['period']!,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Đã trả ngày: ${item['paidAt']} • ${item['code']}',
                    style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: BulkyColors.successBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  item['amount']!,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.success,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildWelfarePolicyTab() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: BulkyColors.primaryContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: BulkyColors.primaryLight.withValues(alpha: 0.3)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.shield_outlined, color: BulkyColors.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Quy định An sinh & Nhắc nợ rác thải',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: BulkyColors.primaryDark),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text(
            '• Quy trình nhắc cước: Ngày D (hạn đóng), D+3 (nhắc nhẹ qua app), D+7 (thông báo tổ dân phố), D+14 (chuyển cán bộ an sinh duyệt).\n'
            '• Cam kết an sinh: Hệ thống TUYỆT ĐỐI KHÔNG TỰ ĐỘNG CHẶN THU GOM nếu hộ dân chưa được xem xét hoàn cảnh an sinh.\n'
            '• Cảm biến IoT thông minh tại thùng rác gia đình vẫn duy trì đo đạc mức đầy và cảnh báo mùi 24/7.',
            style: TextStyle(fontSize: 12, color: BulkyColors.textPrimary, height: 1.4),
          ),
        ],
      ),
    );
  }

  /// Sheet: Eco Rewards Exchange with Tabs (Catalog, History)
  void _showEcoRewardsSheet(BuildContext context, int points) {
    int activeTab = 0; // 0: Đổi quà, 1: Lịch sử điểm

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.8,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: BulkyColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '🎁 Đổi Điểm Xanh ($points Điểm)',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const Divider(),
              const SizedBox(height: 6),

              // Segmented Tab Selector
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Kho quà sinh thái')),
                      selected: activeTab == 0,
                      selectedColor: BulkyColors.warningBg,
                      backgroundColor: BulkyColors.background,
                      side: BorderSide(
                        color: activeTab == 0 ? BulkyColors.warning : BulkyColors.border,
                      ),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: activeTab == 0 ? FontWeight.bold : FontWeight.normal,
                        color: activeTab == 0 ? BulkyColors.warning : BulkyColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) setSheetState(() => activeTab = 0);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Lịch sử tích điểm')),
                      selected: activeTab == 1,
                      selectedColor: BulkyColors.warningBg,
                      backgroundColor: BulkyColors.background,
                      side: BorderSide(
                        color: activeTab == 1 ? BulkyColors.warning : BulkyColors.border,
                      ),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: activeTab == 1 ? FontWeight.bold : FontWeight.normal,
                        color: activeTab == 1 ? BulkyColors.warning : BulkyColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) setSheetState(() => activeTab = 1);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              Expanded(
                child: SingleChildScrollView(
                  child: activeTab == 0
                      ? _buildRewardsCatalogTab(ctx)
                      : _buildPointsHistoryTab(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRewardsCatalogTab(BuildContext ctx) {
    final rewards = [
      {
        'emoji': '🛍️',
        'title': '1 Cuộn túi rác sinh học tự phân hủy',
        'cost': 50,
        'costText': '50 Điểm Xanh',
        'enabled': true,
      },
      {
        'emoji': '🎟️',
        'title': 'Voucher giảm 30k cước xe thu gom rác cồng kềnh',
        'cost': 100,
        'costText': '100 Điểm Xanh',
        'enabled': true,
      },
      {
        'emoji': '🪴',
        'title': 'Cây sen đá để bàn lọc không khí',
        'cost': 80,
        'costText': '80 Điểm Xanh',
        'enabled': true,
      },
      {
        'emoji': '🧤',
        'title': 'Găng tay phân loại rác bảo hộ cao cấp',
        'cost': 40,
        'costText': '40 Điểm Xanh',
        'enabled': true,
      },
      {
        'emoji': '🗑️',
        'title': 'Thùng rác mini phân loại 2 ngăn gia đình',
        'cost': 200,
        'costText': '200 Điểm Xanh (Cần thêm 80 điểm)',
        'enabled': false,
      },
    ];

    return Column(
      children: rewards.map((r) {
        final isEnabled = r['enabled'] as bool;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: BulkyColors.background,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: BulkyColors.border),
          ),
          child: ListTile(
            leading: Text(r['emoji'] as String, style: const TextStyle(fontSize: 24)),
            title: Text(
              r['title'] as String,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            subtitle: Text(
              r['costText'] as String,
              style: TextStyle(
                fontSize: 11,
                color: isEnabled ? BulkyColors.primary : BulkyColors.textSecondary,
                fontWeight: isEnabled ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
            trailing: ElevatedButton(
              onPressed: isEnabled
                  ? () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(
                          content: Text('✓ Đã đổi ${r['title']} thành công!'),
                          backgroundColor: BulkyColors.primary,
                        ),
                      );
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: isEnabled ? BulkyColors.primary : BulkyColors.border,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text(isEnabled ? 'Đổi quà' : 'Chưa đủ'),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPointsHistoryTab() {
    final history = [
      {'desc': 'Phân loại rác tái chế tuần qua', 'pts': '+20 điểm', 'date': '24/09/2026', 'isAdd': true},
      {'desc': 'Đặt xe thu gom sofa cồng kềnh đúng chuẩn', 'pts': '+30 điểm', 'date': '20/09/2026', 'isAdd': true},
      {'desc': 'Cư dân sống xanh tiêu biểu Tháng 08', 'pts': '+50 điểm', 'date': '01/09/2026', 'isAdd': true},
      {'desc': 'Đã đổi 1 Cuộn túi rác sinh học', 'pts': '-50 điểm', 'date': '15/09/2026', 'isAdd': false},
    ];

    return Column(
      children: history.map((item) {
        final isAdd = item['isAdd'] as bool;
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: BulkyColors.background,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: BulkyColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['desc'] as String,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item['date'] as String,
                      style: const TextStyle(fontSize: 10, color: BulkyColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Text(
                item['pts'] as String,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: isAdd ? BulkyColors.success : BulkyColors.error,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  /// Dialog: Citizen Feedback & Bin Complaints with Tabs (Create & History)
  void _showCitizenFeedbackDialog(BuildContext context) {
    int activeTab = 0; // 0: Gửi mới, 1: Lịch sử phản ánh

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Text('📢 ', style: TextStyle(fontSize: 20)),
                  Text('Phản Ánh Thùng Rác', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.pop(ctx),
              ),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('Gửi phản ánh mới'),
                      selected: activeTab == 0,
                      selectedColor: BulkyColors.primaryLight.withValues(alpha: 0.15),
                      backgroundColor: BulkyColors.background,
                      labelStyle: TextStyle(
                        fontSize: 11,
                        fontWeight: activeTab == 0 ? FontWeight.bold : FontWeight.normal,
                        color: activeTab == 0 ? BulkyColors.primary : BulkyColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) setDialogState(() => activeTab = 0);
                      },
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('Lịch sử (2)'),
                      selected: activeTab == 1,
                      selectedColor: BulkyColors.primaryLight.withValues(alpha: 0.15),
                      backgroundColor: BulkyColors.background,
                      labelStyle: TextStyle(
                        fontSize: 11,
                        fontWeight: activeTab == 1 ? FontWeight.bold : FontWeight.normal,
                        color: activeTab == 1 ? BulkyColors.primary : BulkyColors.textSecondary,
                      ),
                      onSelected: (selected) {
                        if (selected) setDialogState(() => activeTab = 1);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (activeTab == 0) ...[
                  const Text(
                    'Chọn vấn đề phản ánh về thùng rác thông minh:',
                    style: TextStyle(fontSize: 13, color: BulkyColors.textSecondary),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      _buildComplaintChip('Thùng quá tải'),
                      _buildComplaintChip('Bị bốc mùi hôi'),
                      _buildComplaintChip('Bị bỏ sót thu gom'),
                      _buildComplaintChip('Thùng hư hỏng / nứt'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    decoration: InputDecoration(
                      hintText: 'Nhập vị trí ngõ hoặc mô tả cụ thể...',
                      hintStyle: const TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    maxLines: 2,
                  ),
                ] else ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: BulkyColors.background,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: BulkyColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Phiếu #PA-8921 • Bị bốc mùi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: BulkyColors.successBg, borderRadius: BorderRadius.circular(4)),
                              child: const Text('ĐÃ XỬ LÝ', style: TextStyle(color: BulkyColors.success, fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        const Text('Tổ VSMT đã xịt khử khuẩn lúc 10:15 ngày 22/09.', style: TextStyle(fontSize: 11, color: BulkyColors.textSecondary)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: BulkyColors.background,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: BulkyColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Phiếu #PA-8710 • Thùng đầy tràn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: BulkyColors.successBg, borderRadius: BorderRadius.circular(4)),
                              child: const Text('ĐÃ GIẢI QUYẾT', style: TextStyle(color: BulkyColors.success, fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        const Text('Xe thu gom số 03 đã đến lấy rác lúc 14:00 ngày 15/09.', style: TextStyle(fontSize: 11, color: BulkyColors.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: activeTab == 0
              ? [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Hủy', style: TextStyle(color: BulkyColors.textSecondary)),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('✓ Đã gửi phản ánh tới Tổ VSMT đô thị. Cảm ơn đóng góp của bạn!'),
                          backgroundColor: BulkyColors.primary,
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BulkyColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Gửi phản ánh'),
                  ),
                ]
              : [
                  ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BulkyColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Đóng'),
                  ),
                ],
        ),
      ),
    );
  }

  Widget _buildComplaintChip(String label) {
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      backgroundColor: BulkyColors.surface,
      side: const BorderSide(color: BulkyColors.border),
    );
  }

  Widget _buildBillingRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(fontSize: 13, color: BulkyColors.textSecondary)),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
