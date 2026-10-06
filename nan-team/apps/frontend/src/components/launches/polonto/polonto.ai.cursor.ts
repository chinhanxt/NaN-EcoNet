'use client';

/**
 * "AI is drawing" overlay for the Polotno workspace, shown WHILE the AI works (its ops only arrive at
 * the end). One SVG laid over the active page (viewBox = page units) in which a branded cursor really
 * draws: hand-jittered outlines traced by the pen (stroke-dashoffset), typed text bars, guides, a colour
 * picker, resize handles, ripples and an image sketch. When the edit lands, blocks morph onto the real
 * elements and the overlay fades (≤ 0.8 s). Plain DOM/SVG, pointer-events: none; never touches the store.
 */
export type SketchKind = 'title' | 'text' | 'image' | 'button' | 'frame';
export type PageBox = { x: number; y: number; width: number; height: number; kind?: SketchKind };

const SVG_NS = 'http://www.w3.org/2000/svg';
const BRAND = '#059669';
const TINTS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Generic poster skeleton: title, two sub-lines, picture frame, CTA (page-relative). */
export const posterSketch = (width: number, height: number): PageBox[] => [
  { kind: 'title', x: width * 0.08, y: height * 0.07, width: width * 0.84, height: height * 0.11 },
  { kind: 'text', x: width * 0.08, y: height * 0.21, width: width * 0.7, height: height * 0.035 },
  { kind: 'text', x: width * 0.08, y: height * 0.26, width: width * 0.52, height: height * 0.035 },
  { kind: 'image', x: width * 0.08, y: height * 0.34, width: width * 0.84, height: height * 0.42 },
  { kind: 'button', x: width * 0.08, y: height * 0.82, width: width * 0.36, height: height * 0.075 },
];

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.appendChild(node);
  return node;
};
const shuffle = <T,>(items: T[]) => items.map((item) => [Math.random(), item] as const).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Block = { box: PageBox; kind: SketchKind; group: SVGGElement; outline: SVGPathElement; fill: SVGRectElement; drawn: boolean };

export class AiCanvasDirector {
  readonly enabled: boolean;
  private root?: SVGSVGElement;
  private layers: Record<'guides' | 'blocks' | 'fx' | 'cursor', SVGGElement> = {} as any;
  private cursor = { x: 0, y: 0 };
  private cursorGroup?: SVGGElement;
  private labelText?: SVGTextElement;
  private labelBg?: SVGRectElement;
  private blocks: Block[] = [];
  private running = false;
  private cancelled = false;
  private frames = new Set<number>();
  private finishers = new Set<() => void>();
  private follow?: ReturnType<typeof setInterval>;
  private scale = 1;

  constructor(private readonly store: any) {
    this.enabled = typeof window !== 'undefined' && !prefersReducedMotion();
  }

  // ---------- geometry ----------
  /**
   * Viewport rect of the active page, read from the DOM (no layout formula): Polotno keeps an HTML layer
   * for the page inside `.polotno-page-container` — an absolutely positioned div whose transform is
   * `translate(pageX, pageY) … scaleX(scale)` (it follows scroll and zoom). Its client rect origin IS the
   * page origin on screen; the size is page × store.scale (+ bleed offset).
   */
  private pageGeometry() {
    const page = this.store.activePage;
    const containers = Array.from(document.querySelectorAll<HTMLElement>('.polotno-page-container'));
    const container = containers.find((node) => node.classList.contains('active-page'))
      || containers[Math.max(0, this.store.pages?.indexOf?.(page) ?? 0)] || containers[0];
    // Only "gone from the DOM" counts as closed: offsetParent/visibility are unreliable inside the editor modal.
    if (!container || !page || !container.isConnected) return null;
    const box = container.getBoundingClientRect();
    const scale = this.store.scale || 1, bleed = page.bleed || 0;
    const anchor = Array.from(container.querySelectorAll<HTMLElement>('div[style*="scaleX("]'))
      .find((node) => node.style.position === 'absolute' && /translate\(/.test(node.style.transform));
    let left: number, top: number;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      left = rect.left + bleed * scale;
      top = rect.top + bleed * scale;
    } else {
      // Fallback (canvas/page.js): page group at ((w_c − (w + 2·bleed)·s)/2 + bleed·s, …) in the container.
      left = box.left + (box.width - (page.width + 2 * bleed) * scale) / 2 + bleed * scale;
      top = box.top + (box.height - (page.height + 2 * bleed) * scale) / 2 + bleed * scale;
    }
    return { container, box, scale, left, top, width: page.width * scale, height: page.height * scale, anchored: !!anchor };
  }

