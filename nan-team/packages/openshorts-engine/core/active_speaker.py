"""Who is talking, from mouth movement plus audio energy.

The SPLIT layout shipped without this and it is the thing that decides whether
the format lands or grates: stacking is only worth half the frame when both
people actually take turns. Geometry alone will stack a scene where one person
sits silent for thirty seconds.

Full diarisation is not needed to answer "which of these two faces is moving its
mouth right now". This measures frame-to-frame change in the mouth region of
each known face box, and only trusts the comparison in windows where the audio
says somebody is speaking at all — otherwise a nod, a laugh or a chewed sweet
scores as speech.

The two faces come from split_layout's medians, so no per-frame face detection
runs here: the subjects of a two-shot are seated and the boxes hold.

Everything in this module is pure enough to unit-test except decode_activity(),
which needs ffmpeg.
"""
import os
import subprocess

import numpy as np

# Seconds per decision window. Short enough to catch a one-word interjection,
# long enough that a single blurred frame cannot flip the answer.
WINDOW_SECONDS = 0.4

# Off by default like every other new routing signal here. SPEAKER_SIGNAL=1
# gates SPLIT on both people actually talking; SPEAKER_CUT=1 additionally
# replaces the stack with hard cuts to whoever holds the floor.
ENABLED = os.environ.get("SPEAKER_SIGNAL", "0") == "1"
CUT_MODE = os.environ.get("SPEAKER_CUT", "0") == "1"

# A window counts as speech only if its audio RMS clears this fraction of the
# scene's loudest window. Silence and room tone sit far below it.
AUDIO_FLOOR = 0.18

# The winner's mouth must be this much more active than the other's, relative to
# the pair's total, before the window is attributed. Below it the window is
# "unclear" and simply does not vote — which is the honest answer when both are
# still or both are moving.
MIN_MARGIN = 0.15

# Share of attributed windows each speaker needs before a two-shot counts as a
# conversation. At 0.2 a listener who chips in every fifth window still counts;
# a genuinely silent listener does not.
MIN_SHARE = float(os.environ.get("SPLIT_MIN_SHARE", "0.2"))

ANALYSIS_WIDTH = 480


def mouth_region(box, frame_w, frame_h, scale=1.0):
    """Pixel rect (x0, y0, x1, y1) around the mouth of a face box.

    MediaPipe boxes cover brow to chin, so the mouth sits low and central. The
    region is deliberately wider than the lips: jaw movement carries as much
    signal as the lips themselves and survives a box that drifts a little.
    """
    x, y, w, h = [v / scale for v in box]
    cx = x + w / 2.0
    mouth_y = y + h * 0.72
    half_w = w * 0.36
    half_h = h * 0.22

    x0 = int(max(0, min(cx - half_w, frame_w - 1)))
    x1 = int(max(x0 + 1, min(cx + half_w, frame_w)))
    y0 = int(max(0, min(mouth_y - half_h, frame_h - 1)))
    y1 = int(max(y0 + 1, min(mouth_y + half_h, frame_h)))
    return x0, y0, x1, y1


def audio_envelope(video_path, start_s, duration_s, window_s=WINDOW_SECONDS):
    """Per-window RMS of the clip's audio, normalised to its own peak.

    Returns [] when the source has no audio track, which makes every window
    eligible rather than none: a silent source should fall back to mouth
    movement alone, not refuse to decide.
    """
    try:
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{start_s:.4f}",
             "-t", f"{duration_s:.4f}", "-i", video_path,
             "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=300).stdout
    except (subprocess.SubprocessError, OSError):
        return []
    if not raw:
        return []

    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    per_window = max(1, int(8000 * window_s))
    n = len(samples) // per_window
    if n < 1:
        return []

    windows = samples[:n * per_window].reshape(n, per_window)
    rms = np.sqrt(np.mean(windows ** 2, axis=1))
    peak = rms.max()
    return (rms / peak).tolist() if peak > 0 else [0.0] * n


