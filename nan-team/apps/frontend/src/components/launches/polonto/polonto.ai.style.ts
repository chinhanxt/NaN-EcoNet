'use client';

/**
 * Visual polish for AI designs in Polotno, done locally (no extra AI call):
 * - palette extracted from the background picture (k-means on a 64×64 sample),
 * - harmonize: overlays/gradients from the picture's dark tone, CTA in a boosted accent with AA contrast,
 *   headline white/cream, kicker in a light accent,
 * - gradient elements (op type 'gradient') rendered as Polotno SVG elements,
 * - text fitting: shrink fontSize (5% steps, ≥60%) until a text fits its zone / does not run into the next
 *   element; the headline is limited to two lines.
 */
export type Palette = { colors: string[]; dark: string; light: string; accent: string };
export type Zone = { x: number; y: number; width: number; height: number };

// ---------- colour maths ----------
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string): [number, number, number] => {
  const value = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};
const toHsl = ([r, g, b]: [number, number, number]): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};
const fromHsl = ([h, s, l]: [number, number, number]) => {
  if (!s) return toHex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const channel = (t: number) => {
    t = (t + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return v * 255;
  };
  return toHex(channel(h + 1 / 3), channel(h), channel(h - 1 / 3));
};
const luminance = (hex: string) => {
  const [r, g, b] = fromHex(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

// ---------- palette ----------
/** Five dominant colours (k-means), the darkest, the lightest and a saturated accent of a picture. */
export const extractPalette = (src: string): Promise<Palette | null> => new Promise((resolve) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onerror = () => resolve(null);
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return resolve(null);
      context.drawImage(image, 0, 0, 64, 64);
      const data = context.getImageData(0, 0, 64, 64).data;
      const pixels: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) pixels.push([data[i], data[i + 1], data[i + 2]]);
      if (!pixels.length) return resolve(null);
      // k-means, k = 5, seeds spread over the luminance range.
      const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
      let centers = Array.from({ length: 5 }, (_, i) => sorted[Math.floor(((i + 0.5) / 5) * sorted.length)]);
      let counts = new Array(5).fill(0);
      for (let round = 0; round < 8; round++) {
        const sums = centers.map(() => [0, 0, 0]);
        counts = new Array(5).fill(0);
        for (const pixel of pixels) {
          let best = 0, bestDistance = Infinity;
          centers.forEach((center, index) => {
            const distance = (pixel[0] - center[0]) ** 2 + (pixel[1] - center[1]) ** 2 + (pixel[2] - center[2]) ** 2;
            if (distance < bestDistance) { bestDistance = distance; best = index; }
          });
          sums[best][0] += pixel[0]; sums[best][1] += pixel[1]; sums[best][2] += pixel[2]; counts[best] += 1;
        }
        centers = centers.map((center, index) => (counts[index]
          ? [sums[index][0] / counts[index], sums[index][1] / counts[index], sums[index][2] / counts[index]] : center) as [number, number, number]);
      }
      const clusters = centers.map((center, index) => ({ hex: toHex(...center), count: counts[index] })).filter((c) => c.count)
        .sort((a, b) => b.count - a.count);
      const byLight = [...clusters].sort((a, b) => luminance(a.hex) - luminance(b.hex));
      // Accent: the most saturated cluster that is not negligible (≥3% of the picture).
      const accent = [...clusters].filter((c) => c.count >= pixels.length * 0.03)
        .sort((a, b) => toHsl(fromHex(b.hex))[1] - toHsl(fromHex(a.hex))[1])[0] || clusters[0];
      resolve({ colors: clusters.map((c) => c.hex), dark: byLight[0].hex, light: byLight[byLight.length - 1].hex, accent: accent.hex });
    } catch {
      resolve(null); // tainted canvas (cross-origin) or decode failure
    }
  };
  image.src = src;
});