  /**
   * Keeps the overlay glued to the page (scroll/zoom). It is position: fixed on <body> (inside the
   * page container it was clipped/covered); it removes itself as soon as the editor's page container
   * leaves the DOM (popup closed) — and the AI tab also cancels it on unmount.
   */
  private reposition() {
    if (!this.root) return;
    const geometry = this.pageGeometry();
    if (!geometry) {
      console.debug('[ai-overlay] page container gone → overlay removed');
      this.cancel();
      return;
    }
    const { box } = geometry;
    if (geometry.left < box.left - 1 || geometry.top < box.top - 1 || geometry.left + geometry.width > box.right + 1) {
      console.warn('[ai-overlay] page rect outside its container', geometry, box);
    }
    if (!this.root.isConnected) document.body.appendChild(this.root);
    this.scale = geometry.scale;
    // Clip to the visible workspace: a zoomed-in page must not draw over the toolbar/side panel.
    const view = (geometry.container.closest('.polotno-workspace-container') as HTMLElement | null)?.getBoundingClientRect() || box;
    const edge = (inside: number) => (inside > 0 ? `${inside}px` : '-60px');
    const clip = `inset(${edge(view.top - geometry.top)} ${edge(geometry.left + geometry.width - view.right)} `
      + `${edge(geometry.top + geometry.height - view.bottom)} ${edge(view.left - geometry.left)})`;
    Object.assign(this.root.style, { transform: `translate(${geometry.left}px, ${geometry.top}px)`,
      width: `${geometry.width}px`, height: `${geometry.height}px`, clipPath: clip });
    this.placeCursor();
  }

  private mount() {
    if (this.root) return;
    const page = this.store.activePage;
    this.root = svg('svg', { viewBox: `0 0 ${page.width} ${page.height}`, overflow: 'visible', 'data-nan-ai-overlay': '1' }) as SVGSVGElement;
    Object.assign(this.root.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147482999', pointerEvents: 'none',
      overflow: 'visible', transition: 'opacity .2s ease' });
    const defs = svg('defs', {}, this.root);
    const shine = svg('linearGradient', { id: 'nanAiShine', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    svg('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': 0 }, shine);
    svg('stop', { offset: '0.5', 'stop-color': '#fff', 'stop-opacity': 0.55 }, shine);
    svg('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': 0 }, shine);
    for (const name of ['guides', 'blocks', 'fx', 'cursor'] as const) this.layers[name] = svg('g', {}, this.root);
    // Cursor: arrow + status label, kept at constant screen size (scale 1/zoom).
    this.cursorGroup = svg('g', { opacity: 0 }, this.layers.cursor);
    svg('path', { d: 'M0 0l15 8.2-6.6 1.6-3.1 6.4L0 0z', fill: BRAND, stroke: '#fff', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, this.cursorGroup);
    this.labelBg = svg('rect', { x: 13, y: 15, rx: 6, height: 17, width: 24, fill: BRAND }, this.cursorGroup);
    this.labelText = svg('text', { x: 19, y: 27, fill: '#fff', 'font-size': 10, 'font-weight': 600, 'font-family': 'system-ui,sans-serif' }, this.cursorGroup);
    this.labelText.textContent = 'AI';
    this.cursor = { x: page.width * 0.5, y: page.height * 0.5 };
    this.reposition();
    if (this.root) {
      console.debug('[ai-overlay] mounted over the page', this.root.style.transform, this.root.style.width, this.root.style.height,
        this.pageGeometry()?.anchored ? '(page layer)' : '(formula)');
      this.follow = setInterval(() => this.reposition(), 300);
    }
  }

  private placeCursor() {
    this.cursorGroup?.setAttribute('transform', `translate(${this.cursor.x} ${this.cursor.y}) scale(${1 / (this.scale || 1)})`);
  }

  /** Short status next to the cursor ("Căn lề", "Chọn màu"...); empty → just "AI". */
  private label(text = '') {
    if (!this.labelText || !this.labelBg) return;
    this.labelText.textContent = text ? `AI · ${text}` : 'AI';
    this.labelBg.setAttribute('width', String(12 + this.labelText.textContent.length * 5.6));
  }

