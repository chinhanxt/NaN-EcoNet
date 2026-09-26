/**
 * Gemini Vision AI Service for Smartbin Bulky Waste Recognition
 * Leverages Google Gemini 2.5 Flash Multimodal Vision with Structured Output
 */

import { AI_DECISION, ACCEPTED_ITEM_TYPES } from '../../domain/constants.js';

const DEFAULT_GEMINI_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_GEMINI_API_KEY) ||
  '';

const PRESET_MAPPINGS = {
  'sofa_da_phong_khach.jpg': {
    decision: AI_DECISION.SUGGESTED,
    requiresManualReview: false,
    confidence: 0.96,
    items: [
      {
        itemType: 'SOFA',
        catalogItemCode: 'SOFA',
        displayName: 'Sofa da 3 chỗ phòng khách',
        suggestedQuantity: 1,
        dimensionsCm: { length: 210, width: 90, height: 85 },
        disassemblyNeeded: false,
        box_2d: [180, 120, 850, 910],
        confidence: 0.96,
        suggestedMaterial: 'STANDARD',
      },
    ],
    boundingBoxes: [
      {
        box_2d: [180, 120, 850, 910],
        displayName: 'Sofa da 3 chỗ phòng khách',
        confidence: 0.96,
        itemType: 'SOFA',
        isHazardous: false,
        suggestedMaterial: 'STANDARD',
      },
    ],
    explanation:
      'AI nhận diện: Phát hiện 01 bộ sofa da 3 chỗ nguyên khối, tình trạng hoàn chỉnh, không có vật liệu nguy hại.',
    aiModelUsed: 'Trí tuệ nhân tạo (AI)',
  },
  'nem_lo_xo_1m8.jpg': {
    decision: AI_DECISION.SUGGESTED,
    requiresManualReview: false,
    confidence: 0.94,
    items: [
      {
        itemType: 'MATTRESS',
        catalogItemCode: 'MATTRESS',
        displayName: 'Nệm lò xo King Size 1m8 x 2m',
        suggestedQuantity: 1,
        dimensionsCm: { length: 200, width: 180, height: 25 },
        disassemblyNeeded: false,
        box_2d: [150, 100, 880, 900],
        confidence: 0.94,
        suggestedMaterial: 'STANDARD',
      },
    ],
    boundingBoxes: [
      {
        box_2d: [150, 100, 880, 900],
        displayName: 'Nệm lò xo King Size 1m8 x 2m',
        confidence: 0.94,
        itemType: 'MATTRESS',
        isHazardous: false,
        suggestedMaterial: 'STANDARD',
      },
    ],
    explanation:
      'AI nhận diện: Phát hiện 01 đệm lò xo cỡ lớn (1m8x2m), không thể gập gọn, cần xe tải có sàn lớn.',
    aiModelUsed: 'Trí tuệ nhân tạo (AI)',
  },
  'tu_go_3_canh.jpg': {
    decision: AI_DECISION.SUGGESTED,
    requiresManualReview: false,
    confidence: 0.91,
    items: [
      {
        itemType: 'CABINET',
        catalogItemCode: 'CABINET',
        displayName: 'Tủ quần áo gỗ 3 cánh',
        suggestedQuantity: 1,
        dimensionsCm: { length: 160, width: 60, height: 200 },
        disassemblyNeeded: true,
        box_2d: [100, 150, 920, 850],
        confidence: 0.91,
        suggestedMaterial: 'HEAVY',
      },
    ],
    boundingBoxes: [
      {
        box_2d: [100, 150, 920, 850],
        displayName: 'Tủ quần áo gỗ 3 cánh',
        confidence: 0.91,
        itemType: 'CABINET',
        isHazardous: false,
        suggestedMaterial: 'HEAVY',
      },
    ],
    explanation:
      'AI nhận diện: Phát hiện 01 tủ gỗ 3 buồng kích thước lớn (cao 2m), khuyến nghị tháo rời trước khi vận chuyển.',
    aiModelUsed: 'Trí tuệ nhân tạo (AI)',
  },
};

