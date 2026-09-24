// Backend for the starter UI extension.
//
// Antigravity starts this file with Node.js (see sidecar.json) and sets
// ANTIGRAVITY_SIDECAR_WEB_PORT; SidecarApp listens on it automatically. The
// 'sidecar_sdk' import is resolved by Antigravity, so no npm install is needed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));

// Private, persistent storage for this sidecar, provided by Antigravity:
//   <app data dir>/sidecar_data/<plugin>/<sidecar>/data/
// e.g. ~/.gemini/antigravity/sidecar_data/starter-extension/panel/data/ on
// macOS/Linux (%USERPROFILE%\.gemini\antigravity\... on Windows). It lives
// outside the plugin folder, so it survives restarts and plugin updates.
// Falls back to a local folder so the code still runs if the variable is
// missing.
const DATA_DIR = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || join(HERE, '.data');
const NOTES_FILE = join(DATA_DIR, 'notes.json');
const STARTED_AT = Date.now();

const app = new SidecarApp();

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

// Files are re-read on every request, so frontend edits show up on reload
// without restarting the sidecar.
const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');

app.page('/', () => readLocal('index.html'));
app.page('/app.js', () => readLocal('app.js'));
app.api('/styles.css', () => new Response(readLocal('styles.css'), { contentType: 'text/css' }), 'GET');

// ---------------------------------------------------------------------------
// APIs
// ---------------------------------------------------------------------------

// GET /api/status: basic information about the running sidecar.
app.api('/api/status', () => ({
  node: process.version,
  platform: `${platform()} ${release()}`,
  uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
}), 'GET');

// GET /api/notes: the saved note.
app.api('/api/notes', () => loadNotes(), 'GET');

// POST /api/notes {text}: save the note. POST routes require the sidecar
// token, which window.sidecar.fetch attaches for you.
app.api('/api/notes', (data) => {
  const notes = { text: String(data.text ?? ''), savedAt: new Date().toISOString() };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf8');
  return notes;
});

// ---------------------------------------------------------------------------

function loadNotes() {
  if (!existsSync(NOTES_FILE)) {
    return { text: '', savedAt: null };
  }
  try {
    return JSON.parse(readFileSync(NOTES_FILE, 'utf8'));
  } catch (err) {
    console.error(`Could not read ${NOTES_FILE}: ${err.message}`);
    return { text: '', savedAt: null };
  }
}

app.run();
