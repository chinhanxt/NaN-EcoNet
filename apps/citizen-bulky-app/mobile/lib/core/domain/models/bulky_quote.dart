import '../../constants/bulky_constants.dart';
import 'bulky_item.dart';

/// Breakdown line item for quote display.
class QuoteItemBreakdown {
  final BulkyItem item;
  final int quantity;
  final int unitPriceVnd;
  final int minVnd;
  final int maxVnd;
  final MaterialType material;

  const QuoteItemBreakdown({
    required this.item,
    required this.quantity,
    required this.unitPriceVnd,
    required this.minVnd,
    required this.maxVnd,
    required this.material,
  });

  Map<String, dynamic> toJson() => {
        'item': item.toJson(),
        'quantity': quantity,
        'unitPriceVnd': unitPriceVnd,
        'minVnd': minVnd,
        'maxVnd': maxVnd,
        'material': material.name,
      };

  factory QuoteItemBreakdown.fromJson(Map<String, dynamic> json) =>
      QuoteItemBreakdown(
        item: BulkyItem.fromJson(json['item'] as Map<String, dynamic>),
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        unitPriceVnd: (json['unitPriceVnd'] as num?)?.toInt() ?? 0,
        minVnd: (json['minVnd'] as num?)?.toInt() ?? 0,
        maxVnd: (json['maxVnd'] as num?)?.toInt() ?? 0,
        material: MaterialType.values.firstWhere(
          (m) => m.name == json['material'],
          orElse: () => MaterialType.STANDARD,
        ),
      );
}

/// Tolerance and price protection policy against on-site weight/volume discrepancies.
class TolerancePolicy {
  final int allowedPercent;
  final int allowedMaxVnd;
  final String message;

  const TolerancePolicy({
    this.allowedPercent = TOLERANCE_PERCENT,
    required this.allowedMaxVnd,
    this.message = TOLERANCE_MESSAGE,
  });

  Map<String, dynamic> toJson() => {
        'allowedPercent': allowedPercent,
        'allowedMaxVnd': allowedMaxVnd,
        'message': message,
      };

  factory TolerancePolicy.fromJson(Map<String, dynamic> json) =>
      TolerancePolicy(
        allowedPercent:
            (json['allowedPercent'] as num?)?.toInt() ?? TOLERANCE_PERCENT,
        allowedMaxVnd: (json['allowedMaxVnd'] as num?)?.toInt() ?? 0,
        message: json['message'] as String? ?? TOLERANCE_MESSAGE,
      );
}

/// Complete quote for bulky waste collection service.
class BulkyQuote {
  final String quoteId;
  final List<QuoteItemBreakdown> itemsBreakdown;
  final int subtotalMinVnd;
  final int subtotalMaxVnd;
  final int disassemblyFee;
  final int floorHandlingFee;
  final int areaFee;
  final int minVnd;
  final int maxVnd;
  final int depositHoldVnd;
  final TolerancePolicy tolerancePolicy;
  final DateTime createdAt;
  final DateTime expiresAt;

  const BulkyQuote({
    required this.quoteId,
    required this.itemsBreakdown,
    required this.subtotalMinVnd,
    required this.subtotalMaxVnd,
    this.disassemblyFee = 0,
    this.floorHandlingFee = 0,
    this.areaFee = DEFAULT_AREA_FEE,
    required this.minVnd,
    required this.maxVnd,
    required this.depositHoldVnd,
    required this.tolerancePolicy,
    required this.createdAt,
    required this.expiresAt,
  });

  bool isExpired([DateTime? now]) {
    final current = now ?? DateTime.now();
    return current.isAfter(expiresAt);
  }

  Map<String, dynamic> toJson() => {
        'quoteId': quoteId,
        'itemsBreakdown': itemsBreakdown.map((e) => e.toJson()).toList(),
        'subtotalMinVnd': subtotalMinVnd,
        'subtotalMaxVnd': subtotalMaxVnd,
        'disassemblyFee': disassemblyFee,
        'floorHandlingFee': floorHandlingFee,
        'areaFee': areaFee,
        'minVnd': minVnd,
        'maxVnd': maxVnd,
        'depositHoldVnd': depositHoldVnd,
        'tolerancePolicy': tolerancePolicy.toJson(),
        'createdAt': createdAt.toIso8601String(),
        'expiresAt': expiresAt.toIso8601String(),
      };

  factory BulkyQuote.fromJson(Map<String, dynamic> json) => BulkyQuote(
        quoteId: json['quoteId'] as String? ?? 'quote-unknown',
        itemsBreakdown: (json['itemsBreakdown'] as List<dynamic>? ?? [])
            .map((e) => QuoteItemBreakdown.fromJson(e as Map<String, dynamic>))
            .toList(),
        subtotalMinVnd: (json['subtotalMinVnd'] as num?)?.toInt() ?? 0,
        subtotalMaxVnd: (json['subtotalMaxVnd'] as num?)?.toInt() ?? 0,
        disassemblyFee: (json['disassemblyFee'] as num?)?.toInt() ?? 0,
        floorHandlingFee: (json['floorHandlingFee'] as num?)?.toInt() ?? 0,
        areaFee: (json['areaFee'] as num?)?.toInt() ?? DEFAULT_AREA_FEE,
        minVnd: (json['minVnd'] as num?)?.toInt() ?? 0,
        maxVnd: (json['maxVnd'] as num?)?.toInt() ?? 0,
        depositHoldVnd: (json['depositHoldVnd'] as num?)?.toInt() ?? 0,
        tolerancePolicy: json['tolerancePolicy'] != null
            ? TolerancePolicy.fromJson(
                json['tolerancePolicy'] as Map<String, dynamic>)
            : TolerancePolicy(
                allowedMaxVnd:
                    ((json['maxVnd'] as num? ?? 0) * 1.15).round(),
              ),
        createdAt: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'] as String)
            : DateTime.now(),
        expiresAt: json['expiresAt'] != null
            ? DateTime.parse(json['expiresAt'] as String)
            : DateTime.now().add(const Duration(minutes: 30)),
      );
}
