import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TtsService } from './tts.service';
import { runTtsProcess } from './tts.process';
import { alignEstimatedCaptions, allocateSceneFrames, captionsToVtt, MAX_SCENE_GAP_SECONDS, narrationTempo, parseWordCaptions, planContinuousTimeline, SCENE_GAP_SECONDS, secondsToFrames, voicedIntervalsFromSilence } from './tts.timing';

describe('Vietnamese speech timing', () => {
  test.each([15, 30, 60])('allocates exactly %i seconds at 30 fps', (seconds) => {
    const frames = allocateSceneFrames([3.61, 4.92, 5.12], secondsToFrames(seconds));
    expect(frames.reduce((sum, frame) => sum + frame, 0)).toBe(seconds * 30);
    expect(frames.every((frame) => frame > 0)).toBe(true);
  });
  test('reserves enough frames to preserve every word within the speed limit', () => {
    const durations = [2.11, 2.12, 10.11];
    const minimum = durations.map((seconds) => Math.ceil(seconds / 1.25 * 30));
    const frames = allocateSceneFrames(durations, 450, minimum);
    frames.forEach((count, index) => expect(count).toBeGreaterThanOrEqual(minimum[index]));
    expect(frames.reduce((sum, frame) => sum + frame, 0)).toBe(450);
  });
  test('bounds slowing, allows moderate compression, rejects incomprehensible compression', () => {
    expect(narrationTempo(5, 15)).toBe(0.85);
    expect(narrationTempo(18, 15)).toBe(1.2);
    expect(() => narrationTempo(20, 15)).toThrow('Shorten');
    expect(() => allocateSceneFrames([1, 1], 1)).toThrow();
    expect(() => secondsToFrames(NaN)).toThrow();
  });
  test('uses millisecond word boundaries in valid escaped VTT', () => {
    const words = parseWordCaptions([{ text: 'Xin <chào> & bạn', startMs: 52.4, endMs: 310.8 }]);
    expect(captionsToVtt(words)).toContain('00:00:00.052 --> 00:00:00.311');
    expect(captionsToVtt(words)).toContain('Xin &lt;chào&gt; &amp; bạn');
    expect(() => parseWordCaptions([{ text: 'bad', startMs: 30, endMs: 10 }])).toThrow();
    expect(() => parseWordCaptions([{ text: 'a', startMs: 30, endMs: 40 },
      { text: 'b', startMs: 10, endMs: 20 }])).toThrow();
  });
});

