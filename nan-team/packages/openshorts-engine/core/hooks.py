import os
import re
import textwrap
import subprocess
import urllib.request
import uuid
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from ffmpeg_utils import video_encode_args, QUALITY, METADATA_SCRUB


def _truncate_bytes(text, max_bytes):
    """Trim to a byte budget without splitting a multi-byte character.

    Deliberately duplicated from main.truncate_bytes: this module stays free of
    main's heavy imports (cv2, mediapipe, torch) so it can be used standalone.
    """
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    return encoded[:max_bytes].decode("utf-8", "ignore")

FONT_URL = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSerif/NotoSerif-Bold.ttf"
_BUNDLED_FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
FONT_DIR = _BUNDLED_FONTS if os.path.isdir(_BUNDLED_FONTS) else "fonts"
FONT_PATH = os.path.join(FONT_DIR, "NotoSerif-Bold.ttf")
# Bundled (SIL OFL, see fonts/Montserrat-OFL.txt): the "pill" look's sans.
PILL_FONT_PATH = os.path.join(FONT_DIR, "Montserrat-ExtraBold.ttf")

# Typefaces the hook editor offers, all bundled so the server render and the
# browser preview use the same file. The size factor (share of the box width)
# evens out their visual weight: Anton is condensed, Montserrat wide.
HOOK_FONTS = {
    "montserrat": (PILL_FONT_PATH, 0.064),
    "anton": (os.path.join(FONT_DIR, "Anton-Regular.ttf"), 0.08),
    "serif": (FONT_PATH, 0.05),
}

# Codepoint ranges NotoSerif has no glyphs for (would render as tofu boxes).
_EMOJI_RE = re.compile(
    "["
    "\U0001F000-\U0001FAFF"  # emoticons, symbols, transport, supplemental
    "\U00002600-\U000027BF"  # misc symbols + dingbats
    "\U0001F1E6-\U0001F1FF"  # regional indicators (flags)
    "\U00002B00-\U00002BFF"  # arrows, stars
    "\U0000FE0E\U0000FE0F"   # variation selectors
    "\U0000200D"             # zero-width joiner
    "\U000020E3"             # combining keycap
    "]+"
)

# Emoji-capable fonts, probed at runtime (Windows, WSL, Linux/Docker, macOS).
_EMOJI_FONT_CANDIDATES = [
    "C:\\Windows\\Fonts\\seguiemj.ttf",
    "/mnt/c/Windows/Fonts/seguiemj.ttf",
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    "/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf",
    "/System/Library/Fonts/Apple Color Emoji.ttc",
]


# Bitmap strike sizes color-emoji fonts ship with. NotoColorEmoji (the font
# the Docker image installs) ONLY loads at its strike size — asking for an
# arbitrary size raises "invalid pixel size" — so glyphs are rendered at the
# native size and rescaled at draw time.
_EMOJI_BITMAP_SIZES = [109, 128, 136, 160, 96, 72, 64, 32]


def _load_emoji_font(font_size):
    """Return (font, native_size) for an emoji-capable font, or None.

    native_size == font_size for scalable fonts (Segoe UI Emoji); for
    fixed-bitmap fonts (NotoColorEmoji) it is the strike size the font
    actually loaded at, and the renderer scales glyphs down from it."""
    for path in _EMOJI_FONT_CANDIDATES:
        if not os.path.exists(path):
            continue
        try:
            return ImageFont.truetype(path, font_size), font_size
        except Exception:
            pass
        for native in _EMOJI_BITMAP_SIZES:
            try:
                return ImageFont.truetype(path, native), native
            except Exception:
                continue
    return None


def _split_emoji_runs(text):
    """Split text into (is_emoji, chunk) runs."""
    runs = []
    pos = 0
    for m in _EMOJI_RE.finditer(text):
        if m.start() > pos:
            runs.append((False, text[pos:m.start()]))
        runs.append((True, m.group()))
        pos = m.end()
    if pos < len(text):
        runs.append((False, text[pos:]))
    return runs


