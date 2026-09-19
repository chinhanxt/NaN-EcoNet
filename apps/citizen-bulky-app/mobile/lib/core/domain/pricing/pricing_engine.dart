import '../../constants/bulky_constants.dart';
import '../models/bulky_item.dart';
import '../models/bulky_quote.dart';

/// Pure domain pricing engine for the Smartbin Bulky Waste Service.
/// Implements material factor scaling, Min-Max range estimation,
/// handling and logistics surcharges, and ±15% tolerance policy.
class PricingEngine {
  /// Calculates a full quote with estimated Min-Max range and item breakdown.
  static BulkyQuote calculateQuote({
    required List<BulkyItem> items,
    bool requiresDisassembly = false,
    int floorNumber = 0,
    bool hasElevator = false,
    int areaFee = DEFAULT_AREA_FEE,
    DateTime? now,
    int quoteTtlMinutes = 30,
  }) {
    if (items.isEmpty) {
      throw ArgumentError('Danh sách vật dụng không được để trống.');
    }

    final currentTime = now ?? DateTime.now();
    final expiresAt = currentTime.add(Duration(minutes: quoteTtlMinutes));

    final itemsBreakdown = <QuoteItemBreakdown>[];
    int itemsTotalMinVnd = 0;
    int itemsTotalMaxVnd = 0;

    for (final item in items) {
      if (item.quantity <= 0) {
        throw ArgumentError('Số lượng của ${item.displayName} phải lớn hơn 0.');
      }

      final unitPriceVnd = item.unitPriceVnd;
      final itemMinVnd = item.totalPriceVnd;
      final itemMaxVnd = (itemMinVnd * SPREAD_FACTOR).round();

      itemsBreakdown.add(
        QuoteItemBreakdown(
          item: item,
          quantity: item.quantity,
          unitPriceVnd: unitPriceVnd,
          minVnd: itemMinVnd,
          maxVnd: itemMaxVnd,
          material: item.material,
        ),
      );

      itemsTotalMinVnd += itemMinVnd;
      itemsTotalMaxVnd += itemMaxVnd;
    }

    // Logistics & Handling fees
    final needsDisassembly =
        requiresDisassembly || items.any((i) => i.requiresDisassembly);
    final disassemblyFee = needsDisassembly ? DISASSEMBLY_FEE : 0;
    final floorHandlingFee =
        (!hasElevator && floorNumber > 0) ? floorNumber * FLOOR_FEE_PER_FLOOR : 0;

    final minVnd = itemsTotalMinVnd + disassemblyFee + floorHandlingFee + areaFee;
    final maxVnd = (minVnd * SPREAD_FACTOR).round();
    final depositHoldVnd = minVnd;

    final allowedMaxVnd =
        (maxVnd * (1 + (TOLERANCE_PERCENT / 100.0))).round();

    final tolerancePolicy = TolerancePolicy(
      allowedPercent: TOLERANCE_PERCENT,
      allowedMaxVnd: allowedMaxVnd,
      message: TOLERANCE_MESSAGE,
    );

    return BulkyQuote(
      quoteId: 'quote-${currentTime.millisecondsSinceEpoch}',
      itemsBreakdown: itemsBreakdown,
      subtotalMinVnd: itemsTotalMinVnd,
      subtotalMaxVnd: itemsTotalMaxVnd,
      disassemblyFee: disassemblyFee,
      floorHandlingFee: floorHandlingFee,
      areaFee: areaFee,
      minVnd: minVnd,
      maxVnd: maxVnd,
      depositHoldVnd: depositHoldVnd,
      tolerancePolicy: tolerancePolicy,
      createdAt: currentTime,
      expiresAt: expiresAt,
    );
  }

  /// Calculates total estimated weight in kilograms across all items.
  static double calculateTotalEstimatedWeight(List<BulkyItem> items) {
    double total = 0.0;
    for (final item in items) {
      total += item.totalEstimatedWeightKg;
    }
    return (total * 10).round() / 10.0;
  }
}
