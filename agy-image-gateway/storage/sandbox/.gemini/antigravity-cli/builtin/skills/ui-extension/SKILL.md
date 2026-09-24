---
name: ui-extension
description: >-
  Build, package, run, and debug UI extensions for Antigravity: interactive web
  panels that render in the side pane, served by a Node.js sidecar using the
  built-in Sidecar SDK.
metadata:
  icon: extension
---

# Building UI Extensions

A **UI extension** is a small local web app that Antigravity shows in the side
pane next to a conversation. It is packaged as a **plugin** that contains a
**sidecar** (a background process the app starts and supervises) whose
`sidecar.json` declares a web UI. The sidecar runs a local HTTP server;
Antigravity embeds its pages in a sandboxed iframe and passes theme and
conversation context into it.

**Always create a UI extension as a plugin**:
`plugins/<plugin>/sidecars/<sidecar>/`. The plugin is what the user installs,
enables, and finds in the app, and it can later bundle skills, rules, and MCP
servers alongside the panel. Do not create bare sidecars outside a plugin.

Sidecars are written in **Node.js** with the built-in Sidecar SDK. Antigravity
installs the SDK itself, so extensions need no `npm install` and no
`node_modules`.

## Reference implementation

A complete, working extension lives next to this skill in
[`references/template/`](references/template/). Read it to learn the plugin
layout and the patterns below, then build only what the user's extension needs.
You don't have to copy the whole template: reuse the parts that fit (the
manifests, the static-file routes, `styles.css`) and leave out the demo
features.

```text
references/template/
├── plugin.json                  # Plugin manifest
├── assets/
│   └── logo.svg                 # Plugin logo shown in the app
└── sidecars/
    └── panel/                   # One sidecar = one UI extension
        ├── sidecar.json         # Process + UI manifest
        ├── package.json         # Marks the folder as an ES module package
        ├── main.mjs             # Backend: routes, APIs, persistence
        ├── index.html           # Frontend markup
        ├── app.js               # Frontend logic (window.sidecar)
        └── styles.css           # Theme-aware styles
```

It shows every moving part: serving pages and static files, a JSON API,
persisting state to the sidecar's data directory, and sending a message to the
agent. The minimum a UI extension needs is
`plugin.json`, `sidecar.json`, a backend entrypoint, and a page
that loads `/preload.js`.

## Where to install

Antigravity discovers plugins in the global config directory:

