import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = resolve(process.argv[2] ?? join(root, ".launcher-runtime", "browser-helper.cjs"));
mkdirSync(dirname(output), { recursive: true });
rmSync(output, { force: true });

const build = await Bun.build({
  entrypoints: [join(root, "src", "adapters", "chatgpt-web", "browser-helper-main.ts")],
  target: "node",
  format: "cjs",
  minify: true,
  packages: "external",
  external: ["playwright-core"],
  outdir: dirname(output),
  naming: basename(output),
});
if (!build.success) throw new Error(`Browser helper build failed: ${build.logs.map(log => log.message).join("; ")}`);
if (process.platform !== "win32") chmodSync(output, 0o755);
process.stdout.write(`${output}\n`);
