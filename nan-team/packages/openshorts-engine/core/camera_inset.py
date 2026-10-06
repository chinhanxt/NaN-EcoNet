"""Find the webcam inset in a screen recording, and frame the two apart.

The case: one source, the whole screen (a game, a desktop, an editor) with the
person composited into a corner. It is how OBS records and how every stream VOD
looks, and it is the case screencast_layout gets wrong. There the speaker band
is a large crop taken AROUND the face, which on a full-screen source means the
band is mostly more screen: measured on an Excel walkthrough, the output showed
the same spreadsheet twice, once whole and once enlarged.

What this needs instead is the inset's own rectangle, so the two bands can hold
genuinely different things — screen above, person below.

Finding it exactly is harder than it looks. The inset is not always a rectangle
(circles and clipped polygons are common), it has no reliable border, and on
gameplay the background moves as much as the person does, which rules out
temporal-variance tricks. What IS reliable is that the inset is anchored to a
corner and that a person detector fires inside it. So: locate the person, decide
which corner they are nearest, and grow a box from that corner until it covers
them with margin.
"""
import os

from ffmpeg_utils import blurred_backdrop

CORNER_MARGIN = 0.20   # a subject this far from an edge (as a fraction of the
                       # frame) still counts as anchored to it

# An inset subject is SMALL and OFF-CENTRE; a presenter filling the shot is
# neither. Requiring the detection to actually touch two edges was tried first
# and rejected: YOLO returns an upper-body box that stops at the chest, so a
# webcam pinned to the right edge measured 18% clear of the bottom and got
# thrown out. Measured on four real clips, these two properties separate the
# cases where "touching a corner" did not.
MAX_SUBJECT_HEIGHT = 0.35   # fraction of frame height

# Horizontal offset from centre, as a fraction of frame width. HORIZONTAL
# specifically: a composited camera is pinned to the left or right side, while a
# talking head is centred left-to-right even when their face sits high in the
# shot. Accepting offset on either axis let four talking heads through, all of
# them with a face near the top edge. Measured on those nine candidates the two
# groups do not overlap: real insets sat 0.37-0.43 from centre, the talking
# heads 0.01-0.12.
MIN_OFFSET = 0.18

# How much bigger than the detected head/upper body the inset is assumed to be.
# A webcam frames head and shoulders, and detectors return the head or the upper
# body, so the box has to grow to reach the inset's real edges.
INSET_PADDING = float(os.environ.get("INSET_PADDING", "1.45"))

# Guard rails as a fraction of frame height. Below the floor there is nothing
# worth showing; above the ceiling it stopped being an inset and the layout
# should not be used at all.
MIN_INSET_HEIGHT = 0.10
MAX_INSET_HEIGHT = 0.38

# An inset is pinned to the same pixels for the whole recording; a presenter
# walks about. Spread of the detected centres, as a fraction of frame width,
# above which this is a person in a room rather than a composited camera.
# Measured on the two false positives this rule was written for: a real inset
# moved 3-11px across samples, a presenter 316px.
MAX_CENTRE_SPREAD = 0.05


def nearest_corner(box, frame_w, frame_h):
    """Which corner the subject sits in: (horizontal, vertical) as strings.

    Returns e.g. ("left", "bottom"). A subject in the middle of the frame is
    reported by its nearest edges anyway; callers use `is_cornered` to reject.
    """
    cx = box[0] + box[2] / 2.0
    cy = box[1] + box[3] / 2.0
    return ("left" if cx < frame_w / 2 else "right",
            "top" if cy < frame_h / 2 else "bottom")


def is_cornered(box, frame_w, frame_h, margin=CORNER_MARGIN):
    """True when the subject looks like a webcam inset rather than the shot.

    Small and off-centre, not "touches two edges": see MAX_SUBJECT_HEIGHT.

    This is a sanity filter, not the decision. Whether the video is a screen
    recording with a camera in it at all is answered upstream by layout_picker;
    a game character standing in a corner would pass this test, and is kept out
    by the fact that nobody asked for this layout on that video.
    """
    x, y, w, h = box
    if h > frame_h * MAX_SUBJECT_HEIGHT:
        return False

    cx = (x + w / 2.0) / frame_w
    off_centre = abs(cx - 0.5) >= MIN_OFFSET

    near_edge = (x <= frame_w * margin or (x + w) >= frame_w * (1 - margin)
                 or y <= frame_h * margin or (y + h) >= frame_h * (1 - margin))
    return off_centre and near_edge


INSET_ASPECT = 16 / 9.0


