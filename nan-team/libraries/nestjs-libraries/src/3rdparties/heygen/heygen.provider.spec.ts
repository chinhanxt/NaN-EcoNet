jest.mock('@gitroom/nestjs-libraries/videos/agy-mcp/agy.mcp.service', () => ({ AgyMcpService: class {} }));

import { HeygenProvider } from './heygen.provider';

describe('HeygenProvider.generateVoice via AGY', () => {
  it('returns the structured voice script from AGY analyzeJson', async () => {
    const agy = { analyzeJson: jest.fn().mockResolvedValue({ voice: 'Xin chào... hôm nay' }) };
    const provider = new HeygenProvider(agy as any);
    expect(await provider.generateVoice('key', { text: 'Xin chào - hôm nay' })).toEqual({ voice: 'Xin chào... hôm nay' });
    const [request] = agy.analyzeJson.mock.calls[0];
    expect(request.prompt).toContain('prompt: Xin chào - hôm nay');
    expect(request.prompt).toContain('Keep the language of the post');
    expect(request.schema.required).toEqual(['voice']);
  });
});
