import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TtsService, VoiceCloneUnavailableError } from './tts.service';
import { runTtsProcess } from './tts.process';
import { videoWarningVi } from '../../../../../apps/frontend/src/components/agents/video-warning.vi';

/** Voice Clone (:8002) outage handling: fail fast, fall back to one Edge voice, or a clear Vietnamese error. */
describe('voice clone outage', () => {
  const env = { ...process.env };
  let directory: string;
  let tone: string;
  let edgeCalls: string[];

  const service = () => {
    const tts = new TtsService();
    const original = (tts as any).rawScene.bind(tts);
    // Edge TTS needs the network; stand in with a local tone so the real timeline assembly still runs.
    jest.spyOn(tts as any, 'rawScene').mockImplementation(async (...args: any[]) => {
      const [text, voice, dir, index] = args;
      if (String(voice).startsWith('vi-VN-')) {
        edgeCalls.push(String(voice));
        const audioPath = join(dir, `raw-${index}.wav`);
        await runTtsProcess('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', tone, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', audioPath]);
        return { audioPath, seconds: 2.5, voiced: [{ startMs: 0, endMs: 2500 }], captions: [{ text, startMs: 0, endMs: 2500 }] };
      }
      return original(...args);
    });
    return tts;
  };
  const listen = (handler: (request: IncomingMessage, response: ServerResponse) => void) => new Promise<Server>((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  const urlOf = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const scenes = ['Một', 'Hai', 'Ba', 'Bốn'].map((voiceText) => ({ voiceText }));

  beforeAll(async () => {
    tone = join(await mkdtemp(join(tmpdir(), 'tts-fallback-tone-')), 'tone.wav');
    await runTtsProcess('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
      'sine=frequency=300:sample_rate=24000:duration=2.5', '-c:a', 'pcm_s16le', tone]);
  });
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'tts-fallback-'));
    edgeCalls = [];
    delete process.env.VOICE_CLONE_FALLBACK;
    delete process.env.VOICE_CLONE_TIMEOUT_MS;
    delete process.env.VOICE_CLONE_COOLDOWN_MS;
  });
  afterEach(async () => {
    process.env = { ...env };
    jest.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });
  afterAll(async () => { await rm(join(tone, '..'), { recursive: true, force: true }); });

  test('a 4xx (bad text) does not trip the shared clone breaker; a 5xx does', async () => {
    let status = 400;
    const server = await listen((_request, response) => { response.writeHead(status, { 'Content-Type': 'text/plain' }); response.end('bad text'); });
    try {
      process.env.VOICE_CLONE_SERVICE_URL = urlOf(server);
      const tts = service();
      await tts.synthesizeVideo(scenes, 'Thuyết Minh', 15, directory).catch(() => undefined);
      expect((tts as any).cloneDownUntil).toBe(0);
      status = 503;
      await tts.synthesizeVideo(scenes, 'Thuyết Minh', 15, directory).catch(() => undefined);
      expect((tts as any).cloneDownUntil).toBeGreaterThan(Date.now());
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
  test('server down: one refused request, then the whole narration uses one Edge voice with a warning', async () => {
    const closed = await listen(() => undefined);
    process.env.VOICE_CLONE_SERVICE_URL = urlOf(closed);
    await new Promise((resolve) => closed.close(resolve));
    const fetchSpy = jest.spyOn(global, 'fetch');
    const started = Date.now();
    const speech = await service().synthesizeVideo(scenes, 'Thuyết Minh', 15, directory);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(edgeCalls).toEqual(Array(4).fill('vi-VN-NamMinhNeural'));
    expect(speech.durationInFrames).toBe(450);
    expect(speech.voiceFallback).toMatchObject({ requested: 'Thuyết Minh', used: 'vi-VN-NamMinhNeural' });
    expect(speech.voiceFallback!.reason).toMatch(/ECONNREFUSED|fetch failed/);
    expect(speech.voiceFallback!.warning).toMatch(/^Voice clone "Thuyết Minh" unavailable \(.+\); narrated with Edge voice vi-VN-NamMinhNeural$/);
    // The studio shows this warning in Vietnamese.
    expect(videoWarningVi(speech.voiceFallback!.warning)).toMatch(/^Máy chủ giọng nhân bản không phản hồi \(.+\) nên giọng "Thuyết Minh" đã được thay bằng giọng Edge Nam Minh/);
  });

  test('server hangs: the per-request deadline trips once and queued scenes fail fast', async () => {
    let requests = 0;
    const hanging = await listen(() => { requests++; });
    try {
      process.env.VOICE_CLONE_SERVICE_URL = urlOf(hanging);
      process.env.VOICE_CLONE_TIMEOUT_MS = '1000';
      const started = Date.now();
      const speech = await service().synthesizeVideo(scenes, 'Chị gái', 15, directory);
      expect(Date.now() - started).toBeLessThan(8_000);
      expect(requests).toBe(1);
      expect(speech.voiceFallback).toMatchObject({ used: 'vi-VN-HoaiMyNeural' });
      expect(speech.voiceFallback!.reason).toContain('timed out after 1s');
    } finally { hanging.closeAllConnections(); await new Promise((resolve) => hanging.close(resolve)); }
  });

  test('fallback disabled: clear Vietnamese error, no partial files, no Edge synthesis', async () => {
    const busy = await listen((_request, response) => { response.writeHead(503); response.end('GPU busy'); });
    try {
      process.env.VOICE_CLONE_SERVICE_URL = urlOf(busy);
      process.env.VOICE_CLONE_FALLBACK = '0';
      const pending = service().synthesizeVideo(scenes, 'Thuyết Minh', 15, directory);
      await expect(pending).rejects.toBeInstanceOf(VoiceCloneUnavailableError);
      await expect(pending).rejects.toThrow(/Máy chủ giọng nhân bản \(Voice Clone\) không phản hồi.*HTTP 503: GPU busy/);
      expect(edgeCalls).toEqual([]);
      expect(await readdir(directory)).toEqual([]);
    } finally { await new Promise((resolve) => busy.close(resolve)); }
  });

  test('caller cancellation during a clone request is a cancellation, not a fallback', async () => {
    const hanging = await listen(() => undefined);
    try {
      process.env.VOICE_CLONE_SERVICE_URL = urlOf(hanging);
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error('Video generation cancelled')), 200);
      await expect(service().synthesizeVideo(scenes, 'Thuyết Minh', 15, directory, controller.signal))
        .rejects.toThrow('Video generation cancelled');
      expect(edgeCalls).toEqual([]);
    } finally { hanging.closeAllConnections(); await new Promise((resolve) => hanging.close(resolve)); }
  });

  test('source-video narration preview falls back too, and the clone is retried after the cooldown', async () => {
    let up = false, requests = 0;
    const audio = (await import('node:fs/promises')).readFile(tone);
    const server = await listen(async (_request, response) => {
      requests++;
      if (!up) { response.writeHead(500); response.end('model not loaded'); return; }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, audio_base64: (await audio).toString('base64'),
        captions: [{ text: 'Xin', startMs: 0, endMs: 1200 }, { text: 'chào', startMs: 1200, endMs: 2500 }] }));
    });
    try {
      process.env.VOICE_CLONE_SERVICE_URL = urlOf(server);
      process.env.VOICE_CLONE_COOLDOWN_MS = '0';
      const tts = service();
      const first = await tts.synthesizePreview('Xin chào', 'Adam', directory);
      expect(first.voiceFallback).toMatchObject({ requested: 'Adam', used: 'vi-VN-NamMinhNeural' });
      expect(first.voiceFallback!.reason).toContain('HTTP 500: model not loaded');
      up = true;
      const second = await tts.synthesizePreview('Xin chào', 'Adam', directory);
      expect(second.voiceFallback).toBeUndefined();
      expect(requests).toBe(2);
      expect(edgeCalls).toEqual(['vi-VN-NamMinhNeural']);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
  test('source-video voice-over is tempo-fitted into the clip instead of being cut off', async () => {
    const tts = service();
    // 2.5 s of speech into a 2.8 s clip: sped up to end 0.25 s before the cut, starting after a 0.15 s lead-in.
    const tight = await tts.synthesizePreview('Xin chào', 'vi-VN-NamMinhNeural', directory, undefined, 2.8);
    expect(tight.tempo).toBeCloseTo(2.5 / (2.8 - 0.4), 3);
    expect(tight.durationInSeconds).toBeCloseTo(2.8 - 0.25, 1);
    expect(tight.durationInSeconds).toBeLessThanOrEqual(2.8);
    // Far too long: capped at the intelligibility limit rather than chipmunked.
    expect((await tts.synthesizePreview('Xin chào', 'vi-VN-NamMinhNeural', directory, undefined, 1.5)).tempo).toBe(1.25);
    // Plenty of room: natural pace floor, no stretching to fill the clip.
    const loose = await tts.synthesizePreview('Xin chào', 'vi-VN-NamMinhNeural', directory, undefined, 10);
    expect(loose.tempo).toBe(0.94);
    expect(loose.durationInSeconds).toBeCloseTo(0.15 + 2.5 / 0.94, 1);
    await expect(tts.synthesizePreview('Xin chào', 'vi-VN-NamMinhNeural', directory, undefined, 0.5)).rejects.toThrow('fit duration');
  });
});