def normalise_activity(activity):
    """Rescale each speaker's mouth activity onto its own quiet-to-loud range.

    Raw frame-difference magnitude is not comparable between two faces: it
    scales with the local contrast, the lighting and the size of the box, so
    whichever speaker happens to be better lit wins every window. Measured on a
    real two-shot, the raw signal handed one speaker 90-100% of the scene.

    Subtracting each speaker's own 20th percentile (their resting state) and
    dividing by their own 20-80 spread compares "how active is this mouth for
    this person" instead. Windows where nobody speaks are already dropped by the
    audio gate, so a silent listener's amplified noise never gets a vote.
    """
    if not activity:
        return []
    columns = np.asarray(activity, dtype=float)
    if columns.ndim != 2 or columns.shape[1] < 2:
        return activity
    low = np.percentile(columns, 20, axis=0)
    high = np.percentile(columns, 80, axis=0)
    spread = np.where(high - low > 1e-6, high - low, 1.0)
    return np.clip((columns - low) / spread, 0.0, None).tolist()


def attribute_windows(activity, loudness, min_margin=MIN_MARGIN):
    """Which speaker owns each window, or None when it is not clear.

    ``activity`` is [[a0, a1], ...], one mouth-movement score per speaker per
    window; ``loudness`` is the normalised audio envelope (or [] for none).
    """
    verdicts = []
    for i, pair in enumerate(activity):
        if loudness and i < len(loudness) and loudness[i] < AUDIO_FLOOR:
            verdicts.append(None)          # nobody is talking here
            continue
        a, b = pair
        total = a + b
        if total <= 0:
            verdicts.append(None)
            continue
        margin = abs(a - b) / total
        verdicts.append(None if margin < min_margin else (0 if a > b else 1))
    return verdicts


def shares(verdicts):
    """Fraction of attributed windows held by each speaker: (share0, share1).

    Returns (0.0, 0.0) when nothing was attributed, so callers see "no evidence"
    rather than a spurious 50/50.
    """
    counted = [v for v in verdicts if v is not None]
    if not counted:
        return 0.0, 0.0
    n = float(len(counted))
    return counted.count(0) / n, counted.count(1) / n


def is_conversation(verdicts, min_share=None):
    """True when both speakers hold enough of the attributed windows."""
    min_share = MIN_SHARE if min_share is None else min_share
    a, b = shares(verdicts)
    return min(a, b) >= min_share


def hold(verdicts, min_windows=3):
    """Smooth the per-window verdicts so the answer cannot flap.

    A cut back and forth every 0.4s is unwatchable, and a listener's single
    "yeah" should not steal the frame. Unclear windows inherit the current
    speaker, and a new speaker must hold ``min_windows`` in a row to take over.
    """
    out = []
    current = None
    pending = None
    run = 0
    for v in verdicts:
        if v is None or v == current:
            if v == current:
                pending, run = None, 0
            out.append(current)
            continue
        if v == pending:
            run += 1
        else:
            pending, run = v, 1
        if current is None or run >= min_windows:
            current, pending, run = v, None, 0
        out.append(current)

    # Nothing was ever confident enough to start: leave it to the caller.
    if all(v is None for v in out):
        return out

    # Backfill the lead-in with whoever spoke first.
    first = next(v for v in out if v is not None)
    return [first if v is None else v for v in out]


def speaker_xs(held, centres, crop_w, orig_w, n_frames, fps,
               window_s=WINDOW_SECONDS):
    """Per-frame crop x that cuts to whoever is speaking.

    Reuses the TRACK render path: a camera trajectory with hard jumps is still
    just a list of x positions, so no new filtergraph is needed.
    """
    xs = []
    for f in range(n_frames):
        idx = min(int((f / fps) / window_s), len(held) - 1) if held else 0
        who = held[idx] if held else 0
        cx = centres[who if who is not None else 0][0]
        x = int(round(cx - crop_w / 2.0))
        xs.append(max(0, min(x, orig_w - crop_w)))
    return xs


def verdicts_for_scene(video_path, start_f, end_f, fps, centres):
    """Per-window speaker verdicts for one scene, from its two face centres."""
    return scene_attribution(video_path, start_f, end_f, fps, centres)[0]


# Single-camera two-shot with audio. Measured on the 8Saigon two-shot (Lan
# Ngoc left talking for the whole 32s clip, Quang Tuan right listening): the
# per-speaker-normalised mouth path split the windows 51/49 and put the
# LISTENER on screen for 18s, and raw mouth motion vs voicing correlated at
# only -0.03/+0.08. What did separate them was articulation, mouth motion
# over eye motion in keypoint-aligned patches (head movement cancels): 0.97 vs
# 0.77 overall and higher for the speaker in each of the four quarters. So:
# with audio, never fall back to per-window mouth guesses; attribute from the
# voice plus whole-scene articulation, or give up (GENERAL, both visible).
MIN_ARTICULATION_MARGIN = 0.12     # relative lead of the speaker's ratio
MIN_VOICE_CORR_MARGIN = 0.15       # straight vs swapped voice->face correlation
MIN_VOICED_SHARE = 0.3             # share of windows with speech at all