  // ---------- timing ----------
  private tween(ms: number, step: (t: number) => void) {
    if (this.cancelled || !this.running) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const start = performance.now();
      let id = 0;
      const finish = () => { cancelAnimationFrame(id); this.frames.delete(id); this.finishers.delete(finish); resolve(); };
      const loop = (now: number) => {
        this.frames.delete(id);
        const t = Math.min(1, (now - start) / ms);
        step(t);
        if (t >= 1 || this.cancelled) { finish(); return; }
        id = requestAnimationFrame(loop);
        this.frames.add(id);
      };
      this.finishers.add(finish);
      id = requestAnimationFrame(loop);
      this.frames.add(id);
    });
  }

  private pause(ms: number) {
    return this.tween(ms, () => undefined);
  }

  private async moveTo(x: number, y: number, ms = 420) {
    const from = { ...this.cursor };
    this.cursorGroup?.setAttribute('opacity', '1');
    await this.tween(ms, (t) => {
      const k = ease(t);
      this.cursor = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
      this.placeCursor();
    });
  }

  /** Expanding ring where the cursor clicks / drops something. */
  private ripple(x: number, y: number, color = BRAND) {
    const ring = svg('circle', { cx: x, cy: y, r: 1, fill: 'none', stroke: color, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, this.layers.fx);
    const radius = 20 / (this.scale || 1);
    this.tween(450, (t) => { ring.setAttribute('r', String(1 + radius * t)); ring.setAttribute('opacity', String(1 - t)); })
      .then(() => ring.remove());
  }

  // ---------- drawing primitives ----------
  /** Rectangle outline with a slight hand tremor (perpendicular jitter ≈ 1.2 screen px). */
  private jitterRect(box: PageBox) {
    const wobble = 1.2 / (this.scale || 1);
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height], [box.x, box.y]];
    let d = `M${corners[0][0]} ${corners[0][1]}`;
    for (let side = 0; side < 4; side++) {
      const [ax, ay] = corners[side], [bx, by] = corners[side + 1];
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, jitter = i === steps ? 0 : (Math.random() - 0.5) * 2 * wobble;
        const nx = ay === by ? 0 : 1, ny = ay === by ? 1 : 0;
        d += ` L${ax + (bx - ax) * t + nx * jitter} ${ay + (by - ay) * t + ny * jitter}`;
      }
    }
    return d;
  }

  /** The pen traces `path` with the cursor at its tip (stroke-dashoffset). */
  private async trace(path: SVGPathElement, ms: number) {
    const length = path.getTotalLength();
    path.setAttribute('stroke-dasharray', `${length} ${length}`);
    path.setAttribute('stroke-dashoffset', String(length));
    const start = path.getPointAtLength(0);
    await this.moveTo(start.x, start.y, 260);
    await this.tween(ms, (t) => {
      const point = path.getPointAtLength(length * t);
      path.setAttribute('stroke-dashoffset', String(length * (1 - t)));
      this.cursor = { x: point.x, y: point.y };
      this.placeCursor();
    });
  }

  private makeBlock(box: PageBox): Block {
    const kind = box.kind || 'frame';
    const group = svg('g', {}, this.layers.blocks);
    const clipId = `nanAiClip${Math.random().toString(36).slice(2, 8)}`;
    const clip = svg('clipPath', { id: clipId }, group);
    const clipRect = svg('rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 4 / this.scale }, clip);
    const fill = svg('rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 4 / this.scale, fill: BRAND, 'fill-opacity': 0 }, group);
    const outline = svg('path', { d: this.jitterRect(box), fill: 'none', stroke: BRAND, 'stroke-width': 1.6, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, group);
    (fill as any).__clip = clipRect;
    (group as any).__clipId = clipId;
    return { box, kind, group, outline, fill, drawn: false };
  }

  /** Shimmer sweeping inside a block (SMIL, no JS per frame). */
  private shimmer(block: Block) {
    const band = svg('rect', { x: block.box.x - block.box.width, y: block.box.y, width: block.box.width * 0.6, height: block.box.height,
      fill: 'url(#nanAiShine)', 'clip-path': `url(#${(block.group as any).__clipId})` }, block.group);
    svg('animate', { attributeName: 'x', from: block.box.x - block.box.width * 0.6, to: block.box.x + block.box.width,
      dur: `${1.3 + Math.random() * 0.6}s`, repeatCount: 'indefinite' }, band);
  }

  private async drawBlock(block: Block) {
    const titles: Record<SketchKind, string> = { title: 'Đặt tiêu đề', text: 'Viết nội dung', image: 'Phác ảnh', button: 'Đặt nút', frame: 'Chọn vùng' };
    this.label(titles[block.kind]);
    await this.trace(block.outline, 520 + Math.random() * 260);
    this.ripple(this.cursor.x, this.cursor.y);
    await this.tween(260, (t) => block.fill.setAttribute('fill-opacity', String(0.12 * t)));
    if (block.kind === 'image') await this.sketchPicture(block);
    if (block.kind === 'title' || block.kind === 'text') await this.typeLines(block, block.kind === 'title' ? 2 : 1);
    if (block.kind === 'button') block.fill.setAttribute('fill-opacity', '0.28');
    this.shimmer(block);
    block.drawn = true;
  }

  // ---------- actions ----------
  /** Mountain + sun drawn by hand inside an image frame. */
  private async sketchPicture(block: Block) {
    const { x, y, width: w, height: h } = block.box;
    const hills = svg('path', { d: `M${x + w * 0.08} ${y + h * 0.85} L${x + w * 0.35} ${y + h * 0.45} L${x + w * 0.52} ${y + h * 0.68} L${x + w * 0.68} ${y + h * 0.5} L${x + w * 0.92} ${y + h * 0.85}`,
      fill: 'none', stroke: BRAND, 'stroke-width': 1.4, 'stroke-opacity': 0.7, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, block.group);
    await this.trace(hills, 520);
    const r = Math.min(w, h) * 0.08;
    const sun = svg('path', { d: `M${x + w * 0.78 + r} ${y + h * 0.25} a${r} ${r} 0 1 0 0.01 0`, fill: 'none', stroke: BRAND, 'stroke-width': 1.4,
      'stroke-opacity': 0.7, 'vector-effect': 'non-scaling-stroke' }, block.group);
    await this.trace(sun, 320);
  }

  /** Text bars appearing left→right as if typed, with a blinking caret. */
  private async typeLines(block: Block, lines: number) {
    const { x, y, width: w, height: h } = block.box;
    const lineHeight = h / (lines + 1), barHeight = Math.max(2 / this.scale, lineHeight * 0.45);
    const caret = svg('rect', { width: 1.5 / this.scale, height: barHeight * 1.4, fill: BRAND }, block.group);
    svg('animate', { attributeName: 'opacity', values: '1;0;1', dur: '0.9s', repeatCount: 'indefinite' }, caret);
    for (let line = 0; line < lines; line++) {
      const top = y + lineHeight * (line + 0.75) - barHeight / 2, full = w * (line ? 0.55 + Math.random() * 0.2 : 0.8 + Math.random() * 0.12);
      const bar = svg('rect', { x: x + w * 0.05, y: top, height: barHeight, width: 0, rx: barHeight / 2, fill: BRAND, 'fill-opacity': 0.45 }, block.group);
      await this.tween(380 + Math.random() * 220, (t) => {
        // Words: the bar grows in uneven steps.
        const width = full * Math.round(ease(t) * 7) / 7;
        bar.setAttribute('width', String(width));
        caret.setAttribute('x', String(x + w * 0.05 + width + 2 / this.scale));
        caret.setAttribute('y', String(top - barHeight * 0.2));
        this.cursor = { x: x + w * 0.05 + width + 6 / this.scale, y: top + barHeight };
        this.placeCursor();
      });
    }
    await this.pause(200);
    caret.remove();
  }

  /** Alignment guides (margins + thirds) fade in and out. */
  private async guides() {
    const page = this.store.activePage;
    this.label('Căn lề');
    const lines: SVGLineElement[] = [];
    const add = (x1: number, y1: number, x2: number, y2: number) => lines.push(svg('line', { x1, y1, x2, y2, stroke: '#ec4899',
      'stroke-width': 1, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke', opacity: 0 }, this.layers.guides));
    add(page.width * 0.08, 0, page.width * 0.08, page.height); add(page.width * 0.92, 0, page.width * 0.92, page.height);
    add(0, page.height / 3, page.width, page.height / 3); add(0, (page.height * 2) / 3, page.width, (page.height * 2) / 3);
    add(page.width / 2, 0, page.width / 2, page.height);
    await this.moveTo(page.width * 0.08, page.height * (0.2 + Math.random() * 0.5), 500);
    await this.tween(300, (t) => lines.forEach((line) => line.setAttribute('opacity', String(0.8 * t))));
    await this.moveTo(page.width / 2, page.height / 3, 450);
    this.ripple(page.width / 2, page.height / 3, '#ec4899');
    await this.pause(500);
    await this.tween(300, (t) => lines.forEach((line) => line.setAttribute('opacity', String(0.8 * (1 - t)))));
    lines.forEach((line) => line.remove());
  }

  /** A small swatch palette pops next to the cursor; a click tints a block. */
  private async pickColour(block: Block) {
    this.label('Chọn màu');
    const { x, y, width: w } = block.box;
    await this.moveTo(x + w * 0.9, y, 420);
    const size = 14 / this.scale, gap = 4 / this.scale;
    const palette = svg('g', { opacity: 0 }, this.layers.fx);
    const left = this.cursor.x + 16 / this.scale, top = this.cursor.y + 22 / this.scale;
    svg('rect', { x: left - gap, y: top - gap, width: TINTS.length * (size + gap) + gap, height: size + gap * 2, rx: 5 / this.scale,
      fill: '#fff', stroke: '#e5e7eb', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, palette);
    TINTS.forEach((color, index) => svg('rect', { x: left + index * (size + gap), y: top, width: size, height: size, rx: 3 / this.scale, fill: color }, palette));
    await this.tween(180, (t) => palette.setAttribute('opacity', String(t)));
    const choice = Math.floor(Math.random() * TINTS.length);
    const cx = left + choice * (size + gap) + size / 2, cy = top + size / 2;
    await this.moveTo(cx, cy, 380);
    this.ripple(cx, cy, TINTS[choice]);
    block.fill.setAttribute('fill', TINTS[choice]);
    await this.tween(260, (t) => block.fill.setAttribute('fill-opacity', String(0.12 + 0.12 * t)));
    await this.tween(200, (t) => palette.setAttribute('opacity', String(1 - t)));
    palette.remove();
  }

  /** Grab a corner handle and stretch/shrink the block a little, then settle back. */
  private async resize(block: Block) {
    this.label('Căn chỉnh');
    const box = block.box, handle = 7 / this.scale;
    const handles = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([hx, hy]) => svg('rect', { x: hx - handle / 2, y: hy - handle / 2, width: handle, height: handle, fill: '#fff', stroke: BRAND,
        'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke' }, this.layers.fx));
    const corner = handles[3];
    await this.moveTo(box.x + box.width, box.y + box.height, 420);
    this.ripple(this.cursor.x, this.cursor.y);
    const grow = (Math.random() < 0.5 ? -1 : 1) * Math.min(box.width, box.height) * 0.12;
    const set = (dw: number) => {
      block.fill.setAttribute('width', String(box.width + dw)); block.fill.setAttribute('height', String(box.height + dw * 0.5));
      block.outline.setAttribute('d', this.jitterRect({ ...box, width: box.width + dw, height: box.height + dw * 0.5 }));
      block.outline.removeAttribute('stroke-dasharray'); block.outline.removeAttribute('stroke-dashoffset');
      corner.setAttribute('x', String(box.x + box.width + dw - handle / 2)); corner.setAttribute('y', String(box.y + box.height + dw * 0.5 - handle / 2));
      this.cursor = { x: box.x + box.width + dw, y: box.y + box.height + dw * 0.5 };
      this.placeCursor();
    };
    await this.tween(420, (t) => set(grow * ease(t)));
    await this.tween(380, (t) => set(grow * (1 - ease(t))));
    handles.forEach((node) => node.remove());
  }

  private async wander() {
    const page = this.store.activePage;
    this.label('');
    await this.moveTo(page.width * (0.15 + Math.random() * 0.7), page.height * (0.15 + Math.random() * 0.7), 700);
    await this.pause(250);
  }

  // ---------- public API ----------
  /**
   * Starts the performance for `boxes` (first round draws every block, then shuffled actions loop:
   * guides, typing, colour pick, resize, image sketch, wander) until `land`/`cancel`.
   */
  sketch(boxes: PageBox[]) {
    if (!this.enabled || this.cancelled || !boxes.length || !this.store.activePage) return;
    this.mount();
    if (!this.root) return;
    this.blocks.forEach((block) => block.group.remove());
    this.blocks = boxes.map((box) => this.makeBlock(box));
    this.running = true;
    const blocks = this.blocks;
    (async () => {
      for (const block of blocks) {
        if (!this.running || this.blocks !== blocks) return;
        await this.drawBlock(block);
        await this.pause(120 + Math.random() * 160);
      }
      for (let round = 0; this.running && this.blocks === blocks; round++) {
        const pick = () => blocks[Math.floor(Math.random() * blocks.length)];
        const texty = blocks.filter((block) => block.kind === 'title' || block.kind === 'text');
        const pictures = blocks.filter((block) => block.kind === 'image');
        const actions = shuffle<() => Promise<void>>([
          () => this.guides(),
          () => this.pickColour(pick()),
          () => this.resize(pick()),
          () => this.wander(),
          ...(texty.length ? [() => this.typeLines(texty[Math.floor(Math.random() * texty.length)], 1)] : []),
          ...(pictures.length ? [() => this.sketchPicture(pictures[0])] : []),
        ]);
        for (const action of actions) {
          if (!this.running || this.blocks !== blocks) return;
          await action();
          await this.pause(150 + Math.random() * 250);
        }
      }
    })();
  }

  /** The real edit landed: blocks morph onto `targets` (in order, spare blocks fade), then all fades. */
  land(targets: PageBox[]) {
    if (!this.enabled || !this.root) { this.cleanup(); return; }
    this.running = false;
    this.finishers.forEach((finish) => finish());
    if (this.cancelled) { this.cleanup(); return; }
    const root = this.root, blocks = this.blocks;
    this.blocks = [];
    this.label('');
    const from = blocks.map((block) => block.box);
    const morph = () => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 600), k = ease(t);
        blocks.forEach((block, index) => {
          const a = from[index], b = targets[index];
          if (!b) { block.group.setAttribute('opacity', String(1 - t)); return; }
          const box = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, width: a.width + (b.width - a.width) * k, height: a.height + (b.height - a.height) * k };
          for (const [key, value] of Object.entries(box)) block.fill.setAttribute(key, String(value));
          block.outline.setAttribute('d', `M${box.x} ${box.y}h${box.width}v${box.height}h${-box.width}z`);
          block.outline.removeAttribute('stroke-dasharray');
        });
        if (targets[0]) {
          this.cursor = { x: targets[0].x + targets[0].width * 0.6, y: targets[0].y + targets[0].height * 0.6 };
          this.placeCursor();
        }
        if (t < 1) { requestAnimationFrame(step); return; }
        root.style.opacity = '0';
        setTimeout(() => this.cleanup(root), 220);
      };
      requestAnimationFrame(step);
    };
    morph();
  }

  private cleanup(root = this.root) {
    this.running = false;
    this.frames.forEach((id) => cancelAnimationFrame(id));
    this.frames.clear();
    if (this.follow) clearInterval(this.follow);
    this.follow = undefined;
    root?.remove();
    if (root === this.root) { this.root = undefined; this.blocks = []; }
  }

  /** "Hủy": stop at once; cursor and drawings vanish. */
  cancel() {
    if (this.root) console.debug('[ai-overlay] cancelled');
    this.cancelled = true;
    this.finishers.forEach((finish) => finish());
    this.cleanup();
  }

  /** End of a turn without a landing (error / nothing to morph to). */
  dispose() {
    if (this.root && !this.running) return; // a landing animation is finishing and cleans up itself
    this.land([]);
  }
}

/** Placeholder picture for an image box: centred image glyph (~25% of the short side), any aspect ratio. */
export const placeholderSrc = (width: number, height: number) => {
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
  const icon = Math.min(w, h) * 0.25, x = (w - icon) / 2, y = (h - icon) / 2, stroke = Math.max(2, icon * 0.06);
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`
    + `<rect width="${w}" height="${h}" fill="#e6f4ee"/>`
    + `<g transform="translate(${x} ${y}) scale(${icon / 100})" fill="none" stroke="${BRAND}" stroke-width="${(stroke * 100) / icon}" stroke-linejoin="round" opacity=".6">`
    + '<rect x="4" y="12" width="92" height="76" rx="10"/><circle cx="32" cy="38" r="9"/><path d="M10 80l28-28 20 20 14-14 22 22"/></g></svg>');
};
export const isPlaceholderSrc = (src: unknown) => typeof src === 'string' && src.startsWith('data:image/svg+xml') && src.includes('%23e6f4ee');
