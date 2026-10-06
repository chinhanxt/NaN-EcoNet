'use strict';
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const Ajv = require('ajv');

async function createJobServer(job) {
  const validate = new Ajv({ strict: true, allowUnionTypes: true, allErrors: true, validateFormats: false }).compile(job.schema);
  const token = randomBytes(32).toString('hex');
  let result;
  const calls = [];
  const tools = [
    { name: 'get_job_evidence', description: 'Read the authorized job, schema, role and evidence manifest before working.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    ...(!job.frames?.length ? [] : [{ name: 'read_frame', description: `Read one authorized visual evidence frame by its manifest index. This job has exactly ${job.frames.length} frame${job.frames.length === 1 ? '' : 's'}: valid indexes ${frameRange(job.frames.length)} only. Then use native view_file on the imagePath it returns.`, inputSchema: { type: 'object', properties: { index: { type: 'integer', minimum: 0, maximum: job.frames.length - 1 } }, required: ['index'], additionalProperties: false } }]),
    // The job schema may contain root-local $defs/$ref. Embedding it under
    // `result` changes the reference base in MCP's tool validator. Keep the
    // transport shape simple and validate the complete result with Ajv below.
    { name: 'submit_result', description: `Submit the final result as arguments {"result": ${resultShape(job.schema)}} matching the schema from get_job_evidence. ${resultShapeNote(job.schema)} String fields stay strings: encode structured drafts as a JSON string inside them. This MCP call is required; printed JSON is not accepted.`, inputSchema: { type: 'object', properties: { result: { type: 'object' } }, required: ['result'], additionalProperties: false } },
  ];
  let seedRead = false;
  const argumentAjv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  const argumentValidators = new Map();
  const describeErrors = (errors) => (errors || []).slice(0, 5).map((e) => `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`).join('; ');
  if (job.seedImage) tools.push({ name: 'read_seed_image', description: 'Inspect the authorized seed image before writing the storyboard.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } });
  if (job.kind === 'image') tools.push({ name: 'publish_image', description: 'Publish a native generate_image artifact from the job-owned brain directory. Arguments: {"path": "<absolute artifact path returned by generate_image>"}.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } });
  for (const tool of job.tools || []) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(tool.name) || tools.some((t) => t.name === tool.name)) throw new Error('Invalid or duplicate job tool name');
    tools.push({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
  }
  const http = createServer(async (req, res) => {
    if (req.url !== '/mcp' || req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    // Stateless transport accepts real MCP initialize/list/call requests. Each request
    // gets its own transport; all transports share this job's validated handlers.
    const mcp = new Server({ name: 'agy-video-job', version: '1.0.0' }, { capabilities: { tools: {} } });
    mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
    mcp.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      let args = params.arguments || {};
      const respond = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
      try {
        if (!tools.some((t) => t.name === params.name)) throw new Error('Tool is outside job capability');
        const tool = tools.find((t) => t.name === params.name);
        const received = args && typeof args === 'object' && !Array.isArray(args) ? Object.keys(args) : [];
        let coerced;
        ({ args, coerced } = normalizeArguments(params.name, args, { acceptable: (value) => resultAcceptable(job.schema, validate, value), valid: (value) => !!value && typeof value === 'object' && !Array.isArray(value) && validate(value), properties: Object.keys(job.schema?.properties || {}) }));
        if (coerced) await job.onEvent?.({ type: 'mcp-coerced', name: params.name, note: coerced });
        if (params.name === 'submit_result' && !received.length) throw new Error(`submit_result arrived with empty arguments (the Arguments object was missing or not valid JSON). Send Arguments as a JSON object: {"result": ${resultShape(job.schema)}}. ${resultShapeNote(job.schema)}`);
        if (params.name === 'read_frame' && Number.isInteger(args?.index) && !job.frames[args.index]) {
          const nearest = Math.min(Math.max(args.index, 0), job.frames.length - 1), unread = job.frames.map((_, index) => index).filter((index) => !job.readFrames.has(index));
          throw new Error(`Frame index ${args.index} does not exist: this job has exactly ${job.frames.length} frames, valid indexes ${frameRange(job.frames.length)} only (nearest valid index: ${nearest}). ${unread.length ? `Still unread: ${unread.join(', ')}.` : 'All frames are already read; do not call read_frame again.'} Do not retry index ${args.index}.`);
        }
        if (!argumentValidators.has(tool.name)) argumentValidators.set(tool.name, argumentAjv.compile(tool.inputSchema));
        const validArguments = argumentValidators.get(tool.name);
        if (!validArguments(args)) throw new Error(`Invalid tool arguments for ${tool.name}: ${describeErrors(validArguments.errors)} (received keys: ${received.join(', ') || 'none'}). Expected arguments ${tool.name === 'submit_result' ? `{"result": ${resultShape(job.schema)}}` : JSON.stringify(Object.fromEntries(Object.entries(tool.inputSchema.properties || {}).map(([key, value]) => [key, `<${value.type || 'value'}>`])))}. Fix these fields and call once more.`);
        await job.onEvent?.({ type: 'mcp-call', name: params.name });
        calls.push({ tool: params.name, at: new Date().toISOString(), ...(coerced ? { coerced } : {}) });
        const custom = (job.tools || []).find((t) => t.name === params.name);
        if (custom) {
          await job.onEvent?.({ type: 'tool-call', name: custom.name, args });
          job.signal?.throwIfAborted();
          const value = await custom.execute(args, job.signal);
          job.signal?.throwIfAborted();
          await job.onEvent?.({ type: 'tool-result', name: custom.name, result: value });
          return respond(value);
        }
        // The runner already passes the job prompt to the CLI (-p). Echoing it here made the evidence reply
        // large enough for AGY to spill it to a file and spend one more model turn on view_file.
        if (params.name === 'get_job_evidence') return respond({ id: job.id, role: job.role, prompt: job.promptInTask ? PROMPT_IN_TASK : job.prompt, schema: job.schema, frameCount: job.frames.length, validFrameIndexes: job.frames.length ? `${frameRange(job.frames.length)} only` : 'none (no read_frame tool)', frames: job.frames.map((f, index) => ({ index, timestampSeconds: f.timestampSeconds, imagePath:f.imagePath })), readableFiles: job.readableFiles, fileAccess: job.readableFiles ? 'native view_file works only on the exact absolute paths in readableFiles; call read_frame for every index and view_file every frame imagePath in one parallel batch. Any other path is denied.' : undefined, resultShape: `{"result": ${resultShape(job.schema)}}`, seedImageUrl: job.seedImageUrl, skills: job.skills, specialistProfiles: job.specialistProfiles });
        if (params.name === 'read_seed_image') { seedRead = true; return { content: [{type:'text',text:`Use native view_file to inspect the authorized seed image: ${job.seedImage.imagePath}`},{ type: 'image', data: job.seedImage.data, mimeType: job.seedImage.mimeType }] }; }
        if (params.name === 'read_frame') {
          const frame = job.frames[args.index];
          if (!frame) throw new Error(`Frame is outside job manifest; valid indexes ${frameRange(job.frames.length)} only. Do not retry this index.`);
          job.readFrames.add(args.index);
          return { content: [{ type: 'text', text: `Frame ${args.index}, timestamp ${frame.timestampSeconds}s. Native view_file this exact authorized image unless you already viewed it: ${frame.imagePath}` }, { type: 'image', data: frame.data, mimeType: frame.mimeType }] };
        }
        if (params.name === 'publish_image') {
          const url = await job.publishImage(args.path);
          // A url-only image job is complete once its own artifact is published: accept {url}
          // here and skip a whole submit_result model turn.
          if (job.kind === 'image' && result === undefined && validate({ url })) { result = { url }; calls[calls.length - 1].autoSubmitted = true; return respond({ url, submitted: true, note: 'Job complete. Do not call submit_result or any other tool.' }); }
          return respond({ url });
        }
        if (job.nativeReview && !job.reviewProof?.().succeeded) throw new Error('Successful native content, visual and render reviews are required');
        if (result !== undefined) throw new Error('A result has already been submitted');
        if (!job.evidenceInPrompt && !calls.some((c) => c.tool === 'get_job_evidence')) throw new Error('Read evidence before submitting; call get_job_evidence first');
        if ((job.seedImage || job.frames.length) && !job.visionProof?.()) throw new Error('Native seed image inspection is required');
        if (job.seedImage && !seedRead) throw new Error('Seed image must be inspected before submitting');
        const unreadFrames = job.frames.map((_, index) => index).filter((index) => !job.readFrames.has(index));
        if (unreadFrames.length) throw new Error(`All visual evidence must be read before submitting; call read_frame for indexes ${unreadFrames.join(', ')}`);
        if (!validate(args.result)) {
          const errors = validate.errors;
          const coerced = coerceResult(job.schema, args.result);
          if (!coerced || !validate(coerced)) throw new Error(`Result schema violation: ${describeErrors(errors)}. Expected submit_result arguments {"result": ${resultShape(job.schema)}}. ${resultShapeNote(job.schema)}`);
          args.result = coerced;
          const entry = calls[calls.length - 1];
          entry.coerced = entry.coerced ? `${entry.coerced}; result-fields` : 'result-fields';
          await job.onEvent?.({ type: 'mcp-coerced', name: params.name, note: 'result-fields' });
        }
        if (job.kind === 'image' && !job.publishedUrls.has(args.result.url)) throw new Error('Image must be published by the job MCP tool');
        result = args.result;
        return respond({ accepted: true });
      } catch (error) { await job.onEvent?.({ type: 'mcp-error', name: params.name, message: error.message }); return { isError: true, content: [{ type: 'text', text: error.message }] }; }

    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close().catch(() => {}); mcp.close().catch(() => {}); });
    try { await mcp.connect(transport); await transport.handleRequest(req, res); }
    catch { if (!res.headersSent) res.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => { http.once('error', reject); http.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${http.address().port}/mcp`, token, calls, result: () => result,
    close: () => new Promise((resolve) => { http.closeAllConnections(); http.close(resolve); }) };
}
const PROMPT_IN_TASK = 'Same as the task prompt you were started with (not repeated here to keep this reply small); do not look for it in any file.';
const frameRange = (count) => count ? (count === 1 ? '0' : `0-${count - 1}`) : 'none';
// Resolve a root-local $ref ("#/$defs/X", "#/definitions/X") as emitted by Pydantic.
function resolveRef(root, node, depth = 0) {
  if (!node || typeof node !== 'object' || typeof node.$ref !== 'string' || depth > 8) return node;
  if (!node.$ref.startsWith('#/')) return {};
  const target = node.$ref.slice(2).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~')).reduce((value, key) => value?.[key], root);
  return resolveRef(root, target, depth + 1) || {};
}
// Concrete, recursive shape of the expected result, e.g.
// {"shorts": [{"start": <number>, "why"?: "<string>"}, ...]} — nested objects show every field
// name and type, enums list their values and optional keys carry "?", so the agent submits the
// right shape first time instead of guessing array items.
function resultShape(schema) {
  if (!schema?.properties || typeof schema.properties !== 'object') return '<object>';
  let budget = 120; // bound prompt size for very large schemas
  const render = (raw, depth) => {
    const node = resolveRef(schema, raw);
    if (!node || typeof node !== 'object') return '<value>';
    if (node.const !== undefined) return JSON.stringify(node.const);
    if (Array.isArray(node.enum)) return node.enum.map((value) => JSON.stringify(value)).join('|');
    const variants = node.anyOf || node.oneOf;
    if (Array.isArray(variants)) return [...new Set(variants.map((variant) => render(variant, depth)))].join('|');
    const type = Array.isArray(node.type) ? node.type : [node.type || (node.properties ? 'object' : node.items ? 'array' : 'value')];
    return type.map((kind) => {
      if (kind === 'object') {
        if (!node.properties || depth > 5) return '{}';
        const required = new Set(Array.isArray(node.required) ? node.required : []);
        const fields = Object.entries(node.properties).filter(() => budget-- > 0);
        return `{${fields.map(([key, value]) => `${JSON.stringify(key)}${required.has(key) ? '' : '?'}: ${render(value, depth + 1)}`).join(', ')}}`;
      }
      if (kind === 'array') {
        const count = node.minItems !== undefined || node.maxItems !== undefined ? ` /* ${node.minItems ?? 0}-${node.maxItems ?? 'n'} items */` : '';
        return `[${render(node.items, depth + 1)}, ...${count}]`;
      }
      if (kind === 'string') return `"<${node.minLength > 0 ? 'non-empty ' : ''}string>"`;
      if (kind === 'number' || kind === 'integer') {
        const range = node.minimum !== undefined || node.maximum !== undefined ? ` ${node.minimum ?? ''}..${node.maximum ?? ''}` : '';
        return `<${kind}${range}>`;
      }
      if (kind === 'boolean') return '<true|false>';
      if (kind === 'null') return 'null';
      return `<${kind}>`;
    }).join('|');
  };
  return render(schema, 0);
}
// One-line legend appended after the shape wherever it is shown.
function resultShapeNote(schema) {
  const shape = resultShape(schema);
  return `${shape.includes('"?:') ? 'Keys marked ? are optional; all other keys are required. ' : ''}${shape.includes('[{') ? 'Array items shown as {...} are JSON objects with exactly those fields, never strings. ' : ''}Numbers and integers are bare JSON numbers, not quoted strings.`;
}
// Harmless transport aliases observed from native agents; the owned-path and schema checks still apply afterwards.
// Returns { args, coerced } where coerced is a short trace note when a repair was applied.
// `acceptable(value)` reports whether a candidate result passes (or losslessly coerces to) the job schema.
const FRAME_INDEX_ALIASES = ['frame_index', 'frameIndex', 'i', 'idx'];
const RESULT_WRAPPERS = ['result', 'output', 'data'];
const parseObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return undefined;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined; } catch { return undefined; }
};
function normalizeArguments(name, args, { acceptable = () => false, valid = () => false, properties = [] } = {}) {
  const wrapper = (key) => RESULT_WRAPPERS.includes(key) && !properties.includes(key);
  const done = (value, coerced) => ({ args: value, coerced });
  if (!args || typeof args !== 'object' || Array.isArray(args)) return done(args);
  const keys = Object.keys(args);
  if (name === 'publish_image' && args.path === undefined) {
    const alias = ['image_path', 'imagePath', 'file_path', 'AbsolutePath'].find((key) => typeof args[key] === 'string');
    if (alias && keys.length === 1) return done({ path: args[alias] }, `alias ${alias}->path`);
  }
  if (name === 'read_frame' && keys.length === 1) {
    const key = keys[0], raw = args[key];
    const index = Number.isInteger(raw) ? raw : typeof raw === 'string' && /^\d{1,6}$/.test(raw) ? Number(raw) : undefined;
    if (index !== undefined && (key === 'index' ? typeof raw === 'string' : FRAME_INDEX_ALIASES.includes(key))) return done({ index }, `alias ${key}${typeof raw === 'string' ? '(string)' : ''}->index`);
  }
  if (name === 'submit_result') {
    // {"result": "<json>"}: parse the string form.
    if (typeof args.result === 'string' && keys.length === 1) {
      const parsed = parseObject(args.result);
      if (parsed) return done({ result: parsed }, 'result-json-string');
    }
    // Double wrap: {"result": {"result"|"output"|"data": {...}}} where only the inner value fits the schema.
    if (keys.length === 1 && args.result && typeof args.result === 'object' && !Array.isArray(args.result) && !valid(args.result)) {
      const inner = Object.keys(args.result);
      const parsed = inner.length === 1 && wrapper(inner[0]) ? parseObject(args.result[inner[0]]) : undefined;
      if (parsed && acceptable(parsed)) return done({ result: parsed }, `unwrap result.${inner[0]}`);
    }
    if (args.result === undefined && keys.length) {
      // {"output": {...}} / {"data": {...}} (object or JSON string) instead of {"result": ...}.
      if (keys.length === 1 && wrapper(keys[0]) && !valid(args)) {
        const parsed = parseObject(args[keys[0]]);
        if (parsed) return done({ result: parsed }, `alias ${keys[0]}->result`);
      }
      // Bare result object sent without the wrapper.
      if (acceptable(args)) return done({ result: args }, 'bare-result');
      // Still wrap so the full-schema validator reports the real missing/extra fields.
      return done({ result: args }, 'bare-result(unvalidated)');
    }
  }
  return done(args);
}
// True when the value validates against the job schema directly or after lossless coerceResult.
function resultAcceptable(schema, validate, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (validate(value)) return true;
  const coerced = coerceResult(schema, value);
  return !!coerced && validate(coerced);
}
// Lossless repair for a result whose string field was sent as structured JSON, or whose single string field was omitted.
function coerceResult(schema, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !schema?.properties) return undefined;
  const result = { ...value };
  for (const [key, raw] of Object.entries(schema.properties)) {
    const property = resolveRef(schema, raw);
    if (property?.type === 'string' && result[key] && typeof result[key] === 'object') result[key] = JSON.stringify(result[key]);
    // Array of objects whose items were sent as JSON-encoded strings: parse them back losslessly.
    if (property?.type === 'array' && Array.isArray(result[key]) && resolveRef(schema, property.items)?.type === 'object') {
      result[key] = result[key].map((item) => {
        if (typeof item !== 'string') return item;
        try { const parsed = JSON.parse(item); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : item; } catch { return item; }
      });
    }
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (required.length === 1 && schema.properties[required[0]]?.type === 'string' && result[required[0]] === undefined && Object.keys(schema.properties).length === 1) return { [required[0]]: JSON.stringify(value) };
  return result;
}
module.exports = { createJobServer, resultShape, resultShapeNote, PROMPT_IN_TASK };