/** Saturated, AA-contrast (≥4.5 with its label) button colour derived from the palette accent. */
export const ctaColors = (palette: Palette) => {
  const [h, s, l] = toHsl(fromHex(palette.accent));
  let lightness = clamp(l, 0.35, 0.55);
  let fill = fromHsl([h, clamp(s * 1.35 + 0.15, 0.55, 0.95), lightness]);
  let text = contrast(fill, '#ffffff') >= contrast(fill, '#111111') ? '#ffffff' : '#111111';
  for (let step = 0; contrast(fill, text) < 4.5 && step < 12; step++) {
    lightness = text === '#ffffff' ? lightness - 0.03 : lightness + 0.03;
    fill = fromHsl([h, clamp(s * 1.35 + 0.15, 0.55, 0.95), clamp(lightness, 0.08, 0.92)]);
  }
  return { fill, text };
};
const lightAccent = (palette: Palette) => {
  const [h, s] = toHsl(fromHex(palette.accent));
  return fromHsl([h, clamp(s + 0.2, 0.5, 0.95), 0.72]);
};
const deepen = (hex: string) => {
  const [h, s, l] = toHsl(fromHex(hex));
  return fromHsl([h, s, clamp(l * 0.6, 0.04, 0.18)]);
};

// ---------- gradient element ----------
export type GradientSpec = { from: string; to: string; fromOpacity?: number; toOpacity?: number; direction?: string | number };
const directionVector = (direction: string | number = 'to-bottom') => {
  if (typeof direction === 'number' || /^\d+(\.\d+)?(deg)?$/.test(String(direction))) {
    const angle = ((parseFloat(String(direction)) - 90) * Math.PI) / 180;
    return { x1: 0.5 - Math.cos(angle) / 2, y1: 0.5 - Math.sin(angle) / 2, x2: 0.5 + Math.cos(angle) / 2, y2: 0.5 + Math.sin(angle) / 2 };
  }
  const key = String(direction).replace(/[\s_]/g, '-').toLowerCase();
  return ({
    'to-top': { x1: 0, y1: 1, x2: 0, y2: 0 }, 'to-right': { x1: 0, y1: 0, x2: 1, y2: 0 }, 'to-left': { x1: 1, y1: 0, x2: 0, y2: 0 },
  } as Record<string, any>)[key] || { x1: 0, y1: 0, x2: 0, y2: 1 };
};
/** SVG data URL with a linear gradient filling the whole box (Polotno `svg` element, keepRatio false). */
export const gradientSrc = (spec: GradientSpec) => {
  const v = directionVector(spec.direction);
  const from = isHex(spec.from) ? spec.from : '#000000', to = isHex(spec.to) ? spec.to : from;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" preserveAspectRatio="none">'
    + `<defs><linearGradient id="g" x1="${v.x1}" y1="${v.y1}" x2="${v.x2}" y2="${v.y2}">`
    + `<stop offset="0" stop-color="${from}" stop-opacity="${clamp(spec.fromOpacity ?? 0.85)}"/>`
    + `<stop offset="1" stop-color="${to}" stop-opacity="${clamp(spec.toOpacity ?? 0)}"/></linearGradient></defs>`
    + '<rect width="100" height="100" fill="url(#g)"/></svg>');
};
export const gradientElement = (props: Record<string, any>) => {
  const spec: GradientSpec = { from: props.from, to: props.to, fromOpacity: props.fromOpacity, toOpacity: props.toOpacity, direction: props.direction };
  return { type: 'svg', x: props.x ?? 0, y: props.y ?? 0, width: props.width ?? 100, height: props.height ?? 100,
    src: gradientSrc(spec), keepRatio: false, custom: { aiGradient: spec } };
};

// ---------- harmonize ----------
const area = (element: any) => (element.width || 0) * (element.height || 0);
const centerInside = (inner: any, outer: any) => {
  const cx = inner.x + (inner.width || 0) / 2, cy = inner.y + (inner.height || 0) / 2;
  return cx >= outer.x && cx <= outer.x + outer.width && cy >= outer.y && cy <= outer.y + outer.height;
};
/**
 * Recolours the page after the background picture arrived: overlays → the picture's dark tone, CTA →
 * boosted accent (AA with its label), headline/body → white/cream, kicker → light accent.
 * Returns how many elements changed.
 */
