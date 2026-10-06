"""SPLIT layout: two speakers stacked one above the other in the 9:16 frame.

The third layout, next to TRACK (crop to one face) and GENERAL (blurred
background). It exists for the one case both of the others handle badly: two
people sharing a wide shot and talking to each other. TRACK picks one of them
and throws away the reaction, which is usually where the hook is; GENERAL keeps
both but shrinks them to a strip floating in blur.

Stacking gives each speaker a half-frame crop, so a 1920x1080 source feeds each
half a 1215x1080 region that scales DOWN to 1080x960. No upscaling, unlike the
single-face crop of a 720p source.

Gated off by default (``SPLIT_LAYOUT=1`` to enable): a wrong SPLIT is a worse
failure than a wrong TRACK, because half the frame is then a person who never
moves.
"""
import os

import numpy as np

import frame_sampler

ENABLED = os.environ.get("SPLIT_LAYOUT", "0") == "1"

# Fraction of sampled frames that must show BOTH faces at once.
#
# Coexistence in one frame is the thing being tested: it separates a real
# two-shot from a plano/contraplano cut between two cameras, where each face is
# on screen most of the time but never together, and where stacking would show
# the same person twice.
#
# The bar is 0.5 and not higher because BlazeFace loses faces in profile — which
# is exactly how someone sits while listening to the person next to them.
# Measured on a 22s two-shot: 6 of 10 readable samples had both faces, and every
# miss was one speaker turned to face the other, with both plainly in frame. A
# 0.7 bar rejected that scene, i.e. it rejected the conversation for looking
# like a conversation.
MIN_COEXISTENCE = 0.5

# Horizontal separation between the two face centres, as a fraction of frame
# width. Two faces closer than this are people sitting shoulder to shoulder,
# which a single TRACK crop already frames fine — stacking them would show the
# same pair of shoulders twice.
MIN_SEPARATION = 0.20

# Faces smaller than this (width, as a fraction of frame width) are background
# extras, an audience, or a photo on the wall. Stacking onto one would fill half
# the output with a blurry stranger.
MIN_FACE_WIDTH = 0.045

# Below this a stacked layout reads as a glitch rather than a choice: the viewer
# needs a beat to understand the split before it cuts away.
MIN_SCENE_SECONDS = 2.5

# Fraction of the source height each half-crop takes. At 1.0 the crop is as wide
# as the half-frame aspect allows (1215px on a 1920x1080 source), which never
# upscales but leaves the OTHER speaker's shoulder visible in the corner when
# the two sit close together. Tightening drops the neighbour out of frame at the
# cost of some upscale: 0.8 on a 1080p source scales 972 -> 1080, i.e. 1.11x.
SPLIT_TIGHTNESS = float(os.environ.get("SPLIT_TIGHTNESS", "0.8"))


# Two boxes overlapping by more than this are the same face reported twice.
# BlazeFace applies no suppression of its own, so nothing upstream guarantees
# one box per head, and every layout here decides by headcount. Kept as a cheap
# guard rather than a fix for a measured bug: on the corpus no duplicate pair
# ever exceeded this, so it currently changes no decision.
MAX_FACE_OVERLAP = 0.30


def _iou(a, b):
    """Intersection over union of two [x, y, w, h] boxes."""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def dedupe_faces(candidates, threshold=MAX_FACE_OVERLAP):
    """Drop duplicate detections of the same face, keeping the biggest."""
    kept = []
    for cand in sorted(candidates, key=lambda c: c['box'][2] * c['box'][3],
                       reverse=True):
        if all(_iou(cand['box'], k['box']) <= threshold for k in kept):
            kept.append(cand)
    return kept


def _two_largest(candidates, frame_w):
    """The two biggest faces in a frame, left first, or None."""
    big = [c for c in dedupe_faces(candidates)
           if c['box'][2] >= MIN_FACE_WIDTH * frame_w]
    if len(big) < 2:
        return None
    big.sort(key=lambda c: c['score'], reverse=True)
    a, b = big[0], big[1]
    return tuple(sorted((a, b), key=lambda c: c['box'][0]))


def _centre(box):
    """(cx, cy, w, h). The size travels with the centre because active_speaker
    needs a mouth region, and re-detecting the faces to get it back would mean a
    second pass over the same frames."""
    x, y, w, h = box
    return x + w / 2.0, y + h / 2.0, float(w), float(h)


def as_box(centre):
    """Inverse of _centre: an [x, y, w, h] box from a (cx, cy, w, h) tuple."""
    cx, cy, w, h = centre
    return [cx - w / 2.0, cy - h / 2.0, w, h]


def analyze_scene(frames, frame_w):
    """Decide whether these sampled frames show a stackable two-shot.

    ``frames`` is a list of per-frame face candidate lists (same shape as
    ``detect_face_candidates`` returns). Returns ``(left, right)`` face
    centres as (cx, cy) pairs, or None.
    """
    if not frames:
        return None

    lefts, rights = [], []
    for candidates in frames:
        pair = _two_largest(candidates, frame_w)
        if not pair:
            continue
        left_c, right_c = _centre(pair[0]['box']), _centre(pair[1]['box'])
        if (right_c[0] - left_c[0]) < MIN_SEPARATION * frame_w:
            continue
        lefts.append(left_c)
        rights.append(right_c)

    if len(lefts) < MIN_COEXISTENCE * len(frames):
        return None

    # Median, not mean: one frame where the detector latched onto a bystander
    # would drag a mean crop off the speaker for the whole scene.
    left = tuple(float(np.median([c[i] for c in lefts])) for i in range(4))
    right = tuple(float(np.median([c[i] for c in rights])) for i in range(4))
    return left, right


