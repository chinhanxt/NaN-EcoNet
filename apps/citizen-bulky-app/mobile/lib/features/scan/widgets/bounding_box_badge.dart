import 'package:flutter/material.dart' hide MaterialType;
import '../../../core/constants/bulky_constants.dart';
import '../../../core/theme/bulky_colors.dart';

/// Interactive chip/badge displaying category information, emoji, and AI confidence.
class BoundingBoxBadge extends StatelessWidget {
  final BulkyCategory category;
  final String? displayName;
  final double? confidence;
  final bool isHazardous;
  final bool isSelected;
  final VoidCallback? onTap;
  final MaterialType? material;
  final bool showEmoji;
  final bool showConfidence;

  const BoundingBoxBadge({
    super.key,
    required this.category,
    this.displayName,
    this.confidence,
    this.isHazardous = false,
    this.isSelected = false,
    this.onTap,
    this.material,
    this.showEmoji = true,
    this.showConfidence = true,
  });

  /// Category color mapping adhering to BulkyTheme.
  static Color getColor(BulkyCategory category, {bool isHazardous = false}) {
    if (isHazardous) return BulkyColors.boxHazardous;
    switch (category) {
      case BulkyCategory.SOFA:
        return BulkyColors.boxSofa;
      case BulkyCategory.MATTRESS:
        return BulkyColors.boxMattress;
      case BulkyCategory.CABINET:
        return BulkyColors.boxCabinet;
      case BulkyCategory.TABLE:
        return BulkyColors.boxTable;
      case BulkyCategory.OTHER:
        return BulkyColors.boxOther;
    }
  }

  /// Category emoji mapping.
  static String getEmoji(BulkyCategory category, {bool isHazardous = false}) {
    if (isHazardous) return '⚠️';
    switch (category) {
      case BulkyCategory.SOFA:
        return '🛋️';
      case BulkyCategory.MATTRESS:
        return '🛏️';
      case BulkyCategory.CABINET:
        return '🚪';
      case BulkyCategory.TABLE:
        return '🪑';
      case BulkyCategory.OTHER:
        return '📦';
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = getColor(category, isHazardous: isHazardous);
    final emoji = getEmoji(category, isHazardous: isHazardous);
    final label = displayName ?? category.displayName;

    final badgeContent = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isSelected
            ? color.withValues(alpha: 0.22)
            : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isSelected ? color : color.withValues(alpha: 0.4),
          width: isSelected ? 2.0 : 1.0,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showEmoji) ...[
            Text(emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: BulkyColors.textPrimary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (confidence != null && showConfidence) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '${(confidence! * 100).round()}%',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ],
          if (material != null) ...[
            const SizedBox(width: 4),
            Text(material!.emoji, style: const TextStyle(fontSize: 12)),
          ],
        ],
      ),
    );

    if (onTap == null) return badgeContent;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: badgeContent,
      ),
    );
  }
}
