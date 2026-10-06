"""SCREENCAST layout: full-width content on top, the speaker underneath.

The fourth layout. It targets the failure this repo has now attacked three
times: a screen recording that happens to contain a face gets classified TRACK,
the 9:16 crop keeps a centre strip, and the chart or headline the shot is
actually about comes out sliced mid-word.

The two previous attempts tried to find that content in pixels and both failed
(see the note above analyze_scenes_strategy in main.py): edge density and MSER
text density BOTH score ordinary detailed footage higher than a clean panel of
text, because they measure visual busyness rather than meaning. The third
attempt asked Gemini and detected well, but decided badly: it flagged corner
tickers and demoted well-framed talking heads to the blurred layout.

What is different here is the question asked and what the answer is used for.

  - The question is how much of the WIDTH the content spans, not how much of the
    duration it covers. Coverage did not separate the cases (screencasts ran
    88-97% of the video, a corner-ticker clip 2%, but the failure was on the
    ticker anyway). Width is the quantity that actually decides whether a 9:16
    crop destroys information: a corner bug spans ~15% of the frame and survives
    any crop, a spreadsheet spans ~100% and cannot.
  - The answer routes to THIS layout, not to GENERAL. The old wiring's worst
    case was shrinking a subject into blurred filler to preserve a corner
    counter. Here the worst case is showing the content full width above the
    speaker, which is a reasonable frame even when the trigger was wrong.

Off by default (``SCREENCAST_LAYOUT=1``). Needs GEMINI_API_KEY; without one it
is a silent no-op, like every other optional Gemini path here.
"""
import json
import os
import time

import numpy as np

ENABLED = os.environ.get("SCREENCAST_LAYOUT", "0") == "1"

# Fraction of the frame width the content must span. A corner ticker, logo or
# channel bug sits far below this; a screen recording, slide or spreadsheet sits
# near 1.0. This is the axis the previous attempt did not ask about.
MIN_WIDTH_FRACTION = 0.5

# Above this the content fills the frame, so any presenter is composited ON TOP
# of it rather than sitting beside it. Stacking then shows the same content
# twice: measured on an Excel walkthrough where the speaker is keyed into the
# corner, the bottom band came out as a zoomed crop of the same spreadsheet.
# Those scenes get the full-width GENERAL layout instead, which is the fix they
# actually needed — the default GENERAL ratio crops ~24% off the sides, and on a
# spreadsheet the discarded columns are the point.
STACK_MAX_WIDTH_FRACTION = 0.85

# Seconds of overlap before a scene counts as showing the content.
MIN_OVERLAP_SECONDS = 0.25

# The speaker crop below the content needs a face of at least this width
# (fraction of frame width). Smaller than this and the bottom half is mostly
# desktop with a stamp-sized webcam in it, which is worse than GENERAL.
MIN_FACE_WIDTH = 0.05


def content_bands(orig_w, orig_h, out_w, out_h):
    """(content_height, speaker_height) for the stacked screencast frame.

    The content keeps its full width, which is the entire point of this layout,
    so its height follows from the source aspect: a 16:9 source gives 608px of a
    1920px frame. The speaker takes the rest.
    """
    content_h = int(round(out_w * orig_h / float(orig_w)))
    content_h -= content_h % 2
    content_h = max(2, min(content_h, out_h - 2))
    speaker_h = out_h - content_h
    return content_h, speaker_h


def speaker_crop(orig_w, orig_h, out_w, speaker_h, face_centre):
    """Crop box (w, h, x, y) for the speaker band, framed on the face."""
    aspect = out_w / float(speaker_h)

    crop_h = orig_h
    crop_w = int(round(crop_h * aspect))
    if crop_w > orig_w:
        crop_w = orig_w
        crop_h = int(round(crop_w / aspect))

    crop_w -= crop_w % 2
    crop_h -= crop_h % 2

    cx, cy = face_centre
    x = int(round(cx - crop_w / 2.0))
    x = max(0, min(x, orig_w - crop_w))
    y = int(round(cy - crop_h * 0.42))
    y = max(0, min(y, orig_h - crop_h))

    return crop_w, crop_h, x - (x % 2), y - (y % 2)


