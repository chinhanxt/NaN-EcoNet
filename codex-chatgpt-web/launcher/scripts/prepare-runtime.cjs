const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const launcherRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(launcherRoot, "..");
const output = path.join(launcherRoot, "build", "runtime");
const bun = process.env.CODEX_WEB_GPT_BUN || process.execPath;

const result = spawnSync(bun, ["run", "scripts/build-runtime-bundle.ts", output], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const notices = spawnSync(bun, [
  "run",
  "scripts/generate-third-party-notices.ts",
  path.join(output, "THIRD_PARTY_NOTICES.txt"),
  "--include-launcher",
], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});
if (notices.error) throw notices.error;
if (notices.status !== 0) process.exit(notices.status ?? 1);
fs.copyFileSync(path.join(repositoryRoot, "LICENSE"), path.join(output, "LICENSE"));
fs.cpSync(path.join(repositoryRoot, "LICENSES"), path.join(output, "LICENSES"), { recursive: true });
