"""
Deterministic FFmpeg filter builder for AI edit decision lists.

The old Auto Edit asked Gemini to write a raw -vf filter string, which broke
in two ways: fragile syntax, and zooms that cropped burned-in captions/hooks
out of frame. Now Gemini only decides WHAT to do and WHEN (an edit decision
list); this module turns that list into a safe filter string with hard caps
(max zoom strength, no zooms over captioned videos, no overlapping zooms).

Stdlib-only so it stays unit-testable without FFmpeg or the Gemini SDK.
"""

# Per-type hard limits. "zoom" types re-frame the picture and are dropped
# entirely when the input already has burned-in captions/hooks.
EFFECT_LIMITS = {
    "zoom_in":    {"zoom": True,  "max_strength": 0.15, "default_strength": 0.10},
    "punch_in":   {"zoom": True,  "max_strength": 0.15, "default_strength": 0.09},
    "zoom_pulse": {"zoom": True,  "max_strength": 0.10, "default_strength": 0.07},
    "color_pop":  {"zoom": False, "max_strength": 1.0,  "default_strength": 0.5},
    "bw_moment":  {"zoom": False, "max_strength": 1.0,  "default_strength": 1.0},
    "flash":      {"zoom": False, "max_strength": 1.0,  "default_strength": 1.0},
    "vignette":   {"zoom": False, "max_strength": 1.0,  "default_strength": 1.0},
}

MAX_EDITS = 12
MIN_EFFECT_SECONDS = 0.15
MAX_ZOOM_SECONDS = 8.0
FLASH_SECONDS = 0.15

# Zoom window anchor: 45% of the height keeps headroom for faces (slightly
# above center) instead of cropping equally from top and bottom.
ZOOM_CENTER_Y = 0.45

# Ease for zoom_in release and punch_in snap (seconds, capped to a quarter of the
# segment): a zoom that ends on a hard cut back to 1.0 reads as a glitch.
ZOOM_EASE_SECONDS = 0.3
PUNCH_EASE_SECONDS = 0.12


def _center(value):
    """A finite 0-1 focus coordinate, or None (missing/invalid -> default framing)."""
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if 0.0 <= value <= 1.0 else None


def normalize_edits(edits, duration, has_captions=False):
    """Validate and clamp a raw AI edit list. Returns a cleaned, start-sorted
    list of dicts with keys: type, start, end, strength."""
    if not isinstance(edits, list) or duration <= 0:
        return []

    cleaned = []
    for entry in edits:
        if not isinstance(entry, dict):
            continue
        effect_type = str(entry.get("type", "")).strip().lower()
        limits = EFFECT_LIMITS.get(effect_type)
        if not limits:
            continue
        if has_captions and limits["zoom"]:
            # Burned-in captions/hooks must stay visible: no re-framing.
            continue
        try:
            start = float(entry.get("start", 0.0))
            end = float(entry.get("end", 0.0))
        except (TypeError, ValueError):
            continue
        start = max(0.0, min(start, duration))
        end = max(0.0, min(end, duration))
        if end - start < MIN_EFFECT_SECONDS:
            continue
        if limits["zoom"] and end - start > MAX_ZOOM_SECONDS:
            end = start + MAX_ZOOM_SECONDS
        try:
            strength = float(entry.get("strength") or 0.0)
        except (TypeError, ValueError):
            strength = 0.0
        if strength <= 0.0:
            strength = limits["default_strength"]
        strength = min(strength, limits["max_strength"])
        item = {"type": effect_type, "start": start, "end": end, "strength": strength}
        if limits["zoom"]:
            # Optional focus point (normalized frame coords), e.g. a screen region to read.
            for key in ("centerX", "centerY"):
                if entry.get(key) is not None and _center(entry.get(key)) is not None:
                    item[key] = _center(entry[key])
        cleaned.append(item)

    cleaned.sort(key=lambda e: (e["start"], e["end"]))

    # Zoom terms are summed inside one zoompan expression, so overlapping zoom
    # segments would stack into an oversized zoom — keep the first, drop the rest.
    result = []
    last_zoom_end = -1.0
    flash_count = 0
    for entry in cleaned:
        if EFFECT_LIMITS[entry["type"]]["zoom"]:
            if entry["start"] < last_zoom_end:
                continue
            last_zoom_end = entry["end"]
        if entry["type"] == "flash":
            if flash_count >= 2:
                continue
            flash_count += 1
        result.append(entry)
        if len(result) >= MAX_EDITS:
            break
    return result