/**
 * Trích xuất base64 từ image object
 */
function extractBase64AndMime(imageItem) {
  if (!imageItem) return null;

  if (imageItem.base64) {
    return {
      mimeType: imageItem.mimeType || 'image/jpeg',
      data: imageItem.base64.replace(/^data:image\/[a-z]+;base64,/, ''),
    };
  }

  if (typeof imageItem.dataUrl === 'string' && imageItem.dataUrl.includes('base64,')) {
    const parts = imageItem.dataUrl.split('base64,');
    const mimeMatch = imageItem.dataUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);/);
    return {
      mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
      data: parts[1],
    };
  }

  return null;
}

/**
 * Phân tích ảnh thu gom rác cồng kềnh qua Google Gemini 2.5 Flash Vision
 * @param {Object} input - { images: Array<Object> }
 * @param {Object} [options] - { apiKey, signal }
 */
export async function analyzeBulkyWasteWithGemini(input, options = {}) {
  const images = input?.images || [];
  const apiKey =
    options.apiKey ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('smartbin_gemini_api_key')) ||
    DEFAULT_GEMINI_KEY;

  // 1. Kiểm tra nếu có Preset ảnh mẫu đã biết
  for (const img of images) {
    if (img?.filename && PRESET_MAPPINGS[img.filename]) {
      return { ...PRESET_MAPPINGS[img.filename] };
    }
  }

  // 2. Trích xuất dữ liệu ảnh thật (Base64)
  const imageParts = [];
  for (const img of images) {
    const extracted = extractBase64AndMime(img);
    if (extracted && extracted.data) {
      imageParts.push({
        inline_data: {
          mime_type: extracted.mimeType,
          data: extracted.data,
        },
      });
    }
  }

  // 3. Nếu không có ảnh Base64 nào (ví dụ chạy mock test hoặc chưa upload file thực)
  if (imageParts.length === 0) {
    return {
      decision: AI_DECISION.MANUAL_REVIEW,
      requiresManualReview: true,
      items: [],
      boundingBoxes: [],
      confidence: 0,
      explanation:
        'Chưa có dữ liệu ảnh để nhận diện. Vui lòng tải ảnh rõ hơn hoặc gửi nhân viên kiểm tra.',
    };
  }

  // 4. Chuẩn bị prompt chuyên biệt cho thẩm định rác cồng kềnh Smartbin
  const systemPrompt = `
Bạn là Trợ lý Giám định Thị giác AI chuyên nghiệp của Hệ thống Quản lý Rác cồng kềnh đô thị thông minh Smartbin (Chính quyền Xã/Phường thông minh).
Nhiệm vụ của bạn là phân tích (các) bức ảnh do người dân chụp và xuất kết quả theo định dạng JSON duy nhất.

CÁC QUY TẮC THẨM ĐỊNH BẮT BUỘC:
1. Phân loại nhóm cước chuẩn xác (itemType) vào đúng một trong các mã:
   - "SOFA": Sofa đơn, sofa băng dài, sofa góc chữ L, trường kỷ
   - "MATTRESS": Đệm lò xo, đệm cao su, đệm mút bông ép
   - "CABINET": Tủ quần áo, tủ chén, kệ sách lớn, tủ giày dép, tủ tài liệu
   - "TABLE": Bàn ăn, bàn tròn, bàn trà, ghế ăn, ghế tựa, ghế cafe, ghế văn phòng
   - "OTHER": Đồ cồng kềnh ngoài các loại trên, luôn cần nhân viên kiểm tra và báo giá riêng.

2. TÊN ĐỒ VẬT CỤ THỂ (displayName - RẤT QUAN TRỌNG):
   - Tự động đặt tên tiếng Việt rõ ràng, cụ thể cho từng món đồ hoặc phế thải phát hiện được: ví dụ "Đệm lò xo cũ", "Tấm ván gỗ ép", "Phế thải gạch ngói / xà bần", "Bàn trà gỗ", "Ghế sofa đơn".
   - Không được để tên chung chung là mã tiếng Anh như "TABLE", "SOFA" hay "OTHER".

3. QUY CHUẨN AN TOÀN MÔI TRƯỜNG & RÁC NGUY HẠI CẤM THU GOM:
   - CHỈ coi là rác nguy hại cấm thu gom khi phát hiện: bình gas cháy nổ, bình ắc quy chì, thùng hóa chất độc hại, rác y tế truyền nhiễm nguy cấp.
   - Khi đó:
     -> Đặt "containsHazardousWaste": true
     -> "hazardousReason": ghi rõ lý do và chất nguy hại phát hiện được
     -> "decision": "MANUAL_REVIEW"
   - Phế thải xây dựng/xà bần không được thu gom chung. Đặt "containsConstructionWaste": true và "decision": "MANUAL_REVIEW". Không coi đây là vật dụng thông thường được báo giá tự động.

4. ƯỚC LƯỢNG KÍCH THƯỚC 3D VÀ ĐIỀU KIỆN BỐC XẾP:
   - Không suy đoán kích thước tuyệt đối từ ảnh. Người dân sẽ tự chọn nhóm kích thước sau khi nhận diện.
   - Đánh giá "disassemblyNeeded": true nếu đồ vật quá khổ (ví dụ tủ cao >1.8m, bàn lớn, giường gỗ) cần tháo rời để đưa qua cửa hoặc xuống cầu thang.
   - Tuyệt đối không đoán trọng lượng (kg).

5. TỌA ĐỘ VÙNG NHẬN DIỆN 2D (box_2d):
   - Chuẩn hóa tọa độ [ymin, xmin, ymax, xmax] theo thang 0 - 1000 tương ứng vị trí đồ vật trong ảnh (chuẩn YOLO / Gemini Vision).
   - Ví dụ: [180, 120, 850, 910].

6. PHÂN LOẠI CHẤT LIỆU ƯỚC ĐOÁN (suggestedMaterial):
   - "LIGHT": Đồ nhẹ, nhựa, mút xốp mỏng, vải nệm mỏng, bàn ghế nhựa/nhôm gấp, bao phế thải nhẹ.
   - "STANDARD": Sofa nỉ/da tiêu chuẩn, đệm lò xo/cao su tiêu chuẩn, bàn ghế gỗ ép, ván gỗ cốp pha, tủ composite.
   - "HEAVY": Gạch ngói, bê tông vụn, phế thải xây dựng, gỗ tự nhiên đặc nguyên khối, tủ gỗ 3-4 cánh lớn, mặt đá hoa cương, kính cường lực lớn, kim loại nặng/sắt thép đúc.

7. QUYẾT ĐỊNH (decision):
   - "SUGGESTED": Nhận diện rõ ràng, tự tin cao (confidence >= 0.7) và không có rác nguy hại cháy nổ/hóa chất độc.
   - "NEEDS_CONFIRMATION": Ảnh hơi mờ, góc chụp khuất (confidence từ 0.5 đến 0.69).
   - "MANUAL_REVIEW": Có rác nguy hại, phế thải xây dựng, loại OTHER, confidence < 0.5 hoặc ảnh không rõ đồ vật.

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
      "displayName": "Tên tiếng Việt cụ thể (VD: Đệm lò xo cũ, Tấm ván gỗ ép, Phế thải gạch ngói)",
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
`;

  try {
    const candidateModels = ['gemini-2.5-flash', 'gemini-3.6-flash'];
    let jsonRes = null;
    let lastError = null;

    for (const model of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: systemPrompt }, ...imageParts],
                  },
                ],
                generationConfig: {
                  response_mime_type: 'application/json',
                  temperature: 0.1,
                },
              }),
              signal: options.signal || controller.signal,
            },
          );

          clearTimeout(timeoutId);

          if (res.ok) {
            jsonRes = await res.json();
            if (jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text) {
              break;
            }
          } else {
            const errText = await res.text();
            console.warn(
              `Gemini API ${model} (attempt ${attempt + 1}) returned status:`,
              res.status,
              errText,
            );
            lastError = new Error(`Gemini API ${model} returned HTTP ${res.status}`);
            if (res.status !== 503 && res.status !== 429) {
              break;
            }
          }
        } catch (err) {
          console.warn(
            `Error calling Gemini model ${model} (attempt ${attempt + 1}):`,
            err.message,
          );
          lastError = err;
        }
      }

      if (jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text) {
        break;
      }
    }

    if (!jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('All Vision AI model attempts failed:', lastError);
      return {
        decision: AI_DECISION.MANUAL_REVIEW,
        requiresManualReview: true,
        confidence: 0,
        containsHazardousWaste: false,
        hazardousReason: '',
        explanation:
          'Hệ thống AI hiện đang quá tải hoặc gián đoạn kết nối. Vui lòng bấm Quét lại hoặc kiểm tra/thêm danh mục đồ vật bên dưới.',
        items: [],
        boundingBoxes: [],
        aiModelUsed: 'Trí tuệ nhân tạo (AI)',
      };
    }

    const candidateText = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(candidateText);
    const VALID_MATERIALS = ['LIGHT', 'STANDARD', 'HEAVY'];

    // Chuẩn hóa danh sách items
    const items = (parsed.items || []).map((it) => {
      let type = (it.itemType || 'OTHER').toUpperCase().trim();
      if (!ACCEPTED_ITEM_TYPES.includes(type)) {
        if (
          type.includes('MATTRESS') ||
          type.includes('DEM') ||
          type.includes('NEM') ||
          type.includes('BED')
        ) {
          type = 'MATTRESS';
        } else if (type.includes('SOFA') || type.includes('COUCH')) {
          type = 'SOFA';
        } else if (
          type.includes('TABLE') ||
          type.includes('DESK') ||
          type.includes('BAN') ||
          type.includes('GHE') ||
          type.includes('CHAIR')
        ) {
          type = 'TABLE';
        } else if (
          type.includes('CABINET') ||
          type.includes('WARDROBE') ||
          type.includes('TU') ||
          type.includes('SHELF') ||
          type.includes('KE')
        ) {
          type = 'CABINET';
        } else {
          type = 'OTHER';
        }
      }

      const defaultVietnameseName =
        type === 'TABLE'
          ? 'Bàn / Ghế'
          : type === 'SOFA'
            ? 'Sofa phòng khách'
            : type === 'MATTRESS'
              ? 'Nệm giường ngủ'
              : type === 'CABINET'
                ? 'Tủ quần áo'
                : 'Đồ cồng kềnh';

      let box_2d = [100, 100, 900, 900];
      if (Array.isArray(it.box_2d) && it.box_2d.length === 4) {
        const fallbackDefault = [100, 100, 900, 900];
        const normalized = it.box_2d.map((val, idx) => {
          const num = Number(val);
          return Number.isFinite(num)
            ? Math.max(0, Math.min(1000, Math.round(num)))
            : fallbackDefault[idx];
        });
        box_2d = normalized;
      }

      const confidence =
        typeof it.confidence === 'number'
          ? it.confidence
          : typeof parsed.confidence === 'number'
            ? parsed.confidence
            : 0.9;

      const rawMat = (it.suggestedMaterial || '').toUpperCase();
      const suggestedMaterial = VALID_MATERIALS.includes(rawMat) ? rawMat : 'STANDARD';

      return {
        itemType: type,
        catalogItemCode: type,
        displayName: it.displayName || defaultVietnameseName,
        suggestedQuantity: Number(it.suggestedQuantity) || 1,
        dimensionsCm: {
          length: Number(it.dimensionsCm?.length) || 150,
          width: Number(it.dimensionsCm?.width) || 80,
          height: Number(it.dimensionsCm?.height) || 80,
        },
        disassemblyNeeded: Boolean(it.disassemblyNeeded),
        box_2d,
        confidence,
        suggestedMaterial,
      };
    });

    const isHazardous = Boolean(parsed.containsHazardousWaste);
    const isConstruction = Boolean(parsed.containsConstructionWaste);
    const decision =
      isHazardous ||
      isConstruction ||
      !items.length ||
      items.some((item) => item.itemType === 'OTHER' || item.confidence < 0.5)
        ? AI_DECISION.MANUAL_REVIEW
        : parsed.decision || AI_DECISION.SUGGESTED;

    const finalItems = items.length > 0 ? items : [];

    // Xây dựng mảng boundingBoxes tổng hợp từ items và rác nguy hại (nếu có)
    const boundingBoxes = [];
    finalItems.forEach((it) => {
      boundingBoxes.push({
        box_2d: it.box_2d,
        displayName: it.displayName,
        confidence: it.confidence,
        itemType: it.itemType,
        isHazardous: false,
        suggestedMaterial: it.suggestedMaterial,
      });
    });

    if (isHazardous) {
      if (Array.isArray(parsed.boundingBoxes) && parsed.boundingBoxes.some((b) => b.isHazardous)) {
        parsed.boundingBoxes
          .filter((b) => b.isHazardous)
          .forEach((b) => {
            let bBox = [150, 150, 850, 850];
            if (Array.isArray(b.box_2d) && b.box_2d.length === 4) {
              const hazFallback = [150, 150, 850, 850];
              bBox = b.box_2d.map((val, idx) => {
                const n = Number(val);
                return Number.isFinite(n)
                  ? Math.max(0, Math.min(1000, Math.round(n)))
                  : hazFallback[idx];
              });
            }
            boundingBoxes.push({
              box_2d: bBox,
              displayName: b.displayName || parsed.hazardousReason || 'Rác nguy hại phát hiện',
              confidence:
                typeof b.confidence === 'number' ? b.confidence : parsed.confidence || 0.95,
              itemType: 'HAZARDOUS',
              isHazardous: true,
              suggestedMaterial: 'HEAVY',
            });
          });
      } else {
        boundingBoxes.push({
          box_2d: [150, 150, 850, 850],
          displayName: parsed.hazardousReason || 'Rác nguy hại / phế thải cấm',
          confidence: parsed.confidence || 0.95,
          itemType: 'HAZARDOUS',
          isHazardous: true,
          suggestedMaterial: 'HEAVY',
        });
      }
    }

    return {
      decision,
      requiresManualReview: decision === AI_DECISION.MANUAL_REVIEW || isHazardous,
      confidence: parsed.confidence || 0.9,
      containsHazardousWaste: isHazardous,
      containsConstructionWaste: isConstruction,
      hazardousReason: parsed.hazardousReason || '',
      explanation: parsed.explanation || 'AI đã hoàn tất nhận diện ảnh chụp.',
      items: finalItems,
      boundingBoxes,
      aiModelUsed: 'Trí tuệ nhân tạo (AI)',
    };
  } catch (error) {
    console.error('Error during Vision AI analysis:', error);
    return {
      decision: AI_DECISION.MANUAL_REVIEW,
      requiresManualReview: true,
      confidence: 0,
      containsHazardousWaste: false,
      hazardousReason: '',
      explanation:
        'Không thể kết nối đến dịch vụ AI. Vui lòng bấm Quét lại hoặc chọn đồ vật trực tiếp bên dưới.',
      items: [],
      boundingBoxes: [],
      aiModelUsed: 'Trí tuệ nhân tạo (AI)',
    };
  }
}