def scene_attribution(video_path, start_f, end_f, fps, centres, detector=None):
    """(verdicts, mode) for one two-face scene.

    modes: 'mouth' (no audio: the original mouth-only path), 'two-voice'
    (voices decide windows, articulation maps voice->face), 'single-voice'
    (one talker, identified by articulation; verdicts are that face
    throughout), 'unresolved' (audio present but the face evidence is not
    clear: every verdict None so the caller keeps the safe layout).
    """
    import split_layout

    start_s = start_f / fps
    duration_s = (end_f - start_f) / fps
    samples = load_audio(video_path, start_s, duration_s)
    if len(samples) == 0:
        boxes = [split_layout.as_box(c) for c in centres]
        activity = normalise_activity(decode_activity(video_path, start_s, duration_s, boxes, fps))
        return attribute_windows(activity, audio_envelope(video_path, start_s, duration_s)), 'mouth'

    pitches = window_pitches(pitch_track(samples))
    n = len(pitches)
    unresolved = [None] * n
    if n == 0 or sum(p > 0 for p in pitches) < MIN_VOICED_SHARE * n:
        return unresolved, 'unresolved'
    if detector is None:
        try:
            import tracking as detector
        except ImportError:
            import main as detector
    art = articulation(video_path, start_f, end_f, fps, centres, detector)
    if not art:
        return unresolved, 'unresolved'
    labels = voice_labels(pitches)
    if labels:
        mapping = map_voices_by_correlation(art, labels)
        if mapping is None:
            return unresolved, 'unresolved'
        return (voice_verdicts(labels, mapping) + [None] * n)[:n], 'two-voice'
    face = single_talker(art)
    if face is None:
        return unresolved, 'unresolved'
    return [face] * n, 'single-voice'


def single_talker(art, margin=MIN_ARTICULATION_MARGIN, parts=4):
    """Face index whose articulation leads over the scene AND in every part
    of it, or None."""
    rows = np.asarray([r for r in art if r is not None and np.all(np.isfinite(r))], dtype=float)
    if len(rows) < parts * 2:
        return None
    means = rows.mean(axis=0)
    lead = int(np.argmax(means))
    if means[lead] < (1 + margin) * means[1 - lead]:
        return None
    for chunk in np.array_split(rows, parts):
        if chunk[:, lead].mean() <= chunk[:, 1 - lead].mean():
            return None
    return lead


def map_voices_by_correlation(art, labels, margin=MIN_VOICE_CORR_MARGIN):
    """{voice: face} from correlating each face's articulation series with
    each voice's activity over the whole scene, or None without a clear
    margin between the two possible assignments."""
    n = min(len(art), len(labels))
    keep = [i for i in range(n) if art[i] is not None and np.all(np.isfinite(art[i]))]
    if len(keep) < 6:
        return None
    a_ = np.asarray([art[i] for i in keep], dtype=float)
    corr = np.zeros((2, 2))
    for v in (0, 1):
        ind = np.asarray([1.0 if labels[i] == v else 0.0 for i in keep])
        if ind.std() == 0:
            return None
        for f in (0, 1):
            col = a_[:, f]
            corr[f, v] = 0.0 if col.std() == 0 else float(np.corrcoef(col, ind)[0, 1])
    straight, swapped = corr[0, 0] + corr[1, 1], corr[0, 1] + corr[1, 0]
    if abs(straight - swapped) < margin:
        return None
    return {0: 0, 1: 1} if straight > swapped else {0: 1, 1: 0}


