import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/bulky_constants.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../auth/providers/auth_provider.dart';
import '../../orders/providers/orders_provider.dart';

/// Screen for dispatch operators to oversee all bulky orders,
/// approve AI inspections, and assign collection vehicles & drivers.
class BulkyOperatorScreen extends StatefulWidget {
  const BulkyOperatorScreen({super.key});

  @override
  State<BulkyOperatorScreen> createState() => _BulkyOperatorScreenState();
}

class _BulkyOperatorScreenState extends State<BulkyOperatorScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ordersProvider = context.watch<OrdersProvider>();
    final pendingOrders = ordersProvider.pendingDispatchOrders;
    final assignedOrders = ordersProvider.driverAssignedOrders;
    final allOrders = ordersProvider.orders;

    return Scaffold(
      backgroundColor: BulkyColors.background,
      appBar: AppBar(
        title: const Text(
          'Trung Tâm Điều Phối VSMT',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        backgroundColor: BulkyColors.surface,
        foregroundColor: BulkyColors.textPrimary,
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Tải lại danh sách',
            onPressed: () => ordersProvider.loadOrders(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: BulkyColors.primary,
          unselectedLabelColor: BulkyColors.textSecondary,
          indicatorColor: BulkyColors.primary,
          tabs: [
            Tab(text: 'Chờ xếp xe (${pendingOrders.length})'),
            Tab(text: 'Trên tuyến (${assignedOrders.length})'),
            Tab(text: 'Tất cả (${allOrders.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Operator Identity & Live KPI banner
          _buildOperatorKpiHeader(auth, ordersProvider),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPendingDispatchTab(context, ordersProvider, pendingOrders),
                _buildAssignedTab(context, ordersProvider, assignedOrders),
                _buildAllOrdersTab(context, allOrders),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOperatorKpiHeader(AuthProvider auth, OrdersProvider ordersProvider) {
    final user = auth.currentUser;
    final staffCode = user?.staffCode ?? 'NV-DP01';
    final name = user?.name ?? 'Trần Thị Mai';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: BulkyColors.surface,
        border: Border(
          bottom: BorderSide(color: BulkyColors.border),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  '👮 ĐIỀU PHỐI VIÊN ĐÔ THỊ',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6366F1),
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
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: BulkyColors.primaryLight.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.admin_panel_settings_rounded,
                    size: 18, color: BulkyColors.primary),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$name ($staffCode)',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                    const Text(
                      'Tổ Điều Phối Thu Gom Rác Cồng Kềnh Q.1',
                      style: TextStyle(
                        fontSize: 11,
                        color: BulkyColors.textSecondary,
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
              _buildKpiCard(
                title: 'Chờ xếp xe',
                subtitle: 'Đơn chờ duyệt',
                count: ordersProvider.pendingDispatchOrders.length,
                color: BulkyColors.warning,
                bgColor: BulkyColors.warningBg,
              ),
              const SizedBox(width: 6),
              _buildKpiCard(
                title: 'Đang di chuyển',
                subtitle: 'Xe trên tuyến',
                count: ordersProvider.driverAssignedOrders.length,
                color: BulkyColors.primary,
                bgColor: BulkyColors.primaryLight.withValues(alpha: 0.12),
              ),
              const SizedBox(width: 6),
              _buildKpiCard(
                title: 'Đã hoàn tất',
                subtitle: 'Khối lượng hoàn tất',
                count: ordersProvider.completedOrders.length,
                color: BulkyColors.success,
                bgColor: BulkyColors.successBg,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String subtitle,
    required int count,
    required Color color,
    required Color bgColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$count',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 9,
                color: color.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingDispatchTab(
    BuildContext context,
    OrdersProvider ordersProvider,
    List<BulkyOrder> orders,
  ) {
    if (orders.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.check_circle_outline_rounded,
                  size: 56, color: BulkyColors.success.withValues(alpha: 0.7)),
              const SizedBox(height: 12),
              const Text(
                'Không có đơn hàng nào chờ điều phối',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text(
                'Tất cả các đơn đã cọc đều đã được chỉ định xe và tài xế thu gom.',
                style: TextStyle(fontSize: 13, color: BulkyColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        return _buildPendingOrderCard(context, ordersProvider, order);
      },
    );
  }

  Widget _buildPendingOrderCard(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    return Card(
      key: Key('operator_pending_card_${order.id}'),
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: BulkyColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  order.id,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.textPrimary,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: BulkyColors.warningBg,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: BulkyColors.warning.withValues(alpha: 0.4)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.hourglass_top_rounded, size: 12, color: BulkyColors.warning),
                      SizedBox(width: 4),
                      Text(
                        'Chờ duyệt & Xếp xe',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFB45309),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 15, color: BulkyColors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    order.address,
                    style: const TextStyle(fontSize: 12, color: BulkyColors.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.person_outline_rounded, size: 15, color: BulkyColors.textSecondary),
                const SizedBox(width: 6),
                Text(
                  '${order.contactName ?? "Khách hàng"} • ${order.contactPhone ?? "Chưa có SĐT"}',
                  style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: BulkyColors.background,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Vật dụng thu gom (${order.items.length} món):',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  ...order.items.map(
                    (it) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 1),
                      child: Text(
                        '• ${it.displayName} (x${it.quantity}) - ${it.material.emoji} ${it.material.shortLabel}',
                        style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            // Required truck and weight estimation badge
            Builder(
              builder: (context) {
                final totalWeight = order.items.fold<double>(
                  0.0,
                  (sum, it) => sum + (it.estimatedUnitWeightKg * it.quantity),
                );
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: BulkyColors.primaryLight.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: BulkyColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.local_shipping_rounded, size: 15, color: BulkyColors.primary),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Xe đề xuất: Xe tải thu gom 2.5T • Khối lượng ước tính: ~${totalWeight.toStringAsFixed(0)} kg',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: BulkyColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Cọc đã giữ: ${BulkyColors.formatCurrency(order.quote.depositHoldVnd)}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: BulkyColors.success,
                  ),
                ),
                Text(
                  order.floorNumber > 0
                      ? 'Tầng ${order.floorNumber} (${order.hasElevator ? "Thang máy" : "Thang bộ"})'
                      : 'Bốc tại tầng trệt',
                  style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    key: Key('assign_driver_button_${order.id}'),
                    onPressed: () async {
                      await ordersProvider.assignDriverAndSchedule(
                        order.id,
                        vehiclePlate: '51C-889.21',
                      );
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '✓ Đã phê duyệt hồ sơ và điều phối xe tải 51C-889.21 (Tài xế Nguyễn Văn Hùng) cho đơn ${order.id}!',
                            ),
                            backgroundColor: BulkyColors.primary,
                          ),
                        );
                      }
                    },
                    icon: const Icon(Icons.verified_rounded, size: 16),
                    label: const Text('Phê duyệt & Điều xe tải', style: TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BulkyColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                OutlinedButton.icon(
                  key: Key('open_assign_dialog_button_${order.id}'),
                  onPressed: () => _showApproveDialog(context, ordersProvider, order),
                  icon: const Icon(Icons.tune_rounded, size: 16),
                  label: const Text('Chọn xe', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF6366F1),
                    side: const BorderSide(color: Color(0xFF6366F1)),
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                OutlinedButton(
                  key: Key('reject_order_button_${order.id}'),
                  onPressed: () => _showRejectDialog(context, ordersProvider, order),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: BulkyColors.error,
                    side: const BorderSide(color: BulkyColors.error),
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text('Từ chối', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showApproveDialog(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    String selectedTruck = '51C-889.21';
    final trucks = [
      {
        'plate': '51C-889.21',
        'type': 'Xe tải thu gom 2.5T',
        'driver': 'Nguyễn Văn Hùng',
        'status': 'Sẵn sàng',
      },
      {
        'plate': '51D-921.34',
        'type': 'Xe tải thu gom 3.5T',
        'driver': 'Trần Đình Trọng',
        'status': 'Đang trên tuyến',
      },
      {
        'plate': '50A-712.89',
        'type': 'Xe thu gom chuyên dụng 1.5T',
        'driver': 'Lê Hoàng Quân',
        'status': 'Sẵn sàng',
      },
    ];

    final totalWeight = order.items.fold<double>(
      0.0,
      (sum, it) => sum + (it.estimatedUnitWeightKg * it.quantity),
    );

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.local_shipping_rounded, color: BulkyColors.primary, size: 22),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Phê duyệt & Điều phối xe thu gom',
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
                  'Đơn hàng: ${order.id} • ${order.contactName ?? "Khách hàng"}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: BulkyColors.textPrimary),
                ),
                Text(
                  'Địa chỉ: ${order.address}',
                  style: const TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
                ),
                Text(
                  'Khối lượng ước tính: ~${totalWeight.toStringAsFixed(0)} kg (${order.items.length} món)',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: BulkyColors.primary),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Chọn xe tải thu gom và tài xế phụ trách:',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BulkyColors.textPrimary),
                ),
                const SizedBox(height: 8),
                ...trucks.map((truck) {
                  final plate = truck['plate']!;
                  final isSelected = selectedTruck == plate;
                  return InkWell(
                    onTap: () {
                      setDialogState(() {
                        selectedTruck = plate;
                      });
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isSelected ? BulkyColors.primaryLight.withValues(alpha: 0.12) : BulkyColors.background,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? BulkyColors.primary : BulkyColors.border,
                          width: isSelected ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                            size: 18,
                            color: isSelected ? BulkyColors.primary : BulkyColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '$plate - ${truck['type']}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: isSelected ? BulkyColors.primary : BulkyColors.textPrimary,
                                  ),
                                ),
                                Text(
                                  'Tài xế: ${truck['driver']} • ${truck['status']}',
                                  style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Quay lại', style: TextStyle(color: BulkyColors.textSecondary)),
            ),
            ElevatedButton(
              key: const Key('confirm_assign_dialog_button'),
              onPressed: () async {
                Navigator.pop(ctx);
                await ordersProvider.assignDriverAndSchedule(
                  order.id,
                  vehiclePlate: selectedTruck,
                );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('✓ Đã phê duyệt và điều phối xe $selectedTruck cho đơn ${order.id}!'),
                      backgroundColor: BulkyColors.primary,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: BulkyColors.primary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Xác nhận điều xe'),
            ),
          ],
        ),
      ),
    );
  }

  void _showRejectDialog(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    String selectedReason = 'Chứa chất thải nguy hại / bình gas không thu gom';
    final reasons = [
      'Chứa chất thải nguy hại / bình gas không thu gom',
      'Đường hẻm quá hẹp, xe tải không tiếp cận được',
      'Khai báo sai lệch thể tích / kích thước thực tế',
      'Địa chỉ nằm ngoài địa bàn phụ trách Quận 1',
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: BulkyColors.error.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.cancel_rounded, color: BulkyColors.error, size: 22),
              ),
              const SizedBox(width: 10),
              const Text('Từ chối đơn thu gom', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Bạn đang xem xét từ chối đơn ${order.id}. Tiền cọc ${BulkyColors.formatCurrency(order.quote.depositHoldVnd)} sẽ được hoàn lại cho công dân.',
                style: const TextStyle(fontSize: 13, color: BulkyColors.textSecondary, height: 1.3),
              ),
              const SizedBox(height: 12),
              const Text(
                'Lý do từ chối kiểm duyệt:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BulkyColors.textPrimary),
              ),
              const SizedBox(height: 6),
              ...reasons.map(
                (r) {
                  final isSelected = selectedReason == r;
                  return InkWell(
                    onTap: () {
                      setDialogState(() {
                        selectedReason = r;
                      });
                    },
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                      child: Row(
                        children: [
                          Icon(
                            isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                            size: 18,
                            color: isSelected ? BulkyColors.error : BulkyColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              r,
                              style: TextStyle(
                                fontSize: 12,
                                color: isSelected ? BulkyColors.textPrimary : BulkyColors.textSecondary,
                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Quay lại'),
            ),
            ElevatedButton(
              key: const Key('confirm_reject_dialog_button'),
              onPressed: () async {
                Navigator.pop(ctx);
                await ordersProvider.rejectOrder(order.id, reason: selectedReason);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Đã từ chối đơn ${order.id} và hoàn tiền cọc.'),
                      backgroundColor: BulkyColors.error,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: BulkyColors.error,
                foregroundColor: Colors.white,
              ),
              child: const Text('Xác nhận từ chối'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssignedTab(
    BuildContext context,
    OrdersProvider ordersProvider,
    List<BulkyOrder> orders,
  ) {
    if (orders.isEmpty) {
      return const Center(
        child: Text(
          'Hiện không có đơn nào đang trên tuyến thu gom.',
          style: TextStyle(color: BulkyColors.textSecondary),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        final isEnRoute = order.status == BulkyOrderStatus.IN_PROGRESS;

        return Card(
          key: Key('operator_assigned_card_${order.id}'),
          margin: const EdgeInsets.only(bottom: 14),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: isEnRoute ? BulkyColors.primary : BulkyColors.border,
              width: isEnRoute ? 1.5 : 1.0,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      order.id,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isEnRoute
                            ? const Color(0xFFEEF2FF)
                            : BulkyColors.primaryLight.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        order.status.displayName,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isEnRoute ? const Color(0xFF6366F1) : BulkyColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: BulkyColors.background,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.directions_car_rounded, size: 20, color: BulkyColors.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Xe phụ trách: ${order.vehiclePlate ?? "51C-889.21"}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            const Text(
                              'Tài xế: Nguyễn Văn Hùng • 0909.123.456',
                              style: TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Địa chỉ: ${order.address}',
                  style: const TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () {
                      Navigator.pushNamed(context, '/order-detail', arguments: order.id);
                    },
                    icon: const Icon(Icons.visibility_outlined, size: 16),
                    label: const Text('Xem chi tiết đơn'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAllOrdersTab(BuildContext context, List<BulkyOrder> orders) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          tileColor: BulkyColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: const BorderSide(color: BulkyColors.border),
          ),
          title: Text(order.id, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          subtitle: Text('${order.pickupDate} • ${order.address}', maxLines: 1, overflow: TextOverflow.ellipsis),
          trailing: Text(
            order.status.displayName,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: BulkyColors.primary),
          ),
          onTap: () {
            Navigator.pushNamed(context, '/order-detail', arguments: order.id);
          },
        );
      },
    );
  }
}
