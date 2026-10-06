'use strict';
// Image jobs use the agy-image-gateway framework: gpt-image-2-style-library skill + per-request template,
// guidance, pitfalls and reference cases (port of core/template_engine.py). Missing data keeps the old path.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { artDirection, selectTemplate, skillDirectories } = (() => ({ ...require('../../packages/agy-mcp-runner/style-library.cjs'), ...require('../../packages/agy-mcp-runner/index.cjs') }))();
const { runTask, IMAGE_SKILLS, SKILL_PURPOSES, inlineSkillBody, skillByteCap } = require('../../packages/agy-mcp-runner/index.cjs');

const template = (id, category, extra = {}) => ({ id, category, title: { en: id.replace(/-/g, ' ') }, useWhen: { en: `use ${id}` },
  guidance: { en: [`guide ${id}`] }, pitfalls: { en: [`avoid ${id}`] }, styles: [], scenes: [], tags: [], exampleCases: [], ...extra });
const LIBRARY = {
  styles: [{ value: 'Illustration', keywords: ['watercolor'] }], scenes: [{ value: 'Food', keywords: ['coffee', 'tea'] }],
  templates: [
    template('ui-screenshot-system', 'UI & Interfaces'), template('infographic-engine', 'Charts & Infographics'),
    template('poster-layout-system', 'Posters & Typography'), template('product-commerce-visual', 'Products & E-commerce', { scenes: ['Food'], exampleCases: [7] }),
    template('illustration-art-style', 'Illustration & Art', { styles: ['Illustration'] }), template('realistic-photography', 'Photography & Realism', { exampleCases: [3] }),
    template('scene-storytelling', 'Scenes & Storytelling'),
  ],
};
const CASES = [
  { id: 3, title: 'Street portrait', category: 'Photography & Realism', tags: ['Photography'], prompt: 'Candid 35mm street portrait at golden hour, shallow depth of field.' },
  { id: 7, title: 'Coffee packshot', category: 'Products & E-commerce', tags: ['Product'], prompt: 'Premium coffee bag packshot on travertine, soft studio light. ' + 'x'.repeat(600) },
  { id: 9, title: 'Rainy market', category: 'Photography & Realism', tags: ['Photography', 'Street'], prompt: 'Rainy Saigon market at night, neon reflections, cinematic photo.' },
];
async function withData(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-style-lib-'));
  await fs.writeFile(path.join(dir, 'style-library.json'), JSON.stringify(LIBRARY));
  await fs.writeFile(path.join(dir, 'cases.json'), JSON.stringify({ cases: CASES }));
  try { return await fn(dir); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

test('template selection: Vietnamese/English keywords, word boundaries, tag overlap and fallback', () => {
  const pick = (prompt) => selectTemplate(prompt, LIBRARY).template.id;
  assert.equal(pick('Thiết kế giao diện app đặt đồ ăn'), 'ui-screenshot-system');
  assert.equal(pick('Vẽ sơ đồ quy trình tái chế nhựa'), 'infographic-engine');
  assert.equal(pick('Áp phích sự kiện âm nhạc'), 'poster-layout-system');
  assert.equal(pick('Ảnh sản phẩm chai nước hoa trên nền đá'), 'product-commerce-visual');
  assert.equal(pick('A watercolor fox in the forest'), 'illustration-art-style');
  assert.equal(pick('Cinematic wide shot of a woman on a Saigon street at dawn, no text'), 'realistic-photography');
  // "ui" inside "building" / "quiet" must not select the UI template.
  assert.equal(pick('A quiet old building by the river'), 'realistic-photography');
  // No rule: the library's own style/scene keywords (coffee -> Food scene -> product template).
  assert.equal(pick('a cup of coffee on a wooden table'), 'product-commerce-visual');
  assert.equal(selectTemplate('một con mèo', LIBRARY).reason, 'default for scenes and everyday images');
});

test('art direction carries guidance, pitfalls, closest cases (truncated), negatives; bounded and optional', async () => {
  await withData(async (dir) => {
    const env = { AGY_MCP_STYLE_LIBRARY_DIR: dir };
    const art = artDirection('Cinematic photo of a rainy Saigon market at night, 9:16, no text', env);
    assert.equal(art.templateId, 'realistic-photography');
    assert.deepEqual(art.cases.slice(0, 1), [9], 'best word overlap first');
    assert.match(art.text, /^ART DIRECTION \(gpt-image-2-style-library/);
    assert.match(art.text, /guide realistic-photography/);
    assert.match(art.text, /avoid realistic-photography/);
    assert.match(art.text, /NO garbled, unreadable/);
    assert.match(art.text, /The request wins over this guidance \(subject, aspect ratio, no-text\)/);
    assert.ok(art.text.length <= 2000, `art direction ${art.text.length} B`);
    const product = artDirection('Ảnh sản phẩm túi cà phê', env);
    assert.ok(product.cases.includes(7), 'template example case used when nothing else scores');
    assert.match(product.text, /Case #7 \(Coffee packshot\): Premium coffee bag[^\n]{150,190}\.\.\./);
    assert.equal(artDirection('anything', { ...env, AGY_MCP_STYLE_LIBRARY: '0' }), undefined, 'kill switch');
  });
  assert.equal(artDirection('anything', { AGY_MCP_STYLE_LIBRARY_DIR: path.join(os.tmpdir(), 'no-such-style-library') }), undefined, 'missing data: unchanged path');
});

test('image skills: style library allowlisted and default next to ai-product-photography; extra skill dirs are searched', () => {
  assert.deepEqual(IMAGE_SKILLS, ['ai-product-photography', 'gpt-image-2-style-library']);
  assert.ok(SKILL_PURPOSES['gpt-image-2-style-library']);
  assert.deepEqual(skillDirectories({ AGY_MCP_AUTH_HOME: '/h' }), ['/h/.agents/skills', '/h/agy-image-gateway/agents/skills']);
  assert.deepEqual(skillDirectories({ AGY_MCP_SKILLS_DIRECTORY: '/s', AGY_MCP_EXTRA_SKILL_DIRS: ['/a', 'relative', '/b'].join(path.delimiter) }), ['/s', '/a', '/b']);
  assert.deepEqual(skillDirectories({ AGY_MCP_SKILLS_DIRECTORY: '/s', AGY_MCP_EXTRA_SKILL_DIRS: '' }), ['/s']);
});

test('runner: image job loads both skills (style library from the gateway dir) and appends art direction to the prompt', async () => {
  await withData(async (data) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-style-run-'));
    const binary = path.join(root, 'fake-agy'), skills = path.join(root, 'skills'), gateway = path.join(root, 'gateway-skills');
    await fs.mkdir(path.join(skills, 'ai-product-photography'), { recursive: true });
    await fs.writeFile(path.join(skills, 'ai-product-photography', 'SKILL.md'), '# product photo rules');
    await fs.mkdir(path.join(gateway, 'gpt-image-2-style-library'), { recursive: true });
    await fs.writeFile(path.join(gateway, 'gpt-image-2-style-library', 'SKILL.md'), '---\nname: gpt-image-2-style-library\n---\n# style library rules');
    await fs.writeFile(binary, `#!/usr/bin/env node\nconst fs=require('node:fs'),i=process.argv.indexOf('-p');if(i>0){fs.writeFileSync(${JSON.stringify(path.join(root, 'prompt.txt'))},process.argv[i+1]);fs.copyFileSync('.agents/agents/video-job/agent.md',${JSON.stringify(path.join(root, 'agent.md'))});}\n`, { mode: 0o700 });
    const saved = { ...process.env };
    Object.assign(process.env, { AGY_MCP_BINARY: binary, AGY_MCP_AUTH_HOME: root, AGY_MCP_RECEIPT_DIRECTORY: path.join(root, 'receipts'), AGY_MCP_SKILLS_DIRECTORY: skills, AGY_MCP_EXTRA_SKILL_DIRS: gateway, AGY_MCP_STYLE_LIBRARY_DIR: data });
    try {
      const schema = { type: 'object', properties: { url: { type: 'string', minLength: 1 } }, required: ['url'], additionalProperties: false };
      await assert.rejects(runTask({ kind: 'image', role: 'visual art director', prompt: 'Cinematic photo of a rainy Saigon market\nRequired aspect ratio: 9:16.', schema }), /did not submit/);
      const prompt = await fs.readFile(path.join(root, 'prompt.txt'), 'utf8'), agent = await fs.readFile(path.join(root, 'agent.md'), 'utf8');
      assert.match(prompt, /Required aspect ratio: 9:16\.\n\nART DIRECTION \(gpt-image-2-style-library/);
      assert.match(prompt, /Template: realistic photography \[realistic-photography\]/);
      assert.match(agent, /## Skill: ai-product-photography/);
      assert.match(agent, /## Skill: gpt-image-2-style-library \(.+\)\n# style library rules/);
      // Opt-out per request keeps the original prompt.
      await assert.rejects(runTask({ kind: 'image', role: 'visual art director', prompt: 'plain request', schema, artDirection: false }), /did not submit/);
      assert.ok(!(await fs.readFile(path.join(root, 'prompt.txt'), 'utf8')).includes('ART DIRECTION'), 'no art direction block and no reference to it');
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

test('inlined style-library skill drops example image, references index and maintenance sections', () => {
  const body = '---\nname: gpt-image-2-style-library\n---\n# GPT-Image2 Style Library\nIntro.\n\n## Example Output\n![x](assets/x.png)\n\n## Reference\n- Read `references/style-library.md` first.\n\n## Workflow\n1. Match the template.\n\n## Maintenance\nnpm run generate:style-skill\n';
  const text = inlineSkillBody('gpt-image-2-style-library', body);
  assert.match(text, /^# GPT-Image2 Style Library\nIntro\.\n\n## Workflow\n1\. Match the template\.$/);
  assert.ok(!/references\/|assets\/|npm run/.test(text));
  assert.equal(inlineSkillBody('copywriting', '---\nname: c\n---\n# c\n## Rules\nkeep'), '# c\n## Rules\nkeep', 'other sections untouched');
});

test('caption-writer inlines only the core copywriting rules; other roles keep the full skill', () => {
  const copy = '---\nname: copywriting\n---\n# Copywriting\n## Before Writing\nask\n## Copywriting Principles\nclear\n## Page Structure Framework\nhero\n## CTA Copy Guidelines\ncta\n## Related Skills\nx\n';
  assert.equal(inlineSkillBody('copywriting', copy, 'caption-writer'), '# Copywriting\n## Copywriting Principles\nclear\n## CTA Copy Guidelines\ncta');
  assert.match(inlineSkillBody('copywriting', copy, 'content-writer'), /## Page Structure Framework/);
  const viral = '# V\n## 1. CORE\na\n## 4. 5 KIẾN TRÚC THÂN BÀI\nlong\n## 5. CTA\nb\n## 6. QUY TRÌNH\nsop\n';
  assert.equal(inlineSkillBody('viral-copywriting-master', viral, 'caption-writer'), '# V\n## 1. CORE\na\n## 5. CTA\nb');
});

test('every inlined skill: CLI blocks become example prompts, catalogue/batch/related sections go, 1.5 KB cap in line order', () => {
  const body = ['---', 'name: p', '---', '# Product Photo', '![banner](https://x/y.png)', '', '## Quick Start', '```bash', 'infsh login', '```', '',
    '## Styles', '### Studio', '```bash', 'infsh app run x --input \'{"prompt": "Product photo of a watch on white, soft studio light"}\'', '```', '### Empty', '```bash', 'infsh app list', '```', '',
    '## Batch Generation', 'loop over products', '', '## Best Practices', '1. **Consistent style**', '', '## Related Skills', '- other'].join('\n');
  assert.equal(inlineSkillBody('ai-product-photography', body),
    '# Product Photo\n\n## Styles\n### Studio\n- e.g. Product photo of a watch on white, soft studio light\n\n## Best Practices\n1. **Consistent style**');
  const long = ['# Rules', ...Array.from({ length: 200 }, (_, i) => `- rule ${i} giữ nhịp kể chuyện`)].join('\n');
  // Default cap regardless of the shell/.env value (.env sets 3000).
  const savedCap = process.env.AGY_MCP_SKILL_MAX_BYTES;
  delete process.env.AGY_MCP_SKILL_MAX_BYTES;
  let capped;
  try { capped = inlineSkillBody('viral-copywriting-master', long); }
  finally { if (savedCap !== undefined) process.env.AGY_MCP_SKILL_MAX_BYTES = savedCap; }
  assert.ok(Buffer.byteLength(capped) <= 1500, `${Buffer.byteLength(capped)} B`);
  assert.match(capped, /^# Rules\n- rule 0 /);
  assert.match(capped, /\n…\(trimmed\)$/);
  // A curated role list (caption-writer) is not capped; AGY_MCP_SKILL_MAX_BYTES=0 turns the cap off.
  assert.ok(Buffer.byteLength(inlineSkillBody('viral-copywriting-master', long, 'caption-writer')) > 1500);
  assert.equal(skillByteCap({ AGY_MCP_SKILL_MAX_BYTES: '0' }), 0);
  assert.equal(skillByteCap({}), 1500);
  assert.equal(skillByteCap({ AGY_MCP_SKILL_MAX_BYTES: '100' }), 400, 'floor keeps a usable core');
});
