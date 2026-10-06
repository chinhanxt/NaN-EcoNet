"""Reframe engine v2: analyze in Python, render natively in ffmpeg.

v1 decodes every frame at full resolution in OpenCV, crops/resizes in numpy
and pipes raw frames back into ffmpeg. v2 splits that into:

  1. ANALYSIS — one ffmpeg-decoded pass at <=640px feeding the same detectors
     and the same SmoothedCameraman/SpeakerTracker state machines as v1, so
     the resulting camera trajectory (crop x per frame) is equivalent.
  2. RENDER — one ffmpeg process per scene doing decode -> dynamic crop
     (sendcmd) -> scale -> encode natively (TRACK scenes), or the blurred
     background filtergraph (GENERAL scenes); segments are then concatenated
     with stream copy and the audio mapped straight from the source clip.

No raw-frame piping, no second full-res decode, one less intermediate encode.
Callers must treat any exception as "fall back to the v1 loop".

Pure helpers (sendcmd/concat generation, scene slicing) have no heavy imports
so they stay unit-testable in CI.
"""
import os
import subprocess
import tempfile

import active_speaker
import camera_inset
import punch_in
import screencast_layout
import layout_ranges
import split_layout
from ffmpeg_utils import (video_encode_args, blurred_backdrop, escape_filter_value,
                          QUALITY_FAST, INTERMEDIATE, METADATA_SCRUB)

ANALYSIS_MAX_WIDTH = 640


# Short-form platforms (TikTok / Reels / Shorts) expect a 1080-wide vertical
# upload; anything smaller is treated as low quality and re-encoded from the
# already-soft source. The crop region is whatever the source height allows, so
# a 720p input yields a 406x720 crop — we scale that up to the delivery floor
# rather than shipping sub-HD. Sources that already exceed it are left alone
# (never downscale quality the user supplied).
DELIVERY_MIN_WIDTH = 1080


# --- pure helpers (CI-testable) --------------------------------------------

def delivery_size(orig_w, orig_h, aspect_ratio):
    """Output (width, height) for a reframe of this source.

    Picks the largest crop the source allows, then upscales to
    ``DELIVERY_MIN_WIDTH`` if that crop is narrower. Both dimensions come back
    even (x264/NVENC reject odd ones).
    """
    out_h = orig_h
    out_w = int(out_h * aspect_ratio)
    if out_w > orig_w:
        out_w = orig_w
        out_h = int(out_w / aspect_ratio)

    if out_w < DELIVERY_MIN_WIDTH:
        out_w = DELIVERY_MIN_WIDTH
        out_h = int(round(out_w / aspect_ratio))

    return out_w + (out_w % 2), out_h + (out_h % 2)


def source_already_fits(orig_w, orig_h, aspect_ratio, tol=0.01):
    """True when the source is already at (or past) the target aspect.

    Such a source has no width to throw away, so every layout that rearranges
    the frame is a downgrade: GENERAL puts it in a blurred bed, SPLIT stacks
    two crops of an already-narrow frame, SCREENCAST/INSET carve panels out of
    it. TRACK is the only one that leaves it alone — its crop is the whole
    frame — so a vertical upload should pass straight through.
    """
    return orig_w / float(orig_h) <= aspect_ratio * (1 + tol)


def dedupe_sendcmd_lines(xs, fps, target="crop@c"):
    """sendcmd lines setting crop x per frame, deduped to change-points.

    Timestamps are relative to the segment (the render seeks per scene).
    """
    lines = []
    prev = None
    for i, x in enumerate(xs):
        if x != prev:
            lines.append(f"{max(0, (i - .5) / fps):.6f} {target} x {x};")
            prev = x
    return lines


def segment_window(start_f, end_f, fps):
    """Seek between frames, then encode an exact count, avoiding decimal skips."""
    return max(0, (start_f - .5) / fps), end_f - start_f


def scene_frame_ranges(scene_boundaries, strategies, total_frames, include_index=False):
    """Clamp scene (start, end) frame ranges to the decoded frame count,
    dropping empty ranges. Each range keeps its strategy so later indices
    can't misalign when a range is dropped."""
    ranges = []
    for i, (start_f, end_f) in enumerate(scene_boundaries):
        strategy = strategies[i] if i < len(strategies) else 'TRACK'
        start_f = max(0, min(start_f, total_frames))
        end_f = max(start_f, min(end_f, total_frames))
        if end_f > start_f:
            ranges.append((i,start_f,end_f,strategy) if include_index else (start_f, end_f, strategy))
    return ranges