def split_geometry(orig_w, orig_h, out_w, out_h, centre):
    """Crop box (w, h, x, y) framing ``centre`` for one half of the stack.

    Each half is out_w x out_h/2, so the crop is much wider than the 9:16 one
    TRACK uses; on a 16:9 source it is the full height and ~63% of the width.
    """
    half_h = out_h // 2
    half_h -= half_h % 2
    aspect = out_w / float(half_h)

    crop_h = int(round(orig_h * max(0.3, min(SPLIT_TIGHTNESS, 1.0))))
    crop_w = int(round(crop_h * aspect))
    if crop_w > orig_w:
        crop_w = orig_w
        crop_h = int(round(crop_w / aspect))

    crop_w -= crop_w % 2
    crop_h -= crop_h % 2

    cx, cy = centre[0], centre[1]
    x = int(round(cx - crop_w / 2.0))
    x = max(0, min(x, orig_w - crop_w))

    # Faces sit high in a frame, so centring the crop on the face centre buries
    # the speaker's chin at the bottom edge when the crop is shorter than the
    # source. Bias the box down a little to keep headroom natural.
    y = int(round(cy - crop_h * 0.42))
    y = max(0, min(y, orig_h - crop_h))

    return crop_w, crop_h, x - (x % 2), y - (y % 2), half_h


def split_filtergraph(orig_w, orig_h, out_w, out_h, left_centre, right_centre):
    """vstack of two face-framed crops. Left-hand speaker goes on top.

    Screen position is the only stable ordering available without diarisation:
    keying off who speaks first would swap the two halves between scenes of the
    same conversation, which reads as an edit mistake.
    """
    top_w, top_h, top_x, top_y, half_h = split_geometry(
        orig_w, orig_h, out_w, out_h, left_centre)
    bot_w, bot_h, bot_x, bot_y, _ = split_geometry(
        orig_w, orig_h, out_w, out_h, right_centre)

    return (
        f"[0:v]split=2[ta][ba];"
        f"[ta]crop=w={top_w}:h={top_h}:x={top_x}:y={top_y},"
        f"scale={out_w}:{half_h}[top];"
        f"[ba]crop=w={bot_w}:h={bot_h}:x={bot_x}:y={bot_y},"
        f"scale={out_w}:{half_h}[bot];"
        f"[top][bot]vstack=inputs=2,"
        # vstack of two half_h halves can be 2px short of out_h after the
        # even-rounding above; pad rather than scale so neither half is
        # resampled a second time.
        f"pad={out_w}:{out_h}:0:0,setsar=1[v]"
    )


# One sample per this many seconds of scene, within the bounds below. A fixed
# count made long scenes fragile: on a 22s two-shot, 8 samples put the estimate
# within one profile-turn of flipping the verdict. Sampling in proportion to
# duration makes it stable without moving the bar.
SECONDS_PER_SAMPLE = 1.5
MIN_SAMPLES = 8
MAX_SAMPLES = 24


def detect_split_scenes(video_path, scenes, strategies, samples=None):
    """Upgrade qualifying scenes to SPLIT.

    Returns ``{scene_index: (left_centre, right_centre)}``. Only scenes the
    existing classifier sent to GENERAL are considered: a GENERAL verdict
    already means "more than one face", and leaving TRACK alone keeps this from
    touching the single-speaker material that is most of the corpus.
    """
    import cv2
    try:
        import tracking as m
    except ImportError:
        import main as m

    if not ENABLED:
        return {}

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {}

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    found = {}
    plan = []

    try:
        for i, (start, end) in enumerate(scenes):
            if i < len(strategies) and strategies[i] != 'GENERAL':
                continue
            s_f, e_f = start.get_frames(), end.get_frames()
            duration = (e_f - s_f) / fps
            if duration < MIN_SCENE_SECONDS:
                continue

            n = samples or int(min(max(duration / SECONDS_PER_SAMPLE,
                                       MIN_SAMPLES), MAX_SAMPLES))

            last_f = e_f - 1
            if total_frames:
                last_f = min(last_f, total_frames - 1)
            if last_f < s_f:
                continue

            plan.append((i, n, [int(round(f)) for f in np.linspace(s_f, last_f, n)]))

        flat = [f_idx for _i, _n, idxs in plan for f_idx in idxs]
        frames = frame_sampler.read_at(cap, flat)
        for i, n, idxs in plan:
            sampled = []
            for _f_idx in idxs:
                frame = next(frames)
                if frame is None:
                    continue
                if frame.mean() < 16:  # fade to black, same as the classifier
                    continue
                sampled.append(m.detect_face_candidates(frame))

            if len(sampled) < max(4, n // 2):
                continue

            pair = analyze_scene(sampled, frame_w)
            if pair:
                found[i] = pair
    finally:
        cap.release()

    return found