def inset_box(box, frame_w, frame_h, padding=None):
    """Estimated inset rectangle (x, y, w, h) around a detected subject.

    Grown from the corner the subject is anchored to, so the box hugs the same
    edges the inset does instead of floating around the face.

    The height comes from assuming a 16:9 inset rather than from scaling the
    detection, because the detection is often a torso: YOLO returned a 246x86
    box for a webcam whose real rectangle was about 325x180, and padding that
    shape upwards still cut the head off. Deriving the height from the width
    and pinning the result to the corner reaches the top of the inset instead.
    """
    padding = INSET_PADDING if padding is None else padding
    x, y, w, h = box
    horizontal, vertical = nearest_corner(box, frame_w, frame_h)

    new_w = min(frame_w, w * padding)
    new_h = min(frame_h, max(h * padding, new_w / INSET_ASPECT))

    # Anchor: keep the edge the subject is already near, grow the other way.
    if horizontal == "left":
        new_x = max(0, min(x - (new_w - w) / 2.0, frame_w - new_w))
        if x <= frame_w * CORNER_MARGIN:
            new_x = 0
    else:
        new_x = max(0, min(x + w + (new_w - w) / 2.0 - new_w, frame_w - new_w))
        if (x + w) >= frame_w * (1 - CORNER_MARGIN):
            new_x = frame_w - new_w

    # Vertical growth is biased upwards: detectors return the head or the chest,
    # and a portrait needs headroom, not more torso. Splitting the growth evenly
    # cropped the top of the head off on real clips.
    grow = new_h - h
    if vertical == "top":
        new_y = max(0, min(y - grow * 0.6, frame_h - new_h))
        if y <= frame_h * CORNER_MARGIN:
            new_y = 0
    else:
        # Pin to the bottom edge: the inset is there, and the detection sits
        # somewhere inside it rather than at its top.
        new_y = frame_h - new_h
        if (y + h) < frame_h * (1 - CORNER_MARGIN):
            new_y = max(0, min(y - grow * 0.6, frame_h - new_h))

    return (int(round(new_x)), int(round(new_y)),
            int(round(new_w)), int(round(new_h)))


def usable(box, frame_h, min_ratio=MIN_INSET_HEIGHT, max_ratio=MAX_INSET_HEIGHT):
    """Whether an inset of this size is worth building a layout around."""
    return min_ratio * frame_h <= box[3] <= max_ratio * frame_h


