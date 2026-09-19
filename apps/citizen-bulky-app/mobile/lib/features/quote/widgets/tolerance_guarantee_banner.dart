import 'package:flutter/material.dart';
import '../../../core/domain/models/bulky_quote.dart';
import '../../../core/theme/bulky_colors.dart';

/// Banner displaying price protection guarantee and tolerance policy (±15%).
class ToleranceGuaranteeBanner extends StatelessWidget {
  final TolerancePolicy? policy;

  const ToleranceGuaranteeBanner({
    super.key,
    this.policy,
  });

  @override
  Widget build(BuildContext context) {
    final message = policy?.message ??
        'Đảm bảo chi phí thực tế tại hiện trường không vượt quá 15% so với mức giá trần ước tính.';
    final allowedMax = policy?.allowedMaxVnd;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: BulkyColors.primaryLight.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: BulkyColors.primaryLight.withValues(alpha: 0.35),
          width: 1.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: BulkyColors.primaryLight.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.verified_user_rounded,
                  color: BulkyColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Cam kết bảo vệ giá (Dung sai ±15%)',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.primaryDark,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(
              fontSize: 13,
              color: BulkyColors.textSecondary,
              height: 1.4,
            ),
          ),
          if (allowedMax != null && allowedMax > 0) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: BulkyColors.successBg,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'Mức thanh toán tối đa cam kết: ${BulkyColors.formatCurrency(allowedMax)}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: BulkyColors.success,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