def articulation(video_path, start_f, end_f, fps, centres, detector,
                 window_s=WINDOW_SECONDS):
    """Per-window [ratio_face0, ratio_face1] of mouth motion over eye motion.

    Patches are placed on BlazeFace keypoints every frame and resampled to a
    fixed size, so head movement and face size cancel; dividing by the eye
    patch cancels lighting/contrast. None for windows where a face was lost.
    """
    import cv2
    import frame_sampler

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    per_window = max(1, int(round(fps * window_s)))
    prev = {}
    sums = []
    try:
        for k, frame in enumerate(frame_sampler.read_at(cap, range(start_f, end_f))):
            if frame is None:
                break
            if k % per_window == 0:
                sums.append([[0.0, 0.0, 0] for _ in (0, 1)])
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            small, _scale = detector._detection_frame(frame)
            with detector.DETECT_LOCK:
                result = detector.face_detection.process(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
            for det in result.detections or []:
                box = det.location_data.relative_bounding_box
                cx, fw = (box.xmin + box.width / 2) * frame_w, box.width * frame_w
                dist = [abs(cx - c[0]) for c in centres]
                face = int(np.argmin(dist))
                if dist[face] > max(fw, centres[face][2]):
                    continue
                kp = det.location_data.relative_keypoints
                patches = []
                for px, py in (((kp[0].x + kp[1].x) / 2, (kp[0].y + kp[1].y) / 2),
                               (kp[3].x, kp[3].y)):
                    hw, hh = int(fw * 0.3), int(fw * 0.2)
                    x0, y0 = int(px * frame_w) - hw, int(py * frame_h) - hh
                    if hw < 2 or x0 < 0 or y0 < 0 or x0 + 2 * hw > frame_w or y0 + 2 * hh > frame_h:
                        patches = None
                        break
                    patches.append(cv2.resize(gray[y0:y0 + 2 * hh, x0:x0 + 2 * hw],
                                              (48, 32)).astype(np.float32))
                if patches is None:
                    prev.pop(face, None)
                    continue
                if face in prev:
                    eye = float(np.mean(np.abs(patches[0] - prev[face][0])))
                    mouth = float(np.mean(np.abs(patches[1] - prev[face][1])))
                    acc = sums[-1][face]
                    acc[0] += mouth
                    acc[1] += eye
                    acc[2] += 1
                prev[face] = patches
    finally:
        cap.release()
    out = []
    for window in sums:
        if any(acc[2] == 0 or acc[1] <= 0 for acc in window):
            out.append(None)
        else:
            out.append([acc[0] / acc[1] for acc in window])
    return out


def decode_activity(video_path, start_s, duration_s, boxes, fps,
                    window_s=WINDOW_SECONDS):
    """Mouth-movement score per speaker per window over one scene.

    Decodes the scene once at ANALYSIS_WIDTH and measures mean absolute
    frame-to-frame change inside each speaker's mouth region.
    """
    import cv2

    probe = cv2.VideoCapture(video_path)
    orig_w = int(probe.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(probe.get(cv2.CAP_PROP_FRAME_HEIGHT))
    probe.release()
    if not orig_w or not orig_h:
        return []

    small_w = min(ANALYSIS_WIDTH, orig_w)
    small_w -= small_w % 2
    small_h = max(int(orig_h * small_w / orig_w), 2)
    small_h += small_h % 2
    scale = orig_w / float(small_w)

    regions = [mouth_region(b, small_w, small_h, scale) for b in boxes]
    from reframe_v2 import segment_window
    start_frame = round(start_s * fps)
    frame_count = round(duration_s * fps)
    if frame_count <= 0:
        return []
    seek, frame_count = segment_window(start_frame, start_frame + frame_count, fps)
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-ss", f"{seek:.6f}", "-i", video_path,
         "-vf", f"setpts=PTS-STARTPTS,scale={small_w}:{small_h}",
         "-frames:v", str(frame_count), "-fps_mode", "passthrough", "-f", "rawvideo",
         "-pix_fmt", "gray", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        bufsize=small_w * small_h * 4)

    per_window = max(1, int(round(fps * window_s)))
    activity, bucket, prev = [], [], None
    try:
        while True:
            buf = proc.stdout.read(small_w * small_h)
            if len(buf) < small_w * small_h:
                break
            frame = np.frombuffer(buf, dtype=np.uint8).reshape(small_h, small_w)
            if prev is not None:
                bucket.append([
                    float(np.mean(np.abs(
                        frame[y0:y1, x0:x1].astype(np.int16)
                        - prev[y0:y1, x0:x1].astype(np.int16))))
                    for x0, y0, x1, y1 in regions])
            prev = frame
            if len(bucket) >= per_window:
                activity.append(np.mean(bucket, axis=0).tolist())
                bucket = []
    finally:
        proc.stdout.close()
        proc.wait()

    if bucket:
        activity.append(np.mean(bucket, axis=0).tolist())
    return activity


# --- voice attribution ------------------------------------------------------
#
# Mouth movement alone fails on the footage people actually bring: a produced
# podcast cuts between close-ups of each guest (one face per shot, so there is
# no pair to compare) and its wide two-shot shows faces ~45px wide or in
# profile. Measured on the Vietcetera fixture: five single-face shots, one wide
# shot where BlazeFace found no usable pair, mouth/brow motion ratio ~1.0 on
# every shot — i.e. no visual signal at all, hence "no validated two-speaker
# attribution". The audio, meanwhile, separates the two voices cleanly (median
# F0 109 Hz vs 190-205 Hz). So the voice decides WHO is talking and the picture
# only has to decide WHO is on screen.
#
# Two voices are only trusted when their pitch clusters are far apart; two
# similar voices (same register) fall back to the mouth-only path and, failing
# that, to the plain layouts. Guessing wrong here is worse than not cutting.

VOICE_SR = 16000
PITCH_MIN_HZ = 70
PITCH_MAX_HZ = 400
# Median F0 of the two voice clusters must differ by at least this factor. One
# speaker's intonation moves window medians by ~10-20%; a male/female pair sits
# at ~1.6-1.9x.
MIN_PITCH_RATIO = 1.4
MIN_VOICE_SHARE = 0.12
# A window needs this share of voiced 20 ms hops to carry a pitch.
MIN_VOICED = 0.25
# Share of a scene's labelled windows one voice needs to "hold" that scene.
SCENE_DOMINANCE = 0.6
# Share of single-person shot time where the person on screen must be the voice
# heard, after the best person<->voice assignment, to call it a validated
# multi-camera dialogue.
MIN_AGREEMENT = 0.6
# Clothing colour distance (median Lab a*b*, 0-255 scale) for "same person" /
# "different person". Histogram correlation was tried first and failed across
# camera angles (grading and haze differ per camera: robe close-up vs wide
# 0.04); the median chroma held (same guest 2-11 apart, the two guests 21).
SAME_PERSON = 8.0
OTHER_PERSON = 12.0
# A wide shot's two bodies are matched to the close-up guests only when the
# better left/right assignment beats the swapped one by this much, and every
# matched body sits within MAX_BODY_DISTANCE of its guest.
MIN_SIDE_MARGIN = 8.0
MAX_BODY_DISTANCE = 15.0


def load_audio(video_path, start_s=0.0, duration_s=None, sr=VOICE_SR):
    """Mono float32 samples of the clip's audio, or an empty array."""
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start_s:.4f}"]
    if duration_s is not None:
        cmd += ["-t", f"{duration_s:.4f}"]
    cmd += ["-i", video_path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"]
    try:
        raw = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             timeout=300).stdout
    except (subprocess.SubprocessError, OSError):
        raw = b""
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def pitch_track(samples, sr=VOICE_SR, frame_s=0.04, hop_s=0.02):
    """F0 in Hz per ``hop_s`` hop (0 = unvoiced/silent), by autocorrelation."""
    samples = np.asarray(samples, dtype=np.float32)
    fl, hop = int(frame_s * sr), int(hop_s * sr)
    if len(samples) < fl:
        return np.zeros(0)
    n = 1 + (len(samples) - fl) // hop
    frames = np.lib.stride_tricks.as_strided(
        samples, shape=(n, fl), strides=(samples.strides[0] * hop, samples.strides[0]))
    frames = frames - frames.mean(axis=1, keepdims=True)
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    loud = rms >= max(np.percentile(rms, 95) * 0.15, 1e-4)
    lo, hi = int(sr / PITCH_MAX_HZ), int(sr / PITCH_MIN_HZ)
    spec = np.fft.rfft(frames, n=2 * fl, axis=1)
    ac = np.fft.irfft(np.abs(spec) ** 2, axis=1)[:, :fl]
    ac = ac / (ac[:, :1] + 1e-9)
    lags = lo + np.argmax(ac[:, lo:hi], axis=1)
    strength = ac[np.arange(n), lags]
    f0 = np.where(loud & (strength > 0.5), sr / lags, 0.0)
    return f0


