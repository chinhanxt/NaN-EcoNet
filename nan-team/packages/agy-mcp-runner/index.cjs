'use strict';
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID, createHash } = require('node:crypto');
const { createJobServer, resultShape: resultShapeHint, resultShapeNote } = require('./job-server.cjs');
const { runProcess, nativeToolDiagnostic } = require('./process.cjs');
const { SPECIALISTS, readAgents, reviewProof, visionProof } = require('./native-review.cjs');
const { artDirection } = require('./style-library.cjs');
const RUNTIME_SOURCES = Object.fromEntries(['index.cjs','job-server.cjs','process.cjs','tool-gate.cjs','native-review.cjs','style-library.cjs'].map((name) => [name, fsSync.readFileSync(path.join(__dirname, name))]));
const RUNTIME_HASH = createHash('sha256').update(Buffer.concat(Object.entries(RUNTIME_SOURCES).flatMap(([name, body]) => [Buffer.from(name + ':' + body.length + ':'), body]))).digest('hex');
// Runner skill allowlist with the one-line purpose shown to AGY so it reads the right SKILL.md.
const SKILL_PURPOSES = {
  'copywriting': 'clear, benefit-led marketing copy and titles',
  'viral-copywriting-master': 'Vietnamese social copy: viral hook frameworks, body structures, rhythm',
  'video-retention-scriptwriting': 'short-video retention scripting: hook in 2s, pacing, syllable timing for Vietnamese TTS',
  'ai-product-photography': 'product/visual composition, lighting and framing critique',
  'gpt-image-2-style-library': 'image prompt templates, visual styles and reference cases (awesome-gpt-image-2)',
  'ai-social-media-content': 'platform-native TikTok/Reels/Shorts content, captions and hashtags',
  'data-visualization': 'chart choice, annotation and data storytelling',
  'ai-marketing-videos': 'marketing video structure for ads, promos, launches and brand content',
  'ai-content-pipeline': 'multi-step content pipelines combining image, video, audio and text',
  // design-editor (Polotno posters/social images over a photo): layout zones, title hierarchy, color and contrast.
  'frontend-design': 'distinctive design direction: subject grounding, deliberate typography and palette, avoiding generic AI defaults',
  'og-image-design': 'social card text sizes, safe-zone margins, photo-with-overlay contrast, consistent styling',
  'youtube-thumbnail-design': 'max-3-color strategy, high-contrast pairs, short bold text, safe zones',
};
// Upstream image failures worth rerouting to another account instead of a slow in-session retry.
const TRANSIENT_IMAGE = /\b5\d\d\b|timed? ?out|timeout|deadline|unavailable|overloaded|capacity|internal error|connection reset|econnreset|socket hang up/i;
// Linux caps one argv string at 128 KiB (MAX_ARG_STRLEN; spawn fails with E2BIG). A job prompt above this
// is not passed with -p: the CLI gets a pointer and get_job_evidence returns the full prompt instead.
const MAX_CLI_PROMPT_BYTES = 100 * 1024;
const LARGE_PROMPT_POINTER = 'The job prompt is too large for the command line: get_job_evidence returns it in full (field "prompt"); read it there and follow it exactly.';
const DENIED = ['run_command', 'command_status', 'send_command_input', 'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'search_web', 'read_url_content', 'browser_subagent', 'browser', 'install_plugin', 'add_mcp_server'];
// Image jobs: product/visual craft plus the agy-image-gateway style library (templates, styles, cases).
const IMAGE_SKILLS = ['ai-product-photography', 'gpt-image-2-style-library'];
// SKILL.md lookup order: AGY_MCP_SKILLS_DIRECTORY (or <auth home>/.agents/skills), then AGY_MCP_EXTRA_SKILL_DIRS
// (path-delimited; default <auth home>/agy-image-gateway/agents/skills, where the gateway keeps its skills).
function skillDirectories(env = process.env) {
  const home = env.AGY_MCP_AUTH_HOME || os.homedir();
  const extra = env.AGY_MCP_EXTRA_SKILL_DIRS !== undefined ? env.AGY_MCP_EXTRA_SKILL_DIRS.split(path.delimiter) : [path.join(home, 'agy-image-gateway', 'agents', 'skills')];
  return [...new Set([env.AGY_MCP_SKILLS_DIRECTORY || path.join(home, '.agents', 'skills'), ...extra.map((dir) => dir.trim()).filter((dir) => path.isAbsolute(dir))])];
}
// Inlined skill text drops sections that only make sense interactively or point at unreadable files
// (style-library: example image, references/ index, maintenance commands); the job's art direction
// already carries the selected template. Fewer tokens and no denied view_file turn.
const SKILL_DROP_SECTIONS = { 'gpt-image-2-style-library': ['Example Output', 'Reference', 'Maintenance'] };
// caption-writer jobs are short social posts: keep only the core rules (principles, style, banned
// clichés, hooks, CTA, voice) and drop landing-page structure, long frameworks, SOPs and references,
// so the prompt is shorter and the model answers faster. Headings match by prefix.
const ROLE_SKILL_DROP_SECTIONS = {
  // Poster/social layout: keep layout, typography, color and contrast rules; drop sizing specs, image-model
  // prompting, workflows, meta tags and face psychology (the picture is made elsewhere).
  'design-editor': {
    'frontend-design': ['More on writing in design'],
    'og-image-design': ['Platform Specifications', 'Templates by Content Type', 'OG Meta Tags Reference', 'Testing OG Images'],
    'youtube-thumbnail-design': ['Specifications', 'Face Expression Psychology', 'Thumbnail Patterns by Content Type', 'Thumbnail Checklist'],
  },
  'caption-writer': {
  'copywriting': ['Before Writing', 'Best Practices', 'Page Structure Framework', 'Page-Specific Guidance', 'Output Format', 'Related Skills'],
  'viral-copywriting-master': ['4. ', '6. '],
} };
// Whole paragraphs/lines dropped per role and skill (web-only guidance that does not apply to a static poster).
const ROLE_SKILL_DROP_LINES = { 'design-editor': {
  'frontend-design': /^(?:For web designs|Use non-user-triggered motion|Consider written content|Default to line lengths|When writing the code|Work in two passes|Then review that plan|- (?:Color|Type|Layout|Principles):|Visual structure is information|[345]\. (?:a broadsheet|the SaaS-card|template chrome))/,
} };
function inlineSkillBody(name, body, role) {
  let text = body.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const drop = [...(SKILL_DROP_SECTIONS[name] || []), ...((ROLE_SKILL_DROP_SECTIONS[role] || {})[name] || [])];
  for (const heading of drop) {
    const prefix = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^## ${prefix}[^\\n]*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm'), '');
  }
  const dropLines = (ROLE_SKILL_DROP_LINES[role] || {})[name];
  if (dropLines) text = text.split('\n').filter((line) => !dropLines.test(line.trim())).join('\n');
  // Every inlined skill: no CLI/code examples (never run here), no tool/model catalogues, batch or
  // pipeline recipes, cross-links or docs; then a per-skill byte cap (AGY_MCP_SKILL_MAX_BYTES, default
  // 1500, 0 = off) that keeps whole lines in document order (core rules come first in these skills).
  // Roles with a curated section list (ROLE_SKILL_DROP_SECTIONS, e.g. caption-writer) are not capped.
  // A code block becomes its example prompt text (style examples live in CLI JSON), if it has one.
  text = text.replace(/^```[\s\S]*?^```[^\n]*$/gm, (block) => {
    const example = /"prompt"\s*:\s*"((?:[^"\\]|\\.){12,})"/.exec(block)?.[1];
    return example ? `- e.g. ${example.replace(/\\"/g, '"').slice(0, 160)}` : '';
  });
  text = text.replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, '');
  text = text.replace(new RegExp(`^## (?:${GENERIC_SKILL_DROP.source})[^\\n]*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'gim'), '');
  // Headings left without any body (their examples were code) are dropped too.
  {
    const lines = text.split('\n'), level = (line) => /^(#{2,4}) /.exec(line)?.[1].length || 0;
    for (let index = lines.length - 1; index >= 0; index--) {
      const own = level(lines[index]);
      if (!own) continue;
      let next = index + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      const following = next < lines.length ? level(lines[next]) : -1;
      // Empty when the next content is the end or a heading of the same or a higher level.
      if (following === -1 || (following && following <= own)) lines.splice(index, 1);
    }
    text = lines.join('\n');
  }
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  // The image framework skill (template-selection workflow) is never cut: it is small and core for image jobs.
  const cap = UNCAPPED_SKILLS.has(name) ? 0 : ROLE_SKILL_CAP[role] ?? (ROLE_SKILL_DROP_SECTIONS[role] ? 0 : skillByteCap());
  if (cap && Buffer.byteLength(text) > cap) {
    const kept = [];
    let bytes = 0;
    for (const line of text.split('\n')) {
      const size = Buffer.byteLength(line) + 1;
      if (bytes + size > cap - 16) break;
      kept.push(line); bytes += size;
    }
    text = `${kept.join('\n').trim()}\n…(trimmed)`;
  }
  return text;
}
const UNCAPPED_SKILLS = new Set(['gpt-image-2-style-library']);
// Per-role byte cap per inlined skill after section drops (overrides AGY_MCP_SKILL_MAX_BYTES for that role).
const ROLE_SKILL_CAP = { 'design-editor': 2800 };
// Section headings dropped from every inlined skill (matched at the start of the "## " heading text).
const GENERIC_SKILL_DROP = /quick start|available models|batch|post-processing|related skills|documentation|installation|example output|reference\b|maintenance|pipeline building blocks|complete (?:ad )?workflows|a\/b testing/;
function skillByteCap(env = process.env) {
  const value = Number(env.AGY_MCP_SKILL_MAX_BYTES ?? 1500);
  return Number.isFinite(value) && value > 0 ? Math.max(400, Math.floor(value)) : 0;
}
async function readSkill(directories, name) {
  for (const directory of directories) {
    try { return await fs.readFile(path.join(directory, name, 'SKILL.md'), 'utf8'); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  throw Object.assign(new Error(`Skill ${name} not found`), { code: 'ENOENT' });
}
function selectModel(request, env = process.env) {
  // Image/chat use descriptive roles in prompts; route those by job kind.
  const role = ['image', 'chat'].includes(request.kind) ? request.kind : request.role || '';
  const key = String(role).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return env[`AGY_MCP_MODEL_${key}`]?.trim() || env.AGY_MCP_MODEL?.trim() || undefined;
}
// Built-in effort for text-only post roles (video, ASR and image roles keep the CLI default):
// captions are short copy, text-editor jobs are classification/extraction/splits.
// design-editor (Polotno "AI thiết kế"): layout operations from one screenshot, medium is enough.
const ROLE_EFFORT = { 'caption-writer': 'medium', 'text-editor': 'low', 'design-editor': 'medium' };
// Vision roles whose whole job prompt (instruction + elements JSON) is in -p: skip get_job_evidence and
// read the frame(s) in turn 1, submit in turn 2. Other vision jobs keep get_job_evidence in the batch.
const FRAME_EVIDENCE_IN_PROMPT_ROLES = new Set(['design-editor']);
// Reasoning effort per role: AGY_MCP_EFFORT_<ROLE>, then the built-in role default, then AGY_MCP_EFFORT;
// unset keeps the CLI default.
function selectEffort(request, env = process.env) {
  const role = ['image', 'chat'].includes(request.kind) ? request.kind : request.role || '';
  // Order: operator env per role, then the caller's per-request effort (e.g. a light design tweak), then
  // the built-in role default, then AGY_MCP_EFFORT.
  const value = (env[`AGY_MCP_EFFORT_${String(role).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`] || request.effort || ROLE_EFFORT[role] || env.AGY_MCP_EFFORT || '').trim().toLowerCase();
  return ['low', 'medium', 'high', 'max'].includes(value) ? value : undefined;
}
function nativeEnvironment(home, source = process.env) {
  const env = { PATH: source.PATH, HOME: home, LANG: source.LANG || 'C.UTF-8', XDG_CONFIG_HOME: path.join(home, '.config'), XDG_CACHE_HOME: path.join(home, '.cache') };
  const provider = source.AGY_MCP_PROVIDER_URL || source.CLOUD_CODE_URL;
  if (provider) env.CLOUD_CODE_URL = provider;
  for (const key of ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'SSL_CERT_FILE']) if (source[key]) env[key] = source[key];
  // Every job has a fresh HOME, so the CLI's 15-minute update lock never persists and each job
  // would spawn a background updater (network + CPU, and it may swap the binary mid-run).
  if (source.AGY_MCP_ALLOW_AUTO_UPDATE !== '1') env.AGY_CLI_DISABLE_AUTO_UPDATE = '1';
  return env;
}
async function ownedPath(root, candidate) {
  const actual = await fs.realpath(candidate);
  const base = await fs.realpath(root);
  if (!actual.startsWith(base + path.sep)) throw new Error('Artifact is outside job-owned directory');
  const stat = await fs.stat(actual);
  if (!stat.isFile() || stat.size > 30_000_000) throw new Error('Artifact is not an allowed file');
  return actual;
}
async function imageBytes(filename) {
  const data = await fs.readFile(filename);
  if (data.length > 30_000_000) throw new Error('Image exceeds size limit');
  let mimeType;
  if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mimeType = 'image/png';
  else if (data[0] === 255 && data[1] === 216 && data[2] === 255) mimeType = 'image/jpeg';
  else if (data.toString('ascii',0,4) === 'RIFF' && data.toString('ascii',8,12) === 'WEBP') mimeType = 'image/webp';
  if (!mimeType) throw new Error('Unsupported image format');
  return { data: data.toString('base64'), mimeType };
}
async function bootstrap(home, authHome) {
  const cli = path.join(home, '.gemini', 'antigravity-cli');
  await fs.mkdir(cli, { recursive: true, mode: 0o700 });
  const source = path.join(authHome, '.gemini', 'antigravity-cli');
  let preferences = {};
  try {
    const user = JSON.parse(await fs.readFile(path.join(source, 'settings.json'), 'utf8'));
    for (const key of ['model', 'agent', 'provider', 'modelProvider', 'runningLightSpeed']) if (user[key] !== undefined) preferences[key] = user[key];
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  preferences.toolPermission = 'request-review';
  preferences.allowNonWorkspaceAccess = false;
  preferences.trustedWorkspaces = [];
  await fs.writeFile(path.join(cli, 'settings.json'), JSON.stringify(preferences), { mode: 0o600 });
  try { await fs.copyFile(path.join(source, 'antigravity-oauth-token'), path.join(cli, 'antigravity-oauth-token')); await fs.chmod(path.join(cli, 'antigravity-oauth-token'), 0o600); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  return cli;
}
async function runTask(request, options = {}) {
  if (!request || typeof request.prompt !== 'string' || !request.prompt.trim() || request.prompt.length > 200000) throw new Error('Invalid AGY job prompt');
  options.signal?.throwIfAborted();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'postiz-agy-'));
  await fs.chmod(root, 0o700);
  let server;
  const policyTrace = path.join(root, 'policy-trace.jsonl');
  const skills = [];
  const skillHashes = {};
  const skillBodies = {};
  let policy;const nativeToolErrors=[];
  // Storage URLs this job uploaded; removed if the job does not complete (hedge lost, abort, failure).
  const publishedUrls = new Set();
  // Set when the job is aborted early so the caller can reroute (image fail-fast / stall).
  let failFast, stallTimer;
  // Startup split for receipts: runner setup (profile, MCP server, hooks) vs CLI start until its first stream event.
  let spawnedAt, firstEventAt, art;
  const startedAt = new Date().toISOString();
  const id = randomUUID();
  const cancel = new AbortController();
  const cancelParent = () => cancel.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', cancelParent, { once: true });
  if(options.signal?.aborted)cancelParent();
  // Chat turns may wait on bounded video status calls, so they get their own (longer) deadline.
  const defaultTimeoutMs = request.nativeReview ? 600000 : request.kind === 'chat' ? 420000 : 300000;
  const configuredTimeoutMs = request.kind === 'chat' ? Number(process.env.AGY_MCP_CHAT_DEADLINE_MS) || Number(process.env.AGY_MCP_TIMEOUT_MS) : Number(process.env.AGY_MCP_TIMEOUT_MS);
  const deadline = Date.now() + Math.min(600000, Math.max(1000, configuredTimeoutMs || defaultTimeoutMs));
  const deadlineTimer = setTimeout(() => cancel.abort(new Error('AGY job deadline exceeded')), Math.max(1, deadline - Date.now()));
  try {
    cancel.signal.throwIfAborted();
    const home = path.join(root, 'home'), workspace = path.join(root, 'workspace');
    await fs.mkdir(workspace, { mode: 0o700 });
    await fs.mkdir(path.join(workspace, '.agents'), { mode: 0o700 });
    const cli = await bootstrap(home, process.env.AGY_MCP_AUTH_HOME || os.homedir());
    const frames = [];
    const evidenceRoot = path.join(workspace, 'evidence');
    await fs.mkdir(evidenceRoot, {mode:0o700});
    for (const frame of request.frames || []) {
      // Frame capabilities are supplied by the trusted application, never an LLM path.
      if (!path.isAbsolute(frame.path) || !Number.isFinite(frame.timestampSeconds) || frame.timestampSeconds < 0) throw new Error('Invalid frame capability');
      const bytes = await imageBytes(await fs.realpath(frame.path));
      const imagePath = path.join(evidenceRoot, `frame-${frames.length}.${bytes.mimeType.split('/')[1]}`);
      await fs.writeFile(imagePath, Buffer.from(bytes.data, 'base64'), {mode:0o600});
      frames.push({ ...bytes, imagePath, timestampSeconds: frame.timestampSeconds });
    }

    let seedImage = request.seedImage;
    if (seedImage) {
      if (!['image/png','image/jpeg','image/webp'].includes(seedImage.mimeType) || typeof seedImage.data !== 'string' || seedImage.data.length > 40000000) throw new Error('Invalid seed image capability');
      const imagePath = path.join(evidenceRoot, `seed.${seedImage.mimeType.split('/')[1]}`);
      await fs.writeFile(imagePath, Buffer.from(seedImage.data, 'base64'), {mode:0o600});
      seedImage = {...await imageBytes(imagePath),imagePath};
    }
    const skillRoots = skillDirectories();
    for (const name of [...new Set([...(request.nativeReview ? Object.values(SPECIALISTS).map((entry) => entry.skill) : []), ...(request.kind === 'image' ? IMAGE_SKILLS : []), ...(request.skills || (request.kind === 'image' ? [] : ['copywriting', 'viral-copywriting-master', 'video-retention-scriptwriting']))])]) {
      if (!SKILL_PURPOSES[name]) throw new Error('Skill is outside runner allowlist');
      try {
        const body = await readSkill(skillRoots, name);
        const dir = path.join(workspace, '.agents', 'skills', name);
        await fs.mkdir(dir, { recursive: true, mode: 0o700 });
        await fs.writeFile(path.join(dir, 'SKILL.md'), body, { mode: 0o600 });
        skills.push(name);
        skillBodies[name] = body;
        skillHashes[name] = createHash('sha256').update(body).digest('hex');
      } catch (err) { if (err.code !== 'ENOENT' || request.nativeReview) throw err; }
    }
    // Exact absolute paths native view_file may open; told to the agent up front so it never guesses.
    // Without native review the skill text goes straight into the agent system prompt: the same guidance
    // without one slow view_file turn per SKILL.md. Native specialists still read (and prove) their skill file.
    const inlineSkills = !request.nativeReview;
    const readableFiles = [...(inlineSkills ? [] : skills).map((name) => path.join(workspace, '.agents', 'skills', name, 'SKILL.md')), ...frames.map((frame) => frame.imagePath), ...(seedImage ? [seedImage.imagePath] : [])];
    // Native specialists only see the job through get_job_evidence, so they still get the full prompt.
    // Image jobs get template/style guidance from the agy-image-gateway style library (none when its data is missing).
    art = request.kind === 'image' && request.artDirection !== false ? artDirection(request.prompt) : undefined;
    const jobPrompt = art ? `${request.prompt}\n\n${art.text}` : request.prompt;
    const promptInArgs = Buffer.byteLength(jobPrompt) <= MAX_CLI_PROMPT_BYTES;
    // Text-only content/analysis jobs: the -p prompt already carries everything get_job_evidence would return
    // (prompt, result shape, skills), so turn 1 goes straight to submit_result. This saves one model turn
    // (~4-7 s of the 8-10 s before the first MCP call). Vision, seed, review and caller-tool jobs keep it.
    const evidenceInPrompt = promptInArgs && !request.nativeReview && !seedImage && ['content', 'analysis'].includes(request.kind) && !(request.tools || []).length
      && (!frames.length || FRAME_EVIDENCE_IN_PROMPT_ROLES.has(request.role) || request.evidenceInPrompt === true);
    server = await createJobServer({ ...request, prompt: jobPrompt, promptInTask: !request.nativeReview && promptInArgs, evidenceInPrompt, readableFiles, seedImage, signal: cancel.signal, id, frames, skills, specialistProfiles: request.nativeReview ? SPECIALISTS : undefined, reviewProof: () => reviewProof(policy), visionProof:()=>visionProof(policy), publishedUrls, readFrames: new Set(), publishImage: async (candidate) => {
      if (!options.publishImage) throw new Error('Image publishing is not configured');
      const actual = await ownedPath(path.join(cli, 'brain'), candidate);
      const image = await imageBytes(actual);
      cancel.signal.throwIfAborted();
      const url = await options.publishImage(actual, image.mimeType, cancel.signal);
      publishedUrls.add(url);
      cancel.signal.throwIfAborted();
      return url;
    } });
    // The service pins each job to one AGYXT per-account proxy when a pool is configured.
    const env = nativeEnvironment(home, options.providerUrl ? { ...process.env, AGY_MCP_PROVIDER_URL: options.providerUrl } : process.env);
    const policyFile = path.join(root, 'policy.json');

    policy = { kind: request.kind, nativeReview: !!request.nativeReview, frameCount: frames.length, hasSeed: !!seedImage, framePaths:frames.map((frame)=>frame.imagePath), seedPath:seedImage?.imagePath, reportRoot:path.join(root,'specialist-reports'), brainRoot: path.join(cli, 'brain'), skillPaths: Object.fromEntries(skills.map((name) => [name,path.join(workspace, '.agents', 'skills', name, 'SKILL.md')])), mcpTools: ['get_job_evidence', ...(frames.length ? ['read_frame'] : []), 'submit_result', ...(request.seedImage ? ['read_seed_image'] : []), ...(request.kind === 'image' ? ['publish_image'] : []), ...(request.tools || []).map((t) => t.name)], readableFiles, readRoots: [path.join(cli, 'mcp'), path.join(workspace, '.agents', 'skills'), path.join(workspace, '.agents', 'agents'), evidenceRoot, ...(request.kind === 'image' ? [path.join(cli, 'brain')] : [])], trace: policyTrace };
    await fs.mkdir(policy.reportRoot,{mode:0o700});
    await fs.writeFile(policyFile, JSON.stringify(policy), { mode: 0o600 });
    env.AGY_JOB_POLICY = policyFile;
    const hookPath = path.join(root, 'tool-gate.cjs');
    await fs.writeFile(hookPath, RUNTIME_SOURCES['tool-gate.cjs'], { mode: 0o600 });
    await fs.writeFile(path.join(root, 'native-review.cjs'), RUNTIME_SOURCES['native-review.cjs'], { mode: 0o600 });
    const quote = (value) => "'" + value.replace(/'/g, "'\"'\"'") + "'";
    const hookCommand = quote(process.execPath) + ' ' + quote(hookPath) + ' ' + quote(policyFile);
    await fs.writeFile(path.join(workspace, '.agents', 'hooks.json'), JSON.stringify({ 'job-capability': { PostToolUse: [{matcher:'*',hooks:[{type:'command',command:hookCommand+' post',timeout:10}]}], PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: hookCommand, timeout: 10 }] }] } }), { mode: 0o600 });
    const binary = process.env.AGY_MCP_BINARY || 'agy';
    const processOptions = () => ({ cwd: workspace, env, signal: cancel.signal, timeoutMs: Math.max(1, deadline - Date.now()) });
    const configFile = path.join(cli, 'settings.json');
    const config = JSON.parse(await fs.readFile(configFile, 'utf8'));

    const selectedModel = options.model || selectModel(request);
    // url-only image jobs finish on publish_image (job-server auto-submits {url}).
    const autoImage = request.kind === 'image' && JSON.stringify(Object.keys(request.schema?.properties || {})) === '["url"]';
    const effectiveModel = selectedModel || config.model || 'account-default';
    config.permissions = { allow: policy.mcpTools.map((name) => `mcp(video-job/${name})`), deny: ['command(*)', 'write_file(*)', 'read_url(*)'] };
    await fs.writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
    await runProcess(binary, ['mcp', 'add', '--type', 'http', '--header', `Authorization: Bearer ${server.token}`, 'video-job', server.url], processOptions());
    const agentDir = path.join(workspace, '.agents', 'agents', 'video-job');
    await fs.mkdir(agentDir, { recursive: true, mode: 0o700 });
    const disabled = request.kind === 'image' ? DENIED : [...DENIED, 'generate_image', ...(request.kind === 'chat' && !frames.length ? ['view_file', 'list_resources', 'invoke_subagent'] : [])];
    await fs.writeFile(path.join(agentDir, 'agent.md'), `---\nname: video-job\ndescription: Scoped video production agent\nmainAgent: true\nsubagent: false\ninheritMcp: true\ncommandExecutionPolicy: off\ntools:\n  disabledTools: ${JSON.stringify(disabled)}\n---\n# System Prompt\nYou execute a scoped ${request.kind} job. ${evidenceInPrompt ? 'All job evidence is in the task prompt; do not call get_job_evidence.' : 'Read get_job_evidence first.'} Use only job MCP tools${request.kind === 'image' ? ', native generate_image' : ''} and native bounded subagent collaboration. Never execute commands, modify files, install anything, browse, access credentials, or add capabilities. Skills are reasoning guidance only; do not execute their CLI examples. ${request.kind === 'chat' ? 'Answer the latest user request. Call only tools needed for that request. Do not inspect local files unless authorized image evidence was supplied. Never call read_frame when the evidence manifest has no frames. Submit a nonempty final answer as submit_result arguments {"result":{"content":"your answer"}} immediately after the necessary tool returns.' : `${frames.length ? `Read every provided visual frame using read_frame. This job has exactly ${frames.length} frames: valid indexes 0 through ${frames.length - 1}. Never request another frame index. Batch independent calls in ONE parallel turn: every read_frame index together with native view_file on every frame imagePath.` : 'This job has no visual frames: read_frame does not exist here; never call it.'} ${seedImage ? 'Inspect the seed image using read_seed_image. ' : ''}${frames.length || seedImage ? 'For actual vision, use native view_file on each exact authorized imagePath returned by MCP; textual MCP attachments alone do not establish visual evidence. ' : ''}Use view_file only on exact paths given to you (skill file${frames.length || seedImage ? ', evidence imagePath' : ''}${request.kind === 'image' ? ', your generate_image artifact' : ''}); never guess or browse other paths, they are denied.`} Never call run_command, search_web, read_url_content, list_resources, browser or file-writing tools: they are unavailable here and each denied call only wastes a turn. Submit the result using submit_result once, with the complete result. Printed JSON cannot complete the job.\n${inlineSkills && skills.length ? `\n# Reasoning skills (already loaded here; do not open any SKILL.md; guidance only, never run their CLI examples)\n${skills.map((name) => `\n## Skill: ${name} (${SKILL_PURPOSES[name]})\n${inlineSkillBody(name, skillBodies[name], request.role)}\n`).join('')}` : ''}`, { mode: 0o600 });
    for (const [name, profile] of Object.entries(SPECIALISTS)) {
      const directory = path.join(workspace, '.agents', 'agents', name);
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(directory, 'agent.md'), `---\nname: ${name}\ndescription: ${profile.role} for grounded video production\nmainAgent: false\nsubagent: true\ninheritMcp: true\ncommandExecutionPolicy: off\n---\n# System Prompt\n${profile.focus} Read your skill at ${policy.skillPaths[profile.skill]}. Read get_job_evidence, every read_frame index, and read_seed_image if present. For each returned exact imagePath, use native view_file to actually inspect the image; MCP image attachment alone may not provide vision context. Use evidence only; never invent facts. Return a concise grounded critique to the parent via native send_message using the parent conversation ID. You cannot submit_result, publish images, call custom tools, generate assets, invoke agents, execute commands, browse, or modify files. Skills provide reasoning guidance; never run their command examples.\n`, {mode:0o600});
    }
    const editorEntries = ['content-editor','visual-editor'].map((name) => ({TypeName:name,Prompt:`${SPECIALISTS[name].focus} Read your assigned skill and every evidence frame, use native view_file on each exact imagePath returned by MCP for actual vision, then send findings to the parent via send_message.`,Role:SPECIALISTS[name].role,Workspace:'inherit'}));
    const reviewEntry = {TypeName:'render-reviewer',Prompt:`${SPECIALISTS['render-reviewer'].focus} Read your skill and every evidence frame, use native view_file on every returned imagePath, review both editors findings supplied by the parent, then send a final critique via send_message.`,Role:SPECIALISTS['render-reviewer'].role,Workspace:'inherit'};
    const reviewInstructions = request.nativeReview ? `REQUIRED native collaboration: first invoke_subagent with ${JSON.stringify({Subagents:editorEntries})}. Read both child findings using manage_inbox. After both editors have successfully sent findings, invoke_subagent with ${JSON.stringify({Subagents:[reviewEntry]})}, adding both editors findings to its Prompt. Wait for the render reviewer to send its successful critique; incorporate corrections before submit_result. These are native tool calls, never role prompts or messages to unstarted agents. All three specialists must read their skill and every supplied visual frame.` : '';
    const prompt = `${request.kind === 'chat' ? '' : 'There is no shell, terminal or file-writing tool in this job: never call run_command, write_to_file or search tools (every such call is denied and wastes a turn). '}Complete this scoped ${request.kind} job as ${request.role || 'video producer'}. ${evidenceInPrompt ? (frames.length ? 'All job evidence except the frame images (job prompt below, result shape and skills) is already in this message: do not call get_job_evidence.' : `All job evidence (job prompt below, result shape and skills) is already in this message: do not call get_job_evidence or any other tool before you are done; write the result and make video-job/submit_result your first and only tool call.`) : 'Call get_job_evidence on video-job first.'} If a seed image is supplied, call read_seed_image then native view_file on its exact authorized image path before drafting. ${request.kind === 'image' && frames.length ? `This image job has ${frames.length} REFERENCE IMAGE${frames.length === 1 ? '' : 'S'} from the user. Fastest valid order: turn 1 = ONE parallel batch of get_job_evidence, read_frame for every index ${frames.length === 1 ? '0' : `0-${frames.length - 1}`} and native view_file on every reference path (${frames.map((frame, index) => `reference ${index}: ${frame.imagePath}`).join('; ')}); generate_image is denied until all of them are viewed. Turn 2 = native generate_image whose prompt follows the REFERENCE IMAGES rules in the job prompt${art ? ' and its ART DIRECTION' : ''} (if generate_image accepts input/reference image paths, pass these exact reference paths)${options.imageFailFast ? ' (call it once; never retry it yourself)' : ''}; turn 3 = publish_image with arguments {"path":"<absolute artifact path returned by generate_image>"}${autoImage ? '. The job completes as soon as publish_image returns: do not call submit_result.' : ', then submit_result.'}` : request.kind === 'image' ? (autoImage ? `Fastest valid order (fewest turns): turn 1 = ONE parallel batch of get_job_evidence and native generate_image (write the image prompt straight from the request${art ? ' and its ART DIRECTION' : ''}; no long analysis first)${options.imageFailFast ? ' (call it once; never retry it yourself: a failed call is rerouted automatically)' : ''}; turn 2 = publish_image with arguments {"path":"<absolute artifact path returned by generate_image>"}. The job completes as soon as publish_image returns: do not view the image and do not call submit_result.` : `Use native generate_image${options.imageFailFast ? ' once (never retry it yourself: a failed call is rerouted automatically)' : ' (if it fails with a transient upstream error, retry it once)'}, then call publish_image with arguments {"path":"<absolute artifact path returned by generate_image>"}, then submit_result.`) : ''} ${reviewInstructions} ${request.kind === 'chat' ? 'Use only the tool needed to answer the latest user request, then call video-job/submit_result with arguments {"result":{"content":"a concise, nonempty answer based on the tool result"}}. Do not submit an empty content field; do not continue exploring after the status is known.' : `Finally call video-job/submit_result with arguments {"result": ${resultShapeHint(request.schema)}}. ${resultShapeNote(request.schema)} String fields stay strings (put any structured draft JSON-encoded inside them).`} ${skills.length && inlineSkills ? `Reasoning skills for this job are already in your system prompt (${skills.map((name) => `${name} — ${SKILL_PURPOSES[name]}`).join('; ')}); apply the relevant ones while writing and do not open any SKILL.md.` : ''} ${frames.length ? `Visual evidence: exactly ${frames.length} frame${frames.length === 1 ? '' : 's'}, read_frame indexes ${frames.length === 1 ? '0' : `0-${frames.length - 1}`} only; never request index ${frames.length} or higher. ${request.kind === 'chat' ? 'Read frames with read_frame, then view_file the imagePath it returns.' : request.kind === 'image' ? 'They are reference images to follow, not evidence to describe.' : `Fastest valid order (fewest turns): turn 1 = ONE parallel batch of ${evidenceInPrompt ? '' : 'get_job_evidence, '}read_frame for every index ${frames.length === 1 ? '0' : `0-${frames.length - 1}`} and native view_file on every frame path (${frames.map((frame, index) => `frame ${index}: ${frame.imagePath}`).join('; ')}); turn 2 = reason once over all frames and call submit_result once with the complete result. Do not re-read frames already viewed.`}` : request.kind === 'chat' ? '' : 'No visual frames in this job: read_frame does not exist.'} ${readableFiles.length ? `native view_file may open ONLY these exact absolute paths: ${readableFiles.join(', ')}${request.kind === 'image' ? ', plus the artifact path returned by your own generate_image' : ''}. Every other path (workspace, source video, directories, guessed files) is denied; do not try.` : request.kind === 'chat' ? '' : 'No files are readable with view_file in this job.'}\n${jobPrompt}`;
    const cliPrompt = promptInArgs ? prompt : prompt.slice(0, prompt.length - jobPrompt.length) + LARGE_PROMPT_POINTER;
    // AGY reads mcp/<server>/instructions.md; provide the job prompt there instead of a denied missing path.
    const instructions = path.join(cli, 'mcp', 'video-job', 'instructions.md');
    await fs.mkdir(path.dirname(instructions), { recursive: true, mode: 0o700 });
    await fs.writeFile(instructions, `# video-job MCP server\n\n${prompt}\n`, { mode: 0o600, flag: 'wx' }).catch((error) => { if (error.code !== 'EEXIST') throw error; });
    const args = ['--agent', 'video-job', '--sandbox', '--output-format', 'stream-json', '--json-schema', JSON.stringify(request.schema), '-p', cliPrompt];
    if (selectedModel) args.unshift('--model', selectedModel);
    const effort = options.effort || selectEffort(request);
    if (effort) args.unshift('--effort', effort);
    // Stall watch on the native generate_image step (hook trace): notify the caller once (hedge) and
    // abort before the provider's own read timeout so the retry lands on another account.
    if (request.kind === 'image' && (options.onImageStall || options.imageStallAbortMs > 0)) {
      let notified = false;
      stallTimer = setInterval(async () => {
        const trace = await readPolicyTrace(policyTrace);
        const pre = [...trace].reverse().find((entry) => entry.phase === 'pre' && entry.tool === 'generate_image' && entry.allowed);
        if (!pre || failFast || server.result() !== undefined || trace.some((entry) => entry.phase === 'post' && entry.tool === 'generate_image' && entry.stepIdx === pre.stepIdx && entry.conversationId === pre.conversationId)) return;
        const age = Date.now() - Date.parse(pre.at);
        if (!notified && options.onImageStall && age >= (options.imageStallMs || 28000)) { notified = true; try { options.onImageStall(); } catch {} }
        if (options.imageStallAbortMs > 0 && age >= options.imageStallAbortMs) {
          failFast = Object.assign(new Error(`AGY generate_image stalled ${Math.round(age / 1000)}s; rerouting`), { category: 'image-stalled' });
          cancel.abort(failFast);
        }
      }, 1000);
      stallTimer.unref?.();
    }
    spawnedAt = Date.now();
    let mainConversation, textClosed = false;
    const response = await runProcess(binary, args, { ...processOptions(), complete: () => server.result() !== undefined,
      onNativeEvent: (event) => {
        firstEventAt ||= Date.now();
        const step=event.step_update;
        // Live text of the main conversation only (never subagents). A later user_input step is the CLI's
        // own --json-schema follow-up turn (a JSON echo of the answer), so forwarding stops there.
        if(event.event==='init'&&event.conversation_id)mainConversation||=event.conversation_id;
        if(request.onText&&step&&!textClosed&&server.result()===undefined){
          mainConversation||=step.conversation_id;
          if(step.conversation_id===mainConversation){
            if(step.step_type==='user_input'&&step.step_index>0)textClosed=true;
            else if(step.step_type==='agent_response'&&typeof step.text_delta==='string'&&step.text_delta){
              try{request.onText(step.text_delta,`${step.conversation_id}:${step.step_index}`);}catch{/* A listener failure never fails the job. */}
            }
          }
        }
        if(step?.state!=='ERROR'||!['generate_image','call_mcp_tool','view_file','invoke_subagent'].includes(step.tool_name)||nativeToolErrors.length>=20)return;
        const diagnostic=nativeToolDiagnostic(step),category=diagnostic.category;nativeToolErrors.push(diagnostic);
        // Preserve useful diagnostics without logging provider bodies or tokens.
        void Promise.resolve(request.onEvent?.({type:'mcp-error',jobId:id,name:'native/'+step.tool_name,message:category})).catch(()=>{});
        // Fail fast: an in-session retry hits the same stuck account (a proxy read timeout costs ~60s each).
        if(options.imageFailFast&&request.kind==='image'&&step.tool_name==='generate_image'&&!failFast&&server.result()===undefined
          &&(category==='quota-or-rate-limit'||category==='native-tool-failed'&&TRANSIENT_IMAGE.test(diagnostic.message))){
          failFast=Object.assign(new Error(`AGY generate_image failed transiently (${category}); rerouting`),{category:'image-upstream-transient'});
          cancel.abort(failFast);
        }
      }
    });
    const result = server.result();
    const events = response.output.split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
    if (result === undefined) {
      await request.onEvent?.({ type: 'failure', jobId: id, mcpCalls: server.calls, policyDecisions: await readPolicyTrace(policyTrace), errors: events.filter((e) => e.step_update?.state === 'ERROR').map((e) => ({tool:e.step_update.tool_name,error:e.step_update.tool_info?.error?.message})), eventTypes: events.map((e) => e.event) });
      throw new Error('AGY did not submit a validated result through the real MCP server');
    }
    const sessions = [...new Set(events.map((e) => e.conversation_id || e.step_update?.conversation_id || e.result?.conversation_id).filter(Boolean))];
    const nativeSubagents = readAgents(policy);
    const nativeReview = request.nativeReview ? reviewProof(policy) : undefined;
    const nativeSubagentObserved = nativeSubagents.length > 0;
    if (request.nativeReview && !nativeReview.succeeded) throw new Error('Three successful native specialist reviews were required but not observed');
    const digest = (value) => createHash('sha256').update(value).digest('hex');
    const receipt = { jobId: id, inputHash: digest(JSON.stringify({ kind: request.kind, role: request.role, nativeReview: !!request.nativeReview, prompt: request.prompt, schema: request.schema, seedImageHash: request.seedImage ? digest(request.seedImage.data) : undefined, seedImageUrl: request.seedImageUrl, tools: (request.tools || []).map(({name,description,inputSchema}) => ({name,description,inputSchema})), frames: frames.map((f) => ({ timestampSeconds: f.timestampSeconds, hash: digest(f.data) })) })), runtimeHash: RUNTIME_HASH, nativeToolErrors, skillHashes, kind: request.kind, role: request.role || 'video producer', effectiveModel,  effort: effort || null, providerHash: digest(env.CLOUD_CODE_URL || 'native-oauth'), startedAt, finishedAt: new Date().toISOString(), skills, sessions, mcpCalls: server.calls, authRoute: env.CLOUD_CODE_URL ? 'configured-cloud-code' : 'native-oauth', nativeSubagentObserved, nativeSubagents, nativeReview, policyDecisions: await readPolicyTrace(policyTrace) };
    if (art) receipt.artDirection = { template: art.templateId, reason: art.reason, cases: art.cases };
    receipt.startup = { setupMs: spawnedAt - Date.parse(startedAt), cliFirstEventMs: firstEventAt ? firstEventAt - spawnedAt : null, evidenceInPrompt };
    await saveReceipt(receipt);
    await request.onEvent?.({ type: 'receipt', receipt });
    return { result, receipt };
  } catch (caught) {
    const error = failFast && !options.signal?.aborted ? failFast : caught;
    const receipt = { jobId: id, status: 'failed', startedAt, finishedAt: new Date().toISOString(), nativeToolErrors, failureCategory: typeof error.category === 'string' ? error.category : cancel.signal.aborted ? 'cancelled-or-deadline' : 'runtime-failed', error: String(error?.message || error || '').slice(0, 300), kind: request.kind, role: request.role, skills, skillHashes, runtimeHash: RUNTIME_HASH, inputHash: createHash('sha256').update(JSON.stringify({ prompt: request.prompt, schema: request.schema })).digest('hex'), mcpCalls: server?.calls || [], policyDecisions: await readPolicyTrace(policyTrace) };
    await saveReceipt(receipt).catch(() => {});
    if (options.removeImage) for (const url of publishedUrls) await Promise.resolve().then(() => options.removeImage(url)).catch(() => {});
    await request.onEvent?.({ type: 'receipt', receipt });
    throw error;
  } finally {
    cancel.abort(new Error('AGY job finished'));
    clearTimeout(deadlineTimer); clearInterval(stallTimer);
    options.signal?.removeEventListener('abort', cancelParent);
    if (server) await server.close();
    // Remove only the directory allocated by this invocation, after process exit.
    await fs.rm(root, { recursive: true, force: true });
  }
}
async function readPolicyTrace(file) {
  return (await fs.readFile(file, 'utf8').catch(() => '')).split('\n').flatMap((line) => { try { return line ? [JSON.parse(line)] : []; } catch { return []; } });
}
function receiptDirectory() {
  const directory = process.env.AGY_MCP_RECEIPT_DIRECTORY || path.join(os.homedir(), '.local', 'share', 'nan-team', 'agy-mcp-receipts');
  if (!path.isAbsolute(directory)) throw new Error('Receipt directory must be absolute');
  return directory;
}
async function saveReceipt(receipt) {
  const directory = receiptDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Receipt directory must be an owned real directory');
  await fs.writeFile(path.join(directory, `${receipt.jobId}.json`), JSON.stringify(receipt), { mode: 0o600, flag: 'wx' });
}
async function readReceipt(jobId) {
  if (typeof jobId !== 'string' || !/^[a-f0-9-]{36}$/.test(jobId)) throw new Error('Invalid job receipt ID');
  const directory = receiptDirectory();
  return JSON.parse(await fs.readFile(path.join(directory, `${jobId}.json`), 'utf8'));
}
module.exports = { SKILL_PURPOSES, IMAGE_SKILLS, skillDirectories, inlineSkillBody, skillByteCap, runTask, readReceipt, ownedPath, imageBytes, bootstrap, nativeEnvironment, selectModel, selectEffort };