def _emoji_scale(font, emoji_font):
    """Draw-time scale factor from the emoji font's native size to the text
    size. 1.0 for scalable emoji fonts; < 1 for fixed-bitmap strikes."""
    efont, native = emoji_font
    target = getattr(font, "size", native)
    return target / float(native) if native else 1.0


def _measure_width(draw, text, font, emoji_font):
    """Pixel width of a line, measuring emoji runs with the emoji font.

    emoji_font is the (font, native_size) pair from _load_emoji_font, or None."""
    width = 0.0
    for is_emoji, chunk in _split_emoji_runs(text):
        if is_emoji and emoji_font:
            width += (draw.textlength(chunk, font=emoji_font[0])
                      * _emoji_scale(font, emoji_font))
        else:
            width += draw.textlength(chunk, font=font)
    return width


def _render_emoji_chunk(chunk, emoji_font, scale, fill):
    """Rasterize an emoji run at the font's native size, scaled to the text
    size. Returns an RGBA image ready to alpha-composite, or None."""
    efont, native = emoji_font
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    w = int(probe.textlength(chunk, font=efont))
    if w <= 0:
        return None
    # Emoji glyphs can overshoot the em box slightly; 1.3x covers it.
    tmp = Image.new('RGBA', (w, int(native * 1.3)), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    try:
        d.text((0, 0), chunk, font=efont, embedded_color=True)
    except TypeError:
        d.text((0, 0), chunk, font=efont, fill=fill)
    if scale == 1.0:
        return tmp
    return tmp.resize((max(int(w * scale), 1), max(int(tmp.height * scale), 1)),
                      Image.LANCZOS)


def _draw_mixed(img, draw, xy, text, font, emoji_font, fill, outline=None):
    """Draw a line onto img, rendering emoji runs with the emoji font (in
    color if supported, rescaled when the font is a fixed-size bitmap).
    outline: optional (color, px) stroke drawn under the text."""
    x, y = xy
    stroke_w = outline[1] if outline else 0
    stroke_fill = outline[0] if outline else None
    for is_emoji, chunk in _split_emoji_runs(text):
        if is_emoji and emoji_font:
            scale = _emoji_scale(font, emoji_font)
            rendered = _render_emoji_chunk(chunk, emoji_font, scale, fill)
            if rendered is not None:
                img.alpha_composite(rendered, (int(x), int(y)))
                x += draw.textlength(chunk, font=emoji_font[0]) * scale
        else:
            if stroke_w:
                draw.text((x, y), chunk, font=font, fill=fill,
                          stroke_width=stroke_w, stroke_fill=stroke_fill)
            else:
                draw.text((x, y), chunk, font=font, fill=fill)
            x += draw.textlength(chunk, font=font)


def _break_long_word(draw, word, font, emoji_font, max_width):
    """Character-level hard wrap for a single word wider than max_width."""
    pieces = []
    current = ""
    for ch in word:
        if current and _measure_width(draw, current + ch, font, emoji_font) > max_width:
            pieces.append(current)
            current = ch
        else:
            current += ch
    if current:
        pieces.append(current)
    return pieces

def download_font_if_needed():
    """Downloads a serif font for the hook text if not present."""
    if not os.path.exists(FONT_DIR):
        os.makedirs(FONT_DIR)
    if not os.path.exists(FONT_PATH):
        print(f"⬇️ Downloading font from {FONT_URL}...")
        try:
            # Add user agent to avoid 403s slightly
            req = urllib.request.Request(
                FONT_URL, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req) as response, open(FONT_PATH, 'wb') as out_file:
                out_file.write(response.read())
            print("✅ Font downloaded.")
        except Exception as e:
            print(f"❌ Failed to download font: {e}")

# Hook visual styles. Each maps to box fill (RGBA, alpha 0 = no box), text
# color, and an optional text outline (color, px) for box-less looks.
HOOK_STYLES = {
    # Default. TikTok-native look: every line its own white rounded box,
    # black bold sans (Montserrat ExtraBold).
    "pill":    {"box": (255, 255, 255, 250), "text": (0, 0, 0), "outline": None, "shadow": False,
                "font": PILL_FONT_PATH, "pills": True},
    # White card, black serif text (original look).
    "classic": {"box": (255, 255, 255, 240), "text": (0, 0, 0), "outline": None, "shadow": True},
    # Dark card, white text.
    "dark":    {"box": (18, 18, 20, 235),    "text": (255, 255, 255), "outline": None, "shadow": True},
    # Bright yellow card, black text (high-contrast TikTok look).
    "yellow":  {"box": (255, 214, 0, 245),   "text": (0, 0, 0), "outline": None, "shadow": True},
    # Red "breaking" card, white text.
    "red":     {"box": (220, 38, 38, 245),   "text": (255, 255, 255), "outline": None, "shadow": True},
    # No box: white text with a thick black outline (caption/MrBeast style).
    "outline": {"box": (0, 0, 0, 0),         "text": (255, 255, 255), "outline": ((0, 0, 0), 8), "shadow": False},
    # No box: yellow text with black outline.
    "outline_yellow": {"box": (0, 0, 0, 0),  "text": (255, 214, 0),   "outline": ((0, 0, 0), 8), "shadow": False},
}


def _draw_pills(lines, font, emoji_font, font_size, box_fill, text_fill, output_image_path):
    """One rounded box per line, stacked and centred (the "pill" style).

    Every box has the same height (from the font's own ascent/descent plus
    accents), so the stack reads as one block whatever the letters are.
    """
    lines = [ln for ln in lines if ln.strip()] or [" "]
    pad_x = int(font_size * 0.48)
    pad_y = int(font_size * 0.24)
    radius = int(font_size * 0.36)
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    top, bottom = probe.textbbox((0, 0), "ÁÉÍÓÚÑgjpqy", font=font)[1::2]
    line_h = (bottom - top) + 2 * pad_y
    widths = [int(_measure_width(probe, ln, font, emoji_font)) for ln in lines]
    canvas_w = max(widths) + 2 * pad_x + 40
    canvas_h = line_h * len(lines) + 40

    img = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for i, (ln, w) in enumerate(zip(lines, widths)):
        box_w = w + 2 * pad_x
        x0 = (canvas_w - box_w) // 2
        y0 = 20 + i * line_h
        draw.rounded_rectangle([x0, y0, x0 + box_w, y0 + line_h], radius=radius, fill=box_fill)
        _draw_mixed(img, draw, (x0 + pad_x, y0 + pad_y - top), ln, font, emoji_font,
                    fill=text_fill, outline=None)
    img.save(output_image_path)
    return output_image_path, canvas_w, canvas_h


def create_hook_image(text, target_width, output_image_path="hook_overlay.png", font_scale=1.0, style="pill",
                      font=None):
    """
    Generates a hook overlay image using pixel-based wrapping.
    target_width: The max width the box should occupy (e.g. 85% of video)
    style: one of HOOK_STYLES (pill/classic/dark/yellow/red/outline/outline_yellow)
    """
    download_font_if_needed()

    look = HOOK_STYLES.get(style, HOOK_STYLES["pill"])
    box_fill = look["box"]
    text_fill = look["text"]
    outline = look["outline"]
    has_box = box_fill[3] > 0
    draw_shadow = look["shadow"]
    
    # Configuration
    padding_x = 30 # Balanced padding
    padding_y = 25 
    line_spacing = 20 # Increased spacing
    cornerradius = 20
    shadow_offset = (5, 5) 
    shadow_blur = 10
    
    # Font Size Calculation (approx 5% of width - tuned to match Noto Serif Bold metrics in browser)
    pills = bool(look.get("pills"))
    # A chosen typeface (HOOK_FONTS key) wins; otherwise the style's own
    # (pill -> Montserrat, the rest -> Noto Serif, as they always rendered).
    default_font = "montserrat" if look.get("font") == PILL_FONT_PATH else "serif"
    font_path, size_factor = HOOK_FONTS.get(font or default_font, HOOK_FONTS[default_font])
    base_font_size = int(target_width * size_factor)
    font_size = int(base_font_size * font_scale)
    
    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception as e:
        print(f"⚠️ Warning: Could not load font {font_path}, using default. Error: {e}")
        font = ImageFont.load_default()

    # Emoji handling: render with an emoji-capable font if one exists,
    # otherwise strip emoji instead of drawing tofu boxes.
    emoji_font = None
    if _EMOJI_RE.search(text):
        emoji_font = _load_emoji_font(font_size)
        if emoji_font is None:
            text = _EMOJI_RE.sub("", text)
            text = re.sub(r"[ \t]{2,}", " ", text).strip()

    # Wrap text logic (Pixel-based)
    dummy_img = Image.new('RGBA', (1, 1))
    draw = ImageDraw.Draw(dummy_img)

    max_text_width = target_width - (2 * padding_x)

    # Handle manual newlines first
    paragraphs = text.split('\n')
    lines = []

    for p in paragraphs:
        if not p.strip():
            lines.append("")
            continue

        words = p.split()
        current_line = []

        for word in words:
            # Test if adding word fits
            test_line = ' '.join(current_line + [word])
            w = _measure_width(draw, test_line, font, emoji_font)

            if w <= max_text_width:
                current_line.append(word)
                continue

            # Word doesn't fit on the current line
            if current_line:
                lines.append(' '.join(current_line))
                current_line = []

            if _measure_width(draw, word, font, emoji_font) <= max_text_width:
                current_line = [word]
            else:
                # Single word wider than the box: hard-wrap it character-wise
                # so it can't get cut off at the edges.
                pieces = _break_long_word(draw, word, font, emoji_font, max_text_width)
                lines.extend(pieces[:-1])
                current_line = [pieces[-1]] if pieces else []

        if current_line:
            lines.append(' '.join(current_line))

    if pills:
        return _draw_pills(lines, font, emoji_font, font_size, box_fill, text_fill,
                           output_image_path)

    # Recalculate true width/height
    max_line_width = 0
    text_heights = []

    for line in lines:
        if not line:
            text_heights.append(font_size) # Use font size for empty line height
            continue

        w = _measure_width(draw, line, font, emoji_font)
        bbox = draw.textbbox((0, 0), line, font=font)
        h = bbox[3] - bbox[1]
        max_line_width = max(max_line_width, int(w))
        text_heights.append(h)
    
    # Box dimensions
    # We want the box to fit the text exactly + padding
    # Ensure min width for aesthetic reasons if text is short (at least 30% of target)
    box_width = max(max_line_width + (2 * padding_x), int(target_width * 0.3))
    
    # Total Text Height: sum(heights) + spacing * (n-1)
    if not text_heights:
         total_text_height = font_size
    else:
         total_text_height = sum(text_heights) + (len(text_heights) - 1) * line_spacing
         
    box_height = total_text_height + (2 * padding_y)
    
    # Create Final Image with Rounded Corners and Shadow
    # 1. Canvas for Shadow (larger than box)
    canvas_w = box_width + 40
    canvas_h = box_height + 40
    
    img = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 2. Draw Shadow (only for boxed styles)
    if draw_shadow and has_box:
        shadow_box = [
            (20 + shadow_offset[0], 20 + shadow_offset[1]),
            (20 + box_width + shadow_offset[0], 20 + box_height + shadow_offset[1])
        ]
        draw.rounded_rectangle(shadow_box, radius=cornerradius, fill=(0, 0, 0, 100))
        # 3. Blur Shadow
        img = img.filter(ImageFilter.GaussianBlur(5))

    # 4. Draw Box (sharper, on top of blurred shadow)
    draw_final = ImageDraw.Draw(img)

    if has_box:
        main_box = [
            (20, 20),
            (20 + box_width, 20 + box_height)
        ]
        draw_final.rounded_rectangle(main_box, radius=cornerradius, fill=box_fill)

    # 5. Draw Text
    current_y = 20 + padding_y - 2 # Minor visual adjustment
    for i, line in enumerate(lines):
        if not line:
            current_y += font_size + line_spacing
            continue

        line_w = _measure_width(draw_final, line, font, emoji_font)
        bbox = draw_final.textbbox((0, 0), line, font=font)
        line_h = text_heights[i] if i < len(text_heights) else bbox[3] - bbox[1]

        # Center X
        x = 20 + int(box_width - line_w) // 2

        # Draw text in the style's color (emoji runs use the emoji font)
        _draw_mixed(img, draw_final, (x, current_y), line, font, emoji_font,
                    fill=text_fill, outline=outline)

        current_y += line_h + line_spacing
        
    img.save(output_image_path)
    return output_image_path, canvas_w, canvas_h

def safe_overlay_y(width, height, box_w, box_h, protected_boxes, preferred=None):
    """Choose a stable position avoiding all sampled faces and caption bands."""
    x = (width - box_w) // 2
    low, high = max(8, int(height * .06)), height - box_h - int(height * .20)
    preferred = int(height * .20) if preferred is None else preferred
    candidates = set(range(low, high + 1, max(1, height // 100)))
    if low <= high:
        candidates.update((high, max(low, min(high, preferred))))
    for y in sorted(candidates, key=lambda value: (abs(value - preferred), value)):
        if not any(x < bx+bw and x+box_w > bx and y < by+bh and y+box_h > by
                   for bx,by,bw,bh in protected_boxes):
            return y
    raise ValueError('No hook region avoids detected faces and reserved captions; shorten hook or revise layout')


def _clear(x, y, box_w, box_h, protected_boxes):
    return not any(x < bx+bw and x+box_w > bx and y < by+bh and y+box_h > by
                   for bx,by,bw,bh in protected_boxes)


def static_overlay_boxes(frames, top_fraction=.4, persistence=.9, max_band=.12):
    """[x, y, w, h] boxes of burned-in graphics (channel name, logo, watermark) in the
    top ``top_fraction`` of the frame: edges present in >= ``persistence`` of the sampled
    frames whose pixels also stay constant. A speaking subject or a cut never holds its
    edges and values still, so only static overlays survive; bands taller than
    ``max_band`` of the frame are scenery, not text. Fewer than 4 decodable frames gives [].
    """
    import numpy as np
    edges, low, high = [], None, None
    for frame in frames:
        a = np.asarray(frame)
        if a.dtype == object or a.ndim not in (2, 3) or min(a.shape[:2]) < 32:
            continue
        g = (a if a.ndim == 2 else a[..., :3].mean(axis=2)).astype(np.int16)
        g = g[:max(1, int(g.shape[0] * top_fraction))]
        e = np.zeros(g.shape, dtype=bool)
        e[:, 1:] |= np.abs(np.diff(g, axis=1)) >= 25
        e[1:, :] |= np.abs(np.diff(g, axis=0)) >= 25
        if edges and e.shape != edges[0].shape:
            continue
        edges.append(e)
        low = g if low is None else np.minimum(low, g)
        high = g if high is None else np.maximum(high, g)
    if len(edges) < 4:
        return []
    persistent = (np.mean(edges, axis=0) >= persistence) & (high - low <= 24)
    rows_px, cols_px = persistent.shape
    full_h = int(round(rows_px / top_fraction))
    cell = max(8, cols_px // 64)
    rc, cc = rows_px // cell, cols_px // cell
    if not rc or not cc:
        return []
    density = persistent[:rc * cell, :cc * cell].reshape(rc, cell, cc, cell).mean(axis=(1, 3))
    text = density >= .08
    rows = np.flatnonzero(text.any(axis=1))
    boxes = []
    for group in (np.split(rows, np.flatnonzero(np.diff(rows) > 2) + 1) if len(rows) else []):
        band = text[group[0]:group[-1] + 1]
        if band.sum() < 3 or len(band) * cell > max_band * full_h:
            continue
        cols = np.flatnonzero(band.any(axis=0))
        x0, x1 = max(0, (int(cols[0]) - 1) * cell), min(cols_px, (int(cols[-1]) + 2) * cell)
        # Two cells below: the hook must not butt against the lettering's descenders.
        y0, y1 = max(0, (int(group[0]) - 1) * cell), (int(group[-1]) + 3) * cell
        boxes.append([x0, y0, x1 - x0, y1 - y0])
    return boxes


def safe_overlay_position(width, height, box_w, box_h, protected_boxes, preferred=None, soft_boxes=None):
    """(x, y) avoiding all protected boxes: the centred column first (same order as
    safe_overlay_y), then any column, nearest the centre first.

    The side sweep lets a narrow hook sit beside or between faces (landscape two-shots).
    Vertical frames keep the bottom 20% for platform UI; wider frames keep only 6%.
    soft_boxes (burned-in channel names/watermarks) are avoided when any position allows,
    otherwise ignored. Raises the same ValueError as safe_overlay_y when nothing fits.
    """
    if soft_boxes:
        try:
            return safe_overlay_position(width, height, box_w, box_h,
                                         list(protected_boxes) + list(soft_boxes), preferred)
        except ValueError:
            pass
    bottom = int(height * .20) if height > width else max(8, int(height * .06))
    low, high = max(8, int(height * .06)), height - box_h - bottom
    preferred = int(height * .20) if preferred is None else preferred
    ys = set(range(low, high + 1, max(1, height // 100)))
    if low <= high:
        ys.update((high, max(low, min(high, preferred))))
    ys = sorted(ys, key=lambda value: (abs(value - preferred), value))
    centre = (width - box_w) // 2
    margin = max(8, int(width * .03))
    xs = set(range(margin, width - box_w - margin + 1, max(1, width // 100)))
    if margin <= width - box_w - margin:
        xs.add(width - box_w - margin)
    xs.discard(centre)
    for x in [centre] + sorted(xs, key=lambda value: (abs(value - centre), value)):
        for y in ys:
            if _clear(x, y, box_w, box_h, protected_boxes):
                return x, y
    raise ValueError('No hook region avoids detected faces and reserved captions; shorten hook or revise layout')


def hook_font_scale(width, height):
    """Hook text is sized from the frame width, tuned for 9:16; wider frames scale it
    like the captions (subtitles.caption_scale): 0.5625 for 16:9, 0.75 for 1:1."""
    if width <= 0 or height <= 0:
        return 1.0
    return min(1.0, ((9 / 16) * height / width) ** 0.5)


def add_hook_to_video(video_path, text, output_path, position="top", font_scale=1.0, duration=None, style="pill",
                      also=None, font=None, protected_boxes=None, placement_receipt=None, width_ratio=0.9,
                      soft_boxes=None):
    """
    Overlays text hook onto video.
    position: 'top', 'center', 'bottom'
    font_scale: float multiplier (1.0 = default)
    width_ratio: max hook box width as a fraction of the frame (0.9 default); a narrower
      box wraps into more lines at the SAME font size so it can fit beside faces.
    style: hook look (see HOOK_STYLES)
    also: optional (vf, path): ALSO write ``path`` = the hooked picture with
      ``vf`` applied (the captions), from the same decode. The job pipeline
      needs both files (the editor re-captions from the hooked one), and one
      ffmpeg with two outputs saves a full decode + pass per clip.
      With ``output_path=None`` only ``path`` is written: hook and captions
      burned in ONE encode (no hook-only intermediate).
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video {video_path} not found")

    # 1. Probe video width to scale text properly
    try:
        cmd = ['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', video_path]
        res = subprocess.check_output(cmd, timeout=60).decode().strip()
        # Takes first stream if multiple
        dims = res.split('\n')[0].split('x')
        video_width = int(dims[0])
        video_height = int(dims[1])
    except Exception as e:
        print(f"⚠️ FFprobe failed: {e}. Assuming 1080x1920")
        video_width = 1080
        video_height = 1920
        
    # 2. Generate Image
    # Box check: Don't let it be wider than 90% of screen
    width_ratio = min(0.9, max(0.2, float(width_ratio)))
    target_box_width = int(video_width * width_ratio)
    # Font size follows the full-width box (create_hook_image derives it from target_width).
    effective_scale = font_scale * (0.9 / width_ratio) * hook_font_scale(video_width, video_height)
    
    # Unique per invocation so parallel jobs can't overwrite each other's overlay.
    # The uuid alone guarantees that; the source name rides along only as a
    # debugging hint, so it is trimmed by BYTES (filesystems cap at 255 bytes,
    # and one Bengali or Arabic character costs three). Embedding it untrimmed
    # raised OSError 36 and killed the endpoint in prod on 26-jul-2026.
    stem = os.path.splitext(os.path.basename(video_path))[0]
    hook_filename = os.path.join(
        os.path.dirname(os.path.abspath(output_path or also[1])),
        f"temp_hook_{uuid.uuid4().hex[:8]}_{_truncate_bytes(stem, 80)}.png",
    )
    
    try:
        img_path, box_w, box_h = create_hook_image(text, target_box_width, hook_filename, font_scale=effective_scale,
                                                   style=style, font=font)
        
        # 3. Calculate Overlay Position
        overlay_x = (video_width - box_w) // 2
        
        if protected_boxes is not None:
            preferred = {'center': (video_height-box_h)//2, 'bottom': int(video_height*.70)}.get(position)
            overlay_x, overlay_y = safe_overlay_position(video_width, video_height, box_w, box_h,
                                                         protected_boxes, preferred, soft_boxes)
        elif position == "center":
            overlay_y = (video_height - box_h) // 2
        elif position == "bottom":
             # Bottom 20% mark (approx)
             overlay_y = int(video_height * 0.70)
        else:
             # Top 20% mark
             overlay_y = int(video_height * 0.20)
        if placement_receipt is not None:
            placement_receipt.update({'x':overlay_x,'y':overlay_y,'width':box_w,'height':box_h,'widthRatio':width_ratio,
                'protectedBoxes':protected_boxes,'strategy':'sampled-face-clearance' if protected_boxes is not None else position})
            if soft_boxes:
                placement_receipt.update({'watermarkBoxes': soft_boxes,
                                          'watermarkClear': _clear(overlay_x, overlay_y, box_w, box_h, soft_boxes)})
        
        # 4. FFmpeg Command
        print(f"🎬 Overlaying hook: '{text}' at {overlay_x},{overlay_y}")
        
        overlay = (f"[0:v][1:v]overlay={overlay_x}:{overlay_y}"
                   + (f":enable='lt(t,{float(duration)})'" if duration else ""))
        tail = ['-c:a', 'copy', *video_encode_args(QUALITY), *METADATA_SCRUB,
                '-movflags', '+faststart']
        if also and output_path is None:
            extra_vf, extra_path = also
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', img_path,
                '-filter_complex', f"{overlay}[h];[h]{extra_vf}[s]",
                '-map', '[s]', '-map', '0:a?', *tail, extra_path,
            ]
        elif also:
            extra_vf, extra_path = also
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', img_path,
                '-filter_complex', f"{overlay},split=2[h][c];[c]{extra_vf}[s]",
                '-map', '[h]', '-map', '0:a?', *tail, output_path,
                '-map', '[s]', '-map', '0:a?', *tail, extra_path,
            ]
        else:
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', img_path,
                '-filter_complex', overlay,
                *tail,
                output_path
            ]
        
        subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=1800)
        print(f"✅ Hook added to {output_path or also[1]}")
        return True

    except subprocess.TimeoutExpired:
        print("❌ FFmpeg hook overlay timed out after 1800s.")
        raise RuntimeError("FFmpeg hook overlay timed out after 1800s.")
    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg Error: {e.stderr.decode() if e.stderr else 'Unknown'}")
        raise e
    except Exception as e:
        print(f"❌ Hook Gen Error: {e}")
        raise e
    finally:
        # Cleanup temp image
        if os.path.exists(hook_filename):
            os.remove(hook_filename)