def window_pitches(f0, hop_s=0.02, window_s=WINDOW_SECONDS):
    """Median voiced F0 per decision window (0 where too little is voiced)."""
    per = max(1, int(round(window_s / hop_s)))
    out = []
    for i in range(0, len(f0), per):
        chunk = np.asarray(f0[i:i + per])
        voiced = chunk[chunk > 0]
        out.append(float(np.median(voiced))
                   if len(chunk) and len(voiced) >= MIN_VOICED * per else 0.0)
    return out


def voice_labels(pitches, min_ratio=MIN_PITCH_RATIO, min_share=MIN_VOICE_SHARE):
    """Per-window voice id (0 = lower voice, 1 = higher) or None, or None
    overall when the windows do not form two clearly separate voices."""
    vals = np.asarray([p for p in pitches if p > 0], dtype=float)
    if len(vals) < 6:
        return None
    logs = np.log(vals)
    c = np.percentile(logs, [20, 80]).astype(float)
    for _ in range(20):
        assign = np.abs(logs[:, None] - c[None, :]).argmin(axis=1)
        if assign.min() == assign.max():
            return None
        c = np.array([logs[assign == k].mean() for k in (0, 1)])
    if np.exp(c[1] - c[0]) < min_ratio:
        return None
    if min((assign == 0).mean(), (assign == 1).mean()) < min_share:
        return None
    labels = []
    for p in pitches:
        if p <= 0:
            labels.append(None)
            continue
        d = np.abs(np.log(p) - c)
        # Windows sitting between the two voices are overlap or noise: no vote.
        labels.append(None if abs(d[0] - d[1]) < 0.25 * (c[1] - c[0]) else int(d.argmin()))
    return labels


