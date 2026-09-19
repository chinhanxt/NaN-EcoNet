import 'dart:typed_data';
import 'package:flutter/material.dart' hide MaterialType;
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bounding_box.dart';
import 'package:bulky_mobile/core/services/ai/ai_recognition_result.dart';
import 'package:bulky_mobile/core/theme/bulky_colors.dart';
import 'package:bulky_mobile/core/theme/bulky_theme.dart';
import 'package:bulky_mobile/features/scan/providers/scan_provider.dart';
import 'package:bulky_mobile/features/scan/widgets/bounding_box_painter.dart';
import 'package:bulky_mobile/features/scan/widgets/bounding_box_badge.dart';
import 'package:bulky_mobile/features/scan/widgets/bulky_camera_preview.dart';

/// Minimal valid 1x1 PNG for testing Image.memory without decoding errors
final Uint8List kTestPngBytes = Uint8List.fromList([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0B, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x00, 0x00, 0x00,
  0x02, 0x00, 0x01, 0xF4, 0x71, 0x64, 0x04, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('BoundingBoxPainter Coordinate Scaling', () {
    test('1. scales normalized coordinates 0..1000 to arbitrary Canvas Size(300, 200)', () {
      const box = BoundingBox(
        ymin: 100,
        xmin: 50,
        ymax: 500,
        xmax: 250,
        displayName: 'Sofa da 3 chỗ',
        category: BulkyCategory.SOFA,
      );

      const canvasSize = Size(300, 200);
      final rect = BoundingBoxPainter.getBoxRect(box, canvasSize);

      // xmin: 50/1000 * 300 = 15.0
      // ymin: 100/1000 * 200 = 20.0
      // xmax: 250/1000 * 300 = 75.0
      // ymax: 500/1000 * 200 = 100.0
      expect(rect.left, closeTo(15.0, 0.001));
      expect(rect.top, closeTo(20.0, 0.001));
      expect(rect.right, closeTo(75.0, 0.001));
      expect(rect.bottom, closeTo(100.0, 0.001));
      expect(rect.width, closeTo(60.0, 0.001));
      expect(rect.height, closeTo(80.0, 0.001));
    });

    test('2. maps category colors correctly matching BulkyColors', () {
      expect(
        BoundingBoxPainter.getColorForBox(const BoundingBox(
          ymin: 0, xmin: 0, ymax: 100, xmax: 100,
          displayName: 'Sofa', category: BulkyCategory.SOFA,
        )),
        BulkyColors.boxSofa,
      );

      expect(
        BoundingBoxPainter.getColorForBox(const BoundingBox(
          ymin: 0, xmin: 0, ymax: 100, xmax: 100,
          displayName: 'Nệm', category: BulkyCategory.MATTRESS,
        )),
        BulkyColors.boxMattress,
      );

      expect(
        BoundingBoxPainter.getColorForBox(const BoundingBox(
          ymin: 0, xmin: 0, ymax: 100, xmax: 100,
          displayName: 'Tủ', category: BulkyCategory.CABINET,
        )),
        BulkyColors.boxCabinet,
      );

      expect(
        BoundingBoxPainter.getColorForBox(const BoundingBox(
          ymin: 0, xmin: 0, ymax: 100, xmax: 100,
          displayName: 'Bàn', category: BulkyCategory.TABLE,
        )),
        BulkyColors.boxTable,
      );

      expect(
        BoundingBoxPainter.getColorForBox(const BoundingBox(
          ymin: 0, xmin: 0, ymax: 100, xmax: 100,
          displayName: 'Khác', category: BulkyCategory.OTHER,
        )),
        BulkyColors.boxOther,
      );

      expect(
        BoundingBoxPainter.getColorForBox(const BoundingBox(
          ymin: 0, xmin: 0, ymax: 100, xmax: 100,
          displayName: 'Ắc quy chì độc hại', category: BulkyCategory.OTHER, isHazardous: true,
        )),
        BulkyColors.boxHazardous,
      );
    });
  });

  group('BoundingBoxPainter Hit-Testing (findBoxAt)', () {
    const box1 = BoundingBox(
      ymin: 100,
      xmin: 100,
      ymax: 400,
      xmax: 400,
      displayName: 'Sofa da',
      category: BulkyCategory.SOFA,
    );

    const box2 = BoundingBox(
      ymin: 500,
      xmin: 500,
      ymax: 900,
      xmax: 900,
      displayName: 'Tủ gỗ',
      category: BulkyCategory.CABINET,
    );

    const canvasSize = Size(1000, 1000);
    final painter = BoundingBoxPainter(boxes: const [box1, box2]);

    test('1. returns correct box index when tapped inside box bounds', () {
      expect(painter.findBoxAt(const Offset(200, 250), canvasSize), 0);
      expect(painter.findBoxAt(const Offset(700, 750), canvasSize), 1);
    });

    test('2. returns null when tapped outside all boxes', () {
      expect(painter.findBoxAt(const Offset(50, 50), canvasSize), isNull);
      expect(painter.findBoxAt(const Offset(450, 450), canvasSize), isNull);
      expect(painter.findBoxAt(const Offset(950, 950), canvasSize), isNull);
    });

    test('3. selects topmost box when boxes overlap', () {
      const overlapBoxA = BoundingBox(
        ymin: 100, xmin: 100, ymax: 600, xmax: 600,
        displayName: 'Box A',
      );
      const overlapBoxB = BoundingBox(
        ymin: 300, xmin: 300, ymax: 800, xmax: 800,
        displayName: 'Box B',
      );

      final overlapPainter = BoundingBoxPainter(boxes: const [overlapBoxA, overlapBoxB]);
      // (400, 400) is in both Box A and Box B, topmost is Box B (index 1)
      expect(overlapPainter.findBoxAt(const Offset(400, 400), canvasSize), 1);
      // (150, 150) is only in Box A (index 0)
      expect(overlapPainter.findBoxAt(const Offset(150, 150), canvasSize), 0);
    });

    test('4. shouldRepaint returns true when state changes and false when identical', () {
      final p1 = BoundingBoxPainter(boxes: const [box1], selectedIndex: 0);
      final p2 = BoundingBoxPainter(boxes: const [box1], selectedIndex: null);
      final p3 = BoundingBoxPainter(boxes: const [box1, box2], selectedIndex: 0);
      final p4 = BoundingBoxPainter(boxes: const [box1], selectedIndex: 0);

      expect(p1.shouldRepaint(p2), isTrue);
      expect(p1.shouldRepaint(p3), isTrue);
      expect(p1.shouldRepaint(p4), isFalse);
    });
  });

  group('BoundingBoxBadge Widget', () {
    testWidgets('renders category emoji, displayName, and confidence %', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: const Scaffold(
            body: Center(
              child: BoundingBoxBadge(
                category: BulkyCategory.SOFA,
                displayName: 'Sofa da 3 chỗ',
                confidence: 0.96,
                isSelected: false,
              ),
            ),
          ),
        ),
      );

      expect(find.text('Sofa da 3 chỗ'), findsOneWidget);
      expect(find.text('96%'), findsOneWidget);
      expect(find.text('🛋️'), findsOneWidget);
    });

    testWidgets('triggers onTap callback when tapped', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: Center(
              child: BoundingBoxBadge(
                category: BulkyCategory.CABINET,
                displayName: 'Tủ gỗ',
                confidence: 0.88,
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Tủ gỗ'));
      expect(tapped, isTrue);
    });
  });

  group('BulkyCameraPreview Widget', () {
    late ScanProvider scanProvider;

    setUp(() {
      scanProvider = ScanProvider();
    });

    testWidgets('1. renders empty state placeholder and action buttons when no image', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: ChangeNotifierProvider<ScanProvider>.value(
              value: scanProvider,
              child: const BulkyCameraPreview(),
            ),
          ),
        ),
      );

      expect(find.text('Chưa có ảnh phế thải'), findsOneWidget);
      expect(find.text('Chụp ảnh'), findsOneWidget);
      expect(find.text('Thư viện'), findsOneWidget);
      expect(find.text('Sofa da'), findsOneWidget);
      expect(find.text('Nệm King Size'), findsOneWidget);
      expect(find.text('Tủ gỗ 3 cánh'), findsOneWidget);
    });

    testWidgets('2. renders image and CustomPaint bounding box overlay when image loaded', (tester) async {
      final boxes = [
        const BoundingBox(
          ymin: 150,
          xmin: 100,
          ymax: 850,
          xmax: 900,
          displayName: 'Sofa da 3 chỗ phòng khách',
          confidence: 0.96,
          category: BulkyCategory.SOFA,
        ),
      ];

      scanProvider.setImage(kTestPngBytes);

      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: ChangeNotifierProvider<ScanProvider>.value(
              value: scanProvider,
              child: BulkyCameraPreview(
                customBoxes: boxes,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(CustomPaint), findsWidgets);
      expect(find.text('Bật/Tắt khung AI'), findsOneWidget);
    });

    testWidgets('3. toggling switch hides and shows bounding box overlay', (tester) async {
      final boxes = [
        const BoundingBox(
          ymin: 100,
          xmin: 100,
          ymax: 800,
          xmax: 800,
          displayName: 'Nệm',
          category: BulkyCategory.MATTRESS,
        ),
      ];

      scanProvider.setImage(kTestPngBytes);

      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: ChangeNotifierProvider<ScanProvider>.value(
              value: scanProvider,
              child: BulkyCameraPreview(
                customBoxes: boxes,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find switch
      final switchFinder = find.byType(Switch);
      expect(switchFinder, findsOneWidget);
      final switchWidgetBefore = tester.widget<Switch>(switchFinder);
      expect(switchWidgetBefore.value, isTrue);

      // Tap switch to toggle off
      await tester.tap(switchFinder);
      await tester.pumpAndSettle();

      final switchWidgetAfter = tester.widget<Switch>(switchFinder);
      expect(switchWidgetAfter.value, isFalse);
    });

    testWidgets('4. tapping on bounding box calls onBoxSelected and selects box in provider', (tester) async {
      int? selectedIndex;
      const box = BoundingBox(
        ymin: 100,
        xmin: 100,
        ymax: 800,
        xmax: 800,
        displayName: 'Sofa da',
        category: BulkyCategory.SOFA,
      );

      scanProvider.setImage(kTestPngBytes);

      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: ChangeNotifierProvider<ScanProvider>.value(
              value: scanProvider,
              child: BulkyCameraPreview(
                customBoxes: const [box],
                onBoxSelected: (idx) {
                  selectedIndex = idx;
                },
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find the preview area with GestureDetector and tap in the middle of box
      // Tap on the image preview
      final gestureFinder = find.byKey(const Key('bulky_preview_gesture'));
      expect(gestureFinder, findsOneWidget);

      await tester.tap(gestureFinder);
      await tester.pumpAndSettle();

      expect(selectedIndex, 0);
      expect(scanProvider.selectedBoxIndex, 0);
    });

    testWidgets('5. tapping preset button ("Sofa da") loads sample image and runs AI scan', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: ChangeNotifierProvider<ScanProvider>.value(
              value: scanProvider,
              child: const BulkyCameraPreview(),
            ),
          ),
        ),
      );

      expect(scanProvider.hasResult, isFalse);

      // Tap preset button "Sofa da"
      await tester.tap(find.text('Sofa da'));
      await tester.pump(); // start scanning
      await tester.pumpAndSettle(); // finish async scan

      expect(scanProvider.hasResult, isTrue);
      expect(scanProvider.result!.items.first.category, BulkyCategory.SOFA);
      expect(scanProvider.result!.boundingBoxes.isNotEmpty, isTrue);
      expect(scanProvider.imageBytes, isNotNull);
    });

    testWidgets('6. tapping preset button ("Nệm King Size") loads mattress preset', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: ChangeNotifierProvider<ScanProvider>.value(
              value: scanProvider,
              child: const BulkyCameraPreview(),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Nệm King Size'));
      await tester.pump();
      await tester.pumpAndSettle();

      expect(scanProvider.hasResult, isTrue);
      expect(scanProvider.result!.items.first.category, BulkyCategory.MATTRESS);
      expect(scanProvider.result!.boundingBoxes.isNotEmpty, isTrue);
    });

    testWidgets('7. tapping preset button ("Tủ gỗ 3 cánh") loads cabinet preset', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: BulkyTheme.lightTheme,
          home: Scaffold(
            body: ChangeNotifierProvider<ScanProvider>.value(
              value: scanProvider,
              child: const BulkyCameraPreview(),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Tủ gỗ 3 cánh'));
      await tester.pump();
      await tester.pumpAndSettle();

      expect(scanProvider.hasResult, isTrue);
      expect(scanProvider.result!.items.first.category, BulkyCategory.CABINET);
      expect(scanProvider.result!.boundingBoxes.isNotEmpty, isTrue);
    });
  });
}
