jest.mock('@mastra/core/tools', () => ({ createTool: (options: any) => options }));
jest.mock('../../chat/auth.context',()=>({...jest.requireActual('../../chat/auth.context'),checkAuth:jest.fn()}));
jest.mock('../../database/prisma/integrations/integration.service', () => ({ IntegrationService: class {} }));
jest.mock('../../database/prisma/posts/posts.service', () => ({ PostsService: class {} }));
jest.mock('./remotion.service', () => ({ RemotionService: class {} }));
import { GenerateAiVideoTool } from '../../chat/tools/generate.ai.video.tool';
import { AiVideoStatusTool } from '../../chat/tools/ai.video.status.tool';
import { IntegrationSchedulePostTool } from '../../chat/tools/integration.schedule.post';

const context = (id?: string) => ({ requestContext: new Map([['organization', JSON.stringify({ id })]]) });
const media = { id: 'real-media-id', path: 'http://localhost:4200/uploads/test/video.mp4' };
describe('AI video Agent tool integration', () => {
  it('starts the requested topic job in the authenticated tenant', async () => {
    const videos = { startFromTopic: jest.fn().mockResolvedValue({ jobId: 'job' }) };
    const tool = new GenerateAiVideoTool(videos as any).run();
    const input = { topic: 'Buổi sáng xanh', targetDuration: 30, voice: 'vi-VN-HoaiMyNeural', resumeJobId: '731182c8-00cc-4b60-8e92-2915b4aa6af4' };
    expect(await tool.execute!(input as any, context('tenant') as any)).toEqual({ jobId: 'job' });
    expect(videos.startFromTopic).toHaveBeenCalledWith({ id: 'tenant' }, input);
    expect(tool.inputSchema.safeParse({ ...input, targetDuration: 20 }).success).toBe(false);
    expect(tool.inputSchema.safeParse({ ...input, resumeJobId: '../other' }).success).toBe(false);
  });
  it('does not start work when the organization context is missing', async () => {
    const videos = { startFromTopic: jest.fn() };
    const tool = new GenerateAiVideoTool(videos as any).run();
    expect(await tool.execute!({} as any, context() as any)).toMatchObject({ error: expect.any(String) });
    expect(videos.startFromTopic).not.toHaveBeenCalled();
  });
  it('returns saved media from the owned status job, and preserves failures', async () => {
    const videos = { getStatus: jest.fn().mockResolvedValue({ jobId: 'job', status: 'completed', progress: 100, media }) };
    const tool = new AiVideoStatusTool(videos as any).run();
    expect(await tool.execute!({ jobId: 'job' }, context('tenant') as any)).toMatchObject({ media });
    expect(videos.getStatus).toHaveBeenCalledWith('tenant', 'job');
    videos.getStatus.mockRejectedValue(new Error('Video job was not found'));
    expect(await tool.execute!({ jobId: 'foreign' }, context('tenant') as any)).toEqual({ error: 'Video job was not found' });
  });
  it('passes MP4 attachments through the existing schedule tool and returns the calendar link', async () => {
    // Scheduling boundary is mocked: this test cannot enqueue or publish a real social post.
    const posts = {
      validatePosts: jest.fn().mockResolvedValue([{ valid: true, errors: true, emptyContent: false, tooLong: false }]),
      createPost: jest.fn().mockResolvedValue([{ postId: 'test-post', integration: 'channel' }]),
      getPostsForSlot: jest.fn().mockResolvedValue([]),
    };
    const integrations = { getIntegrationById: jest.fn().mockResolvedValue({ id: 'channel', name: 'Test channel', providerIdentifier: 'tiktok' }) };
    const tool = new IntegrationSchedulePostTool(posts as any, integrations as any).run();
    const input = { socialPost: [{ integrationId: 'channel', isPremium: false,
      date: new Date(Date.now() + 86400000).toISOString(), shortLink: false, type: 'schedule',
      postsAndComments: [{ content: '<p>Buổi sáng xanh</p>', attachments: [media.path] }], settings: [] as Array<{key: string; value: unknown}> }] };
    expect(tool.inputSchema.safeParse(input).success).toBe(true);
    const result = await tool.execute!(input as any, context('tenant') as any);
    expect(result).toMatchObject({ calendarUrl: 'http://localhost:4200/launches', output: [expect.objectContaining({ type: 'schedule' })] });
    expect(posts.createPost).toHaveBeenCalledWith('tenant', expect.objectContaining({ type: 'schedule',
      posts: [expect.objectContaining({ value: [expect.objectContaining({ image: [expect.objectContaining({ path: media.path })] })] })] }), 'MCP');
  });
});