def dominant_voice(labels, start_s, end_s, window_s=WINDOW_SECONDS,
                   dominance=SCENE_DOMINANCE):
    """The voice holding [start_s, end_s), or None when mixed or silent."""
    i0, i1 = int(start_s / window_s), max(int(start_s / window_s) + 1, int(end_s / window_s))
    votes = [v for v in labels[i0:i1] if v is not None]
    if len(votes) < 2:
        return None
    for v in (0, 1):
        if votes.count(v) / len(votes) >= dominance:
            return v
    return None


def map_voices_by_mouth(activity, labels, margin=0.1):
    """{voice: face index} from which mouth moves more under each voice, or
    None. Aggregating over every window of a voice is far steadier than the
    per-window mouth comparison, which is where the old path lost two-shots."""
    if not activity or not labels:
        return None
    diffs = {}
    for v in (0, 1):
        d = [a[0] - a[1] for a, lab in zip(activity, labels) if lab == v]
        if len(d) < 3:
            return None
        diffs[v] = float(np.mean(d))
    if abs(diffs[0]) < margin or abs(diffs[1]) < margin or (diffs[0] > 0) == (diffs[1] > 0):
        return None
    return {v: (0 if diffs[v] > 0 else 1) for v in (0, 1)}


def voice_verdicts(labels, mapping):
    """Per-window face verdicts from voice labels and a voice->face mapping."""
    return [None if lab is None else mapping[lab] for lab in labels]


def assign_people_to_voices(shots):
    """Best one-to-one person<->voice assignment for single-person shots.

    ``shots`` is [(person, dominant_voice or None, seconds)]. Returns
    ({person: voice}, agreement) or (None, 0.0). Agreement is the share of
    voiced shot time where the person on screen is the voice heard; reaction
    shots (listener on screen) are what keeps it below 1.
    """
    people = sorted({p for p, _v, _d in shots if p is not None})
    if len(people) != 2:
        return None, 0.0
    total = sum(d for p, v, d in shots if p is not None and v is not None)
    if total <= 0:
        return None, 0.0
    best = None
    for mapping in ({people[0]: 0, people[1]: 1}, {people[0]: 1, people[1]: 0}):
        matched = {p: 0.0 for p in people}
        for p, v, d in shots:
            if p is not None and v is not None and mapping[p] == v:
                matched[p] += d
        score = sum(matched.values())
        if best is None or score > best[1]:
            best = (mapping, score, matched)
    mapping, score, matched = best
    # Each person must be seen speaking at least once, or the "cut to the
    # speaker" claim rests on one side only.
    if min(matched.values()) <= 0:
        return None, score / total
    return mapping, score / total


