"""Punch-in: a short push toward the subject on the beats that carry the clip.

Not a layout. Every other mode here decides WHERE the frame sits; this one
decides when it moves in, which is the difference between a clip that reads as
footage and one that reads as edited. A static crop for 45 seconds is the single
most "unedited" thing a vertical clip can do.

The push is deliberately small. Anything past ~15% starts cropping the speaker's
head on a face-framed shot, and on an upscaled source it also starts showing.
The curve is asymmetric on purpose: fast in, hold, slow out, which is how a
human operator does it and how it reads as intent rather than drift.

It rides the TRACK path, widening the existing per-frame crop command from
x-only to w/h/x/y, so it composes with the camera trajectory instead of fighting
it. Off by default (``PUNCH_IN=1``).

Beat times come from the audio envelope. The transcript would be a better
source (punch on the hook word, not on the loudest syllable), and render() has
no transcript today — ``emphasis_times`` is a plain list of seconds, so wiring
main.py's word timings in later needs no change here.
"""
import os

import numpy as np

ENABLED = os.environ.get("PUNCH_IN", "0") == "1"

# Peak zoom. 1.12 crops 11% off each dimension: visible as intent, still short
# of cutting into a head framed by the TRACK crop.
MAX_ZOOM = float(os.environ.get("PUNCH_IN_ZOOM", "1.12"))

# Envelope, in seconds: snap in, sit there, drift out.
RISE_SECONDS = 0.25
HOLD_SECONDS = 1.30
FALL_SECONDS = 0.55

# Never punch twice inside this window. Two pushes in quick succession read as a
# glitch, and the second one lands before the first has released.
#
# Audio-envelope resolution used to find beats.
BEAT_WINDOW = 0.2

# A beat must exceed the clip's median loudness by this much of the gap to its
# peak. Low values punch on every syllable; this keeps it to real emphasis.
#
# These two were shipped at 4.0/0.45 and that produced 8.4 punches per minute of
# clip, one every seven seconds. That is not a push on the beat, it is a twitch.
# Swept over 20 corpus clips (31-jul-2026), punches per minute, median and max:
#
#   gap  prom    median  max          gap  prom    median  max
#   4.0  0.45       8.4  11.8        12.0  0.60       2.9   4.6
#   4.0  0.75       2.4   5.8        18.0  0.45       2.9   3.9
#   8.0  0.60       3.4   5.9        18.0  0.60       2.8   3.0
#
# 18.0/0.60 is picked for having the tightest spread, not just the right median:
# a setting whose worst case is 3.0/min never surprises anyone, while 12.0/0.60
# has the same median but can still reach 4.6 on a loud clip. No setting left a
# clip with zero punches.
MIN_GAP_SECONDS = 18.0
BEAT_PROMINENCE = 0.60


def _ease(t):
    """Smoothstep on [0, 1]. Linear ramps look mechanical at this duration."""
    t = min(max(t, 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


def zoom_curve(n_frames, fps, emphasis_times, max_zoom=None,
               start_offset=0.0):
    """Per-frame zoom factor (1.0 = untouched) for one scene.

    ``emphasis_times`` are absolute seconds; ``start_offset`` is where this
    scene begins, so callers can pass clip-level beats unchanged.
    """
    max_zoom = MAX_ZOOM if max_zoom is None else max_zoom
    zooms = [1.0] * max(0, n_frames)
    if not zooms or max_zoom <= 1.0:
        return zooms

    span = RISE_SECONDS + HOLD_SECONDS + FALL_SECONDS
    for t in emphasis_times:
        local = t - start_offset
        if local <= -span or local >= n_frames / fps:
            continue
        for f in range(max(0, int(local * fps)),
                       min(n_frames, int((local + span) * fps) + 1)):
            dt = f / fps - local
            if dt < 0:
                continue
            if dt < RISE_SECONDS:
                amount = _ease(dt / RISE_SECONDS)
            elif dt < RISE_SECONDS + HOLD_SECONDS:
                amount = 1.0
            elif dt < span:
                amount = 1.0 - _ease(
                    (dt - RISE_SECONDS - HOLD_SECONDS) / FALL_SECONDS)
            else:
                continue
            # Overlapping pushes take the strongest rather than compounding.
            zooms[f] = max(zooms[f], 1.0 + (max_zoom - 1.0) * amount)
    return zooms


def crop_boxes(xs, zooms, crop_w, crop_h, orig_w, orig_h):
    """Per-frame (w, h, x, y), zooming about the tracked crop's own centre.

    Keeping the centre fixed is what makes this a push rather than a pan: the
    subject stays put and the frame closes in around them.
    """
    boxes = []
    for i, x in enumerate(xs):
        z = zooms[i] if i < len(zooms) else 1.0
        w = int(crop_w / z)
        h = int(crop_h / z)
        w -= w % 2
        h -= h % 2
        w = max(2, min(w, orig_w))
        h = max(2, min(h, orig_h))

        cx = x + crop_w / 2.0
        cy = crop_h / 2.0
        nx = int(round(cx - w / 2.0))
        ny = int(round(cy - h / 2.0))
        nx = max(0, min(nx, orig_w - w))
        ny = max(0, min(ny, orig_h - h))
        boxes.append((w, h, nx - (nx % 2), ny - (ny % 2)))
    return boxes


def sendcmd_lines(boxes, fps, target="crop@c"):
    """sendcmd lines for per-frame w/h/x/y, deduped to change-points.

    Same contract as reframe_v2.dedupe_sendcmd_lines, but four parameters: at
    30fps a 45s clip is 1350 frames and writing every parameter every frame
    makes a command file large enough to slow the filter down.
    """
    lines = []
    prev = None
    for i, box in enumerate(boxes):
        if box == prev:
            continue
        t = max(0, (i - .5) / fps)
        w, h, x, y = box
        pw, ph, px, py = prev if prev else (None, None, None, None)
        if w != pw:
            lines.append(f"{t:.6f} {target} w {w};")
        if h != ph:
            lines.append(f"{t:.6f} {target} h {h};")
        if x != px:
            lines.append(f"{t:.6f} {target} x {x};")
        if y != py:
            lines.append(f"{t:.6f} {target} y {y};")
        prev = box
    return lines


def emphasis_times(video_path, duration, window=BEAT_WINDOW,
                   min_gap=MIN_GAP_SECONDS, prominence=BEAT_PROMINENCE):
    """Seconds where the audio leaps above its own baseline.

    A stand-in for the hook words until the transcript is wired through. Returns
    [] for silent or unreadable audio, which simply means no punches.
    """
    import active_speaker

    envelope = active_speaker.audio_envelope(video_path, 0.0, duration,
                                             window_s=window)
    if not envelope:
        return []

    values = np.asarray(envelope, dtype=float)
    baseline = float(np.median(values))
    peak = float(values.max())
    if peak - baseline <= 1e-6:
        return []

    threshold = baseline + (peak - baseline) * prominence
    times = []
    last = -1e9
    for i, v in enumerate(values):
        t = i * window
        if v >= threshold and t - last >= min_gap:
            times.append(round(t, 3))
            last = t
    return times
