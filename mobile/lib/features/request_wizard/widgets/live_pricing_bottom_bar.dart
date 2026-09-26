import 'package:flutter/material.dart' hide MaterialType;
import 'package:provider/provider.dart';
import '../../../../core/constants/bulky_constants.dart';
import '../../../../core/theme/bulky_colors.dart';
import '../../orders/providers/orders_provider.dart';
import '../providers/booking_wizard_provider.dart';

/// Persistent bottom action bar displaying real-time price estimation,
/// deposit hold requirement, step navigation buttons, and transparent price drawer.
class LivePricingBottomBar extends StatelessWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final Future<void> Function()? onSubmitReview;

  const LivePricingBottomBar({
    super.key,
    this.onNext,
    this.onBack,
    this.onSubmitReview,
  });

  void _showPriceBreakdownSheet(BuildContext context, BookingWizardProvider wizard) {
    final quote = wizard.currentQuote;
    if (quote == null) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: BulkyColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.65,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: BulkyColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Row(
                    children: [
                      Icon(Icons.receipt_long_rounded, color: BulkyColors.primary, size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Chi Tiết Bảng Cước Thu Gom',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Biểu cước minh bạch niêm yết theo quy định Smartbin',
                    style: TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
                  ),
                  const SizedBox(height: 14),
                  const Divider(height: 1),
                  const SizedBox(height: 12),

                  // 1. Items breakdown
                  const Text(
                    'Vật dụng thu gom:',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  ...wizard.items.map((it) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Text(it.material.emoji, style: const TextStyle(fontSize: 14)),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    '${it.displayName} (x${it.quantity})',
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            BulkyColors.formatCurrency(it.totalPriceVnd),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    );
                  }),
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 12),

                  // 2. Logistics & Surcharges
                  const Text(
                    'Phụ phí dịch vụ & Phương tiện:',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  _buildCostRow('Phí xe thu gom chuyên dụng:', BulkyColors.formatCurrency(quote.areaFee)),
                  if (quote.disassemblyFee > 0)
                    _buildCostRow('Phụ phí tháo dỡ đồ:', BulkyColors.formatCurrency(quote.disassemblyFee)),
                  if (quote.floorHandlingFee > 0)
                    _buildCostRow(
                      'Phụ phí tầng lầu (Tầng ${wizard.floorNumber}):',
                      BulkyColors.formatCurrency(quote.floorHandlingFee),
                    ),
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 12),

                  // 3. Totals
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Text(
                          'Tổng cước ước tính:',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          '${BulkyColors.formatCurrency(quote.minVnd)} - ${BulkyColors.formatCurrency(quote.maxVnd)}',
                          textAlign: TextAlign.end,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: BulkyColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Text(
                          'Tiền cọc giữ chỗ (Tạm ứng):',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: BulkyColors.warning),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        BulkyColors.formatCurrency(quote.depositHoldVnd),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.warning,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // 4. Tolerance Guarantee banner
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: BulkyColors.primaryLight.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: BulkyColors.primary.withValues(alpha: 0.3)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.verified_rounded, size: 20, color: BulkyColors.primary),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            TOLERANCE_MESSAGE,
                            style: TextStyle(fontSize: 11, color: BulkyColors.textPrimary, height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Close button
                  ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BulkyColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Đã hiểu bảng cước'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildCostRow(String title, String cost) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(title, style: const TextStyle(fontSize: 12, color: BulkyColors.textSecondary)),
          ),
          const SizedBox(width: 8),
          Text(cost, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Future<void> _handleReviewSubmission(BuildContext context, BookingWizardProvider wizard) async {
    if (onSubmitReview != null) {
      await onSubmitReview!();
      return;
    }
    if (onNext != null) {
      onNext!();
      return;
    }
    try {
      final newOrder = await context.read<OrdersProvider>().createOrderForReview(wizard);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Đã gửi yêu cầu xét duyệt thành công! Điều phối viên sẽ kiểm tra và chốt giá sớm nhất.',
          ),
          backgroundColor: BulkyColors.success,
        ),
      );
      Navigator.pushNamed(
        context,
        '/order-detail',
        arguments: newOrder.id,
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể gửi yêu cầu xét duyệt: $e'),
          backgroundColor: BulkyColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BookingWizardProvider>(
      builder: (context, wizard, child) {
        final quote = wizard.currentQuote;
        final hasQuote = quote != null;
        final canGoNext = wizard.canGoNext();
        final currentStep = wizard.currentStep;

        final minVnd = hasQuote ? quote.minVnd : 0;
        final maxVnd = hasQuote ? quote.maxVnd : 0;
        final depositHoldVnd = hasQuote ? quote.depositHoldVnd : 0;

        return SafeArea(
          top: false,
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: BoxDecoration(
              color: BulkyColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BulkyColors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 16,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Price Estimation & Deposit Info (Tappable for breakdown drawer)
                InkWell(
                  key: const Key('price_breakdown_trigger'),
                  onTap: hasQuote ? () => _showPriceBreakdownSheet(context, wizard) : null,
                  borderRadius: BorderRadius.circular(10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                const Text(
                                  'Ước tính: ',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: BulkyColors.textSecondary,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                if (hasQuote)
                                  Flexible(
                                    child: Text(
                                      '${BulkyColors.formatCurrency(minVnd)} - ${BulkyColors.formatCurrency(maxVnd)}',
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: BulkyColors.primary,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  )
                                else
                                  const Text(
                                    '0 đ',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: BulkyColors.textSecondary,
                                    ),
                                  ),
                                if (hasQuote) ...[
                                  const SizedBox(width: 6),
                                  const Icon(
                                    Icons.info_outline_rounded,
                                    size: 15,
                                    color: BulkyColors.primary,
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Text(
                                  'Cọc giữ chỗ: ${BulkyColors.formatCurrency(depositHoldVnd)}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: BulkyColors.warning,
                                  ),
                                ),
                                if (wizard.items.isNotEmpty) ...[
                                  const Text(
                                    ' • ',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: BulkyColors.textSecondary,
                                    ),
                                  ),
                                  Text(
                                    '~${wizard.totalEstimatedWeightKg.toStringAsFixed(1)} kg',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: BulkyColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      if (hasQuote)
                        Container(
                          key: const Key('price_breakdown_drawer_button'),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: BulkyColors.primaryContainer,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: BulkyColors.primaryLight.withValues(alpha: 0.3),
                            ),
                          ),
                          child: const Text(
                            'Chi tiết ℹ️',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: BulkyColors.primaryDark,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // Navigation Buttons (height 52px)
                Row(
                  children: [
                    if (currentStep > 0) ...[
                      OutlinedButton.icon(
                        key: const Key('wizard_back_button'),
                        onPressed: onBack ?? () => wizard.prevStep(),
                        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 16),
                        label: const Text('Quay lại'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(100, 52),
                          foregroundColor: BulkyColors.textPrimary,
                          side: const BorderSide(color: BulkyColors.border),
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: KeyedSubtree(
                        key: currentStep == 2
                            ? const Key('wizard_submit_review_button')
                            : const Key('wizard_next_container'),
                        child: ElevatedButton(
                          key: const Key('wizard_next_button'),
                          onPressed: canGoNext
                              ? () {
                                  if (currentStep == 2) {
                                    _handleReviewSubmission(context, wizard);
                                  } else {
                                    if (onNext != null) {
                                      onNext!();
                                    } else {
                                      wizard.nextStep();
                                    }
                                  }
                                }
                              : null,
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size.fromHeight(52),
                            backgroundColor: BulkyColors.primary,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: BulkyColors.border,
                            disabledForegroundColor: BulkyColors.textSecondary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: canGoNext ? 2 : 0,
                          ),
                          child: Text(
                            currentStep == 2 ? 'GỬI YÊU CẦU XÉT DUYỆT' : 'Tiếp tục',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
