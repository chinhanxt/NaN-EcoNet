'use strict';
// Art direction for AGY image jobs from the agy-image-gateway framework (awesome-gpt-image-2 data):
// pick the best template for the request, then add its guidance, pitfalls and the closest reference
// cases to the job prompt. Port of agy-image-gateway/core/template_engine.py (agent_auto_detect +
// build_art_director_context), with keyword rules mapped to template ids that exist in
// data/style-library.json and word-boundary matching (no "ui" inside "building").
// Data dir: AGY_MCP_STYLE_LIBRARY_DIR, default <AGY_MCP_AUTH_HOME or $HOME>/agy-image-gateway/data.
// Missing or invalid data returns undefined, so image jobs run exactly as before.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Small enough to keep image turns fast: one compact block (≤2 KB) instead of the whole library.
const MAX_TEXT = 2000;
const CASE_SNIPPET = 200;
// Ordered: explicit format/style words first, then generic photo/scene words. First matching rule wins.
const RULES = [
  ['ui-screenshot-system', ['ui', 'ux', 'giao diện', 'dashboard', 'bảng điều khiển', 'screenshot', 'ảnh chụp màn hình', 'website', 'landing page', 'mobile app', 'app ui', 'saas']],
  ['infographic-engine', ['infographic', 'sơ đồ', 'biểu đồ', 'quy trình', 'flowchart', 'diagram', 'mindmap', 'timeline', 'chart', 'dòng thời gian']],
  ['conceptual-typography-poster', ['typography', 'kiểu chữ', 'typographic']],
  ['poster-layout-system', ['poster', 'áp phích', 'banner', 'sự kiện', 'quảng cáo', 'sale', 'cover', 'bìa', 'triển lãm', 'flyer']],
  ['product-commerce-visual', ['sản phẩm', 'bao bì', 'product', 'packaging', 'mockup', 'mỹ phẩm', 'nước hoa', 'e-commerce', 'thương mại điện tử', 'packshot']],
  ['brand-identity-package', ['logo', 'biểu trưng', 'nhận diện thương hiệu', 'brand identity', 'brandmark', 'huy hiệu', 'icon set']],
  ['3d-collectible-toy', ['3d', 'diorama', 'miniature', 'isometric', 'mô hình', 'clay', 'đất sét', 'blind box', 'figurine', 'chibi']],
  ['illustration-art-style', ['illustration', 'minh họa', 'tranh vẽ', 'watercolor', 'màu nước', 'anime', 'manga', 'cartoon', 'hoạt hình', 'flat vector', 'ink painting']],
  ['character-design-sheet', ['character sheet', 'character design', 'thiết kế nhân vật', 'turnaround', 'pose sheet']],
  ['history-classical-themes', ['cổ trang', 'lịch sử', 'triều đại', 'historical', 'dynasty', 'ancient', 'cổ đại']],
  ['architecture-space', ['kiến trúc', 'nội thất', 'architecture', 'interior', 'floor plan', 'mặt bằng']],
  ['document-publishing', ['white paper', 'manual', 'tài liệu', 'báo cáo', 'magazine page', 'trang tạp chí']],
  ['scene-storytelling', ['storyboard', 'kịch bản', 'worldbuilding', 'narrative scene']],
  ['realistic-photography', ['photo', 'photography', 'nhiếp ảnh', 'chân dung', 'portrait', 'cinematic', 'điện ảnh', 'realistic', 'chân thực', 'camera', 'shot', 'close-up', 'lens', '35mm', 'ảnh chụp']],
];
// Requests that match no rule are usually video scenes or everyday photos.
const FALLBACK = 'realistic-photography';
const NEGATIVES = [
  'NO blurry or smudged textures',
  'NO garbled, unreadable or random pseudo-letters',
  'NO anatomical distortion, extra fingers or misaligned limbs',
  'NO generic AI slop, floating artifacts or plastic CGI sheen',
  'Text only where the request asks for it, spelled exactly as quoted',
];