| OS            | Plugin location                                 |
| ------------- | ----------------------------------------------- |
| macOS / Linux | `~/.gemini/config/plugins/<plugin>/`            |
| Windows       | `%USERPROFILE%\.gemini\config\plugins\<plugin>\` |

> [!IMPORTANT]
> **Do not assume an OS.** The user may be on macOS, Linux, or Windows. Resolve
> the home directory for the current machine before writing anything, and
> prefer your file-writing tools over shell commands to create directories and
> copy files. If you must use a shell, match it to the platform: `mkdir -p` and
> `cp -r` do not exist in Windows PowerShell or `cmd.exe`.

## Manifests

### `plugin.json`

```json
{
  "name": "my-extension",
  "description": "One sentence on what the panel does and who it is for.",
  "logo": "assets/logo.svg"
}
```

-   **`name`**: plugin identifier, lowercase kebab-case. Defaults to the
    directory name if omitted. Keep it equal to the directory name to avoid
    confusion.
-   **`description`**: shown in the customizations UI.
-   **`logo`**: relative path to a square image inside the plugin, shown next
    to the plugin in the app. Write a small
    square SVG (e.g. `viewBox="0 0 64 64"`) to `assets/logo.svg` that reflects
    what the extension does: a simple, recognizable glyph on a solid
    rounded-square background, legible at small sizes and on both light and
    dark themes. Don't reuse the template's logo. Supported formats are `.svg`,
    `.png`, `.jpg`, `.jpeg`, and `.webp`; absolute paths, paths outside the
    plugin, and remote URLs are ignored.

### `sidecars/<sidecar>/sidecar.json`

```json
{
  "command": "node",
  "args": ["main.mjs"],
  "restart_policy": "always",
  "display_name": "My Extension",
  "description": "What this panel shows.",
  "has_web_ui": true,
  "ui_config": {
    "display_name": "My Extension",
    "views": [
      {
        "path": "/",
        "entrypoint": "SIDECAR_UI_ENTRYPOINT_AUX_PANE",
        "title": "My Extension"
      }
    ]
  }
}
```

-   **`command` / `args`**: keep `"command": "node"`. Antigravity replaces
    `node` with its own bundled Node.js runtime when one is available and falls
    back to `node` on the `PATH` otherwise, so this works the same on every OS.
    The working directory is the sidecar folder.
-   **`restart_policy`**: `"always"` (default), `"on-failure"`, or `"never"`.
    Use `"always"` for panels.
-   **`has_web_ui`**: must be `true` for a UI extension.
-   **`ui_config.views[]`**: each view the panel exposes. `path` is the URL
    path served by your backend; `entrypoint` must be
    `SIDECAR_UI_ENTRYPOINT_AUX_PANE` to render in the side pane; `title` labels
    the view.
-   **`env`** *(optional)*: extra environment variables, as a string map.

A plugin's sidecar is identified as **`<plugin-name>/<sidecar-folder>`**, for
example `my-extension/panel`.

## Runtime environment

Antigravity sets these variables for the sidecar process:

| Variable                          | Meaning                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `ANTIGRAVITY_SIDECAR_WEB_PORT`    | Port your server must listen on. `SidecarApp` uses it automatically. Never hardcode one. |
| `ANTIGRAVITY_EXECUTABLE_DATA_DIR` | Absolute path to a private, persistent data directory for this sidecar: `<app data dir>/sidecar_data/<plugin>/<sidecar>/data/`. |
| `ANTIGRAVITY_SIDECAR_UI_TOKEN`    | Token that authenticates non-GET requests. Handled by the SDK and `preload.js`.          |

Process output (`stdout` / `stderr`) is written to
`<app data dir>/sidecar_data/<sidecar-id>/logs/sidecar.log`, where the app data
directory is `~/.gemini/antigravity` (`%USERPROFILE%\.gemini\antigravity` on
Windows). Read this file first when a panel is blank or keeps restarting.

> [!WARNING]
> The data directory belongs to the sidecar process, not to agents it starts.
> An agent cannot write there by default. If the panel and an agent need to
> exchange files, use a location inside the user's workspace instead.

## Backend: `SidecarApp`

```javascript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SidecarApp, Response } from 'sidecar_sdk';

const here = dirname(fileURLToPath(import.meta.url));
const app = new SidecarApp();

// HTML (and .js) pages, served on GET.
app.page('/', () => readFileSync(join(here, 'index.html'), 'utf8'));
app.page('/app.js', () => readFileSync(join(here, 'app.js'), 'utf8'));

// Any other content type: return a Response from a GET API route.
app.api('/styles.css', () =>
  new Response(readFileSync(join(here, 'styles.css'), 'utf8'), { contentType: 'text/css' }),
  'GET');

// JSON API. POST is the default method; plain objects are sent as JSON.
app.api('/api/greet', (data) => ({ message: `Hello, ${data.name ?? 'world'}!` }));

