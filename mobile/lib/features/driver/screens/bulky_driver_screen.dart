import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/bulky_constants.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../auth/models/citizen_user.dart';
import '../../auth/providers/auth_provider.dart';
import '../../orders/providers/orders_provider.dart';
import '../widgets/driver_route_map_card.dart';

/// Screen for collection drivers / field teams to view assigned pickup stops,
/// start trips, verify items on-site, and confirm bulky waste collection.
class BulkyDriverScreen extends StatefulWidget {
  const BulkyDriverScreen({super.key});

  @override
  State<BulkyDriverScreen> createState() => _BulkyDriverScreenState();
}

class _BulkyDriverScreenState extends State<BulkyDriverScreen> {
  final Set<String> _completedRegularStopIds = {};

  final List<Map<String, dynamic>> _regularWasteStops = [
    {
      'id': 'sh-01',
      'name': 'Thùng rác công cộng #SH-01',
      'address': 'Số 68 Cầu Giấy, Quan Hoa',
      'reason': '📱 Cư dân báo thùng đầy qua App (15 phút trước)',
      'isAppReported': true,
      'reporterNote': 'Thùng rác vỉa hè đầy tràn rác sinh hoạt sau ca chợ sáng.',
      'distance': '450 m',
      'timeReported': '15 phút trước',
    },
    {
      'id': 'sh-02',
      'name': 'Điểm thu gom rác #SH-02',
      'address': '120 Đường Cầu Giấy, Quan Hoa',
      'reason': '🗓️ Lịch thu gom định kỳ (Chu kỳ 2 ngày/lần)',
      'isAppReported': false,
      'reporterNote': 'Tuyến cố định xe ép rác sinh hoạt sáng T7.',
      'distance': '1.2 km',
      'timeReported': 'Định kỳ T7',
    },
    {
      'id': 'sh-03',
      'name': 'Thùng rác công cộng #SH-03',
      'address': 'Ngã tư Trần Thái Tông - Xuân Thủy',
      'reason': '📱 Cư dân báo tồn đọng rác qua App (25 phút trước)',
      'isAppReported': true,
      'reporterNote': 'Rác sinh hoạt tồn đọng quanh điểm chờ xe buýt sau giờ cao điểm.',
      'distance': '1.8 km',
      'timeReported': '25 phút trước',
    },
    {
      'id': 'sh-04',
      'name': 'Điểm thu gom rác #SH-04',
      'address': '45 Phố Duy Tân, Dịch Vọng Hậu',
      'reason': '🗓️ Lịch thu gom định kỳ (Chu kỳ 2 ngày/lần)',
      'isAppReported': false,
      'reporterNote': 'Cụm 3 thùng rác công cộng khu văn phòng Duy Tân.',
      'distance': '2.5 km',
      'timeReported': 'Định kỳ T7',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ordersProvider = context.watch<OrdersProvider>();
    final user = auth.currentUser;
    final isRegularDriver = user?.isRegularWasteDriver ?? false;
    final vehiclePlate = user?.vehiclePlate ?? (isRegularDriver ? '51C-889.21' : '51D-924.58');

    // Bulky driver: handles bulky orders
    final assignedOrders = isRegularDriver
        ? <BulkyOrder>[]
        : ordersProvider.orders
            .where((o) =>
                (o.status == BulkyOrderStatus.SCHEDULED ||
                    o.status == BulkyOrderStatus.ASSIGNED ||
                    o.status == BulkyOrderStatus.IN_PROGRESS ||
                    o.status == BulkyOrderStatus.DISCREPANCY_PENDING))
            .toList();

    final completedTrips = isRegularDriver
        ? <BulkyOrder>[]
        : ordersProvider.orders
            .where((o) => o.status == BulkyOrderStatus.COMPLETED)
            .toList();

    // Regular driver stops:
    final activeRegularStops = _regularWasteStops
        .where((s) => !_completedRegularStopIds.contains(s['id']))
        .toList();
    final completedRegularStops = _regularWasteStops
        .where((s) => _completedRegularStopIds.contains(s['id']))
        .toList();

    return Scaffold(
      backgroundColor: BulkyColors.background,
      appBar: AppBar(
        title: const Text(
          'Lộ Trình Thu Gom Hiện Trường',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        backgroundColor: BulkyColors.surface,
        foregroundColor: BulkyColors.textPrimary,
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Cập nhật lộ trình',
            onPressed: () => ordersProvider.loadOrders(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Driver & Vehicle Information Card
            _buildDriverHeaderCard(
              user: user,
              vehiclePlate: vehiclePlate,
              activeCount: isRegularDriver ? activeRegularStops.length : assignedOrders.length,
              isRegularDriver: isRegularDriver,
            ),
            const SizedBox(height: 14),

            // 2. Interactive Route Mockup Map
            DriverRouteMapCard(
              vehiclePlate: vehiclePlate,
              activeOrders: assignedOrders,
              isRegularWasteRoute: isRegularDriver,
            ),
            const SizedBox(height: 16),

            // 3. Active Stops Section
            Row(
              children: [
                Icon(
                  isRegularDriver ? Icons.cleaning_services_rounded : Icons.route_rounded,
                  size: 18,
                  color: isRegularDriver ? const Color(0xFF0D9488) : BulkyColors.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  isRegularDriver
                      ? 'Điểm thu gom trên tuyến (Định kỳ & Dân báo App)'
                      : 'Nhiệm vụ thu gom trên tuyến',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (isRegularDriver) ...[
              if (activeRegularStops.isEmpty)
                _buildRegularAllCompletedCard()
              else
                ...activeRegularStops.map(_buildRegularWasteStopCard),
            ] else ...[
              if (assignedOrders.isEmpty)
                _buildEmptyTasksCard()
              else
                ...assignedOrders.map(
                  (order) => _buildDriverTaskCard(context, ordersProvider, order),
                ),
            ],

            const SizedBox(height: 20),

            // 4. Completed Trips Section
            if (isRegularDriver && completedRegularStops.isNotEmpty) ...[
              const Row(
                children: [
                  Icon(Icons.check_circle_outline_rounded, size: 18, color: BulkyColors.success),
                  SizedBox(width: 8),
                  Text(
                    'Đã hoàn tất ép rác hôm nay',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ...completedRegularStops.map(_buildCompletedRegularStopCard),
            ] else if (!isRegularDriver && completedTrips.isNotEmpty) ...[
              const Row(
                children: [
                  Icon(Icons.check_circle_outline_rounded,
                      size: 18, color: BulkyColors.success),
                  SizedBox(width: 8),
                  Text(
                    'Đã hoàn tất hôm nay',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ...completedTrips.map(_buildCompletedTripCard),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRegularWasteStopCard(Map<String, dynamic> stop) {
    final isAppReported = stop['isAppReported'] as bool;
    final id = stop['id'] as String;

    return Container(
      key: Key('regular_stop_card_$id'),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isAppReported
              ? const Color(0xFFF59E0B).withValues(alpha: 0.4)
              : const Color(0xFF0D9488).withValues(alpha: 0.3),
        ),
        boxShadow: BulkyColors.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isAppReported ? const Color(0xFFFEF3C7) : const Color(0xFFE6FFFA),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isAppReported ? Icons.phone_android_rounded : Icons.event_repeat_rounded,
                      size: 13,
                      color: isAppReported ? const Color(0xFFD97706) : const Color(0xFF0D9488),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      stop['reason'] as String,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isAppReported ? const Color(0xFFB45309) : const Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                stop['distance'] as String,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Name & Address
          Text(
            stop['name'] as String,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: BulkyColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.location_on_rounded, size: 15, color: BulkyColors.primary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  stop['address'] as String,
                  style: const TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Note
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: BulkyColors.background,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, size: 14, color: BulkyColors.textSecondary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    stop['reporterNote'] as String,
                    style: const TextStyle(fontSize: 11, color: BulkyColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Complete Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              key: Key('confirm_regular_collection_button_$id'),
              onPressed: () {
                setState(() {
                  _completedRegularStopIds.add(id);
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      '✓ Đã thu gom và ép rác tại ${stop['name']} vào xe ép 51C-889.21!',
                    ),
                    backgroundColor: const Color(0xFF0D9488),
                  ),
                );
              },
              icon: const Icon(Icons.check_circle_rounded, size: 18),
              label: const Text('🚛 Xác nhận đã thu gom & ép rác'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompletedRegularStopCard(Map<String, dynamic> stop) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: BulkyColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle, color: BulkyColors.success, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stop['name'] as String,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                ),
                Text(
                  stop['address'] as String,
                  style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: BulkyColors.successBg,
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text(
              'Đã ép tải',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BulkyColors.success),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRegularAllCompletedCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFE6FFFA),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF0D9488).withValues(alpha: 0.3)),
      ),
      child: const Column(
        children: [
          Icon(Icons.task_alt_rounded, size: 40, color: Color(0xFF0D9488)),
          SizedBox(height: 8),
          Text(
            'Hoàn tất ca thu gom rác sinh hoạt!',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
          ),
          SizedBox(height: 4),
          Text(
            'Toàn bộ điểm rác báo qua app và định kỳ đã được dọn sạch. Xe ép rác di chuyển về Trạm ép kín Cầu Giấy để xả rác.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildDriverHeaderCard({
    required CitizenUser? user,
    required String vehiclePlate,
    required int activeCount,
    required bool isRegularDriver,
  }) {
    final badgeText = isRegularDriver
        ? '🚚 TÀI XẾ THU GOM RÁC SINH HOẠT'
        : '🛋️ TÀI XẾ THU GOM RÁC CỒNG KỀNH CHUYÊN DỤNG';

    final badgeColor = isRegularDriver ? const Color(0xFF0D9488) : const Color(0xFFEA580C);

    final vehicleDesc = isRegularDriver
        ? 'Xe ép rác 5T ($vehiclePlate) • Đội Xe Ép Sinh Hoạt Q.1'
        : 'Xe tải 2.5T ($vehiclePlate) • Đội Xe Thu Gom Cồng Kềnh Q.1';

    final defaultName = isRegularDriver ? 'Nguyễn Văn Hùng' : 'Lê Hoàng Long';
    final defaultStaffCode = isRegularDriver ? 'TX-51C889' : 'TX-CK924';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: BulkyColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: badgeColor,
                  ),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: BulkyColors.successBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, size: 8, color: BulkyColors.success),
                    SizedBox(width: 4),
                    Text(
                      'Trực tuyến',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.success,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.local_shipping_rounded, color: badgeColor, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            user?.name ?? defaultName,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: BulkyColors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: BulkyColors.primaryLight.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            user?.staffCode ?? defaultStaffCode,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: BulkyColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      vehicleDesc,
                      style: const TextStyle(
                        fontSize: 11,
                        color: BulkyColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.fiber_manual_record,
                      size: 10, color: BulkyColors.success),
                  SizedBox(width: 6),
                  Text(
                    'Trạng thái: Đang trực tuyến',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: BulkyColors.success,
                    ),
                  ),
                ],
              ),
              Text(
                'Điểm hẹn: $activeCount đang chờ',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyTasksCard() {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: BulkyColors.border),
      ),
      child: Column(
        children: [
          Icon(Icons.task_alt_rounded,
              size: 48, color: BulkyColors.success.withValues(alpha: 0.7)),
          const SizedBox(height: 12),
          const Text(
            'Hiện tại không có điểm thu gom nào',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          const Text(
            'Xe tải 51C-889.21 sẵn sàng nhận lệnh phân công mới từ Điều phối viên.',
            style: TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildDriverTaskCard(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    final isInProgress = order.status == BulkyOrderStatus.IN_PROGRESS;
    final isDiscrepancyPending = order.status == BulkyOrderStatus.DISCREPANCY_PENDING;

    return Card(
      key: Key('driver_task_card_${order.id}'),
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isDiscrepancyPending
              ? BulkyColors.warning
              : isInProgress
                  ? const Color(0xFFF97316)
                  : BulkyColors.border,
          width: (isInProgress || isDiscrepancyPending) ? 2.0 : 1.0,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status & Priority Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: isDiscrepancyPending
                        ? BulkyColors.warningBg
                        : isInProgress
                            ? const Color(0xFFFFF7ED)
                            : BulkyColors.primaryLight.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isDiscrepancyPending
                          ? BulkyColors.warning
                          : isInProgress
                              ? const Color(0xFFF97316)
                              : BulkyColors.primary.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isDiscrepancyPending
                            ? Icons.hourglass_top_rounded
                            : isInProgress
                                ? Icons.navigation_rounded
                                : Icons.schedule_rounded,
                        size: 14,
                        color: isDiscrepancyPending
                            ? BulkyColors.warning
                            : isInProgress
                                ? const Color(0xFFEA580C)
                                : BulkyColors.primary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isDiscrepancyPending
                            ? 'Chờ duyệt phát sinh'
                            : isInProgress
                                ? 'Đang đến điểm hẹn'
                                : 'Đã lên lịch thu gom',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isDiscrepancyPending
                              ? BulkyColors.warning
                              : isInProgress
                                  ? const Color(0xFFEA580C)
                                  : BulkyColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  order.id,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Assigned Truck Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFEA580C).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFEA580C).withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping_rounded, size: 16, color: Color(0xFFEA580C)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Xe phụ trách: ${order.vehiclePlate ?? "51C-889.21"} - Xe tải 2.5T',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFEA580C),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Pickup Address
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on_rounded,
                    size: 18, color: BulkyColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.address,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.textPrimary,
                        ),
                      ),
                      if (order.floorNumber > 0)
                        Text(
                          'Tầng ${order.floorNumber} (${order.hasElevator ? "Có thang máy" : "Thang bộ"})',
                          style: const TextStyle(
                            fontSize: 11,
                            color: BulkyColors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),

            // Customer Contact with 1-tap call button
            Row(
              children: [
                const Icon(Icons.phone_iphone_rounded,
                    size: 16, color: BulkyColors.textSecondary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${order.contactName ?? "Khách hàng"}: ${order.contactPhone ?? "0901234567"}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: BulkyColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                OutlinedButton.icon(
                  key: Key('driver_call_customer_button_${order.id}'),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          '📞 Đang kết nối cuộc gọi đến ${order.contactPhone ?? "0901234567"} (${order.contactName ?? "Khách hàng"})...',
                        ),
                        backgroundColor: BulkyColors.primary,
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  icon: const Icon(Icons.phone_in_talk_rounded, size: 14),
                  label: const Text('Gọi điện', style: TextStyle(fontSize: 11)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: BulkyColors.primary,
                    side: const BorderSide(color: BulkyColors.primary),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Items breakdown
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: BulkyColors.background,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Đồ đạc cần thu gom (${order.items.length} món):',
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  ...order.items.map(
                    (it) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          Text('${it.material.emoji} ',
                              style: const TextStyle(fontSize: 12)),
                          Expanded(
                            child: Text(
                              '${it.displayName} (x${it.quantity})',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                          Text(
                            '~${(it.estimatedUnitWeightKg * it.quantity).toStringAsFixed(0)} kg',
                            style: const TextStyle(
                              fontSize: 11,
                              color: BulkyColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Action Buttons
            if (isDiscrepancyPending) ...[
              Container(
                key: Key('driver_discrepancy_banner_${order.id}'),
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: BulkyColors.warningBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: BulkyColors.warning.withValues(alpha: 0.5)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.hourglass_top_rounded,
                            size: 18, color: BulkyColors.warning),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '⏳ Đang chờ cư dân duyệt cước phát sinh (${BulkyColors.formatCurrency(order.onSiteAdjustedPriceVnd ?? 0)})',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF92400E),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (order.onSiteDiscrepancyNote != null &&
                        order.onSiteDiscrepancyNote!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Ghi chú: ${order.onSiteDiscrepancyNote}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: BulkyColors.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    const Text(
                      'Tạm hoãn bốc dỡ đồ phát sinh. Xe tải chờ xác nhận của cư dân trên ứng dụng.',
                      style: TextStyle(
                        fontSize: 11,
                        fontStyle: FontStyle.italic,
                        color: BulkyColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (!isInProgress)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  key: Key('driver_start_collection_button_${order.id}'),
                  onPressed: () async {
                    await ordersProvider.startCollection(order.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            'Đã bắt đầu di chuyển đến điểm thu gom ${order.id}!',
                          ),
                          backgroundColor: const Color(0xFFEA580C),
                        ),
                      );
                    }
                  },
                  icon: const Icon(Icons.navigation_rounded, size: 18),
                  label: const Text('🚗 Đang đến điểm thu gom'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEA580C),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              )
            else ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: BulkyColors.successBg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: BulkyColors.success.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle_rounded,
                        size: 16, color: BulkyColors.success),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Đã có mặt tại hiện trường. Kiểm tra và bốc dỡ đồ đạc lên thùng xe tải an toàn.',
                        style: TextStyle(
                            fontSize: 11, color: BulkyColors.textPrimary),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Trip Checklist (active on-site)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: BulkyColors.background,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: BulkyColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.checklist_rounded, size: 16, color: BulkyColors.primary),
                        SizedBox(width: 6),
                        Text(
                          'Quy trình kiểm tra & cân rác tại chỗ:',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BulkyColors.textPrimary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    _buildTripChecklistRow('Kiểm tra đúng chủng loại rác cồng kềnh'),
                    _buildTripChecklistRow('Chụp ảnh xác thực trước khi bốc dỡ'),
                    _buildTripChecklistRow('Cân tải trọng thực tế bằng cân điện tử xe tải'),
                    _buildTripChecklistRow('Quét dọn hiện trường sạch sẽ sau khi bốc xếp'),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Exception action button 1: Report discrepancy
              KeyedSubtree(
                key: const Key('driver_report_discrepancy_button'),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    key: Key('driver_report_discrepancy_button_${order.id}'),
                    onPressed: () => _showDiscrepancyDialog(context, ordersProvider, order),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFD97706),
                      side: const BorderSide(color: Color(0xFFD97706)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text(
                      '⚠️ Báo phát sinh đồ tại hiện trường',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),

              // Exception action button 2: Reject safety violation
              KeyedSubtree(
                key: const Key('driver_reject_safety_button'),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    key: Key('driver_reject_safety_button_${order.id}'),
                    onPressed: () => _showSafetyRejectionDialog(context, ordersProvider, order),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: BulkyColors.error,
                      side: const BorderSide(color: BulkyColors.error),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text(
                      '⛔ Từ chối thu gom (Rác cấm / Nguy hại)',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  key: Key('driver_complete_collection_button_${order.id}'),
                  onPressed: () async {
                    await ordersProvider.completeCollection(order.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            'Đã hoàn tất thu gom đơn hàng ${order.id}! Biên bản đã đồng bộ.',
                          ),
                          backgroundColor: BulkyColors.success,
                        ),
                      );
                    }
                  },
                  icon: const Icon(Icons.verified_rounded, size: 18),
                  label: const Text('✓ Hoàn tất bốc xếp & Cân rác'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: BulkyColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showDiscrepancyDialog(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    final currentPrice = order.finalizedPriceVnd ?? order.quote.maxVnd;
    final priceController = TextEditingController(text: (currentPrice + 100000).toString());
    final noteController = TextEditingController(text: 'Phát sinh thêm đồ tại hiện trường');

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706)),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Báo phát sinh tại hiện trường',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Cước đã chốt ban đầu: ${BulkyColors.formatCurrency(currentPrice)}',
                style: const TextStyle(fontSize: 13, color: BulkyColors.textSecondary),
              ),
              const SizedBox(height: 12),
              const Text(
                'Cước điều chỉnh mới (VNĐ):',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              TextField(
                key: const Key('discrepancy_price_input'),
                controller: priceController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'Nhập tổng cước sau phát sinh...',
                  suffixText: 'VNĐ',
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Ghi chú phát sinh của tài xế:',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              TextField(
                key: const Key('discrepancy_note_input'),
                controller: noteController,
                maxLines: 2,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'Ví dụ: Phát sinh thêm 1 nệm và thang bộ tầng 3...',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            key: const Key('confirm_report_discrepancy_button'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              final price = int.tryParse(priceController.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? currentPrice;
              final note = noteController.text.trim();
              Navigator.of(dialogCtx).pop();
              await ordersProvider.reportOnSiteDiscrepancy(order.id, price, note);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'Đã gửi báo giá điều chỉnh (${BulkyColors.formatCurrency(price)}) cho cư dân!',
                    ),
                    backgroundColor: const Color(0xFFD97706),
                  ),
                );
              }
            },
            child: const Text('Gửi báo giá điều chỉnh cho Cư dân'),
          ),
        ],
      ),
    );
  }

  void _showSafetyRejectionDialog(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    final reasonController = TextEditingController(
      text: 'Phát hiện chất thải nguy hại / cấm thu gom tại hiện trường',
    );

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.dangerous_rounded, color: BulkyColors.error),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Từ chối thu gom tại chỗ',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: BulkyColors.errorBg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: BulkyColors.error.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, size: 18, color: BulkyColors.error),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Khấu trừ 50.000 đ phí điều xe thực tế, hoàn lại phần cọc còn lại cho cư dân.',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.error,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Lý do từ chối (Chất độc, pin ắc quy, bình ga, rác quá tải...):',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              TextField(
                key: const Key('safety_rejection_reason_input'),
                controller: reasonController,
                maxLines: 2,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'Nhập lý do vi phạm an toàn...',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            key: const Key('confirm_safety_rejection_button'),
            style: ElevatedButton.styleFrom(
              backgroundColor: BulkyColors.error,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              final reason = reasonController.text.trim();
              Navigator.of(dialogCtx).pop();
              await ordersProvider.rejectOnSiteSafetyViolation(
                order.id,
                reason.isEmpty
                    ? 'Phát hiện chất thải nguy hại / cấm thu gom tại hiện trường'
                    : reason,
                calloutFee: DEFAULT_CALLOUT_FEE_VND,
              );
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'Đã từ chối thu gom đơn hàng ${order.id} do vi phạm an toàn. Khấu trừ 50k phí điều xe.',
                    ),
                    backgroundColor: BulkyColors.error,
                  ),
                );
              }
            },
            child: const Text('Xác nhận từ chối & Trừ phí điều xe 50k'),
          ),
        ],
      ),
    );
  }

  static Widget _buildTripChecklistRow(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline_rounded, size: 14, color: BulkyColors.success),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompletedTripCard(BulkyOrder order) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: BulkyColors.border),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: const BoxDecoration(
            color: BulkyColors.successBg,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, size: 18, color: BulkyColors.success),
        ),
        title: Text(order.id,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
        subtitle: Text(order.address,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11)),
        trailing: const Text(
          'Đã thu gom',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: BulkyColors.success,
          ),
        ),
      ),
    );
  }
}