def concat_list_content(segment_paths):
    # Single quotes per concat-demuxer spec; our paths are tempfile-generated
    # (no quotes in them).
    return "".join(f"file '{p}'\n" for p in segment_paths)


# How much of the frame height the real content should fill in GENERAL layout.
#
# Fitting a 16:9 source to the full output width leaves it 608px tall in a
# 1920px frame — the content is 32% of the screen and 68% is blurred filler.
# That reads as a thumbnail floating in soup, and it is what a GENERAL scene
# looked like in real delivered clips (audited 26-jul-2026).
#
# Scaling the content up and letting the sides overflow trades width for
# presence, and the trade has to stay conservative: GENERAL is chosen for group
# shots and landscapes, exactly the material where cropping the sides cuts
# someone out of frame. At 0.42 a 16:9 source keeps ~76% of its width while
# going from 32% to 42% of the frame height. 0.55 was tried and rejected — it
# reaches 55% height but throws away 42% of the width.
#
# GENERAL_CONTENT_HEIGHT_RATIO=0.32 restores the old full-width behaviour.
GENERAL_CONTENT_HEIGHT_RATIO = float(
    os.environ.get("GENERAL_CONTENT_HEIGHT_RATIO", "0.42"))


def full_width_content_height(orig_w, orig_h, out_w):
    """Height the source fills when its FULL width is kept (even)."""
    fg_h = int(round(out_w * orig_h / float(orig_w)))
    return fg_h + (fg_h % 2)


def general_filtergraph(out_w, out_h, content_h=None, orig_w=None, orig_h=None):
    """Blurred-background 'general shot' layout: bg fills the frame (centre-
    cropped, blurred), fg is scaled to a readable share of the height and
    centred, overflowing the sides rather than floating small in the middle.

    ``content_h`` overrides the height ratio. Passing the full-width height
    turns the side-cropping off entirely, which is what a scene full of charts
    or spreadsheets needs: the default 0.42 ratio buys presence by throwing away
    ~24% of the width, and on that material the discarded columns are the point.

    ``orig_w``/``orig_h`` floor the foreground at the height where the source
    fills the output width. The 0.42 ratio buys presence on a LANDSCAPE source
    by overflowing the sides; on a portrait one the same number is a shrink —
    an already-9:16 upload came back as a 453px sliver floating over a blurred
    copy of itself. Filling the width is the floor, never the target.
    """
    fg_h = content_h if content_h else int(out_h * GENERAL_CONTENT_HEIGHT_RATIO)
    if orig_w and orig_h:
        fg_h = max(fg_h, full_width_content_height(orig_w, orig_h, out_w))
    fg_h += fg_h % 2
    return (
        f"[0:v]split=2[bga][fga];"
        f"[bga]{blurred_backdrop(out_w, out_h, 12)}[bg];"
        # Scale by HEIGHT, then trim any overflow to the output width. crop
        # centres by default, and min() makes it a no-op when the scaled source
        # is already narrower than the frame (portrait/square sources).
        f"[fga]scale=-2:{fg_h},crop=w=min(iw\\,{out_w}):h=ih[fg];"
        f"[bg][fg]overlay=x=(W-w)/2:y=(H-h)/2,setsar=1[v]"
    )


# --- analysis ---------------------------------------------------------------