def detect(video_path, samples=10):
    """Median inset rectangle across sampled frames, or None.

    None means "no usable inset here", which callers must treat as "use another
    layout" rather than as an error.
    """
    import cv2
    import numpy as np
    try:
        import tracking as m
    except ImportError:
        import main as m
    import screencast_layout

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if total <= 0 or not frame_w:
        cap.release()
        return None

    boxes = []
    try:
        for i in range(samples):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(i * total / samples))
            ok, frame = cap.read()
            if not ok:
                continue
            # Faces first, body as fallback: a webcam inset is small, and on a
            # 1080p source the face inside it is often too few pixels for
            # BlazeFace even at full resolution, while YOLO still finds the
            # person.
            faces = screencast_layout.detect_faces_full_res(frame)
            if faces:
                box = max(faces, key=lambda c: c['score'])['box']
            else:
                box = m.detect_person_yolo(frame)
            if not box:
                continue
            if not is_cornered(box, frame_w, frame_h):
                continue
            boxes.append(inset_box(box, frame_w, frame_h))
    finally:
        cap.release()

    if len(boxes) < max(3, samples // 3):
        return None

    arr = np.array(boxes, dtype=float)

    centres_x = arr[:, 0] + arr[:, 2] / 2.0
    centres_y = arr[:, 1] + arr[:, 3] / 2.0
    mid_x, mid_y = np.median(centres_x), np.median(centres_y)
    tolerance = frame_w * MAX_CENTRE_SPREAD
    close = ((np.abs(centres_x - mid_x) <= tolerance)
             & (np.abs(centres_y - mid_y) <= tolerance))
    if close.sum() < max(3, 0.6 * len(boxes)):
        return None

    arr = arr[close]
    median = tuple(int(v) for v in np.median(arr, axis=0))
    if not usable(median, frame_h):
        return None
    return median


MAX_CAMERA_RATIO = 0.40


def inset_filtergraph(orig_w, orig_h, out_w, out_h, box, camera_ratio=None):
    """Screen on top at full width, the webcam inset below.

    The screen keeps its whole width, which is the point: a game HUD or a
    desktop puts what matters at the edges. The inset is scaled up so the person
    reads at a size the source never gave them.

    The camera band takes its height from the INSET'S OWN aspect ratio rather
    than a fixed share of the frame. A fixed share was tried first and stretched
    every face sideways: a 16:9 inset forced into a 2:1 band is a 12% horizontal
    stretch, and it is immediately visible on a face.
    """
    box_w = max(2, box[2])
    box_h = max(2, box[3])

    if camera_ratio is not None:
        cam_h = int(out_h * camera_ratio)
    else:
        cam_h = int(round(out_w * box_h / float(box_w)))
    cam_h = min(cam_h, int(out_h * MAX_CAMERA_RATIO))
    cam_h -= cam_h % 2

    screen_h = int(round(out_w * orig_h / float(orig_w)))
    screen_h -= screen_h % 2
    screen_h = max(2, min(screen_h, out_h - cam_h - 2))

    # Widen (or heighten) the crop to the band's aspect so the scale below is
    # uniform. Clamped to the frame, so an inset hard against an edge simply
    # keeps whatever it can reach.
    target_aspect = out_w / float(cam_h)
    x, y, w, h = box
    if w / float(h) < target_aspect:
        want_w = min(orig_w, int(round(h * target_aspect)))
        x = int(round(x + w / 2.0 - want_w / 2.0))
        w = want_w
    else:
        want_h = min(orig_h, int(round(w / target_aspect)))
        y = int(round(y + h / 2.0 - want_h / 2.0))
        h = want_h
    x = max(0, min(x, orig_w - w))
    y = max(0, min(y, orig_h - h))

    w -= w % 2
    h -= h % 2
    x -= x % 2
    y -= y % 2

    filler_h = out_h - screen_h - cam_h

    return (
        f"[0:v]split=3[bga][sa][ca];"
        # Blurred backdrop so the leftover strip is not a black bar. Scaled by
        # HEIGHT: scaling a 16:9 source to 1080 wide gives 608 tall, and there
        # is no 1920-tall crop to take out of that.
        f"[bga]{blurred_backdrop(out_w, out_h, 14)}[bg];"
        f"[sa]scale={out_w}:{screen_h}[screen];"
        f"[ca]crop=w={w}:h={h}:x={x}:y={y},scale={out_w}:{cam_h}[cam];"
        f"[bg][screen]overlay=x=0:y={filler_h // 2}[withscreen];"
        f"[withscreen][cam]overlay=x=0:y={filler_h // 2 + screen_h},"
        f"setsar=1[v]"
    )


# --- precise bubble bounds + picture-in-picture presenter -------------------
#
# inset_box() above GUESSES the inset rectangle from a person detection and pins
# it to the frame edge. On a round face-cam bubble floating above the taskbar
# (the common Canva/Loom/OBS look) that guess is wrong both ways: it reaches
# down into the taskbar and cuts the face off at the side, and the band below
# the screen then upscales it ~4x. The bubble has one property the guess
# ignores: it is STATIC while the screen and the face change, so its ring is the
# strongest edge in the temporal median of the recording. detect_bubble() finds
# that circle (or, failing that, keeps the old rectangle) and reports the shape
# so the renderer can mask it round instead of showing the UI in its corners.

MAX_PRESENTER_UPSCALE = 2.0      # never blow the presenter past this
PRESENTER_MAX_W = 1080           # output px
PRESENTER_MAX_H = 620            # output px: the screen keeps the rest
BUBBLE_MAX_D = 400               # a round bubble reads as PIP, not a panel
PRESENTER_MARGIN = 24            # output px around the presenter
BOTTOM_SAFE = 264                # output px left to the platform UI
REFERENCE_CANVAS = (1080, 1920)  # the pixel constants above are for this canvas
MAX_PRESENTER_SHARE = 0.35       # presenter height cap, share of canvas height
MIN_PANEL_SHARE = 0.35           # screen panel keeps at least this share
MIN_RING_SCORE = 40.0            # median Sobel magnitude along the ring


def _ring_score(gray_grad, cx, cy, r):
    """Mean gradient magnitude sampled along a circle (0 when off-frame)."""
    import numpy as np
    h, w = gray_grad.shape
    angles = np.linspace(0, 2 * np.pi, 180, endpoint=False)
    xs = np.round(cx + r * np.cos(angles)).astype(int)
    ys = np.round(cy + r * np.sin(angles)).astype(int)
    ok = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
    if ok.mean() < 0.6:
        return 0.0
    vals = gray_grad[ys[ok], xs[ok]]
    # Median, not mean: a ring must be continuous, one bright UI edge crossing
    # the circle must not carry it.
    return float(np.median(vals))


def find_circle(median_gray, face_box):
    """(cx, cy, r) of a static circular bubble around the face, or None."""
    import cv2
    import numpy as np
    fx, fy, fw, fh = face_box
    fcx, fcy = fx + fw / 2.0, fy + fh / 2.0
    size = max(fw, fh)
    reach = int(size * 3.2)
    h, w = median_gray.shape
    x0, y0 = max(0, int(fcx - reach)), max(0, int(fcy - reach))
    x1, y1 = min(w, int(fcx + reach)), min(h, int(fcy + reach))
    roi = cv2.GaussianBlur(median_gray[y0:y1, x0:x1], (5, 5), 1.5)
    circles = cv2.HoughCircles(roi, cv2.HOUGH_GRADIENT, dp=1, minDist=4,
                               param1=100, param2=28,
                               minRadius=int(size * 0.75), maxRadius=reach)
    if circles is None:
        return None
    gx = cv2.Sobel(median_gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(median_gray, cv2.CV_32F, 0, 1, ksize=3)
    grad = cv2.magnitude(gx, gy)
    best = None
    for cx, cy, r in circles[0][:12]:
        cx, cy = cx + x0, cy + y0
        # The face must sit inside the bubble, not beside it.
        if (fcx - cx) ** 2 + (fcy - cy) ** 2 > (0.6 * r) ** 2:
            continue
        # Hough is a few px / ~5% off: refine centre and radius on the ring.
        for dx in range(-4, 5, 2):
            for dy in range(-4, 5, 2):
                for rr in np.arange(r * 0.88, r * 1.12, 1.0):
                    score = _ring_score(grad, cx + dx, cy + dy, rr)
                    if best is None or score > best[3]:
                        best = (float(cx + dx), float(cy + dy), float(rr), score)
    # An absolute floor: a bubble border is a hard edge (measured 150-190 on
    # a gold ring), a chance arc through UI is not continuous and scores low.
    if best is None or best[3] < MIN_RING_SCORE:
        return None
    cx, cy, r, peak = best
    # A border is several px thick: its inner and outer edges are both strong.
    # Take the OUTER one so the ring stays whole, but no further — past it is
    # screen UI that would show in the mask's rim.
    outer = r
    for rr in np.arange(r, r * 1.12, 1.0):
        if _ring_score(grad, cx, cy, rr) >= 0.25 * peak:
            outer = rr
    return cx, cy, float(outer) + 1


def detect_bubble(video_path, samples=12):
    """The face-cam inset of a screen recording, measured on its real bounds.

    Returns {'box': (x, y, w, h), 'shape': 'circle'|'rect', 'face': box} or
    None. 'box' is the bubble's own square (circle) or the estimated inset
    rectangle (rect, from inset_box) in source pixels.
    """
    import cv2
    import numpy as np
    try:
        import tracking as m
    except ImportError:
        import main as m
    import screencast_layout

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    grays, faces = [], []
    try:
        for i in range(samples):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int((i + 0.5) * total / samples))
            ok, frame = cap.read()
            if not ok:
                continue
            grays.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
            found = screencast_layout.detect_faces_full_res(frame)
            box = (max(found, key=lambda c: c['score'])['box'] if found
                   else m.detect_person_yolo(frame))
            if box and is_cornered(box, frame_w, frame_h):
                faces.append(list(box))
    finally:
        cap.release()
    return bubble_from_samples(grays, faces, frame_w, frame_h, samples)


def bubble_from_samples(grays, faces, frame_w, frame_h, samples):
    """Same bubble geometry for callers that already decoded/detected samples."""
    import numpy as np
    if len(faces) < max(3, samples // 3) or not grays:
        return None
    arr = np.array(faces, dtype=float)
    cxs, cys = arr[:, 0] + arr[:, 2] / 2, arr[:, 1] + arr[:, 3] / 2
    keep = ((np.abs(cxs - np.median(cxs)) <= frame_w * MAX_CENTRE_SPREAD)
            & (np.abs(cys - np.median(cys)) <= frame_w * MAX_CENTRE_SPREAD))
    if keep.sum() < max(3, 0.6 * len(faces)):
        return None
    face = tuple(int(v) for v in np.median(arr[keep], axis=0))
    median = np.median(np.stack(grays), axis=0).astype(np.uint8)

    circle = find_circle(median, face)
    if circle:
        cx, cy, r = circle
        x, y = int(round(cx - r)), int(round(cy - r))
        d = int(round(2 * r))
        x, y = max(0, x), max(0, y)
        d = min(d, frame_w - x, frame_h - y)
        return {'box': (x, y, d, d), 'shape': 'circle', 'face': face}
    box = inset_box(face, frame_w, frame_h)
    if not usable(box, frame_h):
        return None
    return {'box': box, 'shape': 'rect', 'face': face}


def _canvas_scale(out_w, out_h):
    return min(out_w / float(REFERENCE_CANVAS[0]), out_h / float(REFERENCE_CANVAS[1]), 1.0)


def presenter_size(bubble, out_w=None, out_h=None, max_h=None):
    """Output (w, h) of the presenter: at most 2x, round bubbles stay PIP.

    Pixel caps are defined for the 1080x1920 reference canvas and scale down to
    the actual canvas; height is further capped to a share of the canvas.
    """
    _x, _y, w, h = bubble['box']
    k = _canvas_scale(out_w, out_h) if out_w and out_h else 1.0
    scale = MAX_PRESENTER_UPSCALE
    if bubble['shape'] == 'circle':
        scale = min(scale, BUBBLE_MAX_D * k / float(w))
    scale = min(scale, PRESENTER_MAX_W * k / float(w), PRESENTER_MAX_H * k / float(h))
    if out_h:
        scale = min(scale, MAX_PRESENTER_SHARE * out_h / float(h))
    if max_h is not None:
        scale = min(scale, max_h / float(h))
    out_w_ = int(w * scale) // 2 * 2
    out_h_ = int(h * scale) // 2 * 2
    return max(2, out_w_), max(2, out_h_)


def bubble_layout(out_w, out_h, bubble):
    """Geometry of the presenter-over-screen frame.

    Presenter centred at the top (hooks already steer clear of faces), screen
    panel below it at full output width, a bottom strip left to platform UI.
    Margins and the bottom safe area scale with the canvas, and the presenter
    shrinks so the screen panel keeps a meaningful share of the height.
    Returns dict with presenter (w, h, x, y) and panel (w, h, x, y).
    """
    k = _canvas_scale(out_w, out_h)
    margin = int(round(PRESENTER_MARGIN * k))
    bottom = int(round(BOTTOM_SAFE * out_h / float(REFERENCE_CANVAS[1])))
    min_panel = int(out_h * MIN_PANEL_SHARE)
    room = out_h - bottom - 2 * margin - min_panel
    pw, ph = presenter_size(bubble, out_w, out_h, max_h=max(2, room))
    top = margin
    panel_y = top + ph + margin
    panel_h = max(2, out_h - bottom - panel_y)
    panel_h -= panel_h % 2
    return {'presenter': (pw, ph, (out_w - pw) // 2, top),
            'panel': (out_w, panel_h, 0, panel_y)}


def bubble_filtergraph(out_w, out_h, bubble, layout, crop_w, crop_h, init_xy,
                       cmd_path=None):
    """Blurred backdrop + ROI-panned screen panel + masked presenter.

    The screen crop (crop_w x crop_h at init_xy) is driven per frame by sendcmd
    on ``crop@s`` when cmd_path is given.
    """
    from reframe_v2 import escape_filter_value
    pw, ph, px, py = layout['presenter']
    sw, sh, sx, sy = layout['panel']
    bx, by, bw, bh = bubble['box']
    bx -= bx % 2
    by -= by % 2
    bw -= bw % 2
    bh -= bh % 2
    x0, y0 = init_xy
    send = (f"sendcmd=f='{escape_filter_value(cmd_path)}',"
            if cmd_path else "")
    if bubble['shape'] == 'circle':
        # Round alpha, 1px feather: the square crop's corners are screen UI.
        cam = (f"[ca]crop=w={bw}:h={bh}:x={bx}:y={by},scale={pw}:{ph}:flags=lanczos,"
               f"format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':"
               f"a='255*clip((W/2-hypot(X-W/2,Y-H/2)),0,1)'[cam];")
    else:
        cam = (f"[ca]crop=w={bw}:h={bh}:x={bx}:y={by},"
               f"scale={pw}:{ph}:flags=lanczos[cam];")
    return (
        f"[0:v]split=3[bga][sa][ca];"
        f"[bga]{blurred_backdrop(out_w, out_h, 18)}[bg];"
        f"[sa]{send}crop@s=w={crop_w}:h={crop_h}:x={x0}:y={y0},"
        f"scale={sw}:{sh}:flags=lanczos[screen];"
        + cam +
        f"[bg][screen]overlay=x={sx}:y={sy}[withscreen];"
        f"[withscreen][cam]overlay=x={px}:y={py},setsar=1[v]"
    )
