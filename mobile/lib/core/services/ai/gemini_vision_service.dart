// ignore_for_file: constant_identifier_names, non_constant_identifier_names

import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../../constants/bulky_constants.dart';
import 'ai_recognition_result.dart';

/// Service providing Multimodal Vision AI item recognition via Google Gemini.
/// Implements automatic candidate model fallback (gemini-2.5-flash -> gemini-3.6-flash),
/// resilient JSON extraction, preset mocking, and smart bulky business rules.
class GeminiVisionService {
  static const List<String> candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.6-flash',
  ];

  static const String defaultGeminiApiKey = String.fromEnvironment('GEMINI_API_KEY');

  static const String systemPrompt = '''
Bạn là AI phân tích đồ vật chuyên nghiệp của Hệ thống Quản lý Rác cồng kềnh đô thị thông minh Smartbin (Chính quyền Xã/Phường thông minh).
Nhiệm vụ của bạn là phân tích (các) bức ảnh do người dân chụp và xuất kết quả theo định dạng JSON duy nhất.

CÁC QUY TẮC THẨM ĐỊNH BẮT BUỘC:
1. Phân loại nhóm cước chuẩn xác (itemType) vào đúng một trong các mã:
   - "SOFA": Sofa đơn, sofa băng dài, sofa góc chữ L, trường kỷ
   - "MATTRESS": Đệm lò xo, đệm cao su, đệm mút bông ép
   - "CABINET": Tủ quần áo, tủ chén, kệ sách lớn, tủ giày dép, tủ tài liệu
   - "TABLE": Bàn ăn, bàn tròn, bàn trà, ghế ăn, ghế tựa, ghế cafe, ghế văn phòng
   - "OTHER": Đồ cồng kềnh ngoài các loại trên, gạch ngói, vữa, xà bần, phế thải xây dựng, ván vụn.

2. TÊN ĐỒ VẬT CỤ THỂ (displayName - RẤT QUAN TRỌNG):
   - Tự động đặt tên tiếng Việt rõ ràng, cụ thể cho từng món đồ hoặc phế thải phát hiện được: ví dụ "Đệm lò xo cũ", "Tấm ván gỗ ép", "Phế thải gạch ngói / xà bần", "Bàn trà gỗ sồi", "Ghế sofa da đơn".
   - Không được để tên chung chung là mã tiếng Anh như "TABLE", "SOFA" hay "OTHER".

3. QUY CHUẨN AN TOÀN MÔI TRƯỜNG & RÁC NGUY HẠI CẤM THU GOM:
   - CHỈ coi là rác nguy hại cấm thu gom khi phát hiện: bình gas cháy nổ, bình ắc quy chì, thùng hóa chất độc hại, rác y tế truyền nhiễm nguy cấp.
   - Khi đó:
     -> Đặt "containsHazardousWaste": true
     -> "hazardousReason": ghi rõ lý do và chất nguy hại phát hiện được
     -> "decision": "MANUAL_REVIEW"

4. QUY TẮC PHẾ THẢI XÂY DỰNG, GẠCH NGÓI, XÀ BẦN:
   - Khi phát hiện gạch ngói, vữa, xà bần, ván gỗ vụn, phế thải sửa chữa nhà:
     -> Đặt "itemType": "OTHER"
     -> Đặt "suggestedMaterial": "HEAVY"
     -> Đặt "containsConstructionWaste": true
     -> Đây là dịch vụ thu gom cồng kềnh có biểu cước tự động (không bắt buộc nhân viên duyệt thủ công nếu không có rác nguy hại).

5. TỌA ĐỘ VÙNG NHẬN DIỆN 2D (box_2d):
   - Chuẩn hóa tọa độ [ymin, xmin, ymax, xmax] theo thang 0 - 1000 tương ứng vị trí đồ vật trong ảnh (chuẩn Gemini Vision).
   - Ví dụ: [180, 120, 850, 910].

6. PHÂN LOẠI CHẤT LIỆU ƯỚC ĐOÁN (suggestedMaterial):
   - "LIGHT": Đồ nhẹ, nhựa, mút xốp mỏng, vải nệm mỏng, bàn ghế nhựa/nhôm gấp.
   - "STANDARD": Sofa nỉ/da tiêu chuẩn, đệm lò xo/cao su tiêu chuẩn, bàn ghế gỗ ép MDF, tủ composite.
   - "HEAVY": Gạch ngói, vữa vụn, bê tông xà bần, phế thải xây dựng, gỗ tự nhiên đặc nguyên khối, mặt đá hoa cương, kim loại nặng.

7. QUYẾT ĐỊNH (decision):
   - "SUGGESTED": Nhận diện rõ ràng, tự tin cao (confidence >= 0.7) và không có rác nguy hại cháy nổ/hóa chất độc.
   - "NEEDS_CONFIRMATION": Ảnh hơi mờ, góc chụp khuất (confidence từ 0.5 đến 0.69).
   - "MANUAL_REVIEW": Có rác nguy hại cháy nổ/hóa chất độc, confidence < 0.5 hoặc ảnh không rõ đồ vật.

ĐỊNH DẠNG TRẢ VỀ: Trả về DUY NHẤT một chuỗi JSON hợp lệ với cấu trúc sau:
{
  "decision": "SUGGESTED" | "NEEDS_CONFIRMATION" | "MANUAL_REVIEW",
  "confidence": 0.95,
  "containsHazardousWaste": false,
  "containsConstructionWaste": false,
  "hazardousReason": "",
  "explanation": "Mô tả ngắn gọn bằng tiếng Việt về đồ vật phát hiện được",
  "items": [
    {
      "itemType": "SOFA" | "MATTRESS" | "CABINET" | "TABLE" | "OTHER",
      "displayName": "Tên tiếng Việt cụ thể (VD: Đệm lò xo cũ, Phế thải gạch ngói vỡ)",
      "suggestedQuantity": 1,
      "dimensionsCm": { "length": 200, "width": 90, "height": 85 },
      "disassemblyNeeded": false,
      "box_2d": [180, 120, 850, 910],
      "confidence": 0.95,
      "suggestedMaterial": "LIGHT" | "STANDARD" | "HEAVY"
    }
  ],
  "boundingBoxes": [
    {
      "box_2d": [180, 120, 850, 910],
      "displayName": "Tên tiếng Việt của đồ vật hoặc rác nguy hại",
      "confidence": 0.95,
      "itemType": "SOFA" | "MATTRESS" | "CABINET" | "TABLE" | "OTHER" | "HAZARDOUS",
      "isHazardous": false,
      "suggestedMaterial": "LIGHT" | "STANDARD" | "HEAVY"
    }
  ]
}
''';

  static final Map<String, AiRecognitionResult> PRESET_MAPPINGS = {
    'sofa_da_phong_khach.jpg': AiRecognitionResult(
      decision: AiDecision.SUGGESTED,
      requiresManualReview: false,
      confidence: 0.96,
      explanation:
          'AI nhận diện: Phát hiện 01 bộ sofa da 3 chỗ nguyên khối, tình trạng hoàn chỉnh, không có vật liệu nguy hại.',
      items: [
        BulkyItem(
          id: 'preset-sofa',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa da 3 chỗ phòng khách',
          quantity: 1,
          lengthCm: 210,
          widthCm: 90,
          heightCm: 85,
          material: MaterialType.STANDARD,
          box2d: const BoundingBox(
            ymin: 180,
            xmin: 120,
            ymax: 850,
            xmax: 910,
            displayName: 'Sofa da 3 chỗ phòng khách',
            confidence: 0.96,
            category: BulkyCategory.SOFA,
            material: MaterialType.STANDARD,
          ),
          confidence: 0.96,
          requiresDisassembly: false,
        ),
      ],
      boundingBoxes: const [
        BoundingBox(
          ymin: 180,
          xmin: 120,
          ymax: 850,
          xmax: 910,
          displayName: 'Sofa da 3 chỗ phòng khách',
          confidence: 0.96,
          category: BulkyCategory.SOFA,
          material: MaterialType.STANDARD,
        ),
      ],
      aiModelUsed: 'Trí tuệ nhân tạo (AI)',
    ),
    'nem_lo_xo_1m8.jpg': AiRecognitionResult(
      decision: AiDecision.SUGGESTED,
      requiresManualReview: false,
      confidence: 0.94,
      explanation:
          'AI nhận diện: Phát hiện 01 đệm lò xo cỡ lớn (1m8x2m), không thể gập gọn, cần xe tải có sàn lớn.',
      items: [
        BulkyItem(
          id: 'preset-mattress',
          category: BulkyCategory.MATTRESS,
          displayName: 'Nệm lò xo King Size 1m8 x 2m',
          quantity: 1,
          lengthCm: 200,
          widthCm: 180,
          heightCm: 25,
          material: MaterialType.STANDARD,
          box2d: const BoundingBox(
            ymin: 150,
            xmin: 100,
            ymax: 880,
            xmax: 900,
            displayName: 'Nệm lò xo King Size 1m8 x 2m',
            confidence: 0.94,
            category: BulkyCategory.MATTRESS,
            material: MaterialType.STANDARD,
          ),
          confidence: 0.94,
          requiresDisassembly: false,
        ),
      ],
      boundingBoxes: const [
        BoundingBox(
          ymin: 150,
          xmin: 100,
          ymax: 880,
          xmax: 900,
          displayName: 'Nệm lò xo King Size 1m8 x 2m',
          confidence: 0.94,
          category: BulkyCategory.MATTRESS,
          material: MaterialType.STANDARD,
        ),
      ],
      aiModelUsed: 'Trí tuệ nhân tạo (AI)',
    ),
    'tu_go_3_canh.jpg': AiRecognitionResult(
      decision: AiDecision.SUGGESTED,
      requiresManualReview: false,
      confidence: 0.91,
      explanation:
          'AI nhận diện: Phát hiện 01 tủ gỗ 3 buồng kích thước lớn (cao 2m), khuyến nghị tháo rời trước khi vận chuyển.',
      items: [
        BulkyItem(
          id: 'preset-cabinet',
          category: BulkyCategory.CABINET,
          displayName: 'Tủ quần áo gỗ 3 cánh',
          quantity: 1,
          lengthCm: 160,
          widthCm: 60,
          heightCm: 200,
          material: MaterialType.HEAVY,
          box2d: const BoundingBox(
            ymin: 100,
            xmin: 150,
            ymax: 920,
            xmax: 850,
            displayName: 'Tủ quần áo gỗ 3 cánh',
            confidence: 0.91,
            category: BulkyCategory.CABINET,
            material: MaterialType.HEAVY,
          ),
          confidence: 0.91,
          requiresDisassembly: true,
        ),
      ],
      boundingBoxes: const [
        BoundingBox(
          ymin: 100,
          xmin: 150,
          ymax: 920,
          xmax: 850,
          displayName: 'Tủ quần áo gỗ 3 cánh',
          confidence: 0.91,
          category: BulkyCategory.CABINET,
          material: MaterialType.HEAVY,
        ),
      ],
      aiModelUsed: 'Trí tuệ nhân tạo (AI)',
    ),
    'gach_ngoi_xa_ban.jpg': AiRecognitionResult(
      decision: AiDecision.SUGGESTED,
      requiresManualReview: false,
      containsConstructionWaste: true,
      confidence: 0.95,
      explanation:
          'AI nhận diện: Phát hiện phế thải xây dựng, gạch ngói vỡ và vữa xà bần (~80 kg). Tự động phân loại đồ cồng kềnh nhóm Nặng (HEAVY).',
      items: [
        BulkyItem(
          id: 'preset-debris',
          category: BulkyCategory.OTHER,
          displayName: 'Phế thải gạch ngói / xà bần',
          quantity: 1,
          lengthCm: 120,
          widthCm: 80,
          heightCm: 50,
          material: MaterialType.HEAVY,
          box2d: const BoundingBox(
            ymin: 120,
            xmin: 100,
            ymax: 880,
            xmax: 900,
            displayName: 'Phế thải gạch ngói / xà bần',
            confidence: 0.95,
            category: BulkyCategory.OTHER,
            material: MaterialType.HEAVY,
          ),
          confidence: 0.95,
          requiresDisassembly: false,
        ),
      ],
      boundingBoxes: const [
        BoundingBox(
          ymin: 120,
          xmin: 100,
          ymax: 880,
          xmax: 900,
          displayName: 'Phế thải gạch ngói / xà bần',
          confidence: 0.95,
          category: BulkyCategory.OTHER,
          material: MaterialType.HEAVY,
        ),
      ],
      aiModelUsed: 'Trí tuệ nhân tạo (AI)',
    ),
  };

  final http.Client? client;
  final String? apiKey;

  GeminiVisionService({this.client, this.apiKey});

  /// Instance method wrapper for dependency injection.
  Future<AiRecognitionResult> analyze(
    Uint8List imageBytes, {
    String? mimeType,
    http.Client? client,
    String? apiKey,
    String? filename,
  }) {
    return analyzeImageBytes(
      imageBytes,
      mimeType: mimeType,
      client: client ?? this.client,
      apiKey: apiKey ?? this.apiKey,
      filename: filename,
    );
  }

  /// Alias for analyze.
  Future<AiRecognitionResult> analyzeBulkyImage(
    Uint8List imageBytes, {
    String? mimeType,
    http.Client? client,
    String? apiKey,
    String? filename,
  }) =>
      analyze(
        imageBytes,
        mimeType: mimeType,
        client: client,
        apiKey: apiKey,
        filename: filename,
      );

  /// Primary recognition method taking image bytes.
  static Future<AiRecognitionResult> analyzeImageBytes(
    Uint8List imageBytes, {
    String? mimeType,
    http.Client? client,
    String? apiKey,
    String? filename,
  }) async {
    // 1. Preset check
    if (filename != null && PRESET_MAPPINGS.containsKey(filename)) {
      return PRESET_MAPPINGS[filename]!;
    }

    if (imageBytes.isEmpty) {
      return AiRecognitionResult(
        decision: AiDecision.MANUAL_REVIEW,
        requiresManualReview: true,
        confidence: 0.0,
        explanation: 'Chưa có dữ liệu ảnh để nhận diện. Vui lòng chụp hoặc tải ảnh rõ nét.',
        items: const [],
        boundingBoxes: const [],
        aiModelUsed: 'Trí tuệ nhân tạo (AI)',
      );
    }

    final effectiveClient = client ?? http.Client();
    final effectiveApiKey = (apiKey != null && apiKey.isNotEmpty)
        ? apiKey
        : defaultGeminiApiKey;

    if (client == null && effectiveApiKey.isEmpty) {
      return AiRecognitionResult(
        decision: AiDecision.MANUAL_REVIEW,
        requiresManualReview: true,
        confidence: 0.0,
        explanation:
            'Chưa cấu hình GEMINI_API_KEY. Vui lòng bấm chọn các ảnh mẫu kiểm thử nhanh bên dưới (Sofa da, Nệm, Tủ gỗ, Gạch ngói) hoặc khởi chạy app với --dart-define=GEMINI_API_KEY=...',
        items: const [],
        boundingBoxes: const [],
        aiModelUsed: 'Trí tuệ nhân tạo (AI)',
      );
    }
    final base64Data = base64Encode(imageBytes);
    final effectiveMime = mimeType ?? 'image/jpeg';

    Map<String, dynamic>? parsedJson;
    String? successfulModel;

    // 2. Candidate models fallback loop (gemini-2.5-flash -> gemini-3.6-flash)
    for (final model in candidateModels) {
      try {
        final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$effectiveApiKey',
        );

        final requestPayload = {
          'contents': [
            {
              'role': 'user',
              'parts': [
                {'text': systemPrompt},
                {
                  'inline_data': {
                    'mime_type': effectiveMime,
                    'data': base64Data,
                  }
                }
              ]
            }
          ],
          'generationConfig': {
            'response_mime_type': 'application/json',
            'temperature': 0.1,
          }
        };

        final response = await effectiveClient.post(
          url,
          headers: {'content-type': 'application/json'},
          body: jsonEncode(requestPayload),
        );

        if (response.statusCode == 200) {
          final bodyJson = jsonDecode(response.body) as Map<String, dynamic>;
          final candidates = bodyJson['candidates'] as List<dynamic>?;
          if (candidates != null && candidates.isNotEmpty) {
            final content = candidates[0]['content'] as Map<String, dynamic>?;
            final parts = content?['parts'] as List<dynamic>?;
            if (parts != null && parts.isNotEmpty) {
              final rawText = parts[0]['text'] as String?;
              if (rawText != null && rawText.isNotEmpty) {
                parsedJson = _parseResilientJson(rawText);
                successfulModel = model;
                break;
              }
            }
          }
        } else if (response.statusCode == 503 ||
            response.statusCode == 429 ||
            response.statusCode >= 500) {
          // Retryable status code -> try next candidate model
          continue;
        } else {
          continue;
        }
      } catch (_) {
        continue;
      }
    }

    if (client == null) {
      // Close client if created locally
      effectiveClient.close();
    }

    if (parsedJson == null) {
      return AiRecognitionResult.fallbackError(
        explanation:
            'Hệ thống AI hiện đang quá tải hoặc gián đoạn kết nối. Vui lòng bấm Quét lại hoặc kiểm tra/thêm danh mục đồ vật bên dưới.',
        aiModelUsed: successfulModel ?? 'Trí tuệ nhân tạo (AI)',
      );
    }

    return _buildRecognitionResult(parsedJson, successfulModel ?? 'Trí tuệ nhân tạo (AI)');
  }

  /// Resilient JSON extractor supporting markdown code fences and extraneous text.
  static Map<String, dynamic> _parseResilientJson(String text) {
    final cleanText = text.trim();

    // Check markdown code blocks ```json ... ``` or ``` ... ```
    final fencedMatch = RegExp(r'```(?:json)?\s*([\s\S]*?)\s*```', multiLine: true).firstMatch(cleanText);
    if (fencedMatch != null && fencedMatch.group(1) != null) {
      return jsonDecode(fencedMatch.group(1)!.trim()) as Map<String, dynamic>;
    }

    // Try finding the outermost JSON brackets
    final firstBrace = cleanText.indexOf('{');
    final lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace) {
      final jsonSub = cleanText.substring(firstBrace, lastBrace + 1);
      return jsonDecode(jsonSub) as Map<String, dynamic>;
    }

    return jsonDecode(cleanText) as Map<String, dynamic>;
  }

  /// Transforms raw parsed JSON into structured domain objects enforcing business and safety rules.
  static AiRecognitionResult _buildRecognitionResult(
    Map<String, dynamic> parsed,
    String modelUsed,
  ) {
    final rawItems = parsed['items'] as List<dynamic>? ?? [];
    final rawBoundingBoxes = parsed['boundingBoxes'] as List<dynamic>? ?? [];

    bool hasHazardousWaste = parsed['containsHazardousWaste'] == true;
    bool hasConstructionWaste = parsed['containsConstructionWaste'] == true;
    String? hazardousReason = parsed['hazardousReason'] as String?;

    final items = <BulkyItem>[];
    final boundingBoxes = <BoundingBox>[];

    // Helper to check construction debris
    bool isConstructionText(String text) {
      final lower = text.toLowerCase();
      return lower.contains('gạch') ||
          lower.contains('ngói') ||
          lower.contains('xà bần') ||
          lower.contains('xa ban') ||
          lower.contains('vữa') ||
          lower.contains('vua') ||
          lower.contains('bê tông') ||
          lower.contains('be tong') ||
          lower.contains('ván gỗ vụn') ||
          lower.contains('van go vun') ||
          lower.contains('xây dựng');
    }

    // Helper to check hazardous text
    bool isHazardousText(String text) {
      final lower = text.toLowerCase();
      return lower.contains('gas') ||
          lower.contains('bình gas') ||
          lower.contains('hóa chất') ||
          lower.contains('hoa chat') ||
          lower.contains('chất độc') ||
          lower.contains('chat doc') ||
          lower.contains('ắc quy') ||
          lower.contains('ac quy') ||
          lower.contains('y tế') ||
          lower.contains('y te') ||
          lower.contains('cháy nổ') ||
          lower.contains('độc hại');
    }

    for (var i = 0; i < rawItems.length; i++) {
      final it = Map<String, dynamic>.from(rawItems[i] as Map);
      final rawName = it['displayName'] as String? ?? 'Vật dụng cồng kềnh';
      final rawType = (it['itemType'] as String? ?? 'OTHER').toUpperCase().trim();

      BulkyCategory category = _mapCategory(rawType);
      MaterialType material = _mapMaterial(it['suggestedMaterial'] as String?);

      // Business Rule: Gạch ngói, vữa, xà bần, ván gỗ vụn -> BulkyCategory.OTHER + MaterialType.HEAVY
      if (isConstructionText(rawName) || hasConstructionWaste) {
        category = BulkyCategory.OTHER;
        material = MaterialType.HEAVY;
        hasConstructionWaste = true;
      }

      // Safety Rule: Detect hazardous items
      final isItemHazardous = isHazardousText(rawName) || rawType == 'HAZARDOUS';
      if (isItemHazardous) {
        hasHazardousWaste = true;
        hazardousReason ??= rawName;
      }

      final boxCoords = _extractNormalizedBox(it['box_2d']);
      final confidence = (it['confidence'] as num?)?.toDouble() ??
          (parsed['confidence'] as num?)?.toDouble() ??
          0.9;

      BoundingBox? box;
      if (boxCoords != null) {
        box = BoundingBox(
          ymin: boxCoords[0],
          xmin: boxCoords[1],
          ymax: boxCoords[2],
          xmax: boxCoords[3],
          displayName: rawName,
          confidence: confidence,
          category: category,
          isHazardous: isItemHazardous,
          material: material,
        );
      }

      final dimensions = it['dimensionsCm'] as Map<String, dynamic>?;
      final quantity = (it['quantity'] as num?)?.toInt() ??
          (it['suggestedQuantity'] as num?)?.toInt() ??
          1;

      final item = BulkyItem(
        id: it['id'] as String? ?? 'item-${i + 1}',
        category: category,
        displayName: rawName,
        quantity: quantity,
        lengthCm: (it['lengthCm'] as num?)?.toInt() ??
            (dimensions?['length'] as num?)?.toInt(),
        widthCm: (it['widthCm'] as num?)?.toInt() ??
            (dimensions?['width'] as num?)?.toInt(),
        heightCm: (it['heightCm'] as num?)?.toInt() ??
            (dimensions?['height'] as num?)?.toInt(),
        material: material,
        box2d: box,
        confidence: confidence,
        requiresDisassembly: (it['requiresDisassembly'] as bool?) ??
            (it['disassemblyNeeded'] as bool?) ??
            false,
      );

      items.add(item);
      if (box != null) {
        boundingBoxes.add(box);
      }
    }

    // Process explicit boundingBoxes array if provided
    for (final rawBox in rawBoundingBoxes) {
      final b = Map<String, dynamic>.from(rawBox as Map);
      final boxCoords = _extractNormalizedBox(b['box_2d']);
      if (boxCoords == null) continue;

      final name = b['displayName'] as String? ?? 'Vật dụng';
      final isBoxHazardous = (b['isHazardous'] as bool?) ?? isHazardousText(name);
      if (isBoxHazardous) {
        hasHazardousWaste = true;
        hazardousReason ??= name;
      }

      BulkyCategory cat = _mapCategory((b['itemType'] as String? ?? 'OTHER').toUpperCase());
      MaterialType mat = _mapMaterial(b['suggestedMaterial'] as String?);

      if (isConstructionText(name) || hasConstructionWaste) {
        cat = BulkyCategory.OTHER;
        mat = MaterialType.HEAVY;
      }

      // Check if already added
      final exists = boundingBoxes.any((existing) =>
          existing.ymin == boxCoords[0] &&
          existing.xmin == boxCoords[1] &&
          existing.ymax == boxCoords[2] &&
          existing.xmax == boxCoords[3]);

      if (!exists) {
        boundingBoxes.add(BoundingBox(
          ymin: boxCoords[0],
          xmin: boxCoords[1],
          ymax: boxCoords[2],
          xmax: boxCoords[3],
          displayName: name,
          confidence: (b['confidence'] as num?)?.toDouble() ?? 0.9,
          category: cat,
          isHazardous: isBoxHazardous,
          material: mat,
        ));
      }
    }

    // Determine final decision and manual review requirement
    final totalConfidence = (parsed['confidence'] as num?)?.toDouble() ??
        (items.isNotEmpty ? items.first.confidence : 0.9);

    String decision;
    bool requiresManualReview;

    if (hasHazardousWaste) {
      decision = AiDecision.MANUAL_REVIEW;
      requiresManualReview = true;
    } else if (items.isEmpty || totalConfidence < 0.5) {
      decision = AiDecision.MANUAL_REVIEW;
      requiresManualReview = true;
    } else if (hasConstructionWaste) {
      // Crucial Business Rule: Gạch ngói, vữa, xà bần do NOT require manual review
      // and get automatically categorized into OTHER + HEAVY
      decision = totalConfidence >= 0.7 ? AiDecision.SUGGESTED : AiDecision.NEEDS_CONFIRMATION;
      requiresManualReview = false;
    } else if (totalConfidence < 0.7) {
      decision = AiDecision.NEEDS_CONFIRMATION;
      requiresManualReview = false;
    } else {
      decision = parsed['decision'] as String? ?? AiDecision.SUGGESTED;
      requiresManualReview = decision == AiDecision.MANUAL_REVIEW;
    }

    return AiRecognitionResult(
      decision: decision,
      requiresManualReview: requiresManualReview,
      containsHazardousWaste: hasHazardousWaste,
      containsConstructionWaste: hasConstructionWaste,
      confidence: totalConfidence,
      explanation: parsed['explanation'] as String? ?? 'Hoàn tất nhận diện vật dụng cồng kềnh.',
      items: items,
      boundingBoxes: boundingBoxes,
      aiModelUsed: modelUsed,
      hazardousReason: hazardousReason,
    );
  }

  static BulkyCategory _mapCategory(String rawType) {
    if (rawType.contains('MATTRESS') ||
        rawType.contains('DEM') ||
        rawType.contains('NEM') ||
        rawType.contains('BED')) {
      return BulkyCategory.MATTRESS;
    }
    if (rawType.contains('SOFA') || rawType.contains('COUCH')) {
      return BulkyCategory.SOFA;
    }
    if (rawType.contains('TABLE') ||
        rawType.contains('DESK') ||
        rawType.contains('BAN') ||
        rawType.contains('GHE') ||
        rawType.contains('CHAIR')) {
      return BulkyCategory.TABLE;
    }
    if (rawType.contains('CABINET') ||
        rawType.contains('WARDROBE') ||
        rawType.contains('TU') ||
        rawType.contains('SHELF') ||
        rawType.contains('KE')) {
      return BulkyCategory.CABINET;
    }
    return BulkyCategory.OTHER;
  }

  static MaterialType _mapMaterial(String? rawMaterial) {
    final mat = (rawMaterial ?? '').toUpperCase().trim();
    if (mat == 'LIGHT') return MaterialType.LIGHT;
    if (mat == 'HEAVY') return MaterialType.HEAVY;
    return MaterialType.STANDARD;
  }

  static List<int>? _extractNormalizedBox(dynamic rawBox) {
    if (rawBox is List && rawBox.length >= 4) {
      return [
        _clampCoord(rawBox[0]),
        _clampCoord(rawBox[1]),
        _clampCoord(rawBox[2]),
        _clampCoord(rawBox[3]),
      ];
    }
    return null;
  }

  static int _clampCoord(dynamic val) {
    if (val is num) {
      return val.toInt().clamp(0, 1000);
    }
    return 0;
  }
}
