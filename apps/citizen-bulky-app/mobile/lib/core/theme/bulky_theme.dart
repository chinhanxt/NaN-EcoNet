import 'package:flutter/material.dart';
import 'bulky_colors.dart';

class BulkyTheme {
  BulkyTheme._();

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: BulkyColors.primary,
        primary: BulkyColors.primary,
        secondary: BulkyColors.primaryLight,
        surface: BulkyColors.surface,
        error: BulkyColors.error,
        primaryContainer: BulkyColors.primaryContainer,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: BulkyColors.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: BulkyColors.surface,
        foregroundColor: BulkyColors.textPrimary,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: BulkyColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: BulkyColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: BulkyColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: BulkyColors.surface,
        selectedColor: BulkyColors.primaryContainer,
        side: const BorderSide(color: BulkyColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        labelStyle: const TextStyle(fontSize: 13, color: BulkyColors.textPrimary),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return BulkyColors.primary;
          }
          return Colors.grey.shade400;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return BulkyColors.primaryLight.withValues(alpha: 0.5);
          }
          return Colors.grey.shade200;
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: BulkyColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: BulkyColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: BulkyColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: BulkyColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: BulkyColors.error),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: BulkyColors.border,
        thickness: 1,
        space: 1,
      ),
    );
  }
}
