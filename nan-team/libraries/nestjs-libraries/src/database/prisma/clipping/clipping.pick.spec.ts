const mockStorage = { readFile: jest.fn() };
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => mockStorage,
    createIngestProcessor: () => null,
    createClipProcessor: () => null,
  },
}));
jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({ ioRedis: {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/clipping/clipping.repository', () => ({ ClippingRepository: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service', () => ({ SubscriptionService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/organizations/organization.service', () => ({ OrganizationService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/integrations/integration.service', () => ({ IntegrationService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({ PostsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/database/prisma/media/media.service', () => ({ MediaService: class {} }));
jest.mock('@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service', () => ({ AgyMcpService: class {} }));
jest.mock('@gitroom/nestjs-libraries/deepgram/deepgram.service', () => ({ DeepgramService: class {} }));
jest.mock('@gitroom/nestjs-libraries/integrations/social.abstract', () => ({ truncateForTemporal: (v: unknown) => v }));
jest.mock('nestjs-temporal-core', () => ({ TemporalService: class {} }));

import { ClippingService } from './clipping.service';

describe('ClippingService.pickClips via AGY', () => {
  const agy = { analyzeJson: jest.fn() };
  const repository = {
    getClippingById: jest.fn(),
    updateClipping: jest.fn(),
    createClips: jest.fn(async (_id: string, clips: unknown[]) => clips.map((_, i) => ({ id: `c${i}` }))),
  };
  const service = new ClippingService(repository as any, {} as any, {} as any, {} as any, {} as any, {} as any, agy as any, {} as any, {} as any);
  const segments = Array.from({ length: 10 }, (_, i) => ({ start: i * 10, end: i * 10 + 10, text: `câu ${i}` }));

  beforeEach(() => {
    jest.clearAllMocks();
    repository.getClippingById.mockResolvedValue({ id: 'k', organizationId: 'o', title: 'Tiêu đề', maxClips: 2, clips: [] });
    mockStorage.readFile.mockResolvedValue(JSON.stringify({ segments, language: 'vi' }));
  });

  it('asks AGY for line ranges with a JSON schema and stores valid clips', async () => {
    agy.analyzeJson.mockResolvedValue({
      clips: [
        { from: 0, to: 3, title: 'A', content: 'post A' },
        { from: 2, to: 5, title: 'overlap', content: 'x' },
        { from: 6, to: 99, title: 'out of range', content: 'x' },
        { from: 5, to: 9, title: 'B', content: 'post B' },
      ],
    });
    expect(await service.pickClips('k')).toEqual(['c0', 'c1']);
    const [request, signal] = agy.analyzeJson.mock.calls[0];
    expect(request.prompt).toContain('in this language, whatever the language of these instructions: vi');
    expect(request.prompt).toContain('0 [0.0 - 10.0] câu 0');
    expect(request.schema.properties.clips.maxItems).toBe(2);
    expect(request.schema.properties.clips.items.required).toEqual(['from', 'to', 'title', 'content']);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(repository.createClips).toHaveBeenCalledWith('k', [
      { title: 'A', content: 'post A', start: 0, end: 40 },
      { title: 'B', content: 'post B', start: 50, end: 100 },
    ]);
  });

  it('stops when AGY returns no usable clip', async () => {
    agy.analyzeJson.mockResolvedValue({ clips: 'bad' });
    await expect(service.pickClips('k')).rejects.toThrow('No part of this video works as a short clip.');
  });
});
