import 'package:flutter/material.dart' hide MaterialType;
import 'package:provider/provider.dart';
import '../../../../core/theme/bulky_colors.dart';
import '../providers/booking_wizard_provider.dart';

/// Step 3 of Booking Wizard: Order Review, 2-Tiered Quote Breakdown,
/// Pickup Logistics Verification, and ±15% Tolerance Guarantee Banner.
class StepReviewSummary extends StatelessWidget {
  const StepReviewSummary({super.key});

  @override
  Widget build(BuildContext context) {
    final wizard = context.watch<BookingWizardProvider>();
    final quote = wizard.currentQuote;

    if (quote == null || wizard.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.warning_amber_rounded, size: 48, color: BulkyColors.warning),
              const SizedBox(height: 12),
              const Text(
                'Chưa có thông tin đơn hàng',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Vui lòng quay lại Bước 1 để chọn đồ vật cần thu gom.',
                textAlign: TextAlign.center,
                style: TextStyle(color: BulkyColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => wizard.goToStep(0),
                child: const Text('Quay lại Bước 1'),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Vehicle Readiness Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: BulkyColors.successBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BulkyColors.success.withValues(alpha: 0.3)),
              boxShadow: BulkyColors.softShadow,
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: BulkyColors.success.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_circle_rounded, color: BulkyColors.success, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Xe thu gom chuyên dụng sẵn sàng phục vụ ngày ${wizard.scheduledDate.isNotEmpty ? wizard.scheduledDate : "hẹn"}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: BulkyColors.success,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 2. Operator Review Notice Banner
          Container(
            key: const Key('operator_review_notice_banner'),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: BulkyColors.primaryLight.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BulkyColors.primary.withValues(alpha: 0.3)),
              boxShadow: BulkyColors.softShadow,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: BulkyColors.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.assignment_turned_in_outlined,
                    size: 20,
                    color: BulkyColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Quy trình xét duyệt minh bạch',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: BulkyColors.primaryDark,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Đơn hàng sẽ được chuyển đến Điều phối viên để kiểm tra và chốt mức giá chính xác. Bạn chỉ cần thanh toán cọc sau khi đơn được phê duyệt.',
                        style: TextStyle(
                          fontSize: 12,
                          color: BulkyColors.textPrimary,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 3. Items Breakdown Card (Itemized Receipt)
          _buildCard(
            title: 'Danh mục đồ vật (${wizard.totalItemsCount} món - ~${wizard.totalEstimatedWeightKg.toStringAsFixed(1)} kg)',
            icon: Icons.inventory_2_outlined,
            child: Column(
              children: [
                ...quote.itemsBreakdown.map((line) {
                  final item = line.item;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: BulkyColors.primaryContainer,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${line.quantity}x',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: BulkyColors.primaryDark,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.displayName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  color: BulkyColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 1.5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: BulkyColors.background,
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: BulkyColors.border),
                                    ),
                                    child: Text(
                                      '${line.material.emoji} ${line.material.shortLabel}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: BulkyColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    '~${item.totalEstimatedWeightKg.toStringAsFixed(1)} kg',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: BulkyColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '${BulkyColors.formatCurrency(line.minVnd)} - ${BulkyColors.formatCurrency(line.maxVnd)}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                            color: BulkyColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 3. Pickup Logistics Summary Card
          _buildCard(
            title: 'Thông tin thu gom & Bốc dỡ',
            icon: Icons.local_shipping_outlined,
            child: Column(
              children: [
                _buildInfoRow(
                  label: 'Địa chỉ:',
                  value: wizard.address.isNotEmpty ? wizard.address : 'Chưa nhập',
                ),
                const Divider(height: 14),
                _buildInfoRow(
                  label: 'Thời gian:',
                  value: '${wizard.scheduledDate} (${wizard.scheduledTimeSlot})',
                ),
                if (wizard.contactName.isNotEmpty || wizard.contactPhone.isNotEmpty) ...[
                  const Divider(height: 14),
                  _buildInfoRow(
                    label: 'Người liên hệ:',
                    value: '${wizard.contactName} - ${wizard.contactPhone}',
                  ),
                ],
                const Divider(height: 14),
                _buildInfoRow(
                  label: 'Tháo dỡ đồ:',
                  value: wizard.requiresDisassembly ? 'Có (+30.000 đ)' : 'Không yêu cầu',
                ),
                const Divider(height: 14),
                _buildInfoRow(
                  label: 'Thang máy / Lầu:',
                  value: wizard.hasElevator
                      ? 'Có thang máy (Miễn phí tầng)'
                      : (wizard.floorNumber > 0
                          ? 'Thang bộ Tầng ${wizard.floorNumber} (+${BulkyColors.formatCurrency(quote.floorHandlingFee)})'
                          : 'Tầng trệt'),
                ),
                if (wizard.notes.isNotEmpty) ...[
                  const Divider(height: 14),
                  _buildInfoRow(
                    label: 'Ghi chú:',
                    value: wizard.notes,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 4. Two-Tiered Cost Breakdown Card
          _buildCard(
            title: 'Bảng kê chi phí dịch vụ',
            icon: Icons.receipt_long_outlined,
            child: Column(
              children: [
                _buildCostRow(
                  'Cước đồ vật (${wizard.totalItemsCount} món):',
                  '${BulkyColors.formatCurrency(quote.subtotalMinVnd)} - ${BulkyColors.formatCurrency(quote.subtotalMaxVnd)}',
                ),
                if (quote.disassemblyFee > 0)
                  _buildCostRow(
                    'Phụ phí tháo dỡ thiết bị:',
                    BulkyColors.formatCurrency(quote.disassemblyFee),
                  ),
                if (quote.floorHandlingFee > 0)
                  _buildCostRow(
                    'Phụ phí bốc vác thang bộ (Tầng ${wizard.floorNumber}):',
                    BulkyColors.formatCurrency(quote.floorHandlingFee),
                  ),
                _buildCostRow(
                  'Phí xe thu gom chuyên dụng:',
                  BulkyColors.formatCurrency(quote.areaFee),
                ),
                const Divider(thickness: 1.2, height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Tổng cước ước tính:',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                    Text(
                      '${BulkyColors.formatCurrency(quote.minVnd)} - ${BulkyColors.formatCurrency(quote.maxVnd)}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: BulkyColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: BulkyColors.warningBg.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: BulkyColors.warning.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Cọc giữ chỗ xe (Thanh toán sau khi duyệt):',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: BulkyColors.textPrimary,
                            ),
                          ),
                          Text(
                            'Khấu trừ trực tiếp vào hoá đơn sau thu gom',
                            style: TextStyle(
                              fontSize: 11,
                              color: BulkyColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        BulkyColors.formatCurrency(quote.depositHoldVnd),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: BulkyColors.warning,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 5. Tolerance Guarantee Banner (±15%)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: BulkyColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BulkyColors.primary.withValues(alpha: 0.35)),
              boxShadow: BulkyColors.softShadow,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: BulkyColors.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.verified_user_rounded,
                    size: 20,
                    color: BulkyColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Cam kết bảo vệ giá (Dung sai ±15%)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: BulkyColors.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        quote.tolerancePolicy.message,
                        style: const TextStyle(
                          fontSize: 12,
                          color: BulkyColors.textSecondary,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: BulkyColors.softShadow,
      ),
      child: Material(
        color: BulkyColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: BulkyColors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                      color: BulkyColors.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: 18, color: BulkyColors.primary),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              child,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow({required String label, required String value}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: BulkyColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: BulkyColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCostRow(String title, String amount) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
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
            amount,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: BulkyColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
