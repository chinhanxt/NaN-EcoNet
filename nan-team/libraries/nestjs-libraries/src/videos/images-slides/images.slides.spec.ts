jest.mock('@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service', () => ({ AgyMcpService: class {} }));
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({ UploadFactory: { createStorage: () => ({}) } }));
jest.mock('transloadit', () => jest.fn());
jest.mock('music-metadata', () => ({ parseBuffer: jest.fn() }), { virtual: true });
jest.mock('subtitle', () => ({ stringifySync: jest.fn() }), { virtual: true });
jest.mock('p-limit', () => () => (fn: () => unknown) => fn(), { virtual: true });

import { ImagesSlides } from './images.slides';

describe('ImagesSlides.generateSlidesFromText via AGY', () => {
  it('returns slides from AGY analyzeJson with a slides schema', async () => {
    const slides = [{ imagePrompt: 'sunrise, dark gradient', voiceText: 'Chào buổi sáng' }];
    const agy = { analyzeJson: jest.fn().mockResolvedValue({ slides }) };
    const service = new ImagesSlides(agy as any);
    expect(await service.generateSlidesFromText('Chào buổi sáng')).toEqual(slides);
    const [request] = agy.analyzeJson.mock.calls[0];
    expect(request.prompt).toContain('Chào buổi sáng');
    expect(request.prompt).toContain('same language');
    expect(request.schema.properties.slides.maxItems).toBe(5);
    expect(request.schema.properties.slides.items.required).toEqual(['imagePrompt', 'voiceText']);
  });
});