export const harmonize = (page: any, palette: Palette) => {
  const children: any[] = page.children || [];
  const pageArea = (page.width || 1) * (page.height || 1);
  const dark = deepen(palette.dark);
  const cta = ctaColors(palette);
  let changed = 0;
  const texts = children.filter((element) => element.type === 'text');
  const shapes = children.filter((element) => element.type === 'figure' || (element.type === 'svg' && element.custom?.aiGradient));
  // Button: a smaller shape with a text centred in it.
  const buttons = shapes.filter((shape) => area(shape) < pageArea * 0.15 && texts.some((text) => centerInside(text, shape)));
  for (const shape of shapes) {
    if (buttons.includes(shape)) {
      if (shape.type === 'figure') { shape.set({ fill: cta.fill }); changed += 1; }
      texts.filter((text) => centerInside(text, shape)).forEach((text) => { text.set({ fill: cta.text }); changed += 1; });
      continue;
    }
    if (shape.custom?.aiGradient) {
      const spec = { ...shape.custom.aiGradient, from: dark, to: dark };
      shape.set({ src: gradientSrc(spec), custom: { ...shape.custom, aiGradient: spec } });
      changed += 1;
    } else if (area(shape) >= pageArea * 0.08) {
      shape.set({ fill: dark });
      changed += 1;
    }
  }
  const free = texts.filter((text) => !buttons.some((button) => centerInside(text, button)));
  const headline = [...free].sort((a, b) => (b.fontSize || 0) - (a.fontSize || 0))[0];
  for (const text of free) {
    const isKicker = text !== headline && (String(text.text || '').length < 40 && (text.fontSize || 0) < (headline?.fontSize || 0) * 0.5
      && (text.y || 0) < (headline?.y || 0));
    const fill = text === headline ? '#ffffff' : isKicker ? lightAccent(palette) : '#fff8e7';
    if (text.fill !== fill) { text.set({ fill }); changed += 1; }
  }
  return changed;
};

// ---------- text fitting ----------
let measureContext: CanvasRenderingContext2D | null = null;
/** Wrapped line count of a text at a font size inside `width` (same word wrapping as the canvas). */
const lineCount = (text: string, element: any, fontSize: number) => {
  measureContext = measureContext || document.createElement('canvas').getContext('2d');
  if (!measureContext) return 1;
  measureContext.font = `${element.fontStyle || 'normal'} ${element.fontWeight || 'normal'} ${fontSize}px "${element.fontFamily || 'Roboto'}"`;
  let lines = 0;
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    lines += 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measureContext.measureText(next).width > (element.width || 1)) { lines += 1; line = word; }
      else line = next;
    }
  }
  return lines;
};
const textHeight = (element: any, fontSize: number) =>
  lineCount(element.text || '', element, fontSize) * fontSize * (typeof element.lineHeight === 'number' ? element.lineHeight : 1.2);

/**
 * Shrinks fontSize in 5% steps (down to 60% of the original) until each text fits: inside its zone (if
 * given), above the next element below it, inside the page; the largest text (headline) ≤ 2 lines.
 * Returns how many texts were resized.
 */
export const fitTexts = (page: any, texts: any[], zones: Zone[] = []) => {
  const children: any[] = page.children || [];
  const headline = [...texts].sort((a, b) => (b.fontSize || 0) - (a.fontSize || 0))[0];
  let resized = 0;
  for (const text of texts) {
    if (text.type !== 'text' || !text.fontSize || !text.text) continue;
    const zone = zones.find((candidate) => text.y >= candidate.y - 2 && text.y < candidate.y + candidate.height);
    const below = children.filter((other) => other !== text && other.type !== 'image' && !(other.type === 'svg' && other.custom?.aiGradient)
      && (other.y || 0) > text.y + 1
      && (other.x || 0) < text.x + (text.width || 0) && (other.x || 0) + (other.width || 0) > text.x)
      .map((other) => other.y || 0);
    const limit = Math.min(page.height - 4, zone ? zone.y + zone.height : Infinity, below.length ? Math.min(...below) - 4 : Infinity);
    const original = text.fontSize;
    let size = original;
    const tooBig = (value: number) => text.y + textHeight(text, value) > limit
      || (text === headline && lineCount(text.text, text, value) > 2);
    while (tooBig(size) && size > original * 0.6) size = Math.max(original * 0.6, size * 0.95);
    if (size !== original) { text.set({ fontSize: Math.round(size * 10) / 10 }); resized += 1; }
  }
  return resized;
};
