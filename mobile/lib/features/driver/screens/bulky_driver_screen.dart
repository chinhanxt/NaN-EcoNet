import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/bulky_constants.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../auth/models/citizen_user.dart';
import '../../auth/providers/auth_provider.dart';
import '../../orders/providers/orders_provider.dart';

/// Screen for collection drivers / field teams to view assigned pickup stops,
/// start trips, verify items on-site, and confirm bulky waste collection.
class BulkyDriverScreen extends StatelessWidget {
  const BulkyDriverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ordersProvider = context.watch<OrdersProvider>();
    final user = auth.currentUser;
    final vehiclePlate = user?.vehiclePlate ?? '51C-889.21';

    // Get orders assigned to this vehicle or currently in scheduled / progress
    final assignedOrders = ordersProvider.orders
        .where((o) =>
            (o.vehiclePlate == null ||
                o.vehiclePlate!.toLowerCase().contains('51c-889.21') ||
                o.vehiclePlate == vehiclePlate) &&
            (o.status == BulkyOrderStatus.SCHEDULED ||
                o.status == BulkyOrderStatus.ASSIGNED ||
                o.status == BulkyOrderStatus.IN_PROGRESS))
        .toList();

    final completedTrips = ordersProvider.orders
        .where((o) =>
            o.status == BulkyOrderStatus.COMPLETED &&
            (o.vehiclePlate == null ||
                o.vehiclePlate!.toLowerCase().contains('51c-889.21') ||
                o.vehiclePlate == vehiclePlate))
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
            _buildDriverHeaderCard(user, vehiclePlate, assignedOrders.length),
            const SizedBox(height: 12),

            // 2. Active Stops Section
            const Row(
              children: [
                Icon(Icons.route_rounded, size: 18, color: BulkyColors.primary),
                SizedBox(width: 8),
                Text(
                  'Nhiệm vụ thu gom trên tuyến',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (assignedOrders.isEmpty)
              _buildEmptyTasksCard()
            else
              ...assignedOrders.map(
                (order) => _buildDriverTaskCard(context, ordersProvider, order),
              ),

            const SizedBox(height: 20),

            // 3. Completed Trips Section
            if (completedTrips.isNotEmpty) ...[
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

  Widget _buildDriverHeaderCard(CitizenUser? user, String vehiclePlate, int activeCount) {
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
                  color: const Color(0xFFEA580C).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  '🚚 TÀI XẾ THU GOM CHUYÊN DỤNG',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFEA580C),
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
                  color: const Color(0xFFF97316).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.local_shipping_rounded,
                    color: Color(0xFFEA580C), size: 22),
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
                            user?.name ?? 'Nguyễn Văn Hùng',
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
                            user?.staffCode ?? 'TX-51C889',
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
                      'Xe tải 2.5T ($vehiclePlate) • Đội VSMT Q.1',
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

    return Card(
      key: Key('driver_task_card_${order.id}'),
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isInProgress ? const Color(0xFFF97316) : BulkyColors.border,
          width: isInProgress ? 2.0 : 1.0,
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
                    color: isInProgress
                        ? const Color(0xFFFFF7ED)
                        : BulkyColors.primaryLight.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isInProgress
                          ? const Color(0xFFF97316)
                          : BulkyColors.primary.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isInProgress
                            ? Icons.navigation_rounded
                            : Icons.schedule_rounded,
                        size: 14,
                        color: isInProgress
                            ? const Color(0xFFEA580C)
                            : BulkyColors.primary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isInProgress
                            ? 'Đang đến điểm hẹn'
                            : 'Đã lên lịch thu gom',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isInProgress
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
            if (!isInProgress)
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
