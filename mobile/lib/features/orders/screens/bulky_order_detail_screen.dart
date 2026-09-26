import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/bulky_constants.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../auth/providers/auth_provider.dart';
import '../../quote/widgets/tolerance_guarantee_banner.dart';
import '../../../core/widgets/bulky_app_bottom_nav_bar.dart';
import '../providers/orders_provider.dart';

/// Detailed view of a bulky waste order with a 5-step progress timeline,
/// driver info, pickup logistics, itemized breakdown, operator review, and cancellation.
class BulkyOrderDetailScreen extends StatelessWidget {
  final String? orderId;

  const BulkyOrderDetailScreen({
    super.key,
    this.orderId,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveOrderId = orderId ??
        ModalRoute.of(context)?.settings.arguments as String?;

    if (effectiveOrderId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chi Tiết Đơn Hàng')),
        body: const Center(child: Text('Không tìm thấy mã đơn hàng.')),
      );
    }

    final ordersProvider = context.watch<OrdersProvider>();
    final order = ordersProvider.getOrderById(effectiveOrderId);

    if (order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chi Tiết Đơn Hàng')),
        body: const Center(child: Text('Đơn hàng không tồn tại.')),
      );
    }

    AuthProvider? auth;
    try {
      auth = context.watch<AuthProvider>();
    } catch (_) {
      try {
        auth = Provider.of<AuthProvider>(context, listen: false);
      } catch (_) {}
    }
    final isOperator = auth?.isOperator ?? false;

    final statusColor = _getStatusColor(order.status);
    final statusBgColor = _getStatusBgColor(order.status);

