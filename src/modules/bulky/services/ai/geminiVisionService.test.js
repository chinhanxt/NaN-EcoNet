import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeBulkyWasteWithGemini } from './geminiVisionService.js';
import { AI_DECISION } from '../../domain/constants.js';

describe('geminiVisionService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('recognizes preset sofa correctly', async () => {
    const res = await analyzeBulkyWasteWithGemini({
      images: [{ filename: 'sofa_da_phong_khach.jpg' }],
    });
    expect(res.decision).toBe(AI_DECISION.SUGGESTED);
    expect(res.requiresManualReview).toBe(false);
    expect(res.items[0].itemType).toBe('SOFA');
    expect(res.items[0].displayName).toContain('Sofa');
    expect(res.items[0].box_2d).toEqual([180, 120, 850, 910]);
    expect(res.items[0].confidence).toBe(0.96);
    expect(res.items[0].suggestedMaterial).toBe('STANDARD');
    expect(res.boundingBoxes).toHaveLength(1);
    expect(res.boundingBoxes[0].box_2d).toEqual([180, 120, 850, 910]);
    expect(res.boundingBoxes[0].suggestedMaterial).toBe('STANDARD');
    expect(res.aiModelUsed).toBe('Trí tuệ nhân tạo (AI)');
  });

  it('recognizes preset mattress correctly', async () => {
    const res = await analyzeBulkyWasteWithGemini({
      images: [{ filename: 'nem_lo_xo_1m8.jpg' }],
    });
    expect(res.decision).toBe(AI_DECISION.SUGGESTED);
    expect(res.items[0].itemType).toBe('MATTRESS');
    expect(res.items[0].dimensionsCm.width).toBe(180);
    expect(res.items[0].box_2d).toEqual([150, 100, 880, 900]);
    expect(res.items[0].confidence).toBe(0.94);
    expect(res.items[0].suggestedMaterial).toBe('STANDARD');
    expect(res.boundingBoxes).toHaveLength(1);
    expect(res.boundingBoxes[0].box_2d).toEqual([150, 100, 880, 900]);
    expect(res.boundingBoxes[0].suggestedMaterial).toBe('STANDARD');
  });

  it('recognizes preset cabinet correctly', async () => {
    const res = await analyzeBulkyWasteWithGemini({
      images: [{ filename: 'tu_go_3_canh.jpg' }],
    });
    expect(res.decision).toBe(AI_DECISION.SUGGESTED);
    expect(res.items[0].itemType).toBe('CABINET');
    expect(res.items[0].disassemblyNeeded).toBe(true);
    expect(res.items[0].box_2d).toEqual([100, 150, 920, 850]);
    expect(res.items[0].confidence).toBe(0.91);
    expect(res.items[0].suggestedMaterial).toBe('HEAVY');
    expect(res.boundingBoxes).toHaveLength(1);
    expect(res.boundingBoxes[0].box_2d).toEqual([100, 150, 920, 850]);
    expect(res.boundingBoxes[0].suggestedMaterial).toBe('HEAVY');
  });

  it('fallbacks gracefully when no base64 images provided', async () => {
    const res = await analyzeBulkyWasteWithGemini({ images: [] });
    expect(res.decision).toBe(AI_DECISION.MANUAL_REVIEW);
    expect(res.items).toEqual([]);
    expect(res.boundingBoxes).toBeDefined();
  });

  it('calls Gemini 2.5 Flash API when base64 is provided and parses response', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  decision: 'SUGGESTED',
                  confidence: 0.95,
                  containsHazardousWaste: false,
                  explanation: 'Đã phát hiện 1 ghế sofa da đôi',
                  items: [
                    {
                      itemType: 'SOFA',
                      displayName: 'Sofa da 2 chỗ',
                      suggestedQuantity: 1,
                      dimensionsCm: { length: 180, width: 85, height: 80 },
                      disassemblyNeeded: false,
                      box_2d: [120, 80, 860, 900],
                      suggestedMaterial: 'STANDARD',
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    const res = await analyzeBulkyWasteWithGemini({
      images: [
        {
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
          filename: 'uploaded_sofa.jpg',
        },
      ],
    });

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(res.decision).toBe(AI_DECISION.SUGGESTED);
    expect(res.items[0].displayName).toBe('Sofa da 2 chỗ');
    expect(res.items[0].box_2d).toEqual([120, 80, 860, 900]);
    expect(res.items[0].suggestedMaterial).toBe('STANDARD');
    expect(res.boundingBoxes).toHaveLength(1);
    expect(res.boundingBoxes[0].box_2d).toEqual([120, 80, 860, 900]);
    expect(res.boundingBoxes[0].suggestedMaterial).toBe('STANDARD');
    expect(res.aiModelUsed).toBe('Trí tuệ nhân tạo (AI)');
  });

  it('defaults box_2d and suggestedMaterial when missing from API response', async () => {
    const mockResponseWithoutBox = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  decision: 'SUGGESTED',
                  confidence: 0.88,
                  containsHazardousWaste: false,
                  explanation: 'Bàn gỗ phòng khách',
                  items: [
                    {
                      itemType: 'TABLE',
                      displayName: 'Bàn gỗ',
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponseWithoutBox,
    });

    const res = await analyzeBulkyWasteWithGemini({
      images: [
        {
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
          filename: 'ban_go.jpg',
        },
      ],
    });

    expect(res.items[0].box_2d).toEqual([100, 100, 900, 900]);
    expect(res.items[0].suggestedMaterial).toBe('STANDARD');
    expect(res.boundingBoxes).toHaveLength(1);
    expect(res.boundingBoxes[0].box_2d).toEqual([100, 100, 900, 900]);
    expect(res.boundingBoxes[0].suggestedMaterial).toBe('STANDARD');
  });

  it('flags hazardous waste as MANUAL_REVIEW when detected by Gemini', async () => {
    const mockHazardousResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  decision: 'MANUAL_REVIEW',
                  confidence: 0.98,
                  containsHazardousWaste: true,
                  hazardousReason: 'Phát hiện bình gas mini và thùng chứa hóa chất sơn',
                  explanation: 'Hình ảnh chứa rác nguy hại bị cấm thu gom',
                  items: [],
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHazardousResponse,
    });

    const res = await analyzeBulkyWasteWithGemini({
      images: [
        {
          base64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          mimeType: 'image/png',
          filename: 'binh_gas.png',
        },
      ],
    });

    expect(res.decision).toBe(AI_DECISION.MANUAL_REVIEW);
    expect(res.requiresManualReview).toBe(true);
    expect(res.containsHazardousWaste).toBe(true);
    expect(res.hazardousReason).toContain('bình gas');
    expect(res.boundingBoxes).toBeDefined();
    expect(res.boundingBoxes.length).toBeGreaterThanOrEqual(1);
    expect(res.boundingBoxes[0].isHazardous).toBe(true);
  });
});