def screencast_filtergraph(orig_w, orig_h, out_w, out_h, face_centre):
    """Full-width content above, face-framed speaker below."""
    content_h, speaker_h = content_bands(orig_w, orig_h, out_w, out_h)
    cw, ch, cx, cy = speaker_crop(orig_w, orig_h, out_w, speaker_h, face_centre)

    return (
        f"[0:v]split=2[ca][sa];"
        # The content band is the WHOLE frame scaled down. Nothing is cropped
        # off the sides, which is the one thing this layout exists to guarantee.
        f"[ca]scale={out_w}:{content_h}[content];"
        f"[sa]crop=w={cw}:h={ch}:x={cx}:y={cy},scale={out_w}:{speaker_h}[speaker];"
        f"[content][speaker]vstack=inputs=2,"
        f"pad={out_w}:{out_h}:0:0,setsar=1[v]"
    )


def detect_faces_full_res(frame):
    """Face boxes from the UNSCALED frame, in original coordinates.

    detect_face_candidates() runs detection on a 640px copy, which is the
    right trade for a talking head whose face spans a third of the frame. A
    presenter inset into a screen recording does not survive it: measured on a
    1920x1080 Excel walkthrough, the presenter's ~110px face becomes ~37px at
    640 and BlazeFace returned zero detections on every sample. At full width
    the same frames detect fine. Six samples per scene, so the cost is paid on
    screencast candidates only.
    """
    import cv2
    try:
        import tracking as m
    except ImportError:
        import main as m

    h, w, _ = frame.shape
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    with m.DETECT_LOCK:
        results = m.face_detection.process(rgb)
    if not results.detections:
        return []

    out = []
    for detection in results.detections:
        b = detection.location_data.relative_bounding_box
        box = [int(b.xmin * w), int(b.ymin * h),
               int(b.width * w), int(b.height * h)]
        out.append({'box': box, 'score': box[2] * box[3]})
    return out


def _face_centre(candidates, frame_w):
    """Centre of the biggest usable face in a frame, or None."""
    big = [c for c in candidates if c['box'][2] >= MIN_FACE_WIDTH * frame_w]
    if not big:
        return None
    box = max(big, key=lambda c: c['score'])['box']
    return box[0] + box[2] / 2.0, box[1] + box[3] / 2.0


def overlapping_width(scene_start, scene_end, ranges):
    """Widest content the scene overlaps, as a fraction of frame width.

    0.0 when the scene overlaps nothing, which leaves its routing untouched.
    """
    widest = 0.0
    for r in ranges:
        start, end = r[0], r[1]
        width = r[3] if len(r) > 3 else 1.0
        if min(scene_end, end) - max(scene_start, start) > MIN_OVERLAP_SECONDS:
            widest = max(widest, width)
    return widest


def detect_content_ranges(video_path, video_duration):
    """Time ranges where on-screen content spans most of the frame width.

    Returns (start, end, what, width_fraction) tuples, or [] on any failure:
    a missing answer must degrade to today's routing rather than break the job.
    """
    if not ENABLED:
        return []
    api_key = "agy-job-rpc"
    if not api_key:
        return []

    import agy_compat as genai
    from agy_compat import types as genai_types
    import gemini_worker

    model_name = os.environ.get("GEMINI_MODEL") or 'gemini-3.1-flash-lite'
    print("🔎 Checking for full-width on-screen content…")
    # This is the ONE stage that sends the whole video file to Google rather
    # than a handful of frames, so it is also the one that leaves a copy of a
    # user's source on someone else's servers. The Files API keeps an upload for
    # 48 h unless it is deleted; the finally block below deletes it as soon as
    # the answer is back, which is what makes "we do not leave your video with
    # the model provider" a true sentence in the privacy policy.
    client = None
    file_upload = None
    try:
        client = genai.Client(api_key=api_key)
        file_upload = gemini_worker.upload_media(client, video_path)
        deadline = time.time() + 180
        while True:
            info = client.files.get(name=file_upload.name)
            state = str(getattr(getattr(info, "state", info), "name", "")).upper()
            if state == "ACTIVE":
                break
            if state == "FAILED" or time.time() > deadline:
                print("   ⚠️ Upload not usable — keeping face-only routing.")
                return []
            time.sleep(2)

        response = client.models.generate_content(
            model=model_name,
            contents=[file_upload,
                      gemini_worker.WIDE_CONTENT_PROMPT_TEMPLATE.format(
                          video_duration=video_duration)],
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=gemini_worker.WideContentResponse,
            ))
        gemini_worker.raise_if_blocked(response)
        raw = (json.loads(response.text) or {}).get("ranges") or []
    except Exception as e:
        print(f"   ⚠️ On-screen check failed ({e}) — keeping face-only routing.")
        return []
    finally:
        # Every exit path, including the two early returns above and the failure
        # branch: a video left behind because the call raised is exactly the
        # copy nobody would ever notice.
        if client is not None and file_upload is not None:
            try:
                client.files.delete(name=file_upload.name)
            except Exception as e:
                print(f"   ⚠️ Could not delete the uploaded source from Gemini "
                      f"Files ({e}) — it expires there in 48 h.")

    ranges = []
    for r in raw:
        try:
            s = max(0.0, float(r.get("start", 0)))
            e = min(float(video_duration), float(r.get("end", 0)))
            width = float(r.get("width_fraction", 0))
        except (TypeError, ValueError):
            continue
        # The width gate is the whole point: everything narrower survives a 9:16
        # crop and must not move a single scene.
        if e - s >= 0.5 and width >= MIN_WIDTH_FRACTION:
            ranges.append((s, e, str(r.get("what", ""))[:40], width))
    ranges.sort()

    if ranges:
        print("   📊 " + ", ".join(
            f"{w}@{s:.0f}-{e:.0f}s ({frac:.0%} wide)"
            for s, e, w, frac in ranges[:5]))
    else:
        print("   ✅ No full-width content — routing unchanged.")
    return ranges


