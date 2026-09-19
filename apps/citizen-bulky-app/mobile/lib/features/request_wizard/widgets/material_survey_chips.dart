import 'package:flutter/material.dart' hide MaterialType;
import '../../../../core/constants/bulky_constants.dart';
import '../../../../core/theme/bulky_colors.dart';

/// 1-Click interactive material survey chip group.
/// Allows rapid user selection between LIGHT (-20%), STANDARD (Gốc), and HEAVY (+30%).
class MaterialSurveyChips extends StatelessWidget {
  final MaterialType selectedMaterial;
  final ValueChanged<MaterialType> onMaterialChanged;

  const MaterialSurveyChips({
    super.key,
    required this.selectedMaterial,
    required this.onMaterialChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(
              child: _buildChip(
                context,
                type: MaterialType.LIGHT,
                emoji: '🪶',
                label: 'Nhựa / Mút xốp',
                deltaText: '-20%',
                badgeColor: BulkyColors.success,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildChip(
                context,
                type: MaterialType.STANDARD,
                emoji: '🪵',
                label: 'Gỗ ép / Tiêu chuẩn',
                deltaText: 'Gốc',
                badgeColor: BulkyColors.primary,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildChip(
                context,
                type: MaterialType.HEAVY,
                emoji: '🪨',
                label: 'Gỗ đặc / Rất nặng',
                deltaText: '+30%',
                badgeColor: BulkyColors.warning,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildChip(
    BuildContext context, {
    required MaterialType type,
    required String emoji,
    required String label,
    required String deltaText,
    required Color badgeColor,
  }) {
    final isSelected = selectedMaterial == type;

    return Semantics(
      button: true,
      selected: isSelected,
      label: '$label, chênh lệch giá $deltaText',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => onMaterialChanged(type),
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
            decoration: BoxDecoration(
              color: isSelected ? BulkyColors.primaryContainer : BulkyColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isSelected ? BulkyColors.primary : BulkyColors.border,
                width: isSelected ? 2 : 1,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: BulkyColors.primary.withValues(alpha: 0.18),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ]
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Emoji and Delta badge
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      emoji,
                      style: const TextStyle(fontSize: 16),
                    ),
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? badgeColor.withValues(alpha: 0.2)
                            : Colors.grey.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        deltaText,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? badgeColor : BulkyColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                // Text label
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.25,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? BulkyColors.primaryDark : BulkyColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