describe('speech process boundary', () => {
  test('passes quotes and shell substitutions as literal arguments', async () => {
    const text = 'Xin "chào" $(touch /tmp/tts-must-not-exist); test';
    const result = await runTtsProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', text]);
    expect(result).toBe(text);
  });
  test('kills and reaps processes on timeout and cancellation', async () => {
    await expect(runTtsProcess(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'],
      { timeoutMs: 30 })).rejects.toThrow('timed out');
    const controller = new AbortController();
    const pending = runTtsProcess(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'],
      { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
  });
});

describe('speech input and cleanup', () => {
  const service = new TtsService();
  test('rejects unsupported voice, malformed duration, empty dialogue, and path traversal', async () => {
    await expect(service.synthesizePreview('Hello', 'bad' as never, '/tmp')).rejects.toThrow('voice');
    await expect(service.synthesizeVideo([{ voiceText: 'Hello' }], 'vi-VN-HoaiMyNeural',
      10 as never, '/tmp')).rejects.toThrow('duration');
    await expect(service.synthesizePreview(' ', 'vi-VN-HoaiMyNeural', '/tmp')).rejects.toThrow('Narration');
    await expect(service.synthesizePreview('Hello', 'vi-VN-HoaiMyNeural', '/tmp/../tmp')).rejects.toThrow('traversal');
  });
  test('removes partial files when generation is cancelled', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tts-test-'));
    try {
      const controller = new AbortController();
      controller.abort();
      await expect(service.synthesizeVideo([{ voiceText: 'Xin chào bạn' }],
        'vi-VN-NamMinhNeural', 15, directory, controller.signal)).rejects.toThrow('cancelled');
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('estimated clone caption alignment', () => {
  const metadata = [
    'frame:0 pts:0', 'lavfi.silence_start=0', 'lavfi.silence_end=0.2',
    'lavfi.silence_start=1.4', 'lavfi.silence_end=2.0', 'lavfi.silence_start=3.1',
  ].join('\n');
  test('derives voiced intervals and drops short blips', () => {
    expect(voicedIntervalsFromSilence(metadata, 3500)).toEqual([
      { startMs: 200, endMs: 1400 }, { startMs: 2000, endMs: 3100 }]);
    expect(voicedIntervalsFromSilence('lavfi.silence_start=0.5\nlavfi.silence_end=0.53\nlavfi.silence_start=0.56', 1000))
      .toEqual([{ startMs: 0, endMs: 500 }]);
    expect(voicedIntervalsFromSilence('', 800)).toEqual([{ startMs: 0, endMs: 800 }]);
  });
  test('moves words out of silence and never spans a pause', () => {
    // Service-style estimate: 6 equal words spread uniformly over 60–3440 ms, ignoring silence.
    const estimated = ['Mang', 'bình', 'nước,', 'đi', 'bộ', 'nhé.'].map((text, index) =>
      ({ text, startMs: 60 + index * 563.3, endMs: 60 + (index + 1) * 563.3 }));
    const voiced = voicedIntervalsFromSilence(metadata, 3500);
    const aligned = alignEstimatedCaptions(estimated, voiced);
    expect(aligned.map((word) => word.text)).toEqual(estimated.map((word) => word.text));
    // Words sit strictly inside speech: onset lag after the -35 dB crossing, release lead before its end.
    expect(aligned[0].startMs).toBe(260);
    expect(aligned[aligned.length - 1].endMs).toBe(3060);
    for (const word of aligned) {
      expect(voiced.some((span) => word.startMs >= span.startMs && word.endMs <= span.endMs)).toBe(true);
    }
    // The comma pause separates the two phrases.
    expect(aligned[2].endMs).toBe(1360);
    expect(aligned[3].startMs).toBe(2060);
    for (let index = 1; index < aligned.length; index++) {
      expect(aligned[index].startMs).toBeGreaterThanOrEqual(aligned[index - 1].endMs);
    }
  });
  test('keeps edge silences shorter than the interior pause minimum', () => {
    // 30 ms detector output for a clone clip with a 140 ms lead (job a134b487 scene 2) and a 100 ms dip.
    const detected = ['lavfi.silence_start=0', 'lavfi.silence_end=0.14', 'lavfi.silence_start=1.5',
      'lavfi.silence_end=1.6', 'lavfi.silence_start=3.64'].join('\n');
    expect(voicedIntervalsFromSilence(detected, 3760, 60, 150)).toEqual([{ startMs: 140, endMs: 3640 }]);
  });
  test('leaves captions unchanged without usable speech detection', () => {
    const words = [{ text: 'a', startMs: 0, endMs: 100 }];
    expect(alignEstimatedCaptions(words, [])).toBe(words);
  });
});

describe('continuous voice-over timeline', () => {
  test('places trimmed clips back to back with short breaths and exact total frames', () => {
    const plan = planContinuousTimeline([2.9, 3.1, 2.8, 3.0], 15);
    expect(plan.frames.reduce((sum, value) => sum + value, 0)).toBe(450);
    expect(plan.tempo).toBeCloseTo(0.85, 5);
    expect(plan.gapSeconds).toBeGreaterThanOrEqual(SCENE_GAP_SECONDS);
    expect(plan.gapSeconds).toBeLessThanOrEqual(MAX_SCENE_GAP_SECONDS);
    // Every non-final scene ends within one frame of its speech plus one breath.
    plan.frames.slice(0, -1).forEach((frames, index) => {
      expect(Math.abs(frames / 30 - (plan.playedSeconds[index] + plan.gapSeconds))).toBeLessThanOrEqual(1 / 30 + 1e-9);
      expect(frames).toBeGreaterThanOrEqual(Math.ceil(plan.playedSeconds[index] * 30));
    });
  });
  test('uses the minimum breath and shared compression when speech is dense', () => {
    const plan = planContinuousTimeline([4.0, 4.3, 4.1, 4.2], 15);
    expect(plan.tempo).toBeGreaterThan(1);
    expect(plan.gapSeconds).toBeCloseTo(SCENE_GAP_SECONDS, 5);
    expect(plan.frames.reduce((sum, value) => sum + value, 0)).toBe(450);
    expect(() => planContinuousTimeline([6, 6, 6, 6], 15)).toThrow('Shorten');
    expect(() => planContinuousTimeline([], 15)).toThrow();
  });
});

describe('clone narration concurrency', () => {
  const actualFetch = global.fetch;
  afterEach(() => { global.fetch = actualFetch; });
  test('sends one GPU clone request at a time and still assembles an exact timeline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tts-clone-test-'));
    try {
      const wav = join(directory, 'tone.wav');
      await runTtsProcess('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
        'sine=frequency=300:sample_rate=24000:duration=2.5', '-c:a', 'pcm_s16le', wav]);
      const audio = (await import('node:fs/promises')).readFile(wav);
      let inFlight = 0, peak = 0, calls = 0;
      global.fetch = jest.fn(async () => {
        calls++; inFlight++; peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 30));
        inFlight--;
        return new Response(JSON.stringify({ success: true, audio_base64: (await audio).toString('base64'),
          captions: [{ text: 'Xin', startMs: 0, endMs: 1200 }, { text: 'chào', startMs: 1200, endMs: 2500 }] }));
      }) as never;
      const speech = await new TtsService().synthesizeVideo(['Một', 'Hai', 'Ba', 'Bốn'].map((voiceText) => ({ voiceText })),
        'Thuyết Minh', 15, directory);
      expect(calls).toBe(4); expect(peak).toBe(1);
      expect(speech.durationInFrames).toBe(450);
      expect(speech.sceneTimings.map((timing) => timing.sceneIndex)).toEqual([0, 1, 2, 3]);
      expect(speech.sceneTimings.reduce((sum, timing) => sum + timing.durationInFrames, 0)).toBe(450);
      expect(speech.captions).toHaveLength(8);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('regression a134b487: captions never start before speech after a sub-150 ms clone lead-in', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tts-onset-test-'));
    try {
      // Clone clip shaped like job a134b487 scene 2: 140 ms lead silence, comma pause, 120 ms tail.
      const wav = join(directory, 'clip.wav');
      await runTtsProcess('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
        "aevalsrc='0.25*sin(2*PI*220*t)*(between(t,0.14,1.04)+between(t,1.44,3.64))':s=24000:d=3.76",
        '-c:a', 'pcm_s16le', wav]);
      const audio = (await import('node:fs/promises')).readFile(wav);
      const words = 'Không chỉ vậy, mất nước khoảng 1–2% trọng lượng cơ thể khiến sự tập trung và trí nhớ giảm.'.split(' ');
      // The clone service spreads words by length from 60 ms over the whole clip, silence included.
      const step = (3700 - 60) / words.length;
      global.fetch = jest.fn(async () => new Response(JSON.stringify({ success: true,
        audio_base64: (await audio).toString('base64'),
        captions: words.map((text, index) => ({ text, startMs: 60 + index * step, endMs: 60 + (index + 1) * step })) }))) as never;
      const speech = await new TtsService().synthesizeVideo(Array.from({ length: 6 }, () => ({ voiceText: words.join(' ') })),
        'Thuyết Minh', 30, directory);
      expect(speech.durationInFrames).toBe(900);
      // Same measurement as the live quality gate: -32 dB pauses of at least 0.3 s.
      const log = await runTtsProcess('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', speech.audioPath,
        '-af', 'silencedetect=noise=-32dB:duration=0.12,ametadata=mode=print:file=-', '-f', 'null', '-'], { timeoutMs: 30000 });
      const silences: Array<[number, number]> = [];
      let open: number | undefined;
      for (const match of log.matchAll(/silence_(start|end)=(-?[\d.]+)/g)) {
        const t = Math.max(0, Number(match[2]));
        if (match[1] === 'start') open = t; else if (open !== undefined) { silences.push([open, t]); open = undefined; }
      }
      if (open !== undefined) silences.push([open, speech.durationInSeconds]);
      const pauses = silences.filter(([a, b]) => b - a >= 0.3);
      expect(pauses.length).toBeGreaterThanOrEqual(5);
      const inSilence = speech.captions.reduce((sum, caption) => sum + pauses.reduce((inner, [a, b]) =>
        inner + Math.max(0, Math.min(b * 1000, caption.endMs) - Math.max(a * 1000, caption.startMs)), 0), 0);
      expect(inSilence).toBeLessThanOrEqual(1);
      for (const timing of speech.sceneTimings) {
        const first = speech.captions.find((caption) => caption.startMs >= timing.startFrame / 30 * 1000 - 1)!;
        const pause = pauses.find(([a, b]) => a * 1000 <= first.startMs + 1 && b * 1000 > first.startMs);
        expect(pause).toBeUndefined();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
