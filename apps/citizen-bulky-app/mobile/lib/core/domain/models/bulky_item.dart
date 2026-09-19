import '../../constants/bulky_constants.dart';
import 'bounding_box.dart';

/// Represents a single bulky waste item registered for collection.
class BulkyItem {
  final String id;
  final BulkyCategory category;
  final String displayName;
  final int quantity;
  final int? lengthCm;
  final int? widthCm;
  final int? heightCm;
  final MaterialType material;
  final double? weightKg;
  final BoundingBox? box2d;
  final double confidence;
  final bool requiresDisassembly;

  const BulkyItem({
    required this.id,
    required this.category,
    required this.displayName,
    this.quantity = 1,
    this.lengthCm,
    this.widthCm,
    this.heightCm,
    this.material = MaterialType.STANDARD,
    this.weightKg,
    this.box2d,
    this.confidence = 1.0,
    this.requiresDisassembly = false,
  });

  /// Base price per unit based on category and material factor.
  int get unitPriceVnd {
    final base = BASE_PRICES[category] ?? 60000;
    return (base * material.priceFactor).round();
  }

  /// Total price for this item line.
  int get totalPriceVnd => unitPriceVnd * quantity;

  /// Estimated unit weight in kg based on category and material factor.
  double get estimatedUnitWeightKg {
    if (weightKg != null) return weightKg!;
    final baseWeight = BASE_WEIGHTS[category] ?? 15;
    return (baseWeight * material.weightFactor * 10).round() / 10.0;
  }

  /// Total estimated weight for all units of this item.
  double get totalEstimatedWeightKg => estimatedUnitWeightKg * quantity;

  /// Human-readable dimension string, e.g. "180 × 90 × 75 cm".
  String get dimensionsText {
    if (lengthCm != null && widthCm != null && heightCm != null) {
      return '$lengthCm × $widthCm × $heightCm cm';
    }
    return '';
  }

  BulkyItem copyWith({
    String? id,
    BulkyCategory? category,
    String? displayName,
    int? quantity,
    int? lengthCm,
    int? widthCm,
    int? heightCm,
    MaterialType? material,
    double? weightKg,
    BoundingBox? box2d,
    double? confidence,
    bool? requiresDisassembly,
  }) {
    return BulkyItem(
      id: id ?? this.id,
      category: category ?? this.category,
      displayName: displayName ?? this.displayName,
      quantity: quantity ?? this.quantity,
      lengthCm: lengthCm ?? this.lengthCm,
      widthCm: widthCm ?? this.widthCm,
      heightCm: heightCm ?? this.heightCm,
      material: material ?? this.material,
      weightKg: weightKg ?? this.weightKg,
      box2d: box2d ?? this.box2d,
      confidence: confidence ?? this.confidence,
      requiresDisassembly: requiresDisassembly ?? this.requiresDisassembly,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'category': category.name,
      'displayName': displayName,
      'quantity': quantity,
      'lengthCm': lengthCm,
      'widthCm': widthCm,
      'heightCm': heightCm,
      'material': material.name,
      'weightKg': weightKg,
      'box2d': box2d?.toJson(),
      'confidence': confidence,
      'requiresDisassembly': requiresDisassembly,
    };
  }

  factory BulkyItem.fromJson(Map<String, dynamic> json) {
    return BulkyItem(
      id: json['id'] as String? ?? 'item-${DateTime.now().millisecondsSinceEpoch}',
      category: BulkyCategory.values.firstWhere(
        (c) => c.name == json['category'] || c.name == json['itemType'],
        orElse: () => BulkyCategory.OTHER,
      ),
      displayName: json['displayName'] as String? ?? 'Vật dụng cồng kềnh',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      lengthCm: (json['lengthCm'] as num?)?.toInt() ??
          (json['dimensionsCm']?['length'] as num?)?.toInt(),
      widthCm: (json['widthCm'] as num?)?.toInt() ??
          (json['dimensionsCm']?['width'] as num?)?.toInt(),
      heightCm: (json['heightCm'] as num?)?.toInt() ??
          (json['dimensionsCm']?['height'] as num?)?.toInt(),
      material: MaterialType.values.firstWhere(
        (m) =>
            m.name == json['material'] ||
            m.name == json['suggestedMaterial'],
        orElse: () => MaterialType.STANDARD,
      ),
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      box2d: json['box2d'] != null
          ? BoundingBox.fromJson(json['box2d'] as Map<String, dynamic>)
          : (json['box_2d'] != null && json['box_2d'] is List
              ? BoundingBox.fromList(
                  json['box_2d'] as List,
                  displayName: json['displayName'] as String? ?? 'Vật dụng',
                  category: BulkyCategory.values.firstWhere(
                    (c) => c.name == json['category'] || c.name == json['itemType'],
                    orElse: () => BulkyCategory.OTHER,
                  ),
                )
              : null),
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
      requiresDisassembly:
          (json['requiresDisassembly'] as bool?) ?? (json['disassemblyNeeded'] as bool?) ?? false,
    );
  }
}