app.run();
```

-   **`app.page(path, handler)`**: GET route returning a string. Paths ending in
    `.js` are served as JavaScript, everything else as HTML.
-   **`app.api(path, handler, method = 'POST')`**: `handler(data)` receives one
    object that merges the query-string parameters and the parsed JSON body.
    Return a plain object for JSON, or a `Response` for anything else.
-   **`new Response(body, { contentType, status })`**: custom content type or
    status code.
-   **`app.run()`**: starts the server. Call it once, after registering routes.
-   `/preload.js` and the `/_sidecar/*` bridge routes are registered for you.

**Authentication**: GET requests are open so that pages, scripts, styles, and
images load in the iframe. Every other method requires the sidecar token; use
`window.sidecar.fetch` on the frontend and it is attached automatically.

### Writing portable backend code

-   Build paths with `node:path` (`join`, `dirname`) and derive the script
    directory from `fileURLToPath(import.meta.url)`. Never concatenate `/` or
    `\` by hand.
-   Use `os.homedir()` and `os.tmpdir()` instead of `~`, `$HOME`, `/tmp`, or
    `%TEMP%`.
-   Store state in `ANTIGRAVITY_EXECUTABLE_DATA_DIR`, not next to the code; the
    plugin folder may be replaced when the user updates it.
-   Prefer Node.js built-ins. The bundled runtime ships without `npm`, so any
    third-party dependency must be vendored into the sidecar folder.
-   If you must spawn a process, use `execFileSync` / `spawn` with an argument
    array and no shell. Do not assume `bash`, shell scripts, shebangs, or
    executable bits; on Windows, `.cmd` shims such as `npm` and `npx` cannot be
    spawned without a shell.
-   Keep file names unique ignoring case; macOS and Windows file systems are
    usually case-insensitive.

## Frontend: `preload.js` and `window.sidecar`

Load the bridge before your own scripts:

```html
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/styles.css">
  <script src="/preload.js"></script>
</head>
```

It applies the host theme, and exposes `window.sidecar`:

| Member                                          | Description                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `conversationId`                                | Active conversation ID, or `null` when the panel is not tied to a conversation.                      |
| `fetch(url, options)`                           | `fetch` wrapper that adds the sidecar token and a JSON `Content-Type`. Use it for your own API routes. |
| `getWorkspaceUris()`                            | Promise of the conversation's workspace folder URIs (`file://...`); `[]` if none.                    |
| `onWorkspaceChange(listener)`                   | Calls `listener(uris)` when the workspace changes. Returns an unsubscribe function.                  |
| `agent.sendMessage(message, [conversationId])`  | Sends a message to the active (or given) conversation.                                               |
| `agent.startConversation(message)`              | Starts a new conversation with `message` as the first prompt.                                        |
| `agent.getConversationMetadata(conversationId)` | Returns metadata for a conversation.                                                                 |
| `ui.toggleAuxPane({ open })`                    | Opens (`true`), closes (`false`), or toggles (omitted) the side pane.                                |
| `ui.toggleConversation(conversationId)`         | Switches the host to the given conversation.                                                         |

Workspace URIs are `file://` URIs, including on Windows
(`file:///C:/Users/...`). Pass them to your backend as-is and convert with
`fileURLToPath` from `node:url` there. Don't parse them by hand.

Guard agent calls on `window.sidecar.conversationId`; they need an active
conversation.

## Theming

`preload.js` copies the host's theme tokens onto `:root` and updates them live
when the user switches themes. Style only with these tokens, and give each one a
fallback so the page is still readable outside the host:

-   **Surfaces**: `--background`, `--content`, `--card`, `--secondary`,
    `--muted`, `--sidebar`, `--sidebar-secondary`, `--sidebar-muted`
-   **Text**: `--foreground`, `--secondary-foreground`, `--muted-foreground`,
    `--primary-foreground`, `--placeholder`
-   **Accents**: `--primary`, `--accent`
-   **Borders**: `--border`, `--card-border`

```css
.card {
  background: var(--card, #ffffff);
  border: 1px solid var(--card-border, var(--border, #e0e0e0));
  color: var(--foreground, #1f1f1f);
}
button:hover {
  /* Moves toward the text color: lighter in dark themes, darker in light ones. */
  background: color-mix(in srgb, var(--primary, #1a73e8) 88%, var(--foreground, #000));
}
```

Do not use `--vscode-*` variables. Use system font stacks rather than web fonts
so the panel matches the host on every OS. The template's `styles.css` is a
complete starting point.

## Workflow

1.  **Create the plugin** in the user's plugins directory (see
    [Where to install](#where-to-install)) under a kebab-case name, following
    the structure of `references/template/`. Write `plugin.json` and
    `sidecar.json` with the extension's own name, description, and titles,
    and create a logo for the extension at `assets/logo.svg`, referenced from
    `plugin.json` (see [`plugin.json`](#pluginjson)).
2.  **Build the feature.** Write the backend routes in `main.mjs` and the page
    in `index.html` (plus a script such as `app.js` if needed), reusing
    patterns from the reference implementation where they fit. Keep styling
    on the theme tokens.
3.  **Tell the user how to enable and open it.** End your reply with these
    steps, using the plugin's actual name:
    1.  Go to the **Customizations** page in the left sidebar and select the
        **Installed** tab.
    2.  Find the plugin and, if it is not enabled, enable it. The sidecar
        starts automatically once the plugin is enabled.
    3.  Go to any conversation, open the **⋮** (three-dot) menu in the top
        right, and choose the extension from the **Extensions** menu to open it
        in the right pane.
4.  **Debug** with `sidecar.log` (see [Runtime environment](#runtime-environment)).
    Common causes of a blank or crashing panel: a syntax error in `main.mjs`, a
    missing route for a file the page requests, or a hardcoded port.

After editing backend code, the sidecar must restart to pick it up: ask the
user to disable and re-enable the plugin. If the backend re-reads frontend files
(`index.html`, `app.js`, `styles.css`) on each request, as the reference
implementation does, closing and reopening the panel is enough for
frontend-only changes.