def detect_screencast_scenes(video_path, scenes, strategies, ranges, samples=6):
    """Route scenes that show wide on-screen content.

    Returns ``{scene_index: ('SCREENCAST', centre) | ('WIDE', None)}``:

      - SCREENCAST stacks the content over the presenter, for content that
        leaves room beside itself (width below STACK_MAX_WIDTH_FRACTION) and
        where a presenter is actually found.
      - WIDE is the blurred layout with side-cropping disabled, for content that
        fills the frame, or that has no presenter to stack.
    """
    if not ENABLED or not ranges:
        return {}
    # Below the gate on purpose: main/tracking pulls torch/mediapipe, and the disabled
    # path (the default, and what CI exercises) must not pay that import.
    import cv2
    try:
        import tracking as m
    except ImportError:
        import main as m

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {}

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    found = {}

    try:
        for i, (start, end) in enumerate(scenes):
            s_f, e_f = start.get_frames(), end.get_frames()
            width = overlapping_width(s_f / fps, e_f / fps, ranges)
            if not width:
                continue

            # Content that fills the frame has the presenter on top of it, so
            # there is nothing to stack — just stop cropping the sides.
            if width > STACK_MAX_WIDTH_FRACTION:
                found[i] = ('WIDE', None)
                continue

            last_f = e_f - 1
            if total_frames:
                last_f = min(last_f, total_frames - 1)
            if last_f < s_f:
                continue

            centres = []
            for f_idx in np.linspace(s_f, last_f, samples):
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(f_idx)))
                ok, frame = cap.read()
                if not ok:
                    continue
                centre = _face_centre(detect_faces_full_res(frame), frame_w)
                if centre is None:
                    # A presenter keyed into the corner of a screen recording is
                    # often too small for BlazeFace even at full resolution
                    # (measured: zero detections across an Excel walkthrough
                    # where the person is plainly visible). YOLO finds the body
                    # in the same frames, and a body centre frames the speaker
                    # just as well for this layout.
                    person = m.detect_person_yolo(frame)
                    if person:
                        centre = (person[0] + person[2] / 2.0,
                                  person[1] + person[3] / 2.0)
                if centre:
                    centres.append(centre)

            # Half the samples: a webcam inset is static and easy to find, so a
            # weaker signal than this means there is no presenter to stack, and
            # the content still deserves its full width.
            if len(centres) < samples / 2.0:
                found[i] = ('WIDE', None)
                continue

            found[i] = ('SCREENCAST',
                        (float(np.median([c[0] for c in centres])),
                         float(np.median([c[1] for c in centres]))))
    finally:
        cap.release()

    return found


# --- screen panel: follow the active region -----------------------------------
#
# Scaling the whole 16:9 screen to 1080 wide leaves UI text at ~8px — nobody can
# read a Canva menu that way. The panel instead crops a ~1.7x window and moves
# it to where the screen is CHANGING (cursor, typing, a dialog opening), which
# on a tutorial is where the viewer should look. Movement is held/eased, never
# tracked frame-by-frame: the camera only moves when the activity leaves a
# dead zone for a while, then glides there, so the result reads as deliberate
# pans rather than jitter.