def apply_crop_overrides(xs, strategies, scene_boundaries, overrides,
                         crop_w, orig_w, orig_h=None, splits=None):
    """Frame the scenes the user positioned by hand.

    ``overrides`` maps a scene index to either

      * a number — the crop CENTRE as a fraction of the source width, giving a
        single locked 9:16 window for that scene; or
      * ``{"top": v, "bottom": v}`` — two centres, stacking those two regions
        one above the other (the SPLIT layout). Each half is either a bare
        fraction (horizontal only) or ``{"x": f, "y": f}``; SPLIT crops are
        SHORTER than the source, so they carry a vertical centre too.

    Fractions travel instead of pixels because the editor knows where it
    dropped the rectangle, not the source's dimensions, and the same number
    survives a source re-encode at another resolution.

    A hand-framed scene overrides its automatic verdict outright: the single
    form forces TRACK so a scene the detector had sent to GENERAL (blurred
    background) comes back to a vertical crop, and the split form writes
    straight into ``splits``, so the user can stack a scene the detector never
    proposed — no dependency on SPLIT_LAYOUT being switched on.

    Runs after every automatic pass, including the ALTERNATE writes, so a
    manual choice always wins. Unknown scene indices and malformed values are
    skipped rather than rejected: a stale editor tab must not fail the render.
    """
    max_x = max(0, orig_w - crop_w)

    def to_x(fraction):
        return max(0, min(int(round(float(fraction) * orig_w - crop_w / 2)), max_x))

    for raw_idx, value in (overrides or {}).items():
        try:
            idx = int(raw_idx)
        except (TypeError, ValueError):
            continue
        if not 0 <= idx < len(scene_boundaries):
            raise ValueError('crop scene index is outside the detected clip scene manifest')
        start_f, end_f = scene_boundaries[idx]
        end_f = min(end_f, len(xs))
        if end_f <= start_f:
            continue

        if isinstance(value, dict):
            # Split: the halves are centres in SOURCE PIXELS, which is what
            # split_filtergraph expects — unlike the single-crop path, there is
            # no crop window to offset by.
            def point(half):
                if isinstance(half, dict):
                    fx, fy = float(half['x']), float(half.get('y', 0.5))
                else:
                    fx, fy = float(half), 0.5
                return (fx * orig_w, fy * orig_h)

            try:
                centres = (point(value['top']), point(value['bottom']))
            except (KeyError, TypeError, ValueError):
                continue
            if splits is None or not orig_h:
                continue
            splits[start_f] = centres
            strategies[idx] = 'SPLIT'
            continue

        try:
            x = to_x(value)
        except (TypeError, ValueError):
            continue
        xs[start_f:end_f] = [x] * (end_f - start_f)
        strategies[idx] = 'TRACK'
        if splits is not None:
            splits.pop(start_f, None)

    return xs, strategies


def _analyze_trajectory(input_video, scenes_boundaries, scene_strategies,
                        fps, orig_w, orig_h, cameraman, tracker):
    """Replays v1's per-frame decision loop on a downscaled ffmpeg-decoded
    stream. Returns xs: crop x per frame (None on GENERAL frames)."""
    import numpy as np
    try:
        import tracking as m
    except ImportError:
        import main as m

    small_w = min(ANALYSIS_MAX_WIDTH, orig_w)
    if small_w % 2:
        small_w -= 1
    small_h = max(int(orig_h * small_w / orig_w), 2)
    if small_h % 2:
        small_h += 1
    scale = orig_w / small_w
    frame_bytes = small_w * small_h * 3

    proc = subprocess.Popen(
        ["ffmpeg", "-loglevel", "error", "-i", input_video,
         "-vf", f"scale={small_w}:{small_h}",
         "-fps_mode", "passthrough",
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=frame_bytes * 4)

    xs = []
    frame_number = 0
    current_scene_index = 0
    try:
        while True:
            buf = proc.stdout.read(frame_bytes)
            if len(buf) < frame_bytes:
                break
            frame = np.frombuffer(buf, dtype=np.uint8).reshape((small_h, small_w, 3))

            if current_scene_index < len(scenes_boundaries):
                start_f, end_f = scenes_boundaries[current_scene_index]
                if frame_number >= end_f and current_scene_index < len(scenes_boundaries) - 1:
                    current_scene_index += 1

            strategy = (scene_strategies[current_scene_index]
                        if current_scene_index < len(scene_strategies) else 'TRACK')

            # SPLIT, SCREENCAST and WIDE crops are static (fixed boxes for the
            # whole scene), so like GENERAL they need no camera trajectory.
            # ALTERNATE gets one written in after this pass.
            if strategy in ('GENERAL', 'SPLIT', 'SCREENCAST', 'WIDE',
                            'INSET', 'ALTERNATE', 'FOCUS'):
                cameraman.current_center_x = orig_w / 2
                cameraman.target_center_x = orig_w / 2
                xs.append(None)
            else:
                is_scene_start = (
                    current_scene_index < len(scenes_boundaries)
                    and frame_number == scenes_boundaries[current_scene_index][0])
                cut = is_scene_start and m.SCENE_CUT_RESET
                if cut:
                    tracker.reset()
                    cameraman.begin_scene()

                if frame_number % m.DETECT_STRIDE == 0 or cut:
                    candidates = m.detect_face_candidates(frame)
                    for cand in candidates:
                        cand['box'] = [int(v * scale) for v in cand['box']]
                        cand['score'] = cand['box'][2] * cand['box'][3]
                    target_box = tracker.get_target(candidates, frame_number, orig_w)
                    if target_box:
                        cameraman.update_target(target_box)
                    elif frame_number % m.YOLO_FALLBACK_STRIDE == 0 or cut:
                        person_box = m.detect_person_yolo(frame)
                        if person_box:
                            cameraman.update_target([int(v * scale) for v in person_box])

                x1, _y1, _x2, _y2 = cameraman.get_crop_box(force_snap=is_scene_start)
                xs.append(x1)

            frame_number += 1
    finally:
        proc.stdout.close()
        proc.wait()

    return xs


def _speaker_attribution(multicam):
    """JSON-safe receipt of the multi-camera speaker check (None if not run)."""
    if multicam is None:
        return None
    out = {k: v for k, v in multicam.items() if k != 'wide'}
    out['wideCuts'] = [{'sceneIndex': int(i), 'personOfSide': [int(p) for p in people]}
                       for i, (_held, _centres, people) in multicam.get('wide', {}).items()]
    return out


# --- render -----------------------------------------------------------------

def _run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.PIPE, timeout=1800)