def _smooth(u):
    """Smoothstep of an expression already clipped to [0, 1]."""
    return f"({u})*({u})*(3-2*({u}))"


def _zoom_gate(entry, fps):
    start_frame = int(round(entry["start"] * fps))
    end_frame = max(start_frame + 2, int(round(entry["end"] * fps)))
    return start_frame, end_frame, f"between(on,{start_frame},{end_frame})"


def _zoom_term(entry, fps):
    """One additive term of the zoompan z expression for a zoom-type edit."""
    start_frame, end_frame, gate = _zoom_gate(entry, fps)
    span = end_frame - start_frame
    strength = entry["strength"]
    if entry["type"] == "zoom_in":
        # Eased push across the segment, then an eased release over its last frames.
        out = max(1.0, min(ZOOM_EASE_SECONDS * fps, span / 4.0))
        push = f"clip((on-{start_frame})/{span - out:.2f},0,1)"
        release = f"clip(({end_frame}-on)/{out:.2f},0,1)"
        return f"{strength:.4f}*{_smooth(push)}*{_smooth(release)}*{gate}"
    if entry["type"] == "zoom_pulse":
        # Triangular in-and-out peaking mid-segment.
        mid = (start_frame + end_frame) / 2.0
        half = max(span / 2.0, 1.0)
        return f"{strength:.4f}*(1-abs((on-{mid:.1f})/{half:.1f}))*{gate}"
    # punch_in: tighter framing for the whole segment with a short eased snap in/out.
    ease = max(1.0, min(PUNCH_EASE_SECONDS * fps, span / 4.0))
    u = f"min(clip((on-{start_frame})/{ease:.2f},0,1),clip(({end_frame}-on)/{ease:.2f},0,1))"
    return f"{strength:.4f}*{_smooth(u)}*{gate}"


def _focus_axis(applied, fps, key, size, default):
    """zoompan x or y: the zoom window centred on each edit's focus point, clamped to the
    frame (window = size/zoom). Zooms never overlap, so each edit owns its own gate."""
    expr = f"{size}*{default}-({size}/zoom)/2"
    for entry in reversed(applied):
        if EFFECT_LIMITS[entry["type"]]["zoom"] and key in entry:
            gate = _zoom_gate(entry, fps)[2]
            focus = f"clip({size}*{entry[key]:.4f}-({size}/zoom)/2,0,{size}-{size}/zoom)"
            expr = f"if({gate},{focus},{expr})"
    return expr


def build_filter_string(edits, duration, fps, width, height, has_captions=False):
    """Build a -vf filter string from an AI edit list.

    Returns (filter_string_or_None, applied_edits). None means "no edits" —
    the caller should keep the original video untouched.
    """
    applied = normalize_edits(edits, duration, has_captions=has_captions)
    if not applied:
        return None, []

    fps = float(fps) if fps and fps > 0 else 30.0
    width = int(width or 1080)
    height = int(height or 1920)

    color_filters = []
    zoom_terms = []
    for entry in applied:
        start, end, strength = entry["start"], entry["end"], entry["strength"]
        if EFFECT_LIMITS[entry["type"]]["zoom"]:
            zoom_terms.append(_zoom_term(entry, fps))
        elif entry["type"] == "color_pop":
            contrast = 1.0 + 0.15 * strength
            saturation = 1.0 + 0.6 * strength
            color_filters.append(
                f"eq=contrast={contrast:.2f}:saturation={saturation:.2f}:enable='between(t,{start:.2f},{end:.2f})'"
            )
        elif entry["type"] == "bw_moment":
            color_filters.append(f"hue=s=0:enable='between(t,{start:.2f},{end:.2f})'")
        elif entry["type"] == "flash":
            flash_end = min(start + FLASH_SECONDS, end)
            color_filters.append(f"eq=brightness=0.35:enable='between(t,{start:.2f},{flash_end:.2f})'")
        elif entry["type"] == "vignette":
            color_filters.append(f"vignette=angle=PI/4.5:enable='between(t,{start:.2f},{end:.2f})'")

    parts = list(color_filters)
    if zoom_terms:
        z_expr = "1+" + "+".join(zoom_terms)
        parts.append(
            f"zoompan=z='{z_expr}'"
            f":x='{_focus_axis(applied, fps, 'centerX', 'iw', 0.5)}'"
            f":y='{_focus_axis(applied, fps, 'centerY', 'ih', ZOOM_CENTER_Y)}'"
            f":d=1:fps={fps:g}:s={width}x{height}"
        )

    if not parts:
        return None, []
    return ",".join(parts), applied
