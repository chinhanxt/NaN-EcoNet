jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({ PostsService: class {} }));
jest.mock('@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service', () => ({ AgyMcpService: class {} }));
import { AgentGraphInsertService } from '../../libraries/nestjs-libraries/src/agent/agent.graph.insert.service';

describe('native popular-post classification', () => {
  it('classifies through native schemas before saving the original post', async () => {
    const createPopularPosts = jest.fn(async () => ({}));
    const analyzeJson = jest.fn(async (request: any) => {
      const key = request.schema.required[0];
      return { [key]: ({ category: 'Environment', topic: 'Water', hook: 'Save water.' } as Record<string, string>)[key] };
    });
    const graph = new AgentGraphInsertService({ createPopularPosts } as any, { analyzeJson } as any);
    await graph.newPost('Save water. Reuse rainwater for plants.');
    expect(analyzeJson).toHaveBeenCalledTimes(3);
    expect(createPopularPosts).toHaveBeenCalledWith({ category: 'Environment', topic: 'Water', hook: 'Save water.', content: 'Save water. Reuse rainwater for plants.' });
  });
  it('does not save when native classification fails validation', async () => {
    const createPopularPosts = jest.fn();
    const graph = new AgentGraphInsertService({ createPopularPosts } as any, { analyzeJson: async () => ({ category: 7 }) } as any);
    await expect(graph.newPost('Save water.')).rejects.toThrow();
    expect(createPopularPosts).not.toHaveBeenCalled();
  });
});