const fold = (text) => String(text || '').normalize('NFC').toLowerCase();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (haystack, word) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}(?=$|[^\\p{L}\\p{N}])`, 'u').test(haystack);

let cache;
function dataDirectory(env = process.env) {
  return env.AGY_MCP_STYLE_LIBRARY_DIR || path.join(env.AGY_MCP_AUTH_HOME || os.homedir(), 'agy-image-gateway', 'data');
}
/** Loads (and caches per file mtime) style-library.json and cases.json; undefined when unavailable. */
function loadLibrary(env = process.env) {
  const directory = dataDirectory(env);
  const libraryFile = path.join(directory, 'style-library.json'), casesFile = path.join(directory, 'cases.json');
  try {
    const libraryMtime = fs.statSync(libraryFile).mtimeMs;
    let casesMtime = 0;
    try { casesMtime = fs.statSync(casesFile).mtimeMs; } catch { /* cases are optional */ }
    const key = `${directory}:${libraryMtime}:${casesMtime}`;
    if (cache?.key === key) return cache.value;
    const library = JSON.parse(fs.readFileSync(libraryFile, 'utf8'));
    if (!Array.isArray(library?.templates) || !library.templates.length) return undefined;
    let cases = [];
    if (casesMtime) {
      try { const raw = JSON.parse(fs.readFileSync(casesFile, 'utf8')); cases = Array.isArray(raw) ? raw : Array.isArray(raw?.cases) ? raw.cases : []; }
      catch { cases = []; }
    }
    cache = { key, value: { library, cases } };
    return cache.value;
  } catch { return undefined; }
}

/** Template for the request: keyword rules, then template/style/scene tag overlap, then FALLBACK. */
function selectTemplate(prompt, library) {
  const text = fold(prompt);
  const byId = new Map(library.templates.map((template) => [template.id, template]));
  for (const [id, words] of RULES) {
    const word = words.find((candidate) => hasWord(text, candidate));
    if (word && byId.has(id)) return { template: byId.get(id), reason: `keyword "${word}"` };
  }
  // Tag overlap with the library's own style/scene keywords (English requests mostly).
  const keywords = new Map();
  for (const entry of [...(library.styles || []), ...(library.scenes || [])]) for (const word of entry.keywords || []) if (word.trim().length > 2) keywords.set(fold(word.trim()), entry.value);
  const hits = new Set([...keywords].filter(([word]) => hasWord(text, word)).map(([, value]) => value));
  let best, bestScore = 0;
  for (const template of library.templates) {
    const score = [...(template.styles || []), ...(template.scenes || []), ...(template.tags || [])].filter((value) => hits.has(value)).length;
    if (score > bestScore) { best = template; bestScore = score; }
  }
  if (best) return { template: best, reason: `style/scene tags ${[...hits].join(', ')}` };
  return { template: byId.get(FALLBACK) || library.templates[0], reason: 'default for scenes and everyday images' };
}

/** Closest reference cases: same category +1, each request word (>2 chars) in title/tags/prompt head +2. */
function selectCases(prompt, template, cases, count = 2) {
  const words = new Set((fold(prompt).match(/[\p{L}\p{N}]+/gu) || []).filter((word) => word.length > 2));
  const preferred = new Set(template.exampleCases || []);
  const scored = [];
  for (const item of cases) {
    if (!item || typeof item.prompt !== 'string') continue;
    let score = (item.category === template.category ? 1 : 0) + (preferred.has(item.id) ? 1 : 0);
    const haystack = fold(`${item.title || ''} ${(item.tags || []).join(' ')} ${item.prompt.slice(0, 120)}`);
    for (const word of words) if (haystack.includes(word)) score += 2;
    if (score > 1) scored.push([score, item]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const picked = scored.slice(0, count).map(([, item]) => item);
  if (picked.length < count) for (const item of cases) {
    if (picked.length >= count) break;
    if (preferred.has(item?.id) && !picked.includes(item) && typeof item.prompt === 'string') picked.push(item);
  }
  return picked;
}

/** { templateId, templateTitle, reason, cases, text } for an image request, or undefined (no data / disabled). */
function artDirection(prompt, env = process.env) {
  if (env.AGY_MCP_STYLE_LIBRARY === '0' || typeof prompt !== 'string' || !prompt.trim()) return undefined;
  const loaded = loadLibrary(env);
  if (!loaded) return undefined;
  const { template, reason } = selectTemplate(prompt, loaded.library);
  if (!template) return undefined;
  const cases = selectCases(prompt, template, loaded.cases);
  const title = template.title?.en || template.id;
  const lines = [
    'ART DIRECTION (gpt-image-2-style-library, auto-selected; already applied, open no files):',
    `Template: ${title} [${template.id}] - ${template.category || 'General'}`,
    'Guidance:', ...(template.guidance?.en || []).map((item) => `- ${item}`),
    'Pitfalls to avoid:', ...(template.pitfalls?.en || []).map((item) => `- ${item}`),
    ...(cases.length ? ['Reference case patterns (structure only; never copy their subjects, text or language):',
      ...cases.map((item) => { const flat = item.prompt.trim().replace(/\s+/g, ' '); return `Case #${item.id} (${String(item.title || '').slice(0, 60)}): ${flat.slice(0, CASE_SNIPPET)}${flat.length > CASE_SNIPPET ? '...' : ''}`; })] : []),
    'Negative constraints:', ...NEGATIVES.map((item) => `- ${item}`),
    'The request wins over this guidance (subject, aspect ratio, no-text). Write ONE production-grade generate_image prompt from it in turn 1.',
  ];
  let text = lines.join('\n');
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT - 3) + '...';
  return { templateId: template.id, templateTitle: title, reason, cases: cases.map((item) => item.id), text };
}

module.exports = { artDirection, selectTemplate, selectCases, loadLibrary, dataDirectory, RULES, FALLBACK };