def render(input_video, final_output_video, aspect_ratio, content_ranges=None,
           force_strategy=None, crop_overrides=None, watermark=False, decision_receipt=None,
           focus_regions=None):
    """Full v2 reframe of one clip. Raises on failure (caller falls back).

    ``content_ranges`` comes from screencast_layout.detect_content_ranges() on
    the SOURCE video, already translated into this clip's timeline. None or []
    means the layout never triggers, which is the default.

    ``force_strategy`` ('WIDE' / 'TRACK' / any layout the render loop knows)
    applies that layout to EVERY scene, skipping the classifier and the layout
    upgrades — the clip editor's whole-clip framing override.

    ``crop_overrides`` maps scene index -> crop centre as a fraction of the
    source width, for scenes the user framed by hand in the editor. Scenes not
    listed keep the automatic camera, so correcting one bad shot never disturbs
    the ones the tracker got right. Applied AFTER force_strategy: a per-scene
    hand position always beats the whole-clip choice for the scenes it names.
    """
    try:
        import tracking as m
    except ImportError:
        import main as m

    content_ranges = content_ranges or []

    print("   🚀 Reframe engine v2 (ffmpeg-native render)")
    scenes, fps = m.detect_scenes(input_video)
    fps = float(fps)
    orig_w, orig_h = m.get_video_resolution(input_video)

    out_w, out_h = delivery_size(orig_w, orig_h, aspect_ratio)

    if not scenes:
        import cv2
        cap = cv2.VideoCapture(input_video)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        from scenedetect import FrameTimecode
        scenes = [(FrameTimecode(0, fps), FrameTimecode(total, fps))]

    scene_boundaries = [(s.get_frames(), e.get_frames()) for s, e in scenes]

    passthrough = (source_already_fits(orig_w, orig_h, aspect_ratio)
                   and not (content_ranges and screencast_layout.ENABLED)
                   and not (active_speaker.ENABLED and active_speaker.CUT_MODE))
    if force_strategy:
        strategies = [force_strategy] * len(scenes)
        content_ranges = []
        print(f"   🎯 Framing override: every scene -> {force_strategy}")
    elif passthrough:
        strategies = ['TRACK'] * len(scenes)
        content_ranges = []
        print(f"   ↕️  Source is already {orig_w}x{orig_h} vertical — "
              f"passing it through, no reframe")
    else:
        strategies = m.analyze_scenes_strategy(input_video, scenes)

    splits = {}
    split_scene_of = {}
    detected_splits = {} if passthrough else split_layout.detect_split_scenes(
        input_video, scenes, strategies)
    for scene_idx, centres in detected_splits.items():
        strategies[scene_idx] = 'SPLIT'
        start_f = scene_boundaries[scene_idx][0]
        splits[start_f] = centres
        split_scene_of[start_f] = scene_idx

    # Why each scene did or did not get a speaker layout, for the receipt: a
    # no-cut must be explainable from the render decision alone.
    speaker_diagnostics = []
    if active_speaker.ENABLED and not passthrough and not force_strategy:
        for scene_idx, strategy in enumerate(strategies):
            if strategy == 'GENERAL' and scene_idx not in detected_splits:
                s_f, e_f = scene_boundaries[scene_idx]
                speaker_diagnostics.append({'sceneIndex': scene_idx,
                    'startSeconds': s_f / fps, 'endSeconds': e_f / fps,
                    'split': False, 'reason': 'no stable separated two-face pair '
                    f'(>={split_layout.MIN_COEXISTENCE:.0%} of samples, face width '
                    f'>={split_layout.MIN_FACE_WIDTH:.1%}, scene >={split_layout.MIN_SCENE_SECONDS}s)'})

    alternates = {}
    if splits and active_speaker.ENABLED:
        for start_f in list(splits):
            scene_idx = split_scene_of[start_f]
            end_f = scene_boundaries[scene_idx][1]
            verdicts, mode = active_speaker.scene_attribution(
                input_video, start_f, end_f, fps, splits[start_f], detector=m)
            a, b = active_speaker.shares(verdicts)
            speaker_diagnostics.append({'sceneIndex': scene_idx,
                'startSeconds': start_f / fps, 'endSeconds': end_f / fps, 'split': True,
                'faceCentres': [[round(float(v), 1) for v in c[:2]] for c in splits[start_f]],
                'attribution': mode, 'shares': [round(a, 3), round(b, 3)],
                'attributedWindows': sum(v is not None for v in verdicts),
                'windows': len(verdicts),
                'conversation': active_speaker.is_conversation(verdicts)})
            if mode == 'single-voice' and active_speaker.CUT_MODE:
                # One identified talker: cut to them instead of stacking a
                # silent listener or shrinking both into a blurred strip.
                print(f"   🎙️ Scene {scene_idx}: single talker (face {verdicts[0]}) — framing them")
                strategies[scene_idx] = 'ALTERNATE'
                alternates[start_f] = (
                    active_speaker.hold(verdicts), splits.pop(start_f))
            elif not active_speaker.is_conversation(verdicts):
                print(f"   🔇 Scene {scene_idx}: one speaker holds the floor "
                      f"({max(a, b):.0%}) — not stacking")
                del splits[start_f]
                strategies[scene_idx] = 'GENERAL'
            elif active_speaker.CUT_MODE:
                strategies[scene_idx] = 'ALTERNATE'
                alternates[start_f] = (
                    active_speaker.hold(verdicts), splits.pop(start_f))
    # Produced conversations cut between single-person cameras, so there is no
    # two-shot for the path above to work on. Attribute the voices instead,
    # verify the edit shows whoever is talking, and cut inside wide shots.
    multicam = None
    if (active_speaker.ENABLED and active_speaker.CUT_MODE and not force_strategy
            and not passthrough and len(scene_boundaries) > 1):
        try:
            multicam = active_speaker.multicam_dialogue(
                input_video, scene_boundaries, strategies, fps, m)
        except Exception as e:
            multicam = {'validated': False, 'mode': 'multicam',
                        'reason': f'analysis failed: {type(e).__name__}: {e}'}
        if multicam.get('validated'):
            for scene_idx, (held, centres, _people) in multicam.get('wide', {}).items():
                start_f = scene_boundaries[scene_idx][0]
                if strategies[scene_idx] != 'GENERAL' or start_f in splits:
                    continue
                strategies[scene_idx] = 'ALTERNATE'
                split_scene_of[start_f] = scene_idx
                alternates[start_f] = (held, centres)
            print(f"   🎙️ Multi-camera dialogue validated "
                  f"({multicam.get('agreement', 0):.0%} of shot time shows the speaker)")
        else:
            print(f"   🎙️ Multi-camera speaker check: {multicam.get('reason')}")

    if splits:
        print(f"   🪞 SPLIT layout on {len(splits)} scene(s)")
    if alternates:
        print(f"   🎬 Speaker-cut layout on {len(alternates)} scene(s)")

    inset = None
    bubble = None
    if content_ranges and screencast_layout.ENABLED:
        try:
            bubble = camera_inset.detect_bubble(input_video)
        except Exception as e:
            print(f"   ⚠️ Bubble check failed ({e}) — trying the inset guess.")
        if bubble:
            inset = tuple(bubble['box'])
            print(f"   📹 Face-cam {bubble['shape']} at {inset}")
        else:
            try:
                inset = camera_inset.detect(input_video)
            except Exception as e:
                print(f"   ⚠️ Inset check failed ({e}) — using the screen layouts.")
            if inset:
                bubble = {'box': tuple(inset), 'shape': 'rect', 'face': None}
                print(f"   📹 Webcam inset at {inset}")

    screencasts = {}
    wide_scenes = []
    wide_count = 0
    inset_count = 0
    if content_ranges:
        for scene_idx, (plan, centre) in screencast_layout.detect_screencast_scenes(
                input_video, scenes, strategies, content_ranges).items():
            if inset:
                plan, centre = 'INSET', None
            strategies[scene_idx] = plan
            start_f = scene_boundaries[scene_idx][0]
            splits.pop(start_f, None)
            if plan == 'SCREENCAST':
                screencasts[start_f] = centre
            elif plan == 'INSET':
                inset_count += 1
            else:
                wide_count += 1
                wide_scenes.append(scene_idx)
    # Screen-only scenes (no presenter) keep the WIDE shot and zoom into the region the
    # narration talks about, only while it does (focus regions); no region, plain WIDE.
    focus = screencast_layout.focus_canvas(orig_w, orig_h, out_w, out_h) if screencast_layout.ENABLED else None
    focus_scenes = {}
    for scene_idx in wide_scenes if focus else []:
        s_f, e_f = scene_boundaries[scene_idx]
        regions = [{'start': r['start'] - s_f / fps, 'end': r['end'] - s_f / fps,
                    'x': r['x'] * orig_w, 'y': r['y'] * orig_h, 'w': r['w'] * orig_w, 'h': r['h'] * orig_h}
                   for r in focus_regions or [] if r['end'] > s_f / fps and r['start'] < e_f / fps]
        if regions:
            strategies[scene_idx] = 'FOCUS'
            focus_scenes[s_f] = regions
            wide_count -= 1
    if focus_scenes:
        print(f"   🔎 Screen focus on {len(focus_scenes)} scene(s)")
    if screencasts:
        print(f"   🖥️ SCREENCAST layout on {len(screencasts)} scene(s)")
    if wide_count:
        print(f"   📐 Full-width layout on {wide_count} scene(s)")
    if inset_count:
        print(f"   📹 Camera-inset layout on {inset_count} scene(s)")

    cameraman = m.SmoothedCameraman(out_w, out_h, orig_w, orig_h, aspect_ratio=aspect_ratio)
    tracker = m.SpeakerTracker(cooldown_frames=30)

    xs = _analyze_trajectory(input_video, scene_boundaries, strategies, fps,
                             orig_w, orig_h, cameraman, tracker)
    if not xs:
        raise RuntimeError("analysis produced no frames")
    if len(xs) != scene_boundaries[-1][1]:
        raise RuntimeError(f"frame clock mismatch: decoded {len(xs)}, scene end {scene_boundaries[-1][1]}")
    if decision_receipt is not None:
        decision_receipt['frameClock'] = {'decoded':len(xs),
            'sceneEnd':scene_boundaries[-1][1], 'fps':fps,
            'normalization':'CFR during source cut; raw decode passthrough'}

    beats = []
    if punch_in.ENABLED:
        beats = punch_in.emphasis_times(input_video, len(xs) / fps)
        if beats:
            print(f"   🔍 Punch-in on {len(beats)} beat(s)")

    crop_w, crop_h = cameraman.crop_width, cameraman.crop_height

    for start_f, (held, centres) in alternates.items():
        end_f = scene_boundaries[split_scene_of[start_f]][1]
        end_f = min(end_f, len(xs))
        if end_f <= start_f:
            continue
        xs[start_f:end_f] = active_speaker.speaker_xs(
            held, centres, crop_w, orig_w, end_f - start_f, fps)

    if crop_overrides:
        xs, strategies = apply_crop_overrides(
            xs, strategies, scene_boundaries, crop_overrides, crop_w,
            orig_w, orig_h=orig_h, splits=splits)
        print(f"   ✋ Manual framing on {len(crop_overrides)} scene(s)")

    indexed_ranges = scene_frame_ranges(scene_boundaries, strategies, len(xs), include_index=True)
    ranges = [(s,e,strategy) for _index,s,e,strategy in indexed_ranges]
    if not ranges:
        raise RuntimeError("no usable scene ranges")

    workdir = tempfile.mkdtemp(prefix="reframe_v2_")
    segments = []
    focus_paths = []
    try:
        for idx, (start_f, end_f, strategy) in enumerate(ranges):
            seg_path = os.path.join(workdir, f"seg_{idx:03d}.mp4")
            ss, frame_count = segment_window(start_f, end_f, fps)

            if strategy == 'INSET':
                # Presenter at <=2x above a screen panel that follows the
                # active region with held shots and eased pans.
                geo = camera_inset.bubble_layout(out_w, out_h, bubble)
                panel_w, panel_h = geo['panel'][:2]
                sc_w, sc_h = screencast_layout.screen_crop_size(
                    orig_w, orig_h, panel_w, panel_h)
            if strategy == 'INSET' and (sc_w < 2 or sc_h < 2 or panel_h < 2):
                # Degenerate bubble geometry for this canvas: stacked inset.
                graph = camera_inset.inset_filtergraph(
                    orig_w, orig_h, out_w, out_h, inset)
            elif strategy == 'INSET':
                activity = screencast_layout.activity_samples(
                    input_video, start_f, end_f, fps, avoid=inset)
                fx, fy = screencast_layout.focus_path(
                    activity, frame_count, fps, orig_w, orig_h, sc_w, sc_h,
                    avoid=inset)
                cmd_path = os.path.join(workdir, f"cmd_{idx:03d}.txt")
                with open(cmd_path, "w") as f:
                    f.write("\n".join(screencast_layout.focus_sendcmd_lines(
                        fx, fy, fps)) + "\n")
                focus_paths.append({'startSeconds': start_f / fps,
                                    'crop': [sc_w, sc_h],
                                    'positions': sorted({(x, y) for x, y in zip(fx, fy)})[:64]})
                graph = camera_inset.bubble_filtergraph(
                    out_w, out_h, bubble, geo, sc_w, sc_h, (fx[0], fy[0]),
                    cmd_path=cmd_path)
            elif strategy == 'FOCUS' and start_f in focus_scenes:
                regions = focus_scenes[start_f]
                boxes = screencast_layout.focus_boxes(regions, frame_count, fps, orig_w, orig_h, out_w, focus)
                cmd_path = os.path.join(workdir, f"cmd_{idx:03d}.txt")
                with open(cmd_path, "w") as f:
                    f.write("\n".join(punch_in.sendcmd_lines(boxes, fps, target="crop@s")) + "\n")
                focus_paths.append({'startSeconds': start_f / fps, 'crop': list(boxes[0][:2]),
                                    'positions': sorted(set(boxes))[:64],
                                    'zooms': sorted({round(out_w / b[0], 2) for b in boxes}),
                                    'regions': len(regions)})
                graph = screencast_layout.focus_filtergraph(out_w, out_h, orig_w, orig_h, focus,
                                                            boxes[0], cmd_path=cmd_path)
            elif strategy == 'SCREENCAST':
                graph = screencast_layout.screencast_filtergraph(
                    orig_w, orig_h, out_w, out_h, screencasts[start_f])
            elif strategy in ('WIDE', 'FOCUS'):
                graph = general_filtergraph(
                    out_w, out_h,
                    full_width_content_height(orig_w, orig_h, out_w))
            elif strategy == 'SPLIT':
                left, right = splits[start_f]
                graph = split_layout.split_filtergraph(
                    orig_w, orig_h, out_w, out_h, left, right)
            elif strategy == 'GENERAL':
                graph = general_filtergraph(out_w, out_h,
                                            orig_w=orig_w, orig_h=orig_h)
            else:
                seg_xs = [x if x is not None else 0 for x in xs[start_f:end_f]]
                cmd_path = os.path.join(workdir, f"cmd_{idx:03d}.txt")
                if beats:
                    zooms = punch_in.zoom_curve(len(seg_xs), fps, beats,
                                                start_offset=start_f / fps)
                    boxes = punch_in.crop_boxes(seg_xs, zooms, crop_w, crop_h,
                                                orig_w, orig_h)
                    lines = punch_in.sendcmd_lines(boxes, fps)
                    first = boxes[0]
                    init = f"w={first[0]}:h={first[1]}:x={first[2]}:y={first[3]}"
                else:
                    lines = dedupe_sendcmd_lines(seg_xs, fps)
                    crop_y = max(0, (orig_h - crop_h) // 2)
                    init = f"w={crop_w}:h={crop_h}:x={seg_xs[0]}:y={crop_y}"
                with open(cmd_path, "w") as f:
                    f.write("\n".join(lines) + "\n")
                graph = (
                    f"[0:v]sendcmd=f='{escape_filter_value(cmd_path)}',"
                    f"crop@c={init},"
                    f"scale={out_w}:{out_h},setsar=1[v]"
                )

            inputs, out_label = ["-i", input_video], "[v]"
            graph = graph.replace('[0:v]', '[0:v]setpts=PTS-STARTPTS,', 1)
            _run([
                "ffmpeg", "-y", "-loglevel", "error",
                "-ss", f"{ss:.6f}", *inputs,
                "-filter_complex", graph, "-map", out_label,
                *video_encode_args(INTERMEDIATE), "-frames:v", str(frame_count),
                "-fps_mode", "cfr", "-r", str(fps), "-an", seg_path,
            ])
            segments.append(seg_path)

        list_path = os.path.join(workdir, "concat.txt")
        with open(list_path, "w") as f:
            f.write(concat_list_content(segments))

        # Concat video segments (stream copy) + audio straight from the clip.
        _run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", list_path,
            "-i", input_video,
            "-map", "0:v:0", "-map", "1:a:0?",
            "-c:v", "copy", "-c:a", "copy", *METADATA_SCRUB,
            "-movflags", "+faststart",
            final_output_video,
        ])
    finally:
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)

    layout_ranges.write(final_output_video,
                        [(s / fps, e / fps, strategy) for s, e, strategy in ranges])
    print(f"   ✅ Clip saved to {final_output_video}")
    if decision_receipt is not None:
        decision_receipt.update({'engine':'reframe-v2',
            'scenes':[{'sceneIndex':index,'startSeconds':s/fps,'endSeconds':e/fps,'strategy':strategy} for index,s,e,strategy in indexed_ranges],
            'cropScenes':[{'sceneIndex':index,'startSeconds':s/fps,'endSeconds':e/fps,'strategy':strategy} for index,s,e,strategy in indexed_ranges],
            'speakerCuts':[{'startSeconds':start/fps+i*active_speaker.WINDOW_SECONDS,
                            'speaker':speaker} for start,(held,_centres) in alternates.items()
                           for i,speaker in enumerate(held)],
            'trajectory':{'minX':min((x for x in xs if x is not None),default=None),
                          'maxX':max((x for x in xs if x is not None),default=None)},
            'speakerAttribution':_speaker_attribution(multicam),
            'speakerDiagnostics':speaker_diagnostics,
            'cameraInset':[int(v) for v in inset] if inset else None,
            'cameraInsetShape':bubble['shape'] if bubble else None,
            'screenFocus':[{'startSeconds':p['startSeconds'],'crop':p['crop'],
                            'distinctPositions':len(p['positions']),
                            **({'zooms':p['zooms'],'regions':p['regions']} if 'zooms' in p else {})} for p in focus_paths],
            'screencastPresenterCenters':[[float(x),float(y)] for x,y in screencasts.values()]})
    return True
