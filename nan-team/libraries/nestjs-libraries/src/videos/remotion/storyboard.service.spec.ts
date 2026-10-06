jest.mock('../../upload/upload.factory', () => ({ UploadFactory: {} }));
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AgyMcpService } from '../agy-mcp/agy.mcp.service';
import { assertAiVideoAssetUrl } from '../video.asset';
import { RenderVideoDto } from './dto/ai.video.dto';
import { StoryboardService, WORD_BUDGET_SLACK, duplicatesSpokenLine, extractStoryboardJson, hookOverlay, repairStoryboardCheaply, topicItems, unlicensedSources } from './storyboard.service';
import { numberedItems, statisticKeys, unsupportedStatistics } from './storyboard.service';

const input = { topic: 'Cà phê buổi sáng', targetDuration: 15 as const, voice: 'vi-VN-HoaiMyNeural' };
function script() {
  return {
    title: 'Buổi sáng', visualDna: 'Subject: woman. Environment: cafe. Color Palette: warm. Art Style: cinematic.',
    scenes: [14, 14, 14, 14].map((words, sceneIndex) => ({
      sceneIndex, voiceText: `${sceneIndex === 3 ? 'hãy ' : 'cà '}${Array(words - 2).fill('cà').join(' ')} ý${'abcdefghijkl'[sceneIndex]}${sceneIndex ? '' : '?'}`, keywordHighlight: 'cà', imagePrompt: 'Woman at cafe',
    })),
  };
}
const FACTS = { facts: [
  { claim: 'Người trưởng thành nên uống khoảng 2 lít nước mỗi ngày.', basis: 'Bộ Y tế Việt Nam', confidence: 'high' },
  { claim: 'Một chai nhựa cần hàng trăm năm để phân hủy.', basis: 'UNEP', confidence: 'high' },
  { claim: 'Đèn LED tiết kiệm 80% điện so với bóng sợi đốt.', basis: 'uncertain estimate', confidence: 'low' },
] };
function stubGateway() {
  return {
    content: jest.fn().mockResolvedValue(JSON.stringify(script())),
    facts: jest.fn().mockResolvedValue(JSON.stringify(FACTS)),
    image: jest.fn().mockResolvedValue('http://localhost:4200/uploads/generated.png'),
  };
}
// Compose a single provider response while keeping fact/script fixtures independent.
function agy(gateway: ReturnType<typeof stubGateway>) {
  let facts: Promise<string> | undefined;
  return {
    content: async (prompt: string, seed?: string, signal?: AbortSignal) => {
      facts ??= gateway.facts(prompt);
      const content = await gateway.content(prompt, seed, signal);
      try {
        return JSON.stringify({ ...JSON.parse(content), ...JSON.parse(await facts!) });
      } catch { return content; }
    },
    image: gateway.image,
  } as unknown as AgyMcpService;
}