def cluster_people(signatures, same=SAME_PERSON, other=OTHER_PERSON):
    """Group appearance signatures into person ids (None = ambiguous)."""
    ids, centres = [], []
    for sig in signatures:
        if sig is None:
            ids.append(None)
            continue
        dists = [float(np.linalg.norm(np.asarray(c) - sig)) for c in centres]
        best = int(np.argmin(dists)) if dists else -1
        if dists and dists[best] <= same:
            ids.append(best)
        elif not dists or min(dists) >= other:
            centres.append(np.asarray(sig, dtype=float))
            ids.append(len(centres) - 1)
        else:
            ids.append(None)
    return ids, centres


def match_sides(side_sigs, centres, margin=MIN_SIDE_MARGIN, max_dist=MAX_BODY_DISTANCE):
    """[person of left body, person of right body] or None when unclear."""
    if len(centres) != 2 or any(s is None for s in side_sigs):
        return None
    d = [[float(np.linalg.norm(np.asarray(c) - s)) for c in centres] for s in side_sigs]
    straight, swapped = d[0][0] + d[1][1], d[0][1] + d[1][0]
    people = [0, 1] if straight <= swapped else [1, 0]
    if abs(straight - swapped) < margin or max(d[0][people[0]], d[1][people[1]]) > max_dist:
        return None
    return people


def appearance(frame, box):
    """Median Lab chroma (a*, b*) of a torso region, centred on 0. Clothes
    identify a guest across camera angles far more reliably than a 45px face."""
    import cv2
    h_img, w_img = frame.shape[:2]
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    x0, x1 = max(0, x0), min(w_img, x1)
    y0, y1 = max(0, y0), min(h_img, y1)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    lab = cv2.cvtColor(np.ascontiguousarray(frame[y0:y1, x0:x1]), cv2.COLOR_BGR2LAB)
    return np.median(lab.reshape(-1, 3)[:, 1:].astype(float), axis=0) - 128.0


def face_torso(face_box):
    """Torso rect below a face box [x, y, w, h] as (x0, y0, x1, y1)."""
    x, y, w, h = face_box
    return x - 0.5 * w, y + 1.2 * h, x + 1.5 * w, y + 3.2 * h


