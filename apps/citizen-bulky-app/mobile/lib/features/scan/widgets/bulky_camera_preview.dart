import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../core/domain/models/bounding_box.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../request_wizard/providers/booking_wizard_provider.dart';
import '../providers/scan_provider.dart';
import 'bounding_box_painter.dart';

/// Minimal valid 1x1 PNG bytes for presets and testing
final Uint8List kPresetSamplePngBytes = Uint8List.fromList([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0B, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x00, 0x00, 0x00,
  0x02, 0x00, 0x01, 0xF4, 0x71, 0x64, 0x04, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

/// Interactive camera preview widget with CustomPainter bounding box overlay,
/// visibility toggle, camera/gallery actions, and preset test buttons.
class BulkyCameraPreview extends StatefulWidget {
  final ScanProvider? scanProvider;
  final List<BoundingBox>? customBoxes;
  final Uint8List? customImageBytes;
  final ValueChanged<int?>? onBoxSelected;
  final ValueChanged<Uint8List>? onImageSelected;
  final ImagePicker? imagePicker;
  final double previewHeight;

  const BulkyCameraPreview({
    super.key,
    this.scanProvider,
    this.customBoxes,
    this.customImageBytes,
    this.onBoxSelected,
    this.onImageSelected,
    this.imagePicker,
    this.previewHeight = 280,
  });

  @override
  State<BulkyCameraPreview> createState() => _BulkyCameraPreviewState();
}

class _BulkyCameraPreviewState extends State<BulkyCameraPreview> {
  bool _showOverlay = true;

  ScanProvider? _getProvider(BuildContext context, {bool listen = false}) {
    if (widget.scanProvider != null) return widget.scanProvider;
    try {
      return Provider.of<ScanProvider>(context, listen: listen);
    } catch (_) {
      return null;
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final provider = _getProvider(context);
    try {
      final picker = widget.imagePicker ?? ImagePicker();
      final xFile = await picker.pickImage(source: source);
      if (xFile != null) {
        final bytes = await xFile.readAsBytes();
        if (!mounted) return;
        if (provider != null) {
          await provider.scanImage(bytes);
          if (!mounted) return;
          if (provider.result != null && provider.result!.items.isNotEmpty) {
            try {
              Provider.of<BookingWizardProvider>(context, listen: false)
                  .initFromScan(provider.result!, bytes);
            } catch (_) {}
          }
        }
        widget.onImageSelected?.call(bytes);
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  Future<void> _selectPreset(String filename) async {
    final provider = _getProvider(context);
    if (provider != null) {
      Uint8List bytes = kPresetSamplePngBytes;
      try {
        final data = await rootBundle.load('assets/samples/$filename');
        bytes = data.buffer.asUint8List();
      } catch (_) {}
      await provider.scanImage(bytes, filename: filename);
      if (!mounted) return;
      widget.onImageSelected?.call(bytes);
      if (provider.result != null && provider.result!.items.isNotEmpty) {
        try {
          Provider.of<BookingWizardProvider>(context, listen: false)
              .initFromScan(provider.result!, bytes);
        } catch (_) {}
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = _getProvider(context, listen: true);
    final imageBytes = widget.customImageBytes ?? provider?.imageBytes;
    final boxes = widget.customBoxes ?? provider?.result?.boundingBoxes ?? [];
    final selectedIndex = provider?.selectedBoxIndex;
    final isScanning = provider?.isScanning ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // 1. Preview Container
        Container(
          height: widget.previewHeight,
          decoration: BoxDecoration(
            color: BulkyColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: BulkyColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: imageBytes != null
                ? LayoutBuilder(
                    builder: (context, constraints) {
                      final canvasSize = Size(constraints.maxWidth, constraints.maxHeight);
                      final painter = BoundingBoxPainter(
                        boxes: boxes,
                        selectedIndex: selectedIndex,
                      );

                      return GestureDetector(
                        key: const Key('bulky_preview_gesture'),
                        behavior: HitTestBehavior.opaque,
                        onTapUp: (details) {
                          if (boxes.isEmpty) return;
                          final hitIndex = painter.findBoxAt(details.localPosition, canvasSize);
                          widget.onBoxSelected?.call(hitIndex);
                          provider?.selectBox(hitIndex);
                        },
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.memory(
                              imageBytes,
                              fit: BoxFit.contain,
                              width: constraints.maxWidth,
                              height: constraints.maxHeight,
                            ),
                            if (_showOverlay)
                              CustomPaint(
                                size: canvasSize,
                                painter: painter,
                              ),
                            if (isScanning)
                              Container(
                                color: Colors.black.withValues(alpha: 0.55),
                                child: const Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      CircularProgressIndicator(color: Colors.white),
                                      SizedBox(height: 12),
                                      Text(
                                        'AI đang phân tích ảnh...',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  )
                : _buildEmptyPlaceholder(),
          ),
        ),

        const SizedBox(height: 12),

        // 2. Overlay visibility toggle (if image is present)
        if (imageBytes != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: BulkyColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: BulkyColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      _showOverlay ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                      size: 20,
                      color: _showOverlay ? BulkyColors.primary : BulkyColors.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Bật/Tắt khung AI',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                Switch(
                  value: _showOverlay,
                  onChanged: (val) {
                    setState(() {
                      _showOverlay = val;
                    });
                  },
                  activeThumbColor: BulkyColors.primary,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // 3. Action Buttons: Chụp ảnh & Thư viện
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: isScanning ? null : () => _pickImage(ImageSource.camera),
                icon: const Icon(Icons.camera_alt_outlined, size: 20),
                label: const Text('Chụp ảnh'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: isScanning ? null : () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library_outlined, size: 20),
                label: const Text('Thư viện'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: BulkyColors.textPrimary,
                  side: const BorderSide(color: BulkyColors.border),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 14),

        // 4. Preset Sample Photo Buttons
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ảnh mẫu kiểm thử nhanh:',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: BulkyColors.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildPresetButton(
                    context,
                    label: 'Sofa da',
                    icon: Icons.chair_outlined,
                    filename: 'sofa_da_phong_khach.jpg',
                    isScanning: isScanning,
                  ),
                  const SizedBox(width: 8),
                  _buildPresetButton(
                    context,
                    label: 'Nệm King Size',
                    icon: Icons.bed_outlined,
                    filename: 'nem_lo_xo_1m8.jpg',
                    isScanning: isScanning,
                  ),
                  const SizedBox(width: 8),
                  _buildPresetButton(
                    context,
                    label: 'Tủ gỗ 3 cánh',
                    icon: Icons.door_sliding_outlined,
                    filename: 'tu_go_3_canh.jpg',
                    isScanning: isScanning,
                  ),
                  const SizedBox(width: 8),
                  _buildPresetButton(
                    context,
                    label: 'Gạch ngói / Xà bần',
                    icon: Icons.handyman_outlined,
                    filename: 'gach_ngoi_xa_ban.jpg',
                    isScanning: isScanning,
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildEmptyPlaceholder() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: BulkyColors.primaryLight.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.add_a_photo_outlined,
                size: 36,
                color: BulkyColors.primary,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Chưa có ảnh phế thải',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: BulkyColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Chụp ảnh hoặc chọn từ thư viện/ảnh mẫu để nhận diện tự động',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: BulkyColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPresetButton(
    BuildContext context, {
    required String label,
    required IconData icon,
    required String filename,
    required bool isScanning,
  }) {
    return ActionChip(
      avatar: Icon(icon, size: 16, color: BulkyColors.primary),
      label: Text(label),
      labelStyle: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: BulkyColors.textPrimary,
      ),
      backgroundColor: BulkyColors.background,
      side: const BorderSide(color: BulkyColors.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      onPressed: isScanning ? null : () => _selectPreset(filename),
    );
  }
}
