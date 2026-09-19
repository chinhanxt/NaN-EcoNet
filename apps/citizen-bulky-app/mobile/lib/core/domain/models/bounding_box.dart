import '../../constants/bulky_constants.dart';

/// Represents a 2D bounding box detected by Gemini Multimodal Vision AI.
/// Coordinates are scaled in the 0..1000 normalized range: [ymin, xmin, ymax, xmax].
class BoundingBox {
  final int ymin;
  final int xmin;
  final int ymax;
  final int xmax;
  final String displayName;
  final double confidence;
  final BulkyCategory category;
  final bool isHazardous;
  final MaterialType material;

  const BoundingBox({
    required this.ymin,
    required this.xmin,
    required this.ymax,
    required this.xmax,
    required this.displayName,
    this.confidence = 1.0,
    this.category = BulkyCategory.OTHER,
    this.isHazardous = false,
    this.material = MaterialType.STANDARD,
  });

  /// Normalized [0.0..1.0] coordinates for Canvas rendering
  double get topNormalized => ymin / 1000.0;
  double get leftNormalized => xmin / 1000.0;
  double get bottomNormalized => ymax / 1000.0;
  double get rightNormalized => xmax / 1000.0;
  double get widthNormalized => (xmax - xmin).abs() / 1000.0;
  double get heightNormalized => (ymax - ymin).abs() / 1000.0;

  List<int> get box2d => [ymin, xmin, ymax, xmax];

  factory BoundingBox.fromList(
    List<dynamic> coords, {
    required String displayName,
    double confidence = 1.0,
    BulkyCategory category = BulkyCategory.OTHER,
    bool isHazardous = false,
    MaterialType material = MaterialType.STANDARD,
  }) {
    if (coords.length < 4) {
      throw ArgumentError('Bounding box coordinates must contain 4 values');
    }
    return BoundingBox(
      ymin: (coords[0] as num).toInt(),
      xmin: (coords[1] as num).toInt(),
      ymax: (coords[2] as num).toInt(),
      xmax: (coords[3] as num).toInt(),
      displayName: displayName,
      confidence: confidence,
      category: category,
      isHazardous: isHazardous,
      material: material,
    );
  }

  factory BoundingBox.fromJson(Map<String, dynamic> json) {
    final rawBox = json['box_2d'] as List<dynamic>? ??
        [
          json['ymin'] ?? 0,
          json['xmin'] ?? 0,
          json['ymax'] ?? 0,
          json['xmax'] ?? 0,
        ];

    return BoundingBox(
      ymin: (rawBox[0] as num).toInt(),
      xmin: (rawBox[1] as num).toInt(),
      ymax: (rawBox[2] as num).toInt(),
      xmax: (rawBox[3] as num).toInt(),
      displayName: json['displayName'] as String? ?? 'Vật dụng',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
      category: BulkyCategory.values.firstWhere(
        (c) => c.name == json['category'] || c.name == json['itemType'],
        orElse: () => BulkyCategory.OTHER,
      ),
      isHazardous: json['isHazardous'] as bool? ?? false,
      material: MaterialType.values.firstWhere(
        (m) => m.name == json['material'] || m.name == json['suggestedMaterial'],
        orElse: () => MaterialType.STANDARD,
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'box_2d': [ymin, xmin, ymax, xmax],
      'ymin': ymin,
      'xmin': xmin,
      'ymax': ymax,
      'xmax': xmax,
      'displayName': displayName,
      'confidence': confidence,
      'category': category.name,
      'isHazardous': isHazardous,
      'material': material.name,
    };
  }

  BoundingBox copyWith({
    int? ymin,
    int? xmin,
    int? ymax,
    int? xmax,
    String? displayName,
    double? confidence,
    BulkyCategory? category,
    bool? isHazardous,
    MaterialType? material,
  }) {
    return BoundingBox(
      ymin: ymin ?? this.ymin,
      xmin: xmin ?? this.xmin,
      ymax: ymax ?? this.ymax,
      xmax: xmax ?? this.xmax,
      displayName: displayName ?? this.displayName,
      confidence: confidence ?? this.confidence,
      category: category ?? this.category,
      isHazardous: isHazardous ?? this.isHazardous,
      material: material ?? this.material,
    );
  }
}
