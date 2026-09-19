import 'package:flutter/material.dart' hide MaterialType;
import 'package:provider/provider.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/domain/models/bulky_quote.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../orders/providers/orders_provider.dart';
import '../../request_wizard/providers/booking_wizard_provider.dart';
import '../../../core/widgets/bulky_app_bottom_nav_bar.dart';
import '../widgets/tolerance_guarantee_banner.dart';

/// Detailed Quote Screen breaking down itemized pricing, handling surcharges,
/// deposit hold requirement, and tolerance protection guarantee.
class BulkyQuoteScreen extends StatelessWidget {
  final BulkyQuote? quote;
  final BulkyOrder? order;

  const BulkyQuoteScreen({
    super.key,
    this.quote,
    this.order,
  });

  @override
  Widget build(BuildContext context) {
    // Resolve quote and order from props or route arguments or wizard provider
    BulkyQuote? resolvedQuote = quote;
    BulkyOrder? resolvedOrder = order;

    final routeArgs = ModalRoute.of(context)?.settings.arguments;
    if (routeArgs is BulkyOrder) {
      resolvedOrder = routeArgs;
      resolvedQuote = routeArgs.quote;
    } else if (routeArgs is BulkyQuote) {
      resolvedQuote = routeArgs;
    } else if (routeArgs is Map<String, dynamic>) {
      if (routeArgs['order'] is BulkyOrder) {
        resolvedOrder = routeArgs['order'] as BulkyOrder;
      }
      if (routeArgs['quote'] is BulkyQuote) {
        resolvedQuote = routeArgs['quote'] as BulkyQuote;
      }
    }

    final wizard = context.watch<BookingWizardProvider>();
    resolvedQuote ??= resolvedOrder?.quote ?? wizard.currentQuote;

    if (resolvedQuote == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Báo Giá Dịch Vụ'),
        ),
        body: const Center(
          child: Text(
            'Chưa có thông tin báo giá. Vui lòng chọn đồ vật trước.',
            style: TextStyle(color: BulkyColors.textSecondary),
          ),
        ),
      );
    }

    final q = resolvedQuote;

    return Scaffold(
      backgroundColor: BulkyColors.background,
      appBar: AppBar(
        title: const Text(
          'Báo Giá Dịch Vụ',
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
            // Vehicle availability badge
            _buildVehicleAvailabilityBanner(resolvedOrder, wizard),
            const SizedBox(height: 16),

            // Itemized list breakdown
            _buildItemsCard(q),
            const SizedBox(height: 16),

            // Surcharges and totals breakdown
            _buildSurchargesCard(q),
            const SizedBox(height: 16),

            // Deposit hold callout card
            _buildDepositCard(q),
            const SizedBox(height: 16),

            // Tolerance policy guarantee banner
            ToleranceGuaranteeBanner(policy: q.tolerancePolicy),
            const SizedBox(height: 24),
          ],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildBottomActionBar(context, resolvedOrder, wizard),
          const BulkyAppBottomNavBar(activeIndex: 1),
        ],
      ),
    );
  }

  Widget _buildVehicleAvailabilityBanner(BulkyOrder? order, BookingWizardProvider wizard) {
    final date = (order != null && order.pickupDate.isNotEmpty)
        ? order.pickupDate
        : (wizard.scheduledDate.isNotEmpty ? wizard.scheduledDate : 'Hôm nay');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: BulkyColors.successBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: BulkyColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline_rounded, color: BulkyColors.success, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Ngày $date có xe thu gom chuyên dụng sẵn sàng phục vụ',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: BulkyColors.success,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemsCard(BulkyQuote q) {
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
                'Danh mục đồ vật (${q.itemsBreakdown.length})',
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
          ...q.itemsBreakdown.map((breakdown) {
            final item = breakdown.item;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                item.displayName,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: BulkyColors.textPrimary,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              margin: const EdgeInsets.only(left: 6),
                              decoration: BoxDecoration(
                                color: BulkyColors.background,
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: BulkyColors.border),
                              ),
                              child: Text(
                                'x${breakdown.quantity}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: BulkyColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: BulkyColors.background,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: BulkyColors.border),
                              ),
                              child: Text(
                                '${breakdown.material.emoji} ${breakdown.material.shortLabel}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: BulkyColors.textSecondary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '~${(item.estimatedUnitWeightKg * breakdown.quantity).toStringAsFixed(1)} kg',
                              style: const TextStyle(
                                fontSize: 12,
                                color: BulkyColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${BulkyColors.formatCurrency(breakdown.minVnd)} - ${BulkyColors.formatCurrency(breakdown.maxVnd)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.primary,
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

  Widget _buildSurchargesCard(BulkyQuote q) {
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
                'Chi tiết cước phí & Phụ phí',
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
          _buildRowLine(
            'Cước đồ vật',
            '${BulkyColors.formatCurrency(q.subtotalMinVnd)} - ${BulkyColors.formatCurrency(q.subtotalMaxVnd)}',
          ),
          const SizedBox(height: 8),
          _buildRowLine(
            'Phụ phí tháo dỡ',
            BulkyColors.formatCurrency(q.disassemblyFee),
          ),
          const SizedBox(height: 8),
          _buildRowLine(
            'Phụ phí bốc vác thang bộ',
            BulkyColors.formatCurrency(q.floorHandlingFee),
          ),
          const SizedBox(height: 8),
          _buildRowLine(
            'Phí xe thu gom chuyên dụng',
            BulkyColors.formatCurrency(q.areaFee),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tổng cước ước tính',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.textPrimary,
                ),
              ),
              Text(
                '${BulkyColors.formatCurrency(q.minVnd)} - ${BulkyColors.formatCurrency(q.maxVnd)}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRowLine(String title, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            color: BulkyColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: BulkyColors.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildDepositCard(BulkyQuote q) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BulkyColors.warningBg.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BulkyColors.warning.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: BulkyColors.warning.withValues(alpha: 0.05),
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
                'Cọc giữ chỗ xe: ${BulkyColors.formatCurrency(q.depositHoldVnd)}',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.warning,
                ),
              ),
              const Icon(Icons.lock_clock_rounded, color: BulkyColors.warning, size: 20),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Khấu trừ trực tiếp vào hoá đơn sau khi hoàn tất thu gom',
            style: TextStyle(
              fontSize: 12,
              color: BulkyColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActionBar(
    BuildContext context,
    BulkyOrder? existingOrder,
    BookingWizardProvider wizard,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        border: const Border(
          top: BorderSide(color: BulkyColors.border, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        bottom: false,
        child: Row(
          children: [
            OutlinedButton.icon(
              key: const Key('quote_back_button'),
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 15),
              label: const Text('Quay lại'),
              style: OutlinedButton.styleFrom(
                foregroundColor: BulkyColors.textPrimary,
                side: const BorderSide(color: BulkyColors.border),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton(
                key: const Key('proceed_to_payment_button'),
                onPressed: () async {
                  if (existingOrder != null) {
                    Navigator.pushNamed(context, '/payment', arguments: existingOrder.id);
                  } else {
                    final ordersProvider = context.read<OrdersProvider>();
                    try {
                      final newOrder = await ordersProvider.createOrderFromWizard(wizard);
                      if (context.mounted) {
                        Navigator.pushNamed(context, '/payment', arguments: newOrder.id);
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Lỗi tạo đơn: $e')),
                        );
                      }
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: BulkyColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  elevation: 2,
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Tiến hành đặt cọc giữ chỗ',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(width: 6),
                    Icon(Icons.arrow_forward_rounded, size: 16),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
