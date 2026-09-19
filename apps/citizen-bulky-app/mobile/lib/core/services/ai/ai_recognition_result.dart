// ignore_for_file: constant_identifier_names

import '../../domain/models/bulky_item.dart';
import '../../domain/models/bounding_box.dart';

export '../../domain/models/bulky_item.dart';
export '../../domain/models/bounding_box.dart';

/// Decision outcomes produced by Vision AI.
class AiDecision {
  static const String SUGGESTED = 'SUGGESTED';
  static const String NEEDS_CONFIRMATION = 'NEEDS_CONFIRMATION';
  static const String MANUAL_REVIEW = 'MANUAL_REVIEW';
}

/// Represents the holistic recognition result returned by Gemini Vision AI.
class AiRecognitionResult {
  final String decision;
  final bool requiresManualReview;
  final bool containsHazardousWaste;
  final bool containsConstructionWaste;
  final double confidence;
  final String explanation;
  final List<BulkyItem> items;
  final List<BoundingBox> boundingBoxes;
  final String aiModelUsed;
  final String? hazardousReason;

  const AiRecognitionResult({
    required this.decision,
    required this.requiresManualReview,
    this.containsHazardousWaste = false,
    this.containsConstructionWaste = false,
    this.confidence = 1.0,
    required this.explanation,
    required this.items,
    required this.boundingBoxes,
    this.aiModelUsed = 'Trí tuệ nhân tạo (AI)',
    this.hazardousReason,
  });

  Map<String, dynamic> toJson() {
    return {
      'decision': decision,
      'requiresManualReview': requiresManualReview,
      'containsHazardousWaste': containsHazardousWaste,
      'containsConstructionWaste': containsConstructionWaste,
      'confidence': confidence,
      'explanation': explanation,
      'items': items.map((e) => e.toJson()).toList(),
      'boundingBoxes': boundingBoxes.map((e) => e.toJson()).toList(),
      'aiModelUsed': aiModelUsed,
      if (hazardousReason != null) 'hazardousReason': hazardousReason,
    };
  }

  factory AiRecognitionResult.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    final rawBoxes = json['boundingBoxes'] as List<dynamic>? ?? [];

    return AiRecognitionResult(
      decision: json['decision'] as String? ?? AiDecision.MANUAL_REVIEW,
      requiresManualReview: json['requiresManualReview'] as bool? ?? false,
      containsHazardousWaste: json['containsHazardousWaste'] as bool? ?? false,
      containsConstructionWaste: json['containsConstructionWaste'] as bool? ?? false,
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
      explanation: json['explanation'] as String? ?? '',
      items: rawItems
          .map((e) => BulkyItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      boundingBoxes: rawBoxes
          .map((e) => BoundingBox.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      aiModelUsed: json['aiModelUsed'] as String? ?? 'Trí tuệ nhân tạo (AI)',
      hazardousReason: json['hazardousReason'] as String?,
    );
  }

  factory AiRecognitionResult.fallbackError({
    String explanation =
        'Hệ thống AI hiện đang quá tải hoặc gián đoạn kết nối. Vui lòng bấm Quét lại hoặc kiểm tra/thêm danh mục đồ vật bên dưới.',
    String aiModelUsed = 'Trí tuệ nhân tạo (AI)',
  }) {
    return AiRecognitionResult(
      decision: AiDecision.MANUAL_REVIEW,
      requiresManualReview: true,
      confidence: 0.0,
      containsHazardousWaste: false,
      containsConstructionWaste: false,
      explanation: explanation,
      items: const [],
      boundingBoxes: const [],
      aiModelUsed: aiModelUsed,
    );
  }
}
