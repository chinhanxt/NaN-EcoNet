import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/services/ai/ai_recognition_result.dart';
import 'package:bulky_mobile/core/services/ai/gemini_vision_service.dart';

typedef RequestHandler = Future<http.Response> Function(http.BaseRequest request);

class TestMockClient extends http.BaseClient {
  final RequestHandler handler;
  final List<http.BaseRequest> requests = [];

  TestMockClient(this.handler);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    final response = await handler(request);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      reasonPhrase: response.reasonPhrase,
    );
  }
}

void main() {
  final dummyBytes = Uint8List.fromList([1, 2, 3, 4]);

  group('GeminiVisionService', () {
    test('1. Successful response parsing with box_2d and suggestedMaterial', () async {
      final geminiResponsePayload = {
        'candidates': [
          {
            'content': {
              'parts': [
                {
                  'text': jsonEncode({
                    'decision': 'SUGGESTED',
                    'confidence': 0.96,
                    'containsHazardousWaste': false,
                    'containsConstructionWaste': false,
                    'explanation': 'Phát hiện 01 bộ sofa da 3 chỗ phòng khách nguyên khối',
                    'items': [
                      {
                        'itemType': 'SOFA',
                        'displayName': 'Sofa da 3 chỗ phòng khách',
                        'suggestedQuantity': 1,
                        'dimensionsCm': {'length': 210, 'width': 90, 'height': 85},
                        'disassemblyNeeded': false,
                        'box_2d': [180, 120, 850, 910],
                        'confidence': 0.96,
                        'suggestedMaterial': 'STANDARD',
                      }
                    ],
                    'boundingBoxes': [
                      {
                        'box_2d': [180, 120, 850, 910],
                        'displayName': 'Sofa da 3 chỗ phòng khách',
                        'confidence': 0.96,
                        'itemType': 'SOFA',
                        'isHazardous': false,
                        'suggestedMaterial': 'STANDARD',
                      }
                    ],
                  }),
                }
              ]
            }
          }
        ]
      };

      final client = TestMockClient((request) async {
        return http.Response(
          jsonEncode(geminiResponsePayload),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final result = await GeminiVisionService.analyzeImageBytes(
        dummyBytes,
        client: client,
        apiKey: 'test-api-key',
      );

      expect(result.decision, equals('SUGGESTED'));
      expect(result.requiresManualReview, isFalse);
      expect(result.confidence, equals(0.96));
      expect(result.items.length, equals(1));

      final item = result.items.first;
      expect(item.category, equals(BulkyCategory.SOFA));
      expect(item.displayName, equals('Sofa da 3 chỗ phòng khách'));
      expect(item.material, equals(MaterialType.STANDARD));
      expect(item.box2d, isNotNull);
      expect(item.box2d!.box2d, equals([180, 120, 850, 910]));

      expect(result.boundingBoxes.length, equals(1));
      final box = result.boundingBoxes.first;
      expect(box.topNormalized, equals(0.18));
      expect(box.leftNormalized, equals(0.12));
      expect(box.bottomNormalized, equals(0.85));
      expect(box.rightNormalized, equals(0.91));
      expect(box.material, equals(MaterialType.STANDARD));
      expect(box.isHazardous, isFalse);
    });

    test('2. Gạch ngói/xà bần mapped to BulkyCategory.OTHER, MaterialType.HEAVY, and requiresManualReview: false', () async {
      final geminiResponsePayload = {
        'candidates': [
          {
            'content': {
              'parts': [
                {
                  'text': jsonEncode({
                    'decision': 'SUGGESTED',
                    'confidence': 0.92,
                    'containsHazardousWaste': false,
                    'containsConstructionWaste': true,
                    'explanation': 'Phát hiện đống phế thải gạch ngói và xà bần xây dựng',
                    'items': [
                      {
                        'itemType': 'OTHER',
                        'displayName': 'Phế thải gạch ngói vỡ và xà bần',
                        'suggestedQuantity': 1,
                        'box_2d': [200, 150, 800, 850],
                        'confidence': 0.92,
                        'suggestedMaterial': 'HEAVY',
                      }
                    ],
                    'boundingBoxes': [
                      {
                        'box_2d': [200, 150, 800, 850],
                        'displayName': 'Phế thải gạch ngói vỡ và xà bần',
                        'confidence': 0.92,
                        'itemType': 'OTHER',
                        'isHazardous': false,
                        'suggestedMaterial': 'HEAVY',
                      }
                    ],
                  }),
                }
              ]
            }
          }
        ]
      };

      final client = TestMockClient((request) async {
        return http.Response(
          jsonEncode(geminiResponsePayload),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final result = await GeminiVisionService.analyzeImageBytes(
        dummyBytes,
        client: client,
        apiKey: 'test-api-key',
      );

      // Business rule: gạch ngói/xà bần categorized as OTHER + HEAVY, and does NOT require manual review
      expect(result.decision, equals('SUGGESTED'));
      expect(result.requiresManualReview, isFalse);
      expect(result.containsConstructionWaste, isTrue);
      expect(result.containsHazardousWaste, isFalse);
      expect(result.items.first.category, equals(BulkyCategory.OTHER));
      expect(result.items.first.material, equals(MaterialType.HEAVY));
    });

    test('3. Fallback from gemini-2.5-flash to gemini-3.6-flash on HTTP 503 response', () async {
      final requestedUrls = <String>[];

      final geminiSuccessPayload = {
        'candidates': [
          {
            'content': {
              'parts': [
                {
                  'text': jsonEncode({
                    'decision': 'SUGGESTED',
                    'confidence': 0.95,
                    'containsHazardousWaste': false,
                    'explanation': 'Đệm cao su thiên nhiên 1m6',
                    'items': [
                      {
                        'itemType': 'MATTRESS',
                        'displayName': 'Nệm cao su 1m6 x 2m',
                        'box_2d': [100, 100, 900, 900],
                        'suggestedMaterial': 'STANDARD',
                      }
                    ],
                  }),
                }
              ]
            }
          }
        ]
      };

      final client = TestMockClient((request) async {
        final url = request.url.toString();
        requestedUrls.add(url);

        if (url.contains('gemini-2.5-flash')) {
          // Model 1 overloaded
          return http.Response('Service Unavailable (High Load)', 503);
        } else if (url.contains('gemini-3.6-flash')) {
          // Fallback model 2 succeeds
          return http.Response(
            jsonEncode(geminiSuccessPayload),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final result = await GeminiVisionService.analyzeImageBytes(
        dummyBytes,
        client: client,
        apiKey: 'test-api-key',
      );

      expect(requestedUrls.any((u) => u.contains('gemini-2.5-flash')), isTrue);
      expect(requestedUrls.any((u) => u.contains('gemini-3.6-flash')), isTrue);
      expect(result.decision, equals('SUGGESTED'));
      expect(result.items.length, equals(1));
      expect(result.items.first.category, equals(BulkyCategory.MATTRESS));
      expect(result.aiModelUsed, contains('gemini-3.6-flash'));
    });

    test('4. Hazardous waste (gas cylinder) sets containsHazardousWaste: true and requiresManualReview: true', () async {
      final geminiHazardousPayload = {
        'candidates': [
          {
            'content': {
              'parts': [
                {
                  'text': jsonEncode({
                    'decision': 'MANUAL_REVIEW',
                    'confidence': 0.98,
                    'containsHazardousWaste': true,
                    'hazardousReason': 'Phát hiện bình gas mini và can hóa chất tẩy rửa công nghiệp',
                    'explanation': 'Ảnh chụp chứa vật liệu có nguy cơ cháy nổ cao, từ chối định giá tự động',
                    'items': [],
                    'boundingBoxes': [
                      {
                        'box_2d': [150, 150, 700, 700],
                        'displayName': 'Bình gas mini nguy cơ cháy nổ',
                        'itemType': 'HAZARDOUS',
                        'isHazardous': true,
                        'suggestedMaterial': 'HEAVY',
                      }
                    ],
                  }),
                }
              ]
            }
          }
        ]
      };

      final client = TestMockClient((request) async {
        return http.Response(
          jsonEncode(geminiHazardousPayload),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final result = await GeminiVisionService.analyzeImageBytes(
        dummyBytes,
        client: client,
        apiKey: 'test-api-key',
      );

      expect(result.containsHazardousWaste, isTrue);
      expect(result.requiresManualReview, isTrue);
      expect(result.decision, equals('MANUAL_REVIEW'));
      expect(result.hazardousReason, contains('bình gas'));
      expect(result.boundingBoxes.any((b) => b.isHazardous), isTrue);
    });

    test('5. Resilient JSON parsing with markdown code fences and extra text', () async {
      const rawTextWithFence = '''
Dưới đây là kết quả giám định thị giác AI:
```json
{
  "decision": "SUGGESTED",
  "confidence": 0.89,
  "containsHazardousWaste": false,
  "explanation": "Bàn trà gỗ sồi",
  "items": [
    {
      "itemType": "TABLE",
      "displayName": "Bàn trà gỗ sồi mặt kính",
      "box_2d": [100, 100, 800, 800],
      "suggestedMaterial": "STANDARD"
    }
  ]
}
```
Vui lòng kiểm tra lại nếu cần thiết.
''';

      final geminiFencedPayload = {
        'candidates': [
          {
            'content': {
              'parts': [
                {'text': rawTextWithFence}
              ]
            }
          }
        ]
      };

      final client = TestMockClient((request) async {
        return http.Response(
          jsonEncode(geminiFencedPayload),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final result = await GeminiVisionService.analyzeImageBytes(
        dummyBytes,
        client: client,
        apiKey: 'test-api-key',
      );

      expect(result.decision, equals('SUGGESTED'));
      expect(result.items.first.category, equals(BulkyCategory.TABLE));
      expect(result.items.first.displayName, equals('Bàn trà gỗ sồi mặt kính'));
    });

    test('6. Preset sample mappings return without calling HTTP client', () async {
      int httpCallCount = 0;
      final client = TestMockClient((request) async {
        httpCallCount++;
        return http.Response('{}', 200);
      });

      final result = await GeminiVisionService.analyzeImageBytes(
        dummyBytes,
        filename: 'sofa_da_phong_khach.jpg',
        client: client,
      );

      expect(httpCallCount, equals(0));
      expect(result.decision, equals('SUGGESTED'));
      expect(result.items.first.category, equals(BulkyCategory.SOFA));
      expect(result.requiresManualReview, isFalse);
    });

    test('7. AiRecognitionResult serializes to and from JSON', () {
      final original = AiRecognitionResult(
        decision: 'SUGGESTED',
        requiresManualReview: false,
        containsHazardousWaste: false,
        containsConstructionWaste: true,
        confidence: 0.95,
        explanation: 'Nhận diện hoàn tất',
        items: [
          BulkyItem(
            id: 'item-1',
            category: BulkyCategory.OTHER,
            displayName: 'Phế thải gạch vữa',
            material: MaterialType.HEAVY,
          ),
        ],
        boundingBoxes: [
          BoundingBox(
            ymin: 100,
            xmin: 100,
            ymax: 800,
            xmax: 800,
            displayName: 'Phế thải gạch vữa',
            category: BulkyCategory.OTHER,
            material: MaterialType.HEAVY,
          ),
        ],
        aiModelUsed: 'gemini-2.5-flash',
        hazardousReason: null,
      );

      final json = original.toJson();
      final restored = AiRecognitionResult.fromJson(json);

      expect(restored.decision, equals(original.decision));
      expect(restored.requiresManualReview, equals(original.requiresManualReview));
      expect(restored.containsConstructionWaste, equals(original.containsConstructionWaste));
      expect(restored.items.first.displayName, equals('Phế thải gạch vữa'));
      expect(restored.items.first.category, equals(BulkyCategory.OTHER));
      expect(restored.boundingBoxes.first.material, equals(MaterialType.HEAVY));
      expect(restored.aiModelUsed, equals('gemini-2.5-flash'));
    });
  });
}