TARGET_SCREEN_SCALE = 1.7   # output px per source px we aim for
MIN_CROP_FRACTION = 0.45    # never crop narrower than this share of the width
SAMPLE_FPS = 5.0
DIFF_THRESHOLD = 14         # 8-bit grey levels
WINDOW_SECONDS = 1.6        # activity is pooled over this window
DEAD_ZONE = 0.18            # fraction of the crop size the target may drift
MIN_HOLD_SECONDS = 1.2      # a new target must persist this long to move
PAN_SECONDS = 0.8           # eased glide duration


def screen_crop_size(orig_w, orig_h, panel_w, panel_h):
    """(crop_w, crop_h) in source px with the panel's aspect."""
    aspect = panel_w / float(panel_h)
    crop_w = max(panel_w / TARGET_SCREEN_SCALE, orig_w * MIN_CROP_FRACTION)
    crop_w = min(crop_w, orig_w)
    crop_h = crop_w / aspect
    if crop_h > orig_h:
        crop_h = orig_h
        crop_w = crop_h * aspect
    return int(crop_w) // 2 * 2, int(crop_h) // 2 * 2


def place_outside(x, y, crop_w, crop_h, orig_w, orig_h, avoid, margin=8):
    """Nearest crop position to (x, y) that does not overlap ``avoid``.

    ``avoid`` is (x, y, w, h) in source px (the face-cam bubble). When no
    position clears it (the crop is too big) the clamped position is kept.
    """
    def clamp(v, lo, hi):
        return max(lo, min(v, hi))
    max_x, max_y = orig_w - crop_w, orig_h - crop_h
    x, y = clamp(x, 0, max_x), clamp(y, 0, max_y)
    if not avoid:
        return x, y
    ax, ay, aw, ah = avoid
    ax0, ay0, ax1, ay1 = ax - margin, ay - margin, ax + aw + margin, ay + ah + margin
    if x + crop_w <= ax0 or x >= ax1 or y + crop_h <= ay0 or y >= ay1:
        return x, y
    options = []
    for cx, cy in ((ax0 - crop_w, y), (ax1, y), (x, ay0 - crop_h), (x, ay1)):
        if 0 <= cx <= max_x and 0 <= cy <= max_y:
            options.append((abs(cx - x) + abs(cy - y), cx, cy))
    if not options:
        return x, y
    _, bx, by = min(options)
    return bx, by


def activity_samples(video_path, start_f, end_f, fps, avoid=None, width=640):
    """[(t, mass, cx, cy)] of frame-to-frame change, in source px.

    ``avoid`` (the bubble, source px) is masked out: the presenter talks all
    the time and would otherwise win every window.
    """
    import cv2
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    width = min(width, orig_w)
    s = width / float(orig_w)
    step = max(1, int(round(fps / SAMPLE_FPS)))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
    prev, out = None, []
    mask = None
    try:
        f = start_f
        while f < end_f:
            ok, frame = cap.read()
            if not ok:
                break
            if (f - start_f) % step == 0:
                small = cv2.cvtColor(cv2.resize(frame, (width, int(orig_h * s))),
                                     cv2.COLOR_BGR2GRAY)
                if mask is None:
                    mask = np.ones_like(small, dtype=np.uint8)
                    if avoid:
                        ax, ay, aw, ah = avoid
                        pad = 0.08 * aw
                        mask[max(0, int((ay - pad) * s)):int((ay + ah + pad) * s) + 1,
                             max(0, int((ax - pad) * s)):int((ax + aw + pad) * s) + 1] = 0
                if prev is not None:
                    diff = cv2.absdiff(small, prev)
                    # No morphological opening: a mouse pointer or a text
                    # caret is a handful of pixels, and it IS the signal.
                    moving = (diff > DIFF_THRESHOLD).astype(np.uint8) * mask
                    ys, xs = np.nonzero(moving)
                    t = (f - start_f) / fps
                    if len(xs):
                        out.append((t, float(len(xs)), float(np.median(xs)) / s,
                                    float(np.median(ys)) / s))
                    else:
                        out.append((t, 0.0, None, None))
                prev = small
            f += 1
    finally:
        cap.release()
    return out


