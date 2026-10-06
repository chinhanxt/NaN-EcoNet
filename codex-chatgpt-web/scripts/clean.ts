import { rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = join(root, "dist");
rmSync(output, { recursive: true, force: true });
process.stdout.write(`Removed generated output: ${output}\n`);