    return Scaffold(
      backgroundColor: BulkyColors.background,
      appBar: AppBar(
        title: const Text(
          'Chi Tiết Đơn Hàng',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        backgroundColor: BulkyColors.surface,
        foregroundColor: BulkyColors.textPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Order ID & Status Header Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: BulkyColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: BulkyColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        order.id,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.textPrimary,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusBgColor,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                        ),
                        child: Text(
                          order.status.displayName,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: statusColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Ngày tạo: ${order.createdAt.day.toString().padLeft(2, '0')}/${order.createdAt.month.toString().padLeft(2, '0')}/${order.createdAt.year}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: BulkyColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Pending approval alert banner for citizens when awaiting approval
            if (order.status == BulkyOrderStatus.CONFIRMED && !isOperator) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: BulkyColors.warningBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: BulkyColors.warning.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.hourglass_top_rounded, color: BulkyColors.warning, size: 26),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Đang chờ Tổ điều phối VSMT kiểm duyệt',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: Color(0xFFB45309),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Hồ sơ đơn ${order.id} đang được cán bộ kiểm tra hình ảnh AI và vật liệu để phê duyệt và điều phối xe tải thu gom.',
                            style: const TextStyle(fontSize: 12, color: BulkyColors.textSecondary, height: 1.3),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Operator review card when in Operator role
            if (order.status == BulkyOrderStatus.CONFIRMED && isOperator) ...[
              _buildOperatorReviewCard(context, ordersProvider, order),
              const SizedBox(height: 16),
            ],

            // 5-Step Timeline Card
            _buildTimelineCard(order),
            const SizedBox(height: 16),

            // Vehicle & Driver Info Card (if assigned or past confirmation)
            _buildDriverVehicleCard(context, order),
            const SizedBox(height: 16),

            // Logistics & Pickup Information Card
            _buildLogisticsCard(order),
            const SizedBox(height: 16),

            // Items breakdown Card
            _buildItemsCard(order),
            const SizedBox(height: 16),

            // Cost & Deposit Summary Card
            _buildCostSummaryCard(order),
            const SizedBox(height: 16),

            // Tolerance Policy Guarantee Banner
            ToleranceGuaranteeBanner(policy: order.quote.tolerancePolicy),
            const SizedBox(height: 24),

            // Order Action Buttons
            _buildActionButtons(context, ordersProvider, order),
            const SizedBox(height: 24),
          ],
        ),
      ),
      bottomNavigationBar: const BulkyAppBottomNavBar(activeIndex: 2),
    );
  }

  Widget _buildTimelineCard(BulkyOrder order) {
    final isStep1Active = order.status != BulkyOrderStatus.DRAFT &&
        order.status != BulkyOrderStatus.AWAITING_PAYMENT &&
        order.status != BulkyOrderStatus.CANCELLED;

    final isStep2Active = [
      BulkyOrderStatus.SCHEDULED,
      BulkyOrderStatus.ASSIGNED,
      BulkyOrderStatus.IN_PROGRESS,
      BulkyOrderStatus.COLLECTED,
      BulkyOrderStatus.COMPLETED,
    ].contains(order.status);

    final isStep3Active = [
      BulkyOrderStatus.SCHEDULED,
      BulkyOrderStatus.ASSIGNED,
      BulkyOrderStatus.IN_PROGRESS,
      BulkyOrderStatus.COLLECTED,
      BulkyOrderStatus.COMPLETED,
    ].contains(order.status);

    final isStep4Active = [
      BulkyOrderStatus.IN_PROGRESS,
      BulkyOrderStatus.COLLECTED,
      BulkyOrderStatus.COMPLETED,
    ].contains(order.status);

    final isStep5Active = order.status == BulkyOrderStatus.COMPLETED;

    final timelineSteps = [
      {
        'title': 'Đã đặt cọc',
        'active': isStep1Active,
        'desc': 'Đã cọc giữ chỗ thành công',
      },
      {
        'title': 'Kiểm duyệt & Phê duyệt',
        'active': isStep2Active,
        'desc': isStep2Active
            ? 'Tổ điều phối đã duyệt hồ sơ'
            : 'Đang chờ điều phối viên phê duyệt',
      },
      {
        'title': 'Đã xếp lịch xe tải & Tài xế',
        'active': isStep3Active,
        'desc': isStep3Active
            ? 'Đã điều phối xe tải thu gom'
            : 'Chờ phân công xe tải thu gom',
      },
      {
        'title': 'Đang đến lấy rác',
        'active': isStep4Active,
        'desc': 'Tài xế đang di chuyển tới điểm hẹn',
      },
      {
        'title': 'Hoàn tất thu gom',
        'active': isStep5Active,
        'desc': 'Đã hoàn tất thanh toán & dịch vụ',
      },
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BulkyColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.timeline_rounded, size: 20, color: BulkyColors.primary),
              SizedBox(width: 8),
              Text(
                'Lộ trình xử lý đơn hàng',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...List.generate(timelineSteps.length, (index) {
            final step = timelineSteps[index];
            final isActive = step['active'] as bool;
            final isLast = index == timelineSteps.length - 1;

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: isActive ? BulkyColors.primary : BulkyColors.background,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isActive ? BulkyColors.primary : BulkyColors.border,
                          width: 2,
                        ),
                      ),
                      child: Center(
                        child: isActive
                            ? const Icon(Icons.check, size: 14, color: Colors.white)
                            : Text(
                                '${index + 1}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: BulkyColors.textSecondary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    ),
                    if (!isLast)
                      Container(
                        width: 2,
                        height: 28,
                        color: isActive ? BulkyColors.primary : BulkyColors.border,
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step['title'] as String,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                            color: isActive ? BulkyColors.textPrimary : BulkyColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          step['desc'] as String,
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
            );
          }),
        ],
      ),
    );
  }

  Widget _buildDriverVehicleCard(BuildContext context, BulkyOrder order) {
    final vehiclePlate = order.vehiclePlate ?? '51C-889.21 (Xe tải 2.5T)';
    const driverPhone = '0909.123.456';
    const driverName = 'Nguyễn Văn Hùng';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BulkyColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.local_shipping_outlined, size: 20, color: BulkyColors.primary),
                  SizedBox(width: 8),
                  Text(
                    'Thông tin Xe & Tài xế',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: BulkyColors.successBg,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: BulkyColors.success.withValues(alpha: 0.3)),
                ),
                child: const Text(
                  'Đã phân công',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 12),
          _buildInfoRow('Biển số xe:', vehiclePlate),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(
                width: 140,
                child: Text(
                  'Tài xế:',
                  style: TextStyle(
                    fontSize: 13,
                    color: BulkyColors.textSecondary,
                  ),
                ),
              ),
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    const Text(
                      '$driverName • $driverPhone',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 6),
                    InkWell(
                      key: const Key('call_driver_button'),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Đang gọi cho tài xế Nguyễn Văn Hùng ($driverPhone)...'),
                            duration: Duration(seconds: 1),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: BulkyColors.primaryLight.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.phone_in_talk_rounded,
                          size: 14,
                          color: BulkyColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _buildInfoRow('Đơn vị phụ trách:', 'Đội Vệ Sinh Môi Trường Đô Thị Q.1'),
        ],
      ),
    );
  }

  Widget _buildLogisticsCard(BulkyOrder order) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BulkyColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.place_outlined, size: 20, color: BulkyColors.primary),
              SizedBox(width: 8),
              Text(
                'Thông tin Địa điểm & Hẹn giờ',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 12),
          _buildInfoRow('Địa chỉ thu gom:', order.address.isNotEmpty ? order.address : 'Chưa nhập'),
          const SizedBox(height: 8),
          _buildInfoRow('Ngày thu gom:', order.pickupDate.isNotEmpty ? order.pickupDate : 'Chưa xếp'),
          if (order.contactName != null) ...[
            const SizedBox(height: 8),
            _buildInfoRow('Người liên hệ:', '${order.contactName} - ${order.contactPhone ?? ""}'),
          ],
          const SizedBox(height: 8),
          _buildInfoRow(
            'Bốc xếp tầng lầu:',
            order.floorNumber > 0
                ? 'Tầng ${order.floorNumber} (${order.hasElevator ? "Có thang máy" : "Thang bộ"})'
                : 'Tầng trệt',
          ),
          if (order.requiresDisassembly) ...[
            const SizedBox(height: 8),
            _buildInfoRow('Yêu cầu tháo dỡ:', 'Có hỗ trợ tháo dỡ'),
          ],
          if (order.note != null && order.note!.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildInfoRow('Ghi chú:', order.note!),
          ],
        ],
      ),
    );
  }

  Widget _buildItemsCard(BulkyOrder order) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BulkyColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.inventory_2_outlined, size: 20, color: BulkyColors.primary),
              const SizedBox(width: 8),
              Text(
                'Danh mục vật dụng (${order.items.length})',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 8),
          ...order.items.map((item) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${item.displayName} (x${item.quantity})',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: BulkyColors.background,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: BulkyColors.border),
                    ),
                    child: Text(
                      '${item.material.emoji} ${item.material.shortLabel}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: BulkyColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '~${(item.estimatedUnitWeightKg * item.quantity).toStringAsFixed(1)} kg',
                    style: const TextStyle(
                      fontSize: 12,
                      color: BulkyColors.textSecondary,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildCostSummaryCard(BulkyOrder order) {
    final q = order.quote;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BulkyColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.receipt_long_outlined, size: 20, color: BulkyColors.primary),
              SizedBox(width: 8),
              Text(
                'Chi phí & Tiền cọc',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 12),
          _buildInfoRow(
            'Ước tính cước:',
            '${BulkyColors.formatCurrency(q.minVnd)} - ${BulkyColors.formatCurrency(q.maxVnd)}',
          ),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Tiền cọc giữ chỗ:',
            BulkyColors.formatCurrency(q.depositHoldVnd),
          ),
          const SizedBox(height: 8),
          _buildInfoRow(
            'Trạng thái tiền cọc:',
            order.paymentStatus.label,
          ),
        ],
      ),
    );
  }

  Widget _buildOperatorReviewCard(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.5), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.admin_panel_settings_rounded, size: 20, color: Color(0xFF6366F1)),
                  SizedBox(width: 8),
                  Text(
                    'Kiểm Duyệt Hồ Sơ',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.4)),
                ),
                child: const Text(
                  'Tổ Điều Phối',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6366F1),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 10),
          Text(
            'Đơn hàng ${order.id} đã hoàn tất đặt cọc ${BulkyColors.formatCurrency(order.quote.depositHoldVnd)}. Vui lòng xác nhận phê duyệt để điều xe tải thu gom hoặc từ chối nếu sai phạm quy định.',
            style: const TextStyle(fontSize: 12, color: BulkyColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  key: Key('operator_approve_button_${order.id}'),
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
                  label: const Text(
                    '✓ Phê duyệt & Điều xe tải',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: BulkyColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                key: Key('operator_reject_button_${order.id}'),
                onPressed: () => _showRejectDialog(context, ordersProvider, order),
                style: OutlinedButton.styleFrom(
                  foregroundColor: BulkyColors.error,
                  side: const BorderSide(color: BulkyColors.error),
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text(
                  'Từ chối',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
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
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Icon(
                            isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                            size: 16,
                            color: isSelected ? BulkyColors.error : BulkyColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              r,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                color: isSelected ? BulkyColors.textPrimary : BulkyColors.textSecondary,
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
              child: const Text('Hủy bỏ'),
            ),
            ElevatedButton(
              key: const Key('confirm_reject_button'),
              onPressed: () async {
                Navigator.pop(ctx);
                await ordersProvider.rejectOrder(order.id, reason: selectedReason);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'Đã từ chối đơn ${order.id}. Tiền cọc ${BulkyColors.formatCurrency(order.quote.depositHoldVnd)} đã được hoàn trả.',
                      ),
                      backgroundColor: BulkyColors.error,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: BulkyColors.error,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Xác nhận từ chối & Hoàn cọc'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(
    BuildContext context,
    OrdersProvider ordersProvider,
    BulkyOrder order,
  ) {
    final canPay = order.status == BulkyOrderStatus.AWAITING_PAYMENT;
    final canCancel = order.status == BulkyOrderStatus.AWAITING_PAYMENT ||
        order.status == BulkyOrderStatus.CONFIRMED;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (canPay) ...[
          ElevatedButton(
            key: const Key('pay_deposit_now_button'),
            onPressed: () {
              Navigator.pushNamed(context, '/payment', arguments: order.id);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: BulkyColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text(
              'Thanh toán cọc ngay',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (canCancel) ...[
          OutlinedButton(
            onPressed: () {
              _showCancelDialog(context, ordersProvider, order.id);
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: BulkyColors.error,
              side: const BorderSide(color: BulkyColors.error),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text(
              'Hủy đơn hàng',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ],
    );
  }

  void _showCancelDialog(
    BuildContext context,
    OrdersProvider ordersProvider,
    String orderId,
  ) {
    showDialog(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          title: const Text('Xác nhận hủy đơn'),
          content: const Text('Bạn có chắc chắn muốn hủy đơn thu gom này?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Đóng'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(dialogCtx);
                await ordersProvider.cancelOrder(orderId);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã hủy đơn hàng thành công.'),
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: BulkyColors.error,
                foregroundColor: Colors.white,
              ),
              child: const Text('Xác nhận'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 140,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: BulkyColors.textSecondary,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: BulkyColors.textPrimary,
            ),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }

  Color _getStatusColor(BulkyOrderStatus status) {
    switch (status) {
      case BulkyOrderStatus.DRAFT:
      case BulkyOrderStatus.AWAITING_PAYMENT:
      case BulkyOrderStatus.PENDING_REVIEW:
      case BulkyOrderStatus.DISCREPANCY_PENDING:
        return BulkyColors.warning;
      case BulkyOrderStatus.CONFIRMED:
      case BulkyOrderStatus.SCHEDULED:
      case BulkyOrderStatus.ASSIGNED:
      case BulkyOrderStatus.APPROVED_AWAITING_PAYMENT:
        return BulkyColors.primary;
      case BulkyOrderStatus.IN_PROGRESS:
      case BulkyOrderStatus.COLLECTED:
        return const Color(0xFF6366F1);
      case BulkyOrderStatus.COMPLETED:
        return BulkyColors.success;
      case BulkyOrderStatus.CANCELLED:
      case BulkyOrderStatus.REJECTED_ON_SITE:
      case BulkyOrderStatus.REJECTED:
        return BulkyColors.error;
    }
  }

  Color _getStatusBgColor(BulkyOrderStatus status) {
    switch (status) {
      case BulkyOrderStatus.DRAFT:
      case BulkyOrderStatus.AWAITING_PAYMENT:
      case BulkyOrderStatus.PENDING_REVIEW:
      case BulkyOrderStatus.DISCREPANCY_PENDING:
        return BulkyColors.warningBg;
      case BulkyOrderStatus.CONFIRMED:
      case BulkyOrderStatus.SCHEDULED:
      case BulkyOrderStatus.ASSIGNED:
      case BulkyOrderStatus.APPROVED_AWAITING_PAYMENT:
        return BulkyColors.primaryLight.withValues(alpha: 0.12);
      case BulkyOrderStatus.IN_PROGRESS:
      case BulkyOrderStatus.COLLECTED:
        return const Color(0xFFEEF2FF);
      case BulkyOrderStatus.COMPLETED:
        return BulkyColors.successBg;
      case BulkyOrderStatus.CANCELLED:
      case BulkyOrderStatus.REJECTED_ON_SITE:
      case BulkyOrderStatus.REJECTED:
        return BulkyColors.errorBg;
    }
  }
}
