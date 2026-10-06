export interface WordCaption {
  text: string;
  startMs: number;
  endMs: number;
}

export const VIDEO_FPS = 30;
export const AUDIO_SAMPLE_RATE = 48000;
export const MIN_TEMPO = 0.85;
export const MAX_TEMPO = 1.25;

export function secondsToFrames(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid duration');
  return Math.round(seconds * VIDEO_FPS);
}

/** Preserve intelligibility; long scripts must be shortened rather than cut off. */
export function narrationTempo(seconds: number, targetSeconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0 || targetSeconds <= 0) {
    throw new Error('Invalid narration duration');
  }
  const ratio = seconds / targetSeconds;
  if (ratio > MAX_TEMPO) {
    throw new Error('Narration is too long for this duration. Shorten the scene dialogue.');
  }
  return Math.max(MIN_TEMPO, ratio);
}

/** Largest remainder allocation keeps the total exact and each scene at least one frame. */
export function allocateSceneFrames(durations: number[], totalFrames: number,
  minimumFrames = durations.map(() => 1)): number[] {
  const reserved = minimumFrames.reduce((sum, frames) => sum + frames, 0);
  if (!durations.length || totalFrames < reserved || minimumFrames.length !== durations.length ||
      minimumFrames.some((frames) => !Number.isInteger(frames) || frames < 1) ||
      durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
    throw new Error('Invalid scene durations');
  }
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const shares = durations.map((duration) => duration / total * (totalFrames - reserved));
  const frames = shares.map((share, index) => Math.floor(share) + minimumFrames[index]);
  const order = shares.map((share, index) => ({ index, remainder: share % 1 }))
    .sort((left, right) => right.remainder - left.remainder);
  const remaining = totalFrames - frames.reduce((sum, frame) => sum + frame, 0);
  for (let index = 0; index < remaining; index++) frames[order[index].index]++;
  return frames;
}

export function captionsToVtt(captions: WordCaption[]): string {
  const timestamp = (milliseconds: number) => {
    const ms = Math.round(milliseconds);
    return [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60]
      .map((part) => String(part).padStart(2, '0')).join(':') + '.' + String(ms % 1000).padStart(3, '0');
  };
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return 'WEBVTT\n\n' + captions.map((caption, index) =>
    `${index + 1}\n${timestamp(caption.startMs)} --> ${timestamp(caption.endMs)}\n${escape(caption.text)}\n`
  ).join('\n');
}

export function parseWordCaptions(value: unknown): WordCaption[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Missing word captions');
  let previousStart = -1;
  return value.map((caption: WordCaption) => {
    if (!caption || typeof caption.text !== 'string' || !caption.text.trim() ||
        !Number.isFinite(caption.startMs) || !Number.isFinite(caption.endMs) ||
        caption.startMs < 0 || caption.endMs <= caption.startMs || caption.startMs < previousStart) {
      throw new Error('Invalid word timing metadata');
    }
    previousStart = caption.startMs;
    return { text: caption.text, startMs: caption.startMs, endMs: caption.endMs };
  });
}

export interface TimeInterval { startMs: number; endMs: number }

/**
 * Parses `silencedetect,ametadata=mode=print:file=-` output into voiced intervals.
 * Run silencedetect with a short `duration` so the clip's leading/trailing silence is
 * always found (a 140 ms lead missed by a 150 ms detector put captions ahead of the
 * voice), and pass `minimumPauseMs` so short interior dips do not split phrases.
 */
export function voicedIntervalsFromSilence(metadata: string, durationMs: number,
  minimumVoicedMs = 60, minimumPauseMs = 0): TimeInterval[] {
  const silences: TimeInterval[] = [];
  let open: number | undefined;
  for (const match of metadata.matchAll(/lavfi\.silence_(start|end)=(-?[\d.]+)/g)) {
    const ms = Math.min(durationMs, Math.max(0, Number(match[2]) * 1000));
    if (!Number.isFinite(ms)) continue;
    if (match[1] === 'start') open = ms;
    else if (open !== undefined) { silences.push({ startMs: open, endMs: ms }); open = undefined; }
  }
  if (open !== undefined) silences.push({ startMs: open, endMs: durationMs });
  const voiced: TimeInterval[] = [];
  let cursor = 0;
  const isEdge = (silence: TimeInterval) => silence.startMs <= 1 || silence.endMs >= durationMs - 1;
  for (const silence of silences.filter((item) => isEdge(item) || item.endMs - item.startMs >= minimumPauseMs)
    .sort((a, b) => a.startMs - b.startMs)) {
    if (silence.startMs > cursor) voiced.push({ startMs: cursor, endMs: silence.startMs });
    cursor = Math.max(cursor, silence.endMs);
  }
  if (cursor < durationMs) voiced.push({ startMs: cursor, endMs: durationMs });
  return voiced.filter((interval) => interval.endMs - interval.startMs >= minimumVoicedMs);
}

