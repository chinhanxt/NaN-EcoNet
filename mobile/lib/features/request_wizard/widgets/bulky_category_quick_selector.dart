import 'package:flutter/material.dart' hide MaterialType;
import '../../../../core/constants/bulky_constants.dart';
import '../../../../core/domain/models/bulky_item.dart';
import '../../../../core/theme/bulky_colors.dart';
import '../providers/booking_wizard_provider.dart';

/// Quick-add visual catalog of common bulky items (Sofa, Mattress, Cabinet, Table, Debris).
/// Inspired by top global on-demand waste removal apps (LoadUp, 1-800-GOT-JUNK).
class BulkyCategoryQuickSelector extends StatelessWidget {
  final BookingWizardProvider wizard;

  const BulkyCategoryQuickSelector({
    super.key,
    required this.wizard,
  });

  static const List<_QuickCategoryItem> _quickCategories = [
    _QuickCategoryItem(
      category: BulkyCategory.SOFA,
      name: 'Sofa da phòng khách',
      shortLabel: 'Sofa & Salon',
      emoji: '🛋️',
      basePrice: 150000,
      defaultMaterial: MaterialType.STANDARD,
      defaultWeight: 45,
    ),
    _QuickCategoryItem(
      category: BulkyCategory.MATTRESS,
      name: 'Đệm lò xo 1m8',
      shortLabel: 'Nệm & Đệm',
      emoji: '🛏️',
      basePrice: 100000,
      defaultMaterial: MaterialType.STANDARD,
      defaultWeight: 30,
    ),
    _QuickCategoryItem(
      category: BulkyCategory.CABINET,
      name: 'Tủ quần áo gỗ 3 cánh',
      shortLabel: 'Tủ gỗ & Kệ',
      emoji: '🚪',
      basePrice: 120000,
      defaultMaterial: MaterialType.STANDARD,
      defaultWeight: 40,
    ),
    _QuickCategoryItem(
      category: BulkyCategory.TABLE,
      name: 'Bàn ăn 6 ghế',
      shortLabel: 'Bàn ăn & Bàn đá',
      emoji: '🪑',
      basePrice: 80000,
      defaultMaterial: MaterialType.STANDARD,
      defaultWeight: 20,
    ),
    _QuickCategoryItem(
      category: BulkyCategory.OTHER,
      name: 'Xà bần / Gạch ngói vỡ',
      shortLabel: 'Xà bần & Khác',
      emoji: '🪨',
      basePrice: 60000,
      defaultMaterial: MaterialType.HEAVY,
      defaultWeight: 35,
    ),
  ];

  void _handleQuickAdd(BuildContext context, _QuickCategoryItem item) {
    final newItem = BulkyItem(
      id: 'item-quick-${DateTime.now().millisecondsSinceEpoch}',
      category: item.category,
      displayName: item.name,
      quantity: 1,
      material: item.defaultMaterial,
    );

    wizard.addItem(newItem);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('✓ Đã thêm "${item.name}" vào danh sách thu gom'),
        backgroundColor: BulkyColors.primary,
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Thêm nhanh đồ vật thường gặp:',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: BulkyColors.textPrimary,
              ),
            ),
            Text(
              '1-chạm thêm ngay',
              style: TextStyle(
                fontSize: 11,
                color: BulkyColors.primary.withValues(alpha: 0.9),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 118,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _quickCategories.length,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final cat = _quickCategories[index];
              return _buildQuickCard(context, cat);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildQuickCard(BuildContext context, _QuickCategoryItem cat) {
    return InkWell(
      key: Key('quick_add_${cat.category.name.toLowerCase()}_button'),
      onTap: () => _handleQuickAdd(context, cat),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 104,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        decoration: BoxDecoration(
          color: BulkyColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: BulkyColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: const BoxDecoration(
                color: BulkyColors.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Text(
                cat.emoji,
                style: const TextStyle(fontSize: 18),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              cat.shortLabel,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: BulkyColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 2),
            Text(
              BulkyColors.formatCurrency(cat.basePrice),
              style: const TextStyle(
                fontSize: 10,
                color: BulkyColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickCategoryItem {
  final BulkyCategory category;
  final String name;
  final String shortLabel;
  final String emoji;
  final int basePrice;
  final MaterialType defaultMaterial;
  final double defaultWeight;

  const _QuickCategoryItem({
    required this.category,
    required this.name,
    required this.shortLabel,
    required this.emoji,
    required this.basePrice,
    required this.defaultMaterial,
    required this.defaultWeight,
  });
}
