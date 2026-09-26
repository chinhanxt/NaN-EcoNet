import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bulky_mobile/core/theme/bulky_colors.dart';
import 'package:bulky_mobile/core/theme/bulky_theme.dart';

void main() {
  group('BulkyTheme & BulkyColors Design Tokens', () {
    test('provides modern eco-tech color tokens', () {
      expect(BulkyColors.primary, const Color(0xFF059669));
      expect(BulkyColors.background, const Color(0xFFF6FBF8));
      expect(BulkyColors.wasteOrganic, const Color(0xFF16A34A));
      expect(BulkyColors.wasteRecyclable, const Color(0xFF2563EB));
      expect(BulkyColors.wasteBulky, const Color(0xFFEA580C));
      expect(BulkyColors.wasteHazardous, const Color(0xFFDC2626));
      expect(BulkyColors.iotSafeGradient, isA<LinearGradient>());
      expect(BulkyColors.iotWarnGradient, isA<LinearGradient>());
      expect(BulkyColors.iotDangerGradient, isA<LinearGradient>());
      expect(BulkyColors.softShadow, isA<List<BoxShadow>>());
    });

    test('theme uses border radius and elevated surface tokens', () {
      final theme = BulkyTheme.lightTheme;
      expect(theme.scaffoldBackgroundColor, BulkyColors.background);
      expect(theme.cardTheme.elevation, 0);
      expect(theme.cardTheme.shape, isA<RoundedRectangleBorder>());
      final cardShape = theme.cardTheme.shape as RoundedRectangleBorder;
      expect(cardShape.borderRadius, BorderRadius.circular(20.0));
      expect(cardShape.side.color, const Color(0xFFE2E8F0));
      expect(theme.elevatedButtonTheme.style?.minimumSize?.resolve({}), const Size.fromHeight(52));
    });
  });
}