def focus_path(samples, n_frames, fps, orig_w, orig_h, crop_w, crop_h, avoid=None):
    """Per-frame (x, y) crop origins: held shots joined by eased pans."""
    def origin(cx, cy):
        return place_outside(int(cx - crop_w / 2), int(cy - crop_h / 2),
                             crop_w, crop_h, orig_w, orig_h, avoid)

    # Pooled activity target per sample.
    targets = []
    for i, (t, _m, _x, _y) in enumerate(samples):
        # sqrt weights: a full-screen transition changes 1000x more pixels
        # than the pointer, but it should not outvote it 1000 to 1.
        pool = [(m ** 0.5, x, y) for tt, m, x, y in samples
                if abs(tt - t) <= WINDOW_SECONDS / 2 and m > 0]
        mass = sum(p[0] for p in pool)
        # A few stray pixels (compression noise) do not move the camera.
        if mass < 3:
            targets.append((t, None))
            continue
        cx = sum(p[0] * p[1] for p in pool) / mass
        cy = sum(p[0] * p[2] for p in pool) / mass
        targets.append((t, origin(cx, cy)))

    known = [p for _t, p in targets if p]
    if known:
        # Open on the first place something happens, not the average.
        start = known[0]
    else:
        start = origin(orig_w / 2.0, orig_h / 2.0)

    # Keyframes: (time, position) with a hold/pan state machine.
    keys = [(0.0, start)]
    cur = start
    pending, pending_since = None, None
    for t, p in targets:
        if p is None:
            pending = None
            continue
        far = (abs(p[0] - cur[0]) > DEAD_ZONE * crop_w
               or abs(p[1] - cur[1]) > DEAD_ZONE * crop_h)
        if not far:
            pending = None
            continue
        if pending is None or (abs(p[0] - pending[0]) > DEAD_ZONE * crop_w
                               or abs(p[1] - pending[1]) > DEAD_ZONE * crop_h):
            pending, pending_since = p, t
            continue
        # Track the latest pooled target while it stays put: the first one
        # is still mixed with the old region by the pooling window.
        pending = p
        if (t - pending_since >= max(MIN_HOLD_SECONDS * 0.5, WINDOW_SECONDS / 2)
                and t - keys[-1][0] >= MIN_HOLD_SECONDS):
            # Glide from where we are to the new region, starting when the
            # activity moved (the render is offline, so it can anticipate).
            begin = max(keys[-1][0], pending_since)
            keys.append((begin, cur))
            keys.append((begin + PAN_SECONDS, pending))
            cur, pending = pending, None

    xs, ys = [], []
    k = 0
    for f in range(n_frames):
        t = f / fps
        while k + 1 < len(keys) and keys[k + 1][0] <= t:
            k += 1
        if k + 1 < len(keys):
            (t0, a), (t1, b) = keys[k], keys[k + 1]
            u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
            u = u * u * (3 - 2 * u)   # smoothstep ease-in-out
            x = a[0] + (b[0] - a[0]) * u
            y = a[1] + (b[1] - a[1]) * u
        else:
            x, y = keys[k][1]
        xs.append(int(round(x)) // 2 * 2)
        ys.append(int(round(y)) // 2 * 2)
    return xs, ys


# FOCUS: a screen-only tutorial scene looks exactly like WIDE (whole screen, full width,
# blurred backdrop) and zooms smoothly into the screen region the narration is talking
# about, only during that region's time, then back out. One unified frame, never split.
FOCUS_MARGIN = 0.15        # extra room around the region on each side
FOCUS_MAX_ZOOM = 2.5       # output px per source px: beyond this, UI text turns soft
FOCUS_EASE_SECONDS = 0.7   # ease-in before the region starts / ease-out after it ends


def focus_canvas(orig_w, orig_h, out_w, out_h):
    """(canvas_w, canvas_h) at SOURCE resolution with the output aspect: the WIDE frame
    (screen centred full width over the backdrop) before it is scaled to the output.
    None when the screen is not wider than the output (nothing to zoom from)."""
    if orig_w / float(orig_h) <= out_w / float(out_h) + .01:
        return None
    canvas_h = int(round(orig_w * out_h / float(out_w)))
    return orig_w - orig_w % 2, canvas_h + canvas_h % 2


def focus_box(region, orig_w, orig_h, out_w, canvas):
    """Canvas crop (w, h, x, y) with the output aspect that holds the region plus
    FOCUS_MARGIN, never magnified past FOCUS_MAX_ZOOM, kept inside the canvas."""
    canvas_w, canvas_h = canvas
    top = (canvas_h - orig_h) / 2.0
    aspect = canvas_h / float(canvas_w)
    need_w = max(region['w'] * (1 + 2 * FOCUS_MARGIN), region['h'] * (1 + 2 * FOCUS_MARGIN) / aspect,
                 out_w / FOCUS_MAX_ZOOM)
    w = min(float(canvas_w), need_w)
    h = w * aspect
    w, h = int(round(w)) // 2 * 2, int(round(h)) // 2 * 2
    cx, cy = region['x'] + region['w'] / 2.0, top + region['y'] + region['h'] / 2.0
    x = int(round(min(max(cx - w / 2.0, 0), canvas_w - w))) // 2 * 2
    y = int(round(min(max(cy - h / 2.0, 0), canvas_h - h))) // 2 * 2
    return w, h, x, y


def focus_boxes(regions, n_frames, fps, orig_w, orig_h, out_w, canvas):
    """Per-frame canvas crops: the whole canvas at rest, eased (smoothstep) into each
    region's box FOCUS_EASE_SECONDS before it starts, held to its end, eased back out.
    Regions closer than two eases glide straight from one box to the next."""
    rest = (canvas[0], canvas[1], 0, 0)
    keys = []   # (time, box): piecewise holds joined by eased transitions
    for region in sorted(regions or [], key=lambda r: r['start']):
        target = focus_box(region, orig_w, orig_h, out_w, canvas)
        start, end = max(0.0, region['start']), region['end']
        if end <= start:
            continue
        begin = max(0.0, start - FOCUS_EASE_SECONDS)
        if keys and begin < keys[-1][0]:
            # Too close to the previous region: skip its ease-out, glide region to region.
            keys.pop()
            begin = max(keys[-1][0], (keys[-1][0] + start) / 2.0)
        keys += [(begin, keys[-1][1] if keys else rest), (start, target), (end, target),
                 (end + FOCUS_EASE_SECONDS, rest)]
    boxes = []
    for f in range(n_frames):
        t = f / float(fps)
        box = rest
        for (t0, a), (t1, b) in zip(keys, keys[1:]):
            if t0 <= t < t1:
                u = (t - t0) / (t1 - t0)
                u = u * u * (3 - 2 * u)
                w = int(round(a[0] + (b[0] - a[0]) * u)) // 2 * 2
                h = int(round(w * canvas[1] / float(canvas[0]))) // 2 * 2
                cx = a[2] + a[0] / 2.0 + ((b[2] + b[0] / 2.0) - (a[2] + a[0] / 2.0)) * u
                cy = a[3] + a[1] / 2.0 + ((b[3] + b[1] / 2.0) - (a[3] + a[1] / 2.0)) * u
                box = (w, h, int(round(min(max(cx - w / 2.0, 0), canvas[0] - w))) // 2 * 2,
                       int(round(min(max(cy - h / 2.0, 0), canvas[1] - h))) // 2 * 2)
                break
        boxes.append(box)
    return boxes


def focus_filtergraph(out_w, out_h, orig_w, orig_h, canvas, init_box, cmd_path=None):
    """The WIDE frame built at source resolution, then a canvas crop (driven per frame by
    sendcmd on ``crop@s``) scaled to the output: at rest it is exactly the WIDE shot."""
    from ffmpeg_utils import blurred_backdrop, escape_filter_value
    canvas_w, canvas_h = canvas
    w, h, x, y = init_box
    send = f"sendcmd=f='{escape_filter_value(cmd_path)}'," if cmd_path else ""
    return (
        f"[0:v]split=2[bga][fa];"
        f"[bga]{blurred_backdrop(out_w, out_h, 12)},scale={canvas_w}:{canvas_h}[bg];"
        f"[fa]scale={canvas_w}:-2[fg];"
        f"[bg][fg]overlay=x=0:y=(H-h)/2[canvas];"
        f"[canvas]{send}crop@s=w={w}:h={h}:x={x}:y={y},"
        f"scale={out_w}:{out_h}:flags=lanczos,setsar=1[v]"
    )


def focus_sendcmd_lines(xs, ys, fps, target="crop@s"):
    """sendcmd lines for per-frame crop x/y, deduped to change points."""
    lines, prev = [], None
    for i, (x, y) in enumerate(zip(xs, ys)):
        if (x, y) != prev:
            lines.append(f"{max(0, (i - .5) / fps):.6f} {target} x {x}, {target} y {y};")
            prev = (x, y)
    return lines
