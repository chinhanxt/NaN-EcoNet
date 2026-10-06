'use strict';
// Idea studio status polling: the studio re-renders every second (progress tick). SWR restarts its
// polling timer whenever `refreshInterval` changes identity, so an inline arrow cancelled every
// 2-5s poll and the UI froze at "Kịch bản" while the job completed (job 6cd7e9c4, 2026-10-01).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'requestAnimationFrame', 'cancelAnimationFrame'])
  if (!(key in globalThis) || key === 'window' || key === 'document') Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });

const agents = path.resolve(__dirname, '../../apps/frontend/src/components/agents');
const previousTs = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  module._compile(code, filename);
};
const originalLoad = Module._load;
Module._load = (name, parent, isMain) => name === '@gitroom/helpers/utils/custom.fetch' ? { useFetch: () => fetch } : originalLoad(name, parent, isMain);
let state, progress;
try { state = require(path.join(agents, 'ai-video-studio.state.ts')); progress = require(path.join(agents, 'ai-video-studio.progress.ts')); }
finally { Module._load = originalLoad; if (previousTs) require.extensions['.ts'] = previousTs; else delete require.extensions['.ts']; }

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('status keeps polling while the studio re-renders every tick, and stops once the job is completed', async () => {
  const stages = ['generating-images:1/4', 'generating-images:3/4', 'synthesizing-voice', 'completed'];
  let calls = 0;
  const request = async () => {
    const stage = stages[Math.min(calls++, stages.length - 1)];
    return stage === 'completed'
      ? { jobId: 'j1', status: 'completed', progress: 100, stage, media: { id: 'm', path: '/m.mp4' } }
      : { jobId: 'j1', status: 'rendering', progress: 20, stage };
  };
  const seen = [];
  function Studio() {
    const [, setTick] = React.useState(0);
    // Same cadence as useStudioProgress, faster here to keep the test short.
    React.useEffect(() => { const timer = setInterval(() => setTick((n) => n + 1), 250); return () => clearInterval(timer); }, []);
    const status = state.useAiVideoJobStatus('j1', request);
    if (status.data && seen.at(-1) !== status.data.stage) seen.push(status.data.stage);
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(Studio)); });
  // generating-images polls every 2s, synthesizing-voice every 3s: 3 refreshes need ~7s.
  for (let i = 0; i < 100 && seen.at(-1) !== 'completed'; i++) await sleep(100);
  const callsAtCompletion = calls;
  await sleep(2500);
  await act(async () => { root.unmount(); });
  assert.deepEqual(seen, stages, `stuck after ${calls} status call(s): ${seen.join(' -> ')}`);
  assert.equal(calls, callsAtCompletion, 'polling stops at a terminal status');
});

test('poll interval is a stable module function per stage', () => {
  assert.equal(progress.studioPollInterval(undefined), 2500);
  assert.equal(progress.studioPollInterval({ status: 'rendering', progress: 1, stage: 'generating-storyboard' }), 4000);
  assert.equal(progress.studioPollInterval({ status: 'rendering', progress: 20, stage: 'generating-images:1/4' }), 2000);
  assert.equal(progress.studioPollInterval({ status: 'completed', progress: 100, stage: 'completed' }), 0);
});