def body_torso(body):
    """Upper-torso rect inside a full-body person box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = body
    bw, bh = x1 - x0, y1 - y0
    return x0 + 0.2 * bw, y0 + 0.22 * bh, x1 - 0.2 * bw, y0 + 0.5 * bh


def _mean_sig(sigs):
    sigs = [s for s in sigs if s is not None]
    return np.median(sigs, axis=0) if sigs else None


def _persons(m, frame):
    """All YOLO person boxes (x0, y0, x1, y1) in original coordinates."""
    small, scale = m._detection_frame(frame)
    with m.DETECT_LOCK:
        results = m.model(small, verbose=False, classes=[0])
    boxes = []
    for result in results or []:
        for box in result.boxes:
            if float(box.conf[0]) < 0.4:
                continue
            boxes.append([float(v) * scale for v in box.xyxy[0]])
    return boxes


MULTICAM_SAMPLES = 6


def multicam_dialogue(video_path, scene_boundaries, strategies, fps, m,
                      min_face_width=0.045, min_separation=0.20, min_wide_seconds=2.5):
    """Speaker attribution for a produced (multi-camera) conversation.

    Returns a dict with ``validated``, per-shot records and ``wide`` = {scene
    index: (held verdicts, (left_centre, right_centre), person ids)} for wide
    two-person shots the caller can cut inside. Never raises for "no evidence":
    ``validated`` is False and ``reason`` says why.
    """
    import cv2
    import frame_sampler

    result = {'validated': False, 'mode': 'multicam', 'shots': [], 'wide': {}}
    duration = scene_boundaries[-1][1] / fps if scene_boundaries else 0.0
    labels = voice_labels(window_pitches(pitch_track(load_audio(video_path, 0.0, duration))))
    if labels is None:
        result['reason'] = 'audio does not contain two clearly separable voices'
        return result
    result['voiceWindows'] = len(labels)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        result['reason'] = 'cannot open video'
        return result
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    plan = []
    for i, (s_f, e_f) in enumerate(scene_boundaries):
        margin = min(2, max(0, (e_f - s_f - 1) // 2))
        for f in sorted({int(round(x)) for x in np.linspace(s_f + margin, e_f - 1 - margin,
                                                            MULTICAM_SAMPLES)}):
            plan.append((i, f))
    faces = {i: [] for i in range(len(scene_boundaries))}
    bodies = {i: [] for i in range(len(scene_boundaries))}
    try:
        for (i, _f), frame in zip(plan, frame_sampler.read_at(cap, [f for _i, f in plan])):
            if frame is None or frame.mean() < 16:
                continue
            if strategies[i] == 'TRACK':
                big = [c for c in m.detect_face_candidates(frame)
                       if c['box'][2] >= min_face_width * frame_w]
                faces[i].append(appearance(frame, face_torso(big[0]['box']))
                                if len(big) == 1 else None)
            elif strategies[i] == 'GENERAL':
                persons = sorted(_persons(m, frame), key=lambda b: (b[2] - b[0]) * (b[3] - b[1]),
                                 reverse=True)[:2]
                if len(persons) == 2:
                    persons.sort(key=lambda b: b[0])
                    gap = ((persons[1][0] + persons[1][2]) - (persons[0][0] + persons[0][2])) / 2
                    if gap >= min_separation * frame_w:
                        bodies[i].append((persons, [appearance(frame, body_torso(b))
                                                    for b in persons]))
                        continue
                bodies[i].append(None)
    finally:
        cap.release()

    shot_sigs, shot_idx = [], []
    for i, sigs in faces.items():
        good = [s for s in sigs if s is not None]
        if sigs and len(good) >= 2 * len(sigs) / 3.0:
            shot_sigs.append(_mean_sig(good))
            shot_idx.append(i)
    person_ids, centres = cluster_people(shot_sigs)
    shots = []
    for i, pid in zip(shot_idx, person_ids):
        s_f, e_f = scene_boundaries[i]
        voice = dominant_voice(labels, s_f / fps, e_f / fps)
        shots.append((i, pid, voice, (e_f - s_f) / fps))
    mapping, agreement = assign_people_to_voices([(p, v, d) for _i, p, v, d in shots])
    result['agreement'] = round(agreement, 3)
    alternations = sum(1 for a, b in zip(shots, shots[1:])
                       if a[1] is not None and b[1] is not None and a[1] != b[1])
    if mapping is None or len(centres) != 2:
        result['reason'] = f'{len(centres)} distinct on-screen people; need exactly two with a matching voice each'
        return result
    if agreement < MIN_AGREEMENT or alternations < 1:
        result['reason'] = (f'on-screen person matched the voice for {agreement:.0%} of shot time '
                            f'with {alternations} person changes')
        return result
    result['validated'] = True
    result['voiceOfPerson'] = {int(p): int(v) for p, v in mapping.items()}
    for i, pid, voice, _d in shots:
        s_f, e_f = scene_boundaries[i]
        result['shots'].append({'sceneIndex': i, 'startSeconds': s_f / fps,
                                'endSeconds': e_f / fps, 'person': pid, 'voice': voice,
                                'activeSpeakerOnScreen': pid is not None and voice is not None
                                and mapping.get(pid) == voice})

    person_of_voice = {v: p for p, v in mapping.items()}
    for i, samples in bodies.items():
        s_f, e_f = scene_boundaries[i]
        if not samples or (e_f - s_f) / fps < min_wide_seconds:
            continue
        good = [s for s in samples if s is not None]
        if len(good) < 2 * len(samples) / 3.0:
            continue
        left = tuple(float(np.median([g[0][0][k] for g in good])) for k in range(4))
        right = tuple(float(np.median([g[0][1][k] for g in good])) for k in range(4))
        side_person = match_sides([_mean_sig([g[1][0] for g in good]),
                                   _mean_sig([g[1][1] for g in good])], centres)
        if side_person is None:
            continue
        side_of_person = {p: s for s, p in enumerate(side_person)}
        w0 = int(s_f / fps / WINDOW_SECONDS)
        n = max(1, int(round((e_f - s_f) / fps / WINDOW_SECONDS)))
        window_labels = (labels[w0:w0 + n] + [None] * n)[:n]
        verdicts = [None if lab is None else side_of_person[person_of_voice[lab]]
                    for lab in window_labels]
        held = hold(verdicts)
        if all(v is None for v in held):
            continue
        as_centre = lambda b: ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1])
        result['wide'][i] = (held, (as_centre(left), as_centre(right)), side_person)
    return result
