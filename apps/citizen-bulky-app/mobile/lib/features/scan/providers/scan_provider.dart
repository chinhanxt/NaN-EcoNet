import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../../core/services/ai/ai_recognition_result.dart';
import '../../../core/services/ai/gemini_vision_service.dart';

/// Provider managing AI Vision scanning, camera capture, and bounding box selection.
class ScanProvider extends ChangeNotifier {
  final GeminiVisionService _visionService;

  Uint8List? _imageBytes;
  bool _isScanning = false;
  AiRecognitionResult? _result;
  int? _selectedBoxIndex;
  String? _errorMessage;

  ScanProvider({GeminiVisionService? visionService})
      : _visionService = visionService ?? GeminiVisionService();

  Uint8List? get imageBytes => _imageBytes;
  bool get isScanning => _isScanning;
  AiRecognitionResult? get result => _result;
  int? get selectedBoxIndex => _selectedBoxIndex;
  String? get errorMessage => _errorMessage;

  bool get hasResult => _result != null && _result!.items.isNotEmpty;
  bool get containsHazardousWaste => _result?.containsHazardousWaste ?? false;
  bool get containsConstructionWaste => _result?.containsConstructionWaste ?? false;

  /// Sets captured/picked image bytes without triggering scan.
  void setImage(Uint8List? bytes) {
    _imageBytes = bytes;
    _selectedBoxIndex = null;
    notifyListeners();
  }

  /// Selects a specific bounding box index for highlighting.
  void selectBox(int? index) {
    _selectedBoxIndex = index;
    notifyListeners();
  }

  /// Sets recognition result directly (useful for testing and presets).
  void setScanResult(AiRecognitionResult result, [Uint8List? imageBytes]) {
    _result = result;
    if (imageBytes != null) _imageBytes = imageBytes;
    _isScanning = false;
    _errorMessage = null;
    notifyListeners();
  }

  /// Sends image bytes to Gemini Vision AI for object detection & classification.
  Future<void> scanImage(
    Uint8List bytes, {
    String? filename,
    String? apiKey,
    http.Client? client,
  }) async {
    _imageBytes = bytes;
    _isScanning = true;
    _errorMessage = null;
    _selectedBoxIndex = null;
    notifyListeners();

    try {
      final scanResult = await _visionService.analyzeBulkyImage(
        bytes,
        filename: filename,
        apiKey: apiKey,
        client: client,
      );

      _result = scanResult;

      if (scanResult.decision == AiDecision.MANUAL_REVIEW &&
          scanResult.items.isEmpty) {
        _errorMessage = scanResult.explanation;
      }
    } catch (e) {
      _result = AiRecognitionResult.fallbackError(
        explanation: 'Không thể kết nối dịch vụ AI. Vui lòng thử lại hoặc thêm thủ công.',
      );
      _errorMessage = _result!.explanation;
    } finally {
      _isScanning = false;
      notifyListeners();
    }
  }

  /// Resets scan state back to clean initial state.
  void reset() {
    _imageBytes = null;
    _isScanning = false;
    _result = null;
    _selectedBoxIndex = null;
    _errorMessage = null;
    notifyListeners();
  }
}