describe('StoryboardService', () => {
  beforeEach(() => { process.env.FRONTEND_URL = 'http://localhost:4200'; delete process.env.AGY_IMAGE_GATEWAY_URL; });
  it('extracts fenced and CLI-wrapped JSON', () => {
    expect(extractStoryboardJson('```json\n{"title":"a"}\n```')).toEqual({ title: 'a' });
    expect(extractStoryboardJson('CLI status\n{"title":"b"}\nDone')).toEqual({ title: 'b' });
    expect(() => extractStoryboardJson('not JSON')).toThrow();
  });
  it('validates facts and script from one AGY call before starting images', async () => {
    const provider = {
      content: jest.fn().mockResolvedValue(JSON.stringify({ ...script(), ...FACTS })),
      image: jest.fn().mockResolvedValue('http://localhost:4200/uploads/generated.png'),
    };
    const onCheckpoint = jest.fn().mockResolvedValue(undefined);
    const result = await new StoryboardService(provider as unknown as AgyMcpService)
      .generate(input, undefined, { onCheckpoint });
    expect(provider.content).toHaveBeenCalledTimes(1);
    expect(result.grounding).toEqual({ method: 'agy-self-check', verified: false, label: 'AI tự kiểm (chưa xác minh nguồn)',
      facts: FACTS.facts.slice(0, 2).map(({ claim, basis }) => ({ claim, basis, verified: false })), rejectedClaims: 1 });
    expect(onCheckpoint.mock.invocationCallOrder[0]).toBeLessThan(provider.image.mock.invocationCallOrder[0]);
    expect(provider.image).toHaveBeenCalledTimes(4);
    const prompt = provider.content.mock.calls[0][0];
    expect(prompt).toContain('FACTUAL SELF-CHECK');
    expect(prompt).toContain('TWO nonnumeric content words');
    expect(prompt).toContain('WHOLE scene 0 voiceText must end');
    expect(prompt).toContain('Omit excess facts');
  });
  it('cannot legalize an invented number by changing facts during repair', async () => {
    const invented = script();
    invented.scenes[1].voiceText = invented.scenes[1].voiceText.replace('cà cà', 'cà 80 phút');
    const provider = {
      content: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ ...invented, ...FACTS }))
        .mockResolvedValue(JSON.stringify({ ...invented, facts: [
          { claim: invented.scenes[1].voiceText, basis: 'invented', confidence: 'high' },
        ] })),
      image: jest.fn(),
    };
    await expect(new StoryboardService(provider as unknown as AgyMcpService).generate(input))
      .rejects.toThrow('numbers not present in FACTS (80)');
    expect(provider.content).toHaveBeenCalledTimes(3);
    expect(provider.content.mock.calls[1][0]).toContain('FIXED FACTS');
    expect(provider.image).not.toHaveBeenCalled();
  });
  it('requires self-check notes and rejects numbers when all notes are filtered out', async () => {
    const invented = script();
    invented.scenes[1].voiceText = invented.scenes[1].voiceText.replace('cà cà', 'cà 80 phút');
    const provider = {
      content: jest.fn().mockResolvedValueOnce(JSON.stringify(script()))
        .mockResolvedValue(JSON.stringify({ ...invented, facts: [null,
          { claim: invented.scenes[1].voiceText, basis: 'uncertain', confidence: 'low' },
          { claim: invented.scenes[1].voiceText, basis: '', confidence: 'high' },
        ] })),
      image: jest.fn(),
    };
    await expect(new StoryboardService(provider as unknown as AgyMcpService).generate(input))
      .rejects.toThrow('numbers not present in FACTS (80)');
    expect(provider.content.mock.calls[1][0]).toContain('Expected top-level facts array');
    expect(provider.image).not.toHaveBeenCalled();
  });
  it('uses the seed for scene zero and applies analyzed DNA to parallel AGY images', async () => {
    const gateway = stubGateway();
    const seedImageUrl = 'http://localhost:4200/uploads/2026/09/28/seed.png';
    const result = await new StoryboardService(agy(gateway)).generate({ ...input, seedImageUrl });
    expect(gateway.content).toHaveBeenCalledWith(expect.stringContaining('attached seed image'), seedImageUrl, undefined);
    expect(gateway.image).toHaveBeenCalledTimes(3);
    expect(result.scenes[0].imageUrl).toBe(seedImageUrl);
    expect(result.scenes.every((s) => s.imagePrompt.includes(result.visualDna))).toBe(true);
  });
  it('repairs malformed JSON and budget violations before any image generation', async () => {
    const gateway = stubGateway();
    const invalid = script(); invalid.scenes[0].voiceText = 'cà';
    gateway.content.mockResolvedValueOnce('malformed').mockResolvedValueOnce(JSON.stringify(invalid));
    await new StoryboardService(agy(gateway)).generate(input);
    expect(gateway.content).toHaveBeenCalledTimes(3);
    expect(gateway.content.mock.calls[2][0]).toContain('Narration has');
    expect(gateway.image).toHaveBeenCalledTimes(4);
  });
  it.each([
    { duration: 30 as const, sceneCount: 6, words: 108 },
    { duration: 60 as const, sceneCount: 11, words: 220 },
  ])('enforces $duration second budgets', async ({ duration, sceneCount, words }) => {
    const gateway = stubGateway();
    const generated = script();
    generated.scenes = Array.from({ length: sceneCount }, (_, sceneIndex) => ({
      sceneIndex, voiceText: `${sceneIndex === sceneCount - 1 ? 'hãy ' : 'cà '}${Array(words / sceneCount - 2).fill('cà').join(' ')} ý${'abcdefghijkl'[sceneIndex]}${sceneIndex ? '' : '?'}`,
      keywordHighlight: 'cà', imagePrompt: 'Woman at cafe',
    }));
    gateway.content.mockResolvedValue(JSON.stringify(generated));
    const result = await new StoryboardService(agy(gateway)).generate({ ...input, targetDuration: duration });
    expect(result.scenes).toHaveLength(sceneCount);
    expect(gateway.image).toHaveBeenCalledTimes(sceneCount);
    expect(gateway.content.mock.calls[0][0]).toContain(`Exactly ${sceneCount} scenes`);
  });
  it('renumbers sceneIndex in code but repairs highlights absent from narration via AGY', async () => {
    const gateway = stubGateway();
    const reordered = script(); reordered.scenes[0].sceneIndex = 1;
    gateway.content.mockResolvedValueOnce(JSON.stringify(reordered));
    await new StoryboardService(agy(gateway)).generate(input);
    expect(gateway.content).toHaveBeenCalledTimes(1);
    const absent = script(); absent.scenes[0].keywordHighlight = 'absent';
    gateway.content.mockClear().mockResolvedValueOnce(JSON.stringify(absent));
    await new StoryboardService(agy(gateway)).generate(input);
    expect(gateway.content.mock.calls[1][0]).toContain('must occur');
  });
  describe('cheap code repairs before an AGY round', () => {
    const budget = { minWords: 52, maxWords: 60 };
    it('renumbers indices, snaps highlights to the verbatim span and tolerates a small length miss', () => {
      const raw = { scenes: [
        { sceneIndex: 1, voiceText: 'Ánh sáng xanh làm chậm tiết Melatonin, gây khó ngủ.', keywordHighlight: 'tiet melatonin' },
        { sceneIndex: 1, voiceText: 'Hãy giữ phòng mát khoảng 18–20°C mỗi đêm.', keywordHighlight: 'phòng mát 18–20°C' },
        { sceneIndex: 2, voiceText: 'Đi ngủ đúng giờ.', keywordHighlight: 'hoàn toàn khác' },
      ] };
      const fixes = repairStoryboardCheaply(raw, { minWords: 22 + WORD_BUDGET_SLACK, maxWords: 40 });
      expect(raw.scenes.map((scene) => scene.sceneIndex)).toEqual([0, 1, 2]);
      expect(raw.scenes[0].keywordHighlight).toBe('tiết Melatonin');
      expect(raw.scenes[1].keywordHighlight).toBe('phòng mát');
      expect(raw.scenes[2].keywordHighlight).toBe('hoàn toàn khác');
      expect(fixes).toEqual(expect.arrayContaining(['renumbered sceneIndex', expect.stringContaining('tolerated')]));
      expect(repairStoryboardCheaply({ scenes: [{ sceneIndex: 0, voiceText: 'a b', keywordHighlight: 'a' }] }, budget)).toEqual([]);
    });
    it('swaps a false causal/contrast opener for an unused additive one of the same length', () => {
      const raw = { scenes: [
        { sceneIndex: 0, voiceText: 'Bạn có biết màn hình làm chậm tiết melatonin?', keywordHighlight: 'tiết melatonin' },
        { sceneIndex: 1, voiceText: 'Thêm nữa, phòng ngủ mát giúp dễ ngủ sâu.', keywordHighlight: 'phòng ngủ mát' },
        { sceneIndex: 2, voiceText: 'Vì vậy, người trưởng thành cần 7–9 giờ ngủ mỗi đêm.', keywordHighlight: '7–9 giờ ngủ' },
        { sceneIndex: 3, voiceText: 'Nhưng đi ngủ đúng giờ mỗi ngày là thói quen tốt.', keywordHighlight: 'đúng giờ' },
        { sceneIndex: 4, voiceText: 'Chính vì vậy hãy tắt màn hình trước khi ngủ.', keywordHighlight: 'tắt màn hình' },
      ] };
      const facts = [{ claim: 'Người trưởng thành cần 7–9 giờ ngủ mỗi đêm.', basis: 'NSF', verified: false as const }];
      const fixes = repairStoryboardCheaply(raw, { minWords: 1, maxWords: 999 }, facts);
      // Scene 2: a FACTS number after "Vì vậy" is a false cause.
      expect(raw.scenes[2].voiceText).toBe('Ngoài ra, người trưởng thành cần 7–9 giờ ngủ mỗi đêm.');
      // Scene 3: "Nhưng" with no contrast cue.
      expect(raw.scenes[3].voiceText).toBe('Và đi ngủ đúng giờ mỗi ngày là thói quen tốt.');
      // Scene 4: the previous scene does not state a cause.
      expect(raw.scenes[4].voiceText).toBe('Bên cạnh đó hãy tắt màn hình trước khi ngủ.');
      expect(raw.scenes[1].voiceText).toBe('Thêm nữa, phòng ngủ mát giúp dễ ngủ sâu.');
      expect(fixes).toEqual([expect.stringContaining('scene 2 connective'), expect.stringContaining('scene 3 connective'),
        expect.stringContaining('scene 4 connective')]);
    });
    describe('unlicensed source attributions (idea60 job 43c8509c: "…5 mẹo từ EVN")', () => {
      const energy = '5 mẹo tiết kiệm điện trong gia đình: 1) tắt thiết bị ở chế độ chờ; 2) dùng bóng đèn LED; 3) đặt điều hòa 26 độ; 4) giặt đồ bằng nước lạnh; 5) rút sạc khi pin đầy.';
      const open = { minWords: 1, maxWords: 999 };
      const board = (first: string) => ({
        scenes: [{ sceneIndex: 0, voiceText: first, keywordHighlight: '5 mẹo' },
          { sceneIndex: 1, voiceText: 'Đầu tiên, hãy tắt thiết bị ở chế độ chờ.', keywordHighlight: 'chế độ chờ' }],
        hook: { chosen: first, overlay: '5 mẹo từ EVN', candidates: [{ text: first }] },
      });
      it('drops a trailing "từ X" the topic and FACTS never name, in narration and the hook decision', () => {
        const raw = board('Tiền điện tăng vọt vì bỏ qua 5 mẹo từ EVN.');
        const fixes = repairStoryboardCheaply(raw, open, [], energy);
        expect(raw.scenes[0].voiceText).toBe('Tiền điện tăng vọt vì bỏ qua 5 mẹo.');
        expect(raw.hook.chosen).toBe('Tiền điện tăng vọt vì bỏ qua 5 mẹo.');
        expect(raw.hook.candidates[0].text).toBe('Tiền điện tăng vọt vì bỏ qua 5 mẹo.');
        expect(raw.hook.overlay).toBe('5 mẹo');
        expect(fixes).toEqual(expect.arrayContaining(['scene 0 voiceText dropped an unlicensed source attribution']));
      });
      it('keeps a source the topic or a real FACTS basis names', () => {
        const named = board('Tiền điện tăng vọt vì bỏ qua 5 mẹo từ EVN.');
        repairStoryboardCheaply(named, open, [], `${energy} Nguồn: EVN.`);
        expect(named.scenes[0].voiceText).toBe('Tiền điện tăng vọt vì bỏ qua 5 mẹo từ EVN.');
        const fact = { claim: 'Đặt điều hòa 26 độ giúp tiết kiệm điện.', basis: 'Tập đoàn Điện lực Việt Nam (EVN)', verified: false as const };
        const based = board('Tiền điện tăng vọt vì bỏ qua 5 mẹo từ EVN.');
        repairStoryboardCheaply(based, open, [fact], energy);
        expect(based.scenes[0].voiceText).toBe('Tiền điện tăng vọt vì bỏ qua 5 mẹo từ EVN.');
        // A basis the attribution check rejected ("no specific source") licenses nothing.
        const unattributed = board('Tiền điện tăng vọt vì bỏ qua 5 mẹo từ EVN.');
        repairStoryboardCheaply(unattributed, open, [{ ...fact, basis: 'Không có nguồn cụ thể cho dữ kiện này' }], energy);
        expect(unattributed.scenes[0].voiceText).toBe('Tiền điện tăng vọt vì bỏ qua 5 mẹo.');
      });
      it('drops a leading "Theo X," clause and recapitalizes', () => {
        const raw = board('Theo Bộ Y tế, tắt thiết bị chờ giúp giảm tiền điện?');
        repairStoryboardCheaply(raw, open, [], energy);
        expect(raw.scenes[0].voiceText).toBe('Tắt thiết bị chờ giúp giảm tiền điện?');
        const licensed = board('Theo Bộ Y tế, tắt thiết bị chờ giúp giảm tiền điện?');
        repairStoryboardCheaply(licensed, open, [], `${energy} (Bộ Y tế)`);
        expect(licensed.scenes[0].voiceText).toBe('Theo Bộ Y tế, tắt thiết bị chờ giúp giảm tiền điện?');
      });
      it('flags other attributions for the AGY repair but never product acronyms or places', () => {
        expect(unlicensedSources('EVN khuyến nghị đặt điều hòa 26 độ cả ngày.', energy)).toEqual(['EVN']);
        expect(unlicensedSources('Dữ liệu của WHO cho thấy điều này.', energy)).toEqual(['WHO']);
        expect(unlicensedSources('Hãy dùng bóng đèn LED từ hôm nay, tắt TV và mua đồ từ Sài Gòn.', energy)).toEqual([]);
        expect(unlicensedSources('Tập đoàn Điện lực Việt Nam cho biết điều hòa tốn điện.', energy)).toEqual(['Tập đoàn Điện lực Việt Nam']);
        expect(unlicensedSources('WHO khuyến nghị 150 phút vận động.', 'Vận động',
          [{ claim: 'Người lớn nên vận động 150 phút mỗi tuần.', basis: 'WHO', verified: false }])).toEqual([]);
      });
    });
    it('keeps a real cause and a real contrast', () => {
      const raw = { scenes: [
        { sceneIndex: 0, voiceText: 'Thiếu ngủ khiến trí nhớ giảm sút?', keywordHighlight: 'trí nhớ' },
        { sceneIndex: 1, voiceText: 'Vì vậy hãy ngủ đủ giấc mỗi đêm.', keywordHighlight: 'ngủ đủ giấc' },
        { sceneIndex: 2, voiceText: 'Nhưng nhiều người vẫn thức khuya.', keywordHighlight: 'thức khuya' },
      ] };
      expect(repairStoryboardCheaply(raw, { minWords: 1, maxWords: 999 })).toEqual([]);
      expect(raw.scenes[1].voiceText).toBe('Vì vậy hãy ngủ đủ giấc mỗi đêm.');
    });
    it('accepts narration within the slack without an AGY repair, rejects beyond it', async () => {
      const gateway = stubGateway();
      // script() narrates 56 tokens against a 52-60 budget; trim scenes 1-2 (keeping >= 10 tokens each).
      const trim = (draft: ReturnType<typeof script>, drop: number) => {
        draft.scenes[1].voiceText = draft.scenes[1].voiceText.split(' ').slice(Math.ceil(drop / 2)).join(' ');
        draft.scenes[2].voiceText = draft.scenes[2].voiceText.split(' ').slice(Math.floor(drop / 2)).join(' ');
        return draft;
      };
      const short = trim(script(), 4 + WORD_BUDGET_SLACK);
      gateway.content.mockResolvedValueOnce(JSON.stringify(short));
      await new StoryboardService(agy(gateway)).generate(input);
      expect(gateway.content).toHaveBeenCalledTimes(1);
      const shorter = trim(script(), 5 + WORD_BUDGET_SLACK);
      gateway.content.mockClear().mockResolvedValueOnce(JSON.stringify(shorter));
      await new StoryboardService(agy(gateway)).generate(input);
      expect(gateway.content.mock.calls[1][0]).toContain('Narration has');
    });
  });
  it('rejects invalid scripts after three attempts without making images', async () => {
    const gateway = stubGateway(); gateway.content.mockResolvedValue('{}');
    await expect(new StoryboardService(agy(gateway)).generate(input)).rejects.toThrow('after 3 attempts');
    expect(gateway.image).not.toHaveBeenCalled();
  });
  it('propagates gateway content/image failures without fabricated output', async () => {
    const gateway = stubGateway(); gateway.content.mockRejectedValueOnce(new Error('gateway offline'));
    const service = new StoryboardService(agy(gateway));
    await expect(service.generate(input)).rejects.toThrow('gateway offline');
    expect(gateway.content).toHaveBeenCalledTimes(1);
    gateway.image.mockRejectedValueOnce(new Error('generation failed'));
    await expect(service.generate(input)).rejects.toThrow('generation failed');
  });
  it('retains completed scenes after a provider failure and generates only missing images on resume', async () => {
    const gateway = stubGateway();
    gateway.image.mockResolvedValueOnce('http://localhost:4200/uploads/one.png')
      .mockResolvedValueOnce('http://localhost:4200/uploads/two.png')
      .mockRejectedValueOnce(new Error('503 no model capacity'));
    const service = new StoryboardService(agy(gateway));
    const onCheckpoint = jest.fn().mockResolvedValue(undefined);
    await expect(service.generate(input, undefined, { onCheckpoint })).rejects.toThrow('503');
    const saved = onCheckpoint.mock.calls.at(-1)![0];
    // Scenes run in parallel: the sibling after the failed scene still finishes and is kept.
    expect(Object.keys(saved.images)).toEqual(['0', '1', '3']);
    expect(onCheckpoint.mock.calls[0][0].images).toEqual({});
    gateway.content.mockClear(); gateway.image.mockClear();
    const result = await service.generate(input, undefined, { resume: saved, onCheckpoint });
    expect(gateway.content).not.toHaveBeenCalled();
    expect(gateway.image).toHaveBeenCalledTimes(1);
    expect(result.scenes.map(scene => scene.imageUrl)).toEqual([
      'http://localhost:4200/uploads/one.png', 'http://localhost:4200/uploads/two.png',
      'http://localhost:4200/uploads/generated.png', 'http://localhost:4200/uploads/generated.png',
    ]);
  });
  it('submits scene images concurrently and keeps scene order when they finish out of order', async () => {
    const gateway = stubGateway();
    const pending: ((url: string) => void)[] = [];
    gateway.image.mockImplementation(() => new Promise<string>((resolve) => pending.push(resolve)));
    const onCheckpoint = jest.fn().mockResolvedValue(undefined);
    const run = new StoryboardService(agy(gateway)).generate(input, undefined, { onCheckpoint });
    for (let i = 0; i < 20 && pending.length < 4; i++) await new Promise((resolve) => setImmediate(resolve));
    expect(pending).toHaveLength(4);
    [3, 1, 0, 2].forEach((index) => pending[index](`http://localhost:4200/uploads/s${index}.png`));
    const result = await run;
    expect(result.scenes.map((scene) => scene.imageUrl)).toEqual([0, 1, 2, 3].map((i) => `http://localhost:4200/uploads/s${i}.png`));
    expect(Object.keys(onCheckpoint.mock.calls.at(-1)![0].images)).toEqual(['0', '1', '2', '3']);
  });
  it('rejects unsafe and out of range saved images before invoking AGY', async () => {
    const gateway = stubGateway(), service = new StoryboardService(agy(gateway));
    for (const images of [{ '0': 'http://169.254.169.254/secret' }, { '4': 'http://localhost:4200/uploads/a.png' }, { '12': 'http://localhost:4200/uploads/a.png' }]) {
      await expect(service.generate(input, undefined, { resume: { script: script(), images } })).rejects.toThrow();
    }
    expect(gateway.content).not.toHaveBeenCalled(); expect(gateway.image).not.toHaveBeenCalled();
  });
  it('does not proceed to images when checkpoint persistence fails', async () => {
    const gateway = stubGateway(), service = new StoryboardService(agy(gateway));
    await expect(service.generate(input, undefined, { onCheckpoint: async () => { throw new Error('Disk full'); } })).rejects.toThrow('Disk full');
    expect(gateway.image).not.toHaveBeenCalled();
  });
  it('rejects invalid input before gateway access and validates regeneration', async () => {
    const gateway = stubGateway(); const service = new StoryboardService(agy(gateway));
    await expect(service.generate({ ...input, targetDuration: 20 as 15 })).rejects.toThrow('Invalid storyboard');
    await expect(service.generate({ ...input, topic: '   ' })).rejects.toThrow('Invalid storyboard');
    expect(gateway.content).not.toHaveBeenCalled();
    await expect(service.regenerateImage({ imagePrompt: '', visualDna: '' })).rejects.toThrow();
    await expect(service.regenerateImage({ imagePrompt: 'a scene', visualDna: 'warm cinema' })).resolves.toEqual({ imageUrl: 'http://localhost:4200/uploads/generated.png' });
    expect(gateway.image).toHaveBeenCalledWith(expect.stringContaining('warm cinema'));
  });
  it('validates nested render scene fields and consecutive scene indices', () => {
    const data = { ...input, title: 'Title', scenes: script().scenes.map((s) => ({ ...s, imageUrl: 'http://localhost:4200/uploads/a.png' })) };
    expect(validateSync(plainToInstance(RenderVideoDto, data))).toHaveLength(0);
    data.scenes[1].imageUrl = 'http://169.254.169.254/latest/meta-data';
    expect(validateSync(plainToInstance(RenderVideoDto, data)).length).toBeGreaterThan(0);
    data.scenes[1].sceneIndex = 0;
    expect(validateSync(plainToInstance(RenderVideoDto, data)).some((e) => e.constraints?.AiVideoSceneSequence)).toBe(true);
  });
  it.each([
    'http://localhost:4200/uploads/../secret',
    'http://localhost:4200/uploads/%2e%2e/secret',
    'http://localhost:4200/uploads/%252e%252e/secret',
    'http://localhost:4200/uploads/%2f..%2fsecret',
    'http://user:pass@localhost:4200/uploads/a.png',
    'http://localhost:4200/uploads/a.png?redirect=http://evil.test',
    'http://evil.test/images/a.png',
    'file:///etc/passwd',
  ])('rejects unsafe asset URL %s', (value) => { expect(() => assertAiVideoAssetUrl(value)).toThrow(); });
  it('resumes a checkpoint saved under the previous shorter word budget', async () => {
    const gateway = stubGateway();
    // Previous checkpoint shape: 3 scenes of 13 identical tokens (40-word budget).
    const legacy = script();
    legacy.scenes = legacy.scenes.slice(0, 3);
    legacy.scenes.forEach((scene) => { scene.voiceText = Array(13).fill('cà').join(' '); });
    const images = { 0: 'http://localhost:4200/uploads/a.png', 1: 'http://localhost:4200/uploads/b.png',
      2: 'http://localhost:4200/uploads/c.png' };
    const result = await new StoryboardService(agy(gateway))
      .generate(input, undefined, { resume: { script: legacy, images } });
    expect(gateway.content).not.toHaveBeenCalled();
    expect(gateway.image).not.toHaveBeenCalled();
    expect(result.scenes).toHaveLength(3);
  });
  it('requests a hook/body/payoff arc and rejects thin or repeated scenes before images', async () => {
    const gateway = stubGateway();
    const thin = script(); thin.scenes[1].voiceText = `${Array(5).fill('cà').join(' ')} x`;
    thin.scenes[0].voiceText = Array(22).fill('cà').join(' ');
    const repeated = script(); repeated.scenes[2].voiceText = repeated.scenes[1].voiceText.toUpperCase() + '.';
    gateway.content.mockResolvedValueOnce(JSON.stringify(thin)).mockResolvedValueOnce(JSON.stringify(repeated));
    const result = await new StoryboardService(agy(gateway)).generate(input);
    const prompts = gateway.content.mock.calls.map((call) => call[0] as string);
    expect(prompts[0]).toMatch(/HOOK[\s\S]*BODY[\s\S]*PAYOFF/);
    expect(prompts[0]).toContain('Exactly 4 scenes');
    expect(prompts[1]).toContain('too thin');
    expect(prompts[2]).toContain('repeat the same narration');
    expect(result.scenes).toHaveLength(4);
    expect(gateway.image).toHaveBeenCalledTimes(4);
  });
  it('rejects fresh scripts using the previous scene count', async () => {
    const gateway = stubGateway();
    const old = script(); old.scenes = old.scenes.slice(0, 3);
    old.scenes.forEach((scene, index) => { scene.voiceText = `${Array(18).fill('cà').join(' ')} ý${'abc'[index]}`; });
    gateway.content.mockResolvedValueOnce(JSON.stringify(old));
    await new StoryboardService(agy(gateway)).generate(input);
    expect(gateway.content.mock.calls[1][0]).toContain('Expected exactly 4 scenes');
  });
  it('grounds the script in self-checked facts, stores them in the checkpoint and rejects invented numbers', async () => {
    const gateway = stubGateway();
    const invented = script(); invented.scenes[1].voiceText = invented.scenes[1].voiceText.replace('cà cà', 'cà 80 phút');
    const grounded = script(); grounded.scenes[1].voiceText = grounded.scenes[1].voiceText.replace('cà cà', 'cà 2 lít');
    gateway.content.mockResolvedValueOnce(JSON.stringify(invented)).mockResolvedValueOnce(JSON.stringify(grounded));
    const onCheckpoint = jest.fn().mockResolvedValue(undefined);
    await new StoryboardService(agy(gateway)).generate(input, undefined, { onCheckpoint });
    expect(gateway.facts).toHaveBeenCalledTimes(1);
    expect(gateway.facts.mock.calls[0][0]).toContain('Never invent or estimate statistics');
    const prompts = gateway.content.mock.calls.map((call) => call[0] as string);
    expect(prompts[0]).toContain('CONTINUOUS VOICE-OVER');
    expect(prompts[1]).toContain('2 lít nước');
    expect(prompts[0]).not.toContain('80%');
    expect(prompts[1]).toContain('numbers not present in FACTS (80)');
    const grounding = onCheckpoint.mock.calls[0][0].grounding;
    expect(grounding).toMatchObject({ method: 'agy-self-check', rejectedClaims: 1 });
    expect(grounding.facts).toHaveLength(2);
    // Resume reuses stored grounding without a new fact pass.
    gateway.facts.mockClear();
    await new StoryboardService(agy(gateway)).generate(input, undefined, { resume: onCheckpoint.mock.calls.at(-1)![0] });
    expect(gateway.facts).not.toHaveBeenCalled();
  });
  it('forbids statistics when the self-check returns no facts', async () => {
    const gateway = stubGateway();
    gateway.facts.mockResolvedValueOnce(JSON.stringify({ facts: [] }));
    await new StoryboardService(agy(gateway)).generate(input);
    expect(gateway.content.mock.calls[0][0]).toContain('do not use any statistics or numbers');
  });
  it('repairs a plain-statement hook and a generic payoff (live job c17e9f4f regression)', async () => {
    const gateway = stubGateway();
    const pad = (text: string) => `${text} ${Array(Math.max(0, 14 - text.split(' ').length)).fill('cà').join(' ')}`.trim();
    const live = script();
    live.scenes[0].voiceText = pad('Mang bình nước inox giúp cắt giảm đáng kể chai nhựa dùng một lần.');
    live.scenes[0].keywordHighlight = 'bình nước inox';
    const genericPayoff = script();
    genericPayoff.scenes[3] = { ...genericPayoff.scenes[3], keywordHighlight: 'sống xanh',
      voiceText: 'Cuối cùng, hãy chọn sống xanh ngay hôm nay để bảo vệ môi trường thật tốt nhé.' };
    const numberHook = script();
    numberHook.scenes[0].voiceText = pad('Mỗi tuần chỉ cần 150 phút đi bộ,');
    numberHook.scenes[0].keywordHighlight = '150 phút';
    gateway.facts.mockResolvedValueOnce(JSON.stringify({ facts: [...FACTS.facts,
      { claim: 'WHO khuyến nghị ít nhất 150 phút vận động mỗi tuần.', basis: 'WHO', confidence: 'high' }] }));
    gateway.content.mockResolvedValueOnce(JSON.stringify(live)).mockResolvedValueOnce(JSON.stringify(genericPayoff))
      .mockResolvedValueOnce(JSON.stringify(numberHook));
    const result = await new StoryboardService(agy(gateway)).generate(input);
    const prompts = gateway.content.mock.calls.map((call) => call[0] as string);
    expect(prompts[0]).toContain('A plain descriptive statement or advice is NOT a hook');
    expect(prompts[1]).toContain('Scene 0 is not a hook');
    expect(prompts[2]).toContain('Last scene is a generic call to action');
    expect(result.scenes[0].voiceText).toContain('150 phút');
  });
  it('offers topic-matched hook patterns, accepts an adapted FACTS-entity hook and stores candidates in the checkpoint', async () => {
    const gateway = stubGateway();
    const pad = (text: string) => `${text} ${Array(Math.max(0, 14 - text.split(' ').length)).fill('cà').join(' ')}`.trim();
    const copied = script();
    copied.scenes[0].voiceText = pad('Có một lỗi nhỏ nhưng đang âm thầm phá kênh của bạn.');
    const adapted = { ...script(), hook: {
      candidates: [
        { text: 'Có một lỗi nhỏ khi uống nước mỗi ngày', patternId: 16, scores: { curiosity: 4, specificity: 4, truthfulness: 5, fit: 5 } },
        { text: 'Bạn đã bao giờ tự hỏi uống nước sao cho đủ?', patternId: 11, scores: { curiosity: 3, specificity: 2, truthfulness: 5, fit: 4 } },
      ], chosenPatternId: 16, chosen: 'Có một lỗi nhỏ khi uống nước mỗi ngày' } };
    adapted.scenes[0].voiceText = pad('Có một lỗi nhỏ khi uống nước mỗi ngày.');
    gateway.content.mockResolvedValueOnce(JSON.stringify(copied)).mockResolvedValueOnce(JSON.stringify(adapted));
    const onCheckpoint = jest.fn().mockResolvedValue(undefined);
    await new StoryboardService(agy(gateway)).generate(input, undefined, { onCheckpoint });
    const prompts = gateway.content.mock.calls.map((call) => call[0] as string);
    expect(prompts[0]).toContain('HOOK PATTERNS');
    expect(prompts[0]).toContain('P16 [Tạo Cú Móc]');
    expect(prompts[0]).not.toContain('[Review Thẳng]');
    expect(prompts[1]).toContain('copies a generic hook template verbatim');
    const hook = onCheckpoint.mock.calls[0][0].script.hook;
    expect(hook).toMatchObject({ kind: 'general', chosenPatternId: 16, pattern: { category: 'Tạo Cú Móc' } });
    expect(hook.candidates).toHaveLength(2);
    expect(hook.candidates[0].scores.truthfulness).toBe(5);
  });
  describe('hook overlay (idea15 job 3a0ae677 regression: overlay repeated scene 0 line)', () => {
    const scenes = [
      { voiceText: 'Ánh sáng xanh từ màn hình làm chậm tiết melatonin. Nó gây khó ngủ.', keywordHighlight: 'tiết melatonin' },
      { voiceText: 'Đầu tiên, hãy tắt màn hình 30 phút trước khi ngủ.', keywordHighlight: 'tắt màn hình 30 phút' },
    ];
    const decision = (overlay?: string) => ({ chosenPatternId: 27, chosen: 'Ánh sáng xanh từ màn hình làm chậm tiết melatonin.',
      candidates: [
        { text: 'Ánh sáng xanh từ màn hình làm chậm tiết melatonin.', patternId: 27, scores: { curiosity: 5, specificity: 5, truthfulness: 5, fit: 5 } },
        { text: 'Chỉ cần tắt màn hình 30 phút trước khi ngủ.', patternId: 23, scores: { curiosity: 4, specificity: 5, truthfulness: 5, fit: 5 } },
      ], ...(overlay ? { overlay } : {}) });
    const title = '3 Mẹo Ngủ Ngon Cho Người Làm Việc Muộn';
    it('detects verbatim and near duplicates regardless of case and diacritics', () => {
      const spoken = [scenes[0].voiceText];
      expect(duplicatesSpokenLine('ANH SANG XANH TU MAN HINH LAM CHAM TIET MELATONIN', spoken)).toBe(true);
      expect(duplicatesSpokenLine('Ánh sáng xanh làm chậm melatonin', spoken)).toBe(true);
      expect(duplicatesSpokenLine('Màn hình đang đánh cắp giấc ngủ?', spoken)).toBe(false);
      expect(duplicatesSpokenLine('tiết melatonin', ['Ánh sáng xanh từ màn hình làm chậm tiết melatonin.'])).toBe(false);
    });
    it('keeps a short distinct AGY overlay', () => {
      expect(hookOverlay(decision('Màn hình đang đánh cắp giấc ngủ?'), scenes, title)).toBe('Màn hình đang đánh cắp giấc ngủ?');
    });
    it('repairs a duplicate or too-long overlay deterministically and never echoes scene 0', () => {
      const repaired = hookOverlay(decision('Ánh sáng xanh từ màn hình làm chậm tiết melatonin.'), scenes, title)!;
      expect(repaired).toBe('tắt màn hình 30 phút');
      expect(hookOverlay(decision(), scenes, 'Ngủ ngon dù làm muộn')).toBe('Ngủ ngon dù làm muộn');
      expect(hookOverlay(decision('một hai ba bốn năm sáu bảy tám chín mười'), scenes, 'Ngủ ngon dù làm muộn')).toBe('Ngủ ngon dù làm muộn');
      // A fallback with a number outside FACTS is skipped.
      expect(hookOverlay(decision(), scenes, title, [{ claim: 'Ánh sáng xanh làm chậm tiết melatonin.', basis: 'x' }])).toBe('tiết melatonin');
    });
    it('allows topic numbers when grounding kept no facts and refuses unverified statistics', () => {
      // Grounding dropped every fact: the topic's own "3 mẹo"/"30 phút" still license the overlay, as in narration.
      expect(hookOverlay(decision('3 mẹo ngủ ngon sau 30 phút'), scenes, title, [], '3 mẹo ngủ ngon: tắt màn hình 30 phút')).toBe('3 mẹo ngủ ngon sau 30 phút');
      expect(hookOverlay(decision('3 mẹo ngủ ngon sau 30 phút'), scenes, title, [])).not.toBe('3 mẹo ngủ ngon sau 30 phút');
      expect(hookOverlay(decision('Ngủ sâu hơn 40%'), scenes, title, [{ claim: 'Ngủ sâu hơn 40%', basis: 'x' }], 'Ngủ ngon')).not.toBe('Ngủ sâu hơn 40%');
      expect(statisticKeys('Tủ lạnh chạy 24/7 nên tốn điện.')).toEqual([]);
    });
    it('stores a distinct overlay on the generated hook and asks AGY for one', async () => {
      const gateway = stubGateway();
      const pad = (text: string) => `${text} ${Array(Math.max(0, 14 - text.split(' ').length)).fill('cà').join(' ')}`.trim();
      const adapted = { ...script(), title: 'Uống nước đúng cách mỗi ngày', hook: {
        candidates: [{ text: 'Có một lỗi nhỏ khi uống nước mỗi ngày', patternId: 16, scores: { curiosity: 4, specificity: 4, truthfulness: 5, fit: 5 } }],
        chosenPatternId: 16, chosen: 'Có một lỗi nhỏ khi uống nước mỗi ngày', overlay: 'Có một lỗi nhỏ khi uống nước' } };
      adapted.scenes[0].voiceText = pad('Có một lỗi nhỏ khi uống nước mỗi ngày.');
      gateway.content.mockResolvedValueOnce(JSON.stringify(adapted));
      const onCheckpoint = jest.fn().mockResolvedValue(undefined);
      await new StoryboardService(agy(gateway)).generate(input, undefined, { onCheckpoint });
      expect(gateway.content.mock.calls[0][0]).toContain('"overlay" is the on-screen hook text');
      const hook = onCheckpoint.mock.calls[0][0].script.hook;
      expect(hook.chosen).toBe('Có một lỗi nhỏ khi uống nước mỗi ngày');
      expect(hook.overlay).toBe('Uống nước đúng cách mỗi ngày');
    });
  });
  it('still rejects a pattern hook without a concrete FACTS entity and routes tutorial topics to how-to patterns', async () => {
    const gateway = stubGateway();
    const pad = (text: string) => `${text} ${Array(Math.max(0, 14 - text.split(' ').length)).fill('cà').join(' ')}`.trim();
    const vague = { ...script(), hook: { candidates: [] as unknown[], chosenPatternId: 26, chosen: 'Cách mình pha cà phê ngon hơn' } };
    vague.scenes[0].voiceText = pad('Cách mình pha cà phê ngon hơn.');
    gateway.content.mockResolvedValueOnce(JSON.stringify(vague));
    await new StoryboardService(agy(gateway)).generate({ ...input, topic: 'Cách pha cà phê buổi sáng' });
    const prompts = gateway.content.mock.calls.map((call) => call[0] as string);
    expect(prompts[0]).toContain('[Cách Làm Ngay]');
    expect(prompts[0]).not.toContain('[Mở Vòng Lặp]');
    expect(prompts[1]).toContain('Scene 0 is not a hook');
  });
  it('repairs a number moved onto another fact (live job fdd45c92 regression)', async () => {
    const gateway = stubGateway();
    gateway.facts.mockResolvedValueOnce(JSON.stringify({ facts: [
      { claim: 'Người trưởng thành nên vận động ít nhất 150 phút mỗi tuần, chẳng hạn đi bộ nhanh.', basis: 'WHO', confidence: 'high' },
      { claim: 'Tán cây xanh đô thị giúp lọc bụi mịn và làm mát không khí.', basis: 'EPA', confidence: 'high' },
    ] }));
    const pad = (text: string) => `${text} ${Array(Math.max(0, 14 - text.split(' ').length)).fill('cà').join(' ')}`.trim();
    const merged = script();
    merged.scenes[2].voiceText = pad('Tiếp theo, 150 phút đi bộ dưới tán cây xanh giúp lọc bụi mịn.');
    merged.scenes[2].keywordHighlight = '150 phút';
    const separate = script();
    separate.scenes[2].voiceText = pad('Tiếp theo, hãy vận động 150 phút mỗi tuần.');
    separate.scenes[2].keywordHighlight = '150 phút';
    gateway.content.mockResolvedValueOnce(JSON.stringify(merged)).mockResolvedValueOnce(JSON.stringify(separate));
    const result = await new StoryboardService(agy(gateway)).generate(input);
    const prompts = gateway.content.mock.calls.map((call) => call[0] as string);
    expect(prompts[0]).toContain('never move a number from one fact into another claim');
    expect(prompts[1]).toContain('Numbers 150 are attached to the wrong claim');
    expect(prompts).toHaveLength(2);
    expect(result.scenes[2].voiceText).toContain('150 phút mỗi tuần');
  });
  describe('live job a134b487 regression (30s office hydration)', () => {
    const topic = 'Uống nước đúng cách mỗi ngày cho dân văn phòng. Sự thật: nước chiếm khoảng 60% trọng lượng cơ thể người trưởng thành; chỉ cần mất nước khoảng 1–2% trọng lượng cơ thể là sự tập trung và trí nhớ ngắn hạn đã giảm; Cơ quan An toàn Thực phẩm châu Âu (EFSA) khuyến nghị tổng lượng nước mỗi ngày khoảng 2 lít cho nữ và 2,5 lít cho nam, trong đó khoảng 20–30% đến từ thức ăn. Mẹo thực tế: để bình nước trên bàn làm việc, uống một ly khi vừa thức dậy, nhìn màu nước tiểu vàng nhạt là đủ nước. Cảnh minh họa điện ảnh nhất quán, lời kể tiếng Việt tự nhiên; không chữ trong ảnh.';
    const facts = [
      ['Nước chiếm khoảng 60% trọng lượng cơ thể người trưởng thành.', 'Tổ chức Y tế Thế giới (WHO)'],
      ['Chỉ cần mất nước khoảng 1–2% trọng lượng cơ thể là sự tập trung và trí nhớ ngắn hạn đã giảm.', 'Cơ quan An toàn Thực phẩm châu Âu (EFSA)'],
      ['Cơ quan An toàn Thực phẩm châu Âu (EFSA) khuyến nghị tổng lượng nước mỗi ngày khoảng 2 lít cho nữ và 2,5 lít cho nam.', 'Cơ quan An toàn Thực phẩm châu Âu (EFSA)'],
      ['Khoảng 20–30% tổng lượng nước nạp vào cơ thể mỗi ngày đến từ thức ăn.', 'Cơ quan An toàn Thực phẩm châu Âu (EFSA)'],
      ['Màu nước tiểu có sắc vàng nhạt là dấu hiệu cơ thể đã nhận đủ nước.', 'Dịch vụ Y tế Quốc gia Anh (NHS)'],
      ['Để bình nước trên bàn làm việc và uống một ly khi vừa thức dậy giúp bổ sung nước kịp thời.', 'Khuyến cáo an toàn lao động và sức khỏe CDC'],
    ].map(([claim, basis]) => ({ claim, basis, confidence: 'high' }));
    const board = (lines: [string, string][], hook?: unknown) => ({
      title: 'Bí Quyết Uống Nước Chuẩn Khoa Học Cho Dân Văn Phòng', visualDna: 'Subject: office worker. Environment: HCMC office. Color Palette: aqua. Art Style: cinematic.',
      scenes: lines.map(([voiceText, keywordHighlight], sceneIndex) => ({ sceneIndex, voiceText, keywordHighlight, imagePrompt: 'Office worker with water' })),
      facts, ...(hook ? { hook } : {}),
    });
    // Scenes exactly as generated live (build 03:48).
    const live = board([
      ['Cách đơn giản để duy trì sự tập trung theo EFSA. Bạn chỉ cần uống nước đúng cách.', 'sự tập trung'],
      ['Nhưng nước chiếm khoảng 60% trọng lượng cơ thể người trưởng thành. Nó nuôi dưỡng mọi tế bào.', '60% trọng lượng cơ thể'],
      ['Không chỉ vậy, mất nước khoảng 1–2% trọng lượng cơ thể khiến sự tập trung và trí nhớ giảm.', '1–2% trọng lượng cơ thể'],
      ['Vì thế, EFSA khuyến nghị tổng lượng nước mỗi ngày khoảng 2 lít cho nữ và 2,5 lít cho nam.', '2 lít cho nữ và 2,5 lít cho nam'],
      ['Tiếp theo, khoảng 20–30% tổng lượng nước nạp vào cơ thể mỗi ngày vốn đến từ thức ăn.', '20–30% tổng lượng nước'],
      ['Cuối cùng, để duy trì sự tập trung, hãy để bình nước trên bàn làm việc hôm nay.', 'bình nước trên bàn làm việc'],
    ], { candidates: [{ text: 'Cách đơn giản để duy trì sự tập trung theo EFSA.', patternId: 30, scores: { curiosity: 5, specificity: 5, truthfulness: 5, fit: 5 } }],
      chosenPatternId: 30, chosen: 'Cách đơn giản để duy trì sự tập trung theo EFSA.' });
    const fixed = board([
      ['Chỉ cần mất nước khoảng 1–2% trọng lượng cơ thể, sự tập trung và trí nhớ ngắn hạn đã giảm.', '1–2% trọng lượng cơ thể'],
      ['Thực ra nước chiếm khoảng 60% trọng lượng cơ thể người trưởng thành, nên cần bù nước liên tục.', '60% trọng lượng cơ thể'],
      ['Thêm nữa, EFSA khuyến nghị tổng lượng nước mỗi ngày khoảng 2 lít cho nữ và 2,5 lít cho nam.', '2 lít cho nữ'],
      ['Trong đó khoảng 20–30% lượng nước đến từ thức ăn, phần còn lại bạn phải tự uống.', '20–30%'],
      ['Đầu tiên, uống một ly nước ngay khi vừa thức dậy, rồi để bình nước trên bàn làm việc.', 'bình nước trên bàn làm việc'],
      ['Hãy nhìn màu nước tiểu vàng nhạt để biết đủ nước. Ngay hôm nay, nhớ uống đủ 2 lít cho nữ.', 'màu nước tiểu vàng nhạt'],
    ]);

    it('extracts the three listed tips but not the fact list', () => {
      expect(topicItems(topic)).toEqual(['để bình nước trên bàn làm việc', 'uống một ly khi vừa thức dậy', 'nhìn màu nước tiểu vàng nhạt là đủ nước']);
      expect(topicItems('Tập thể dục buổi sáng:\n- Khởi động khớp cổ tay\n2) Chạy bộ chậm 10 phút\n- ok')).toEqual(['Khởi động khớp cổ tay', 'Chạy bộ chậm 10 phút']);
      expect(topicItems('Cà phê buổi sáng')).toEqual([]);
    });

    it('repairs generic hook, missing tips and wrong connectives in one pass, and labels bases as unverified', async () => {
      const provider = {
        content: jest.fn().mockResolvedValueOnce(JSON.stringify(live)).mockResolvedValueOnce(JSON.stringify(fixed)),
        image: jest.fn().mockResolvedValue('http://localhost:4200/uploads/generated.png'),
      };
      const result = await new StoryboardService(provider as unknown as AgyMcpService)
        .generate({ topic, targetDuration: 30, voice: 'Thuyết Minh', aspectRatio: '9:16' });
      const prompts = provider.content.mock.calls.map((call) => call[0] as string);
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toContain('TOPIC ITEMS');
      expect(prompts[0]).toContain('"uống một ly khi vừa thức dậy"');
      expect(prompts[0]).toContain('ACTUAL logical relation');
      expect(prompts[0]).not.toContain('"Vì thế", "Tiếp theo"');
      expect(prompts[1]).toContain('generic formula hook');
      expect(prompts[1]).toContain('Topic tips/steps not covered: "uống một ly khi vừa thức dậy", "nhìn màu nước tiểu vàng nhạt là đủ nước"');
      // False connectives are swapped in code (same token count); AGY only repairs the rest, from the fixed JSON.
      expect(prompts[1]).not.toContain('connective but states no contrast');
      expect(prompts[1]).not.toContain('uses a causal connective');
      expect(prompts[1]).toContain('Và nước chiếm khoảng 60%');
      expect(prompts[1]).toContain('Ngoài ra, EFSA khuyến nghị');
      expect(prompts[1]).not.toContain('scene 2 ');
      expect(result.scenes.map((scene) => scene.voiceText)).toEqual(fixed.scenes.map((scene) => scene.voiceText));
      expect(result.grounding).toMatchObject({ verified: false, label: 'AI tự kiểm (chưa xác minh nguồn)' });
      expect(result.grounding!.facts.every((fact) => fact.verified === false)).toBe(true);
    });

    it('rejects a payoff without a concrete action and a causal connective after a non-cause', async () => {
      const noAction = board(fixed.scenes.map((scene) => [scene.voiceText, scene.keywordHighlight] as [string, string]));
      noAction.scenes[5].voiceText = 'Màu nước tiểu vàng nhạt là dấu hiệu bình nước trên bàn làm việc đang phát huy tác dụng.';
      noAction.scenes[3].voiceText = 'Vì vậy khoảng 20–30% lượng nước đến từ thức ăn, phần còn lại bạn phải tự uống thêm.';
      const provider = {
        content: jest.fn().mockResolvedValueOnce(JSON.stringify(noAction)).mockResolvedValueOnce(JSON.stringify(fixed)),
        image: jest.fn().mockResolvedValue('http://localhost:4200/uploads/generated.png'),
      };
      await new StoryboardService(provider as unknown as AgyMcpService).generate({ topic, targetDuration: 30, voice: 'Thuyết Minh' });
      const repair = provider.content.mock.calls[1][0] as string;
      expect(repair).toContain('Last scene gives no concrete action');
      expect(repair).not.toContain('uses a causal connective');
      expect(repair).toContain('Ngoài ra khoảng 20–30% lượng nước');
    });
  });
  describe('live job 6d8bba01 regression (60s energy tips, invented percentages)', () => {
    const topic = '5 mẹo tiết kiệm điện trong gia đình: 1) tắt thiết bị ở chế độ chờ; 2) dùng bóng đèn LED; 3) đặt điều hòa 26 độ; 4) giặt đồ bằng nước lạnh; 5) rút sạc khi pin đầy.';
    // Self-check facts exactly as AGY returned them live (all verified: false).
    const facts = [
      ['Giặt đồ bằng nước lạnh giúp giảm khoảng 90% điện năng tiêu thụ của máy giặt.', 'Cơ quan Bảo vệ Môi trường Hoa Kỳ (EPA)'],
      ['Thiết bị ở chế độ chờ tiêu thụ khoảng 10% lượng điện năng gia đình.', 'Bộ Năng lượng Hoa Kỳ (DOE)'],
      ['Bóng đèn LED tiêu thụ ít điện năng hơn khoảng 75% so với bóng đèn sợi đốt.', 'Bộ Năng lượng Hoa Kỳ (DOE)'],
      ['Cài đặt điều hòa 26 độ giúp tối ưu hóa điện năng và duy trì độ mát.', 'Tập đoàn Điện lực Việt Nam (EVN)'],
      ['Thói quen rút sạc khi pin đầy giúp ngắt hoàn toàn dòng điện tiêu hao của thiết bị.', 'Tập đoàn Điện lực Việt Nam (EVN)'],
    ].map(([claim, basis]) => ({ claim, basis, confidence: 'high' }));
    const live: [string, string][] = [
      ['Cách giặt đồ bằng nước lạnh nhưng tiết kiệm 90% điện. Bí mật nằm ở việc máy giặt không cần đun nước nóng.', 'tiết kiệm 90% điện'],
      ['Phần lớn điện năng máy giặt tiêu hao là để làm nóng nước, nên nước lạnh vừa sạch vừa giảm tải.', 'nước lạnh vừa sạch'],
      ['Bên cạnh việc giặt giũ, các thiết bị làm mát trong nhà cũng tiêu tốn nguồn năng lượng rất lớn.', 'thiết bị làm mát'],
      ['Việc đặt điều hòa 26 độ giúp duy trì độ mát mẻ và tối ưu hóa điện năng tiêu thụ trong phòng.', 'đặt điều hòa 26 độ'],
      ['Thêm nữa, bạn nên kết hợp bật quạt gió để luồng không khí mát được lan tỏa nhanh hơn.', 'kết hợp bật quạt gió'],
      ['Sau khu vực làm mát, hệ thống chiếu sáng hàng ngày cũng là nơi tiêu thụ điện đáng kể.', 'hệ thống chiếu sáng'],
      ['Lựa chọn dùng bóng đèn LED giúp tiêu thụ ít điện năng hơn khoảng 75% so với bóng đèn sợi đốt.', 'dùng bóng đèn LED'],
      ['Tuy nhiên, nhiều thiết bị ở chế độ chờ vẫn âm thầm tiêu thụ khoảng 10% lượng điện năng gia đình.', 'khoảng 10% lượng điện'],
      ['Giải pháp đơn giản là tắt thiết bị ở chế độ chờ bằng cách dùng ổ cắm có công tắc ngắt điện.', 'tắt thiết bị ở chế độ chờ'],
      ['Ngoài ra, những củ sạc điện tử cắm sẵn trong ổ điện vẫn liên tục tiêu hao năng lượng vô ích.', 'tiêu hao năng lượng'],
      ['Cuối cùng, bạn hãy tắt thiết bị ở chế độ chờ và rút sạc khi pin đầy ngay hôm nay để giảm chi phí.', 'rút sạc khi pin đầy'],
    ];
    const board = (lines: [string, string][]) => ({
      title: '5 mẹo tiết kiệm điện', visualDna: 'Subject: family. Environment: Vietnamese home. Color Palette: warm. Art Style: cinematic.',
      scenes: lines.map(([voiceText, keywordHighlight], sceneIndex) => ({ sceneIndex, voiceText, keywordHighlight, imagePrompt: 'Home energy saving' })),
      facts,
    });
    // Live order with the percentages softened: tips still drift (4, 3, 2, 1, 5) without ordinals.
    const drifted: [string, string][] = live.map((line) => [...line] as [string, string]);
    drifted[0] = ['Vì sao chỉ cần giặt đồ bằng nước lạnh mà hóa đơn tiền điện của cả nhà đã nhẹ đi thấy rõ?', 'giặt đồ bằng nước lạnh'];
    drifted[6] = ['Lựa chọn dùng bóng đèn LED giúp tiêu thụ ít điện năng hơn hẳn so với bóng đèn sợi đốt.', 'dùng bóng đèn LED'];
    drifted[7] = ['Tuy nhiên, nhiều thiết bị ở chế độ chờ vẫn âm thầm tiêu thụ một lượng điện đáng kể mỗi ngày.', 'lượng điện đáng kể'];
    const fixed: [string, string][] = [
      ['Vì sao chỉ cần năm thói quen nhỏ mà hóa đơn tiền điện cả nhà nhẹ đi thấy rõ?', 'hóa đơn tiền điện'],
      ['Đầu tiên, hãy tắt thiết bị ở chế độ chờ, vì tivi và máy tính vẫn âm thầm hút điện dù bạn không dùng.', 'tắt thiết bị ở chế độ chờ'],
      ['Cách dễ nhất là cắm chúng vào ổ cắm có công tắc riêng để ngắt điện chỉ bằng một lần bấm.', 'ổ cắm có công tắc'],
      ['Thứ hai, hãy dùng bóng đèn LED thay cho bóng sợi đốt, vì đèn LED tiêu thụ ít điện năng hơn hẳn.', 'dùng bóng đèn LED'],
      ['Bóng LED cũng ít tỏa nhiệt hơn, nên căn phòng bớt nóng và bạn đỡ phải bật quạt.', 'ít tỏa nhiệt'],
      ['Thứ ba, hãy đặt điều hòa 26 độ, mức này giúp duy trì độ mát và tối ưu hóa điện năng cho cả phòng.', 'đặt điều hòa 26 độ'],
      ['Kết hợp bật thêm quạt gió giúp khí mát lan tỏa nhanh hơn mà máy lạnh không phải chạy hết công suất.', 'quạt gió'],
      ['Tiếp theo, hãy giặt đồ bằng nước lạnh, vì phần lớn điện năng của máy giặt dùng để đun nóng nước.', 'giặt đồ bằng nước lạnh'],
      ['Quần áo hằng ngày vẫn sạch với nước lạnh và bột giặt phù hợp, lại giữ màu vải bền đẹp lâu hơn.', 'giữ màu vải'],
      ['Ngoài ra, nhớ gom đủ một mẻ đầy máy thay vì giặt lặt vặt, để mỗi lần máy chạy thật đáng giá.', 'một mẻ đầy máy'],
      ['Cuối cùng, hãy rút sạc khi pin đầy và tắt thiết bị ở chế độ chờ ngay hôm nay để tiết kiệm điện.', 'rút sạc khi pin đầy'],
    ];

    it('flags percentages/ratios absent from the topic but keeps topic numbers and plain quantities', () => {
      expect(unsupportedStatistics('Cách giặt đồ bằng nước lạnh nhưng tiết kiệm 90% điện.', topic)).toEqual(['90']);
      expect(unsupportedStatistics('Lựa chọn dùng bóng đèn LED giúp tiêu thụ ít điện năng hơn khoảng 75% so với bóng đèn sợi đốt.', topic)).toEqual(['75']);
      expect(unsupportedStatistics('nhiều thiết bị ở chế độ chờ vẫn âm thầm tiêu thụ khoảng 10% lượng điện năng gia đình.', topic)).toEqual(['10']);
      expect(unsupportedStatistics('khoảng 10% lượng điện', topic)).toEqual(['10']);
      expect(unsupportedStatistics('Việc đặt điều hòa 26 độ giúp tối ưu điện năng, đây là mẹo thứ 3 trong 5 mẹo.', topic)).toEqual([]);
      expect(unsupportedStatistics('Máy lạnh inverter tiết kiệm gấp 3 lần, tức chín mươi phần trăm, hay 1/3 hóa đơn.', topic))
        .toEqual(['3', '1', '~chín mươi']);
      expect(unsupportedStatistics('Hóa đơn giảm gấp đôi.', topic)).toEqual(['~đôi']);
      expect(statisticKeys('Uống 2 lít nước, 3 lần mỗi ngày.')).toEqual([]);
      // A figure the user gave (or a verified source) stays allowed, including ranges.
      expect(unsupportedStatistics('Nước chiếm khoảng 60% cơ thể; mất 1–2% đã giảm tập trung.', 'Sự thật: nước chiếm 60% cơ thể; mất 1-2% nước.')).toEqual([]);
      expect(unsupportedStatistics('LED tiết kiệm 75% điện.', topic, [{ claim: 'LED tiết kiệm 75% điện.', basis: 'DOE', verified: true as unknown as false }])).toEqual([]);
      expect(unsupportedStatistics('LED tiết kiệm 75% điện.', topic, [{ claim: 'LED tiết kiệm 75% điện.', basis: 'DOE', verified: false }])).toEqual(['75']);
    });

    it('drops unverified statistic facts, repairs the invented percentages and keeps topic numbers', async () => {
      const provider = {
        content: jest.fn().mockResolvedValueOnce(JSON.stringify(board(live))).mockResolvedValueOnce(JSON.stringify(board(fixed))),
        image: jest.fn().mockResolvedValue('http://localhost:4200/uploads/generated.png'),
      };
      const result = await new StoryboardService(provider as unknown as AgyMcpService)
        .generate({ topic, targetDuration: 60, voice: 'Thuyết Minh', aspectRatio: '9:16' });
      const prompts = provider.content.mock.calls.map((call) => call[0] as string);
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toContain('percentages, ratios and multipliers');
      expect(prompts[0]).toContain('allowed only when the topic itself states that exact figure');
      expect(prompts[1]).toContain('Narration states statistics not given in the topic (90, 75, 10)');
      // The repair's FIXED FACTS no longer offer the unverified percentages back to AGY.
      expect(prompts[1].split('FIXED FACTS')[1].split('Previous output failed')[0]).not.toMatch(/%/u);
      expect(result.grounding).toMatchObject({ verified: false, rejectedClaims: 3 });
      expect(result.grounding!.facts.map((fact) => fact.claim)).toEqual([facts[3].claim, facts[4].claim]);
      const spoken = result.scenes.map((scene) => `${scene.voiceText} ${scene.keywordHighlight}`).join(' ');
      expect(spoken).not.toMatch(/%|phần trăm/u);
      expect(spoken).toContain('26 độ');
    });

    it('parses only a consecutive numbered run as ordered items', () => {
      expect(numberedItems(topic)).toEqual(['tắt thiết bị ở chế độ chờ', 'dùng bóng đèn LED', 'đặt điều hòa 26 độ', 'giặt đồ bằng nước lạnh', 'rút sạc khi pin đầy']);
      expect(numberedItems('Buổi sáng:\n1. Uống một ly nước\n2. Mở cửa đón nắng\n3. Giãn cơ nhẹ')).toEqual(['Uống một ly nước', 'Mở cửa đón nắng', 'Giãn cơ nhẹ']);
      expect(numberedItems('Đặt điều hòa 26 độ và giặt nước lạnh. Mẹo: tắt đèn, rút sạc.')).toEqual([]);
      expect(numberedItems('Chỉ có 1) một mẹo duy nhất')).toEqual([]);
    });

    it('requests the numbered order up front and repairs drifted tips without ordinal connectors', async () => {
      const provider = {
        content: jest.fn().mockResolvedValueOnce(JSON.stringify(board(drifted))).mockResolvedValueOnce(JSON.stringify(board(fixed))),
        image: jest.fn().mockResolvedValue('http://localhost:4200/uploads/generated.png'),
      };
      const result = await new StoryboardService(provider as unknown as AgyMcpService)
        .generate({ topic, targetDuration: 60, voice: 'Thuyết Minh', aspectRatio: '9:16' });
      const prompts = provider.content.mock.calls.map((call) => call[0] as string);
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toContain('NUMBERED LIST (required order): the topic numbers 5 items');
      expect(prompts[0]).toContain('(1) "tắt thiết bị ở chế độ chờ" → (2) "dùng bóng đèn LED"');
      expect(prompts[0]).toContain('"Đầu tiên, …" for (1)');
      expect(prompts[0]).toContain('hormones such as melatonin');
      expect(prompts[1]).toContain('Numbered topic items are out of order: item (2) "dùng bóng đèn LED" comes before item (1) "tắt thiết bị ở chế độ chờ"');
      expect(prompts[1]).toContain('Scenes 1, 3, 6, 7 introduce a numbered topic item without an ordinal connector');
      expect(result.scenes.map((scene) => scene.voiceText)).toEqual(fixed.map(([voiceText]) => voiceText));
    });
  });
});
