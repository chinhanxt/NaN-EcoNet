// Frontend logic for the starter UI extension.
//
// /preload.js runs first and defines window.sidecar. Use window.sidecar.fetch
// for calls to this extension's own API: it adds the auth token that non-GET
// routes require.

const sidecar = window.sidecar;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callApi(path, { method = 'GET', body } = {}) {
  const res = await sidecar.fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

async function refreshStatus() {
  const badge = $('status-badge');
  try {
    const status = await callApi('/api/status');
    $('status-node').textContent = `Node.js ${status.node}`;
    $('status-platform').textContent = status.platform;
    $('status-uptime').textContent = formatUptime(status.uptimeSeconds);
    badge.textContent = 'Running';
    badge.className = 'badge ok';
  } catch (err) {
    badge.textContent = 'Error';
    badge.className = 'badge error';
    console.error('Status request failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function showSaved(savedAt) {
  $('notes-saved').textContent = savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : '';
}

async function loadNotes() {
  try {
    const notes = await callApi('/api/notes');
    $('notes-text').value = notes.text;
    showSaved(notes.savedAt);
  } catch (err) {
    toast(`Could not load notes: ${err.message}`, true);
  }
}

async function saveNotes() {
  try {
    const notes = await callApi('/api/notes', { method: 'POST', body: { text: $('notes-text').value } });
    showSaved(notes.savedAt);
    toast('Notes saved');
  } catch (err) {
    toast(`Could not save notes: ${err.message}`, true);
  }
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

async function sendToAgent({ newConversation }) {
  const message = $('agent-text').value.trim();
  if (!message) return;
  try {
    if (newConversation) {
      await sidecar.agent.startConversation(message);
      toast('Started a new conversation');
    } else {
      await sidecar.agent.sendMessage(message);
      toast('Message sent');
    }
  } catch (err) {
    toast(`Could not reach the agent: ${err.message}`, true);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

function init() {
  if (!sidecar) {
    $('status-badge').textContent = 'Not in Antigravity';
    $('status-badge').className = 'badge error';
    return;
  }

  $('status-conversation').textContent = sidecar.conversationId ? 'Connected' : 'None';

  // Agent actions only make sense inside a conversation, so the card stays
  // hidden otherwise.
  if (sidecar.conversationId) {
    $('agent-card').hidden = false;
    $('agent-send').addEventListener('click', () => sendToAgent({ newConversation: false }));
    $('agent-new').addEventListener('click', () => sendToAgent({ newConversation: true }));
  }

  $('notes-save').addEventListener('click', saveNotes);

  refreshStatus();
  setInterval(refreshStatus, 10000);
  loadNotes();
}

init();