/**
 * Re-times estimated (length-weighted) captions onto detected speech. Each word is
 * assigned to the voiced interval containing its weighted midpoint, then spread
 * across that interval, so no word is shown during leading/trailing silence or
 * pauses. Real word timings (Edge) must not be passed through this function.
 */
export const CAPTION_ONSET_LAG_MS = 60;
export const CAPTION_RELEASE_LEAD_MS = 40;

export function alignEstimatedCaptions(captions: WordCaption[], voiced: TimeInterval[]): WordCaption[] {
  const voicedTotal = voiced.reduce((sum, item) => sum + item.endMs - item.startMs, 0);
  if (!captions.length || !voiced.length || voicedTotal < 100) return captions;
  const weights = captions.map((caption) => Math.max(1, caption.endMs - caption.startMs));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const groups: number[][] = voiced.map(() => []);
  let cumulative = 0;
  let interval = 0;
  let intervalEnd = voiced[0].endMs - voiced[0].startMs;
  captions.forEach((_, index) => {
    const midpoint = (cumulative + weights[index] / 2) / totalWeight * voicedTotal;
    cumulative += weights[index];
    while (midpoint > intervalEnd && interval < voiced.length - 1) {
      interval++;
      intervalEnd += voiced[interval].endMs - voiced[interval].startMs;
    }
    groups[interval].push(index);
  });
  const aligned: WordCaption[] = [];
  groups.forEach((members, groupIndex) => {
    if (!members.length) return;
    // Detected edges sit on the -35 dB crossing; a reader hears a phrase a beat after that
    // and its decay lingers, so keep each phrase's words strictly inside audible speech.
    const span = voiced[groupIndex].endMs - voiced[groupIndex].startMs;
    const scale = Math.min(1, span / 4 / (CAPTION_ONSET_LAG_MS + CAPTION_RELEASE_LEAD_MS));
    const startMs = voiced[groupIndex].startMs + CAPTION_ONSET_LAG_MS * scale;
    const endMs = voiced[groupIndex].endMs - CAPTION_RELEASE_LEAD_MS * scale;
    const groupWeight = members.reduce((sum, index) => sum + weights[index], 0);
    let cursor = startMs;
    for (const index of members) {
      const next = cursor + weights[index] / groupWeight * (endMs - startMs);
      aligned.push({ text: captions[index].text, startMs: Math.round(cursor * 10) / 10,
        endMs: Math.round(next * 10) / 10 });
      cursor = next;
    }
  });
  return aligned.filter((caption) => caption.endMs > caption.startMs);
}

export const SCENE_GAP_SECONDS = 0.18;
export const MAX_SCENE_GAP_SECONDS = 0.45;

/**
 * Continuous voice-over timeline: scene clips (already trimmed of edge silence) are
 * placed back to back with a short breath between them and one shared tempo, so the
 * narration reads as one take. Slack left after the tempo floor first widens breaths
 * (up to MAX_SCENE_GAP_SECONDS) and the remainder becomes a tail on the last scene.
 * Scene i's audio starts exactly on its first frame.
 */
export function planContinuousTimeline(speechSeconds: number[], targetSeconds: number) {
  if (!speechSeconds.length || speechSeconds.some((seconds) => !Number.isFinite(seconds) || seconds <= 0)) {
    throw new Error('Invalid scene durations');
  }
  const count = speechSeconds.length;
  const speech = speechSeconds.reduce((sum, seconds) => sum + seconds, 0);
  // One frame of headroom absorbs boundary rounding so no clip is ever truncated.
  const tempo = narrationTempo(speech, targetSeconds - SCENE_GAP_SECONDS * (count - 1) - 1 / VIDEO_FPS);
  const played = speechSeconds.map((seconds) => seconds / tempo);
  const slack = targetSeconds - 1 / VIDEO_FPS - played.reduce((sum, seconds) => sum + seconds, 0) - SCENE_GAP_SECONDS * (count - 1);
  const gapSeconds = count > 1
    ? Math.min(MAX_SCENE_GAP_SECONDS, SCENE_GAP_SECONDS + Math.max(0, slack) / count)
    : 0;
  const totalFrames = secondsToFrames(targetSeconds);
  const frames: number[] = [];
  let elapsed = 0;
  let previous = 0;
  for (let index = 0; index < count - 1; index++) {
    elapsed += played[index] + gapSeconds;
    const boundary = Math.round(elapsed * VIDEO_FPS);
    frames.push(boundary - previous);
    previous = boundary;
  }
  frames.push(totalFrames - previous);
  if (frames.some((value, index) => value < Math.ceil(played[index] * VIDEO_FPS))) {
    throw new Error('Narration is too long for this duration. Shorten the scene dialogue.');
  }
  return { tempo, frames, gapSeconds, playedSeconds: played };
}
