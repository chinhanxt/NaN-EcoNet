import 'package:flutter/material.dart';
import '../../../core/domain/models/bounding_box.dart';
import 'bounding_box_badge.dart';

/// CustomPainter rendering normalized 2D bounding boxes and category badges on a canvas.
class BoundingBoxPainter extends CustomPainter {
  final List<BoundingBox> boxes;
  final int? selectedIndex;
  final bool showBadges;
  final double strokeWidth;
  final double selectedStrokeWidth;
  final double fillOpacity;
  final double selectedFillOpacity;
  final double cornerRadius;

  BoundingBoxPainter({
    required this.boxes,
    this.selectedIndex,
    this.showBadges = true,
    this.strokeWidth = 2.5,
    this.selectedStrokeWidth = 4.0,
    this.fillOpacity = 0.12,
    this.selectedFillOpacity = 0.28,
    this.cornerRadius = 8.0,
  });

  /// Scales normalized 0..1000 coordinates to absolute Canvas pixel Rect.
  static Rect getBoxRect(BoundingBox box, Size canvasSize) {
    final left = box.leftNormalized * canvasSize.width;
    final top = box.topNormalized * canvasSize.height;
    final right = box.rightNormalized * canvasSize.width;
    final bottom = box.bottomNormalized * canvasSize.height;
    return Rect.fromLTRB(left, top, right, bottom);
  }

  /// Maps box category to BulkyTheme color, with hazardous override.
  static Color getColorForBox(BoundingBox box) {
    return BoundingBoxBadge.getColor(box.category, isHazardous: box.isHazardous);
  }

  /// Hit-testing: returns index of tapped bounding box, prioritizing topmost box.
  int? findBoxAt(Offset localPosition, Size canvasSize) {
    for (int i = boxes.length - 1; i >= 0; i--) {
      final rect = getBoxRect(boxes[i], canvasSize);
      if (rect.contains(localPosition)) {
        return i;
      }
    }
    return null;
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0 || boxes.isEmpty) return;

    for (int i = 0; i < boxes.length; i++) {
      final box = boxes[i];
      final rect = getBoxRect(box, size);
      final isSelected = selectedIndex == i;
      final color = getColorForBox(box);

      // 1. Draw semi-transparent fill
      final fillPaint = Paint()
        ..color = color.withValues(
          alpha: isSelected
              ? selectedFillOpacity
              : (box.isHazardous ? 0.20 : fillOpacity),
        )
        ..style = PaintingStyle.fill;

      final rrect = RRect.fromRectAndRadius(rect, Radius.circular(cornerRadius));
      canvas.drawRRect(rrect, fillPaint);

      // 2. Draw border stroke
      final borderPaint = Paint()
        ..color = color
        ..strokeWidth = isSelected ? selectedStrokeWidth : strokeWidth
        ..style = PaintingStyle.stroke;

      canvas.drawRRect(rrect, borderPaint);

      // 3. Draw badge tag with Vietnamese displayName + confidence %
      if (showBadges) {
        final confidencePercent = (box.confidence * 100).round();
        final badgeLabel = '${box.displayName} $confidencePercent%';

        final textPainter = TextPainter(
          text: TextSpan(
            text: badgeLabel,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
          ),
          textDirection: TextDirection.ltr,
          maxLines: 1,
        );
        textPainter.layout();

        final badgeWidth = textPainter.width + 12;
        final badgeHeight = textPainter.height + 6;

        // Position badge above box if space permits, otherwise inside top-left
        double badgeLeft = rect.left;
        double badgeTop = (rect.top > badgeHeight + 4)
            ? rect.top - badgeHeight - 2
            : rect.top + 2;

        // Clamp to canvas bounds
        if (badgeLeft + badgeWidth > size.width) {
          badgeLeft = (size.width - badgeWidth - 4).clamp(0.0, size.width);
        }
        if (badgeLeft < 0) badgeLeft = 4;
        if (badgeTop < 0) badgeTop = 4;

        final badgeBgRect = Rect.fromLTWH(badgeLeft, badgeTop, badgeWidth, badgeHeight);
        final badgeBgPaint = Paint()
          ..color = color
          ..style = PaintingStyle.fill;

        canvas.drawRRect(
          RRect.fromRectAndRadius(badgeBgRect, const Radius.circular(4)),
          badgeBgPaint,
        );

        textPainter.paint(
          canvas,
          Offset(badgeLeft + 6, badgeTop + 3),
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant BoundingBoxPainter oldDelegate) {
    if (oldDelegate.boxes.length != boxes.length) return true;
    if (oldDelegate.selectedIndex != selectedIndex) return true;
    if (oldDelegate.showBadges != showBadges) return true;
    if (oldDelegate.strokeWidth != strokeWidth) return true;
    if (oldDelegate.selectedStrokeWidth != selectedStrokeWidth) return true;
    if (oldDelegate.fillOpacity != fillOpacity) return true;
    if (oldDelegate.selectedFillOpacity != selectedFillOpacity) return true;
    if (oldDelegate.cornerRadius != cornerRadius) return true;

    for (int i = 0; i < boxes.length; i++) {
      if (oldDelegate.boxes[i] != boxes[i]) return true;
    }

    return false;
  }
}
