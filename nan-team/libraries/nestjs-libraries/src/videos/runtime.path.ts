import { existsSync, readFileSync } from 'node:fs';
import { freemem } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
/** Resolve bundled runtime assets from a monorepo or its compiled app tree. */
export function resolveWorkspaceArtifact(relative: string, override?: string): string {
  if (override) {
    if (!isAbsolute(override) || !existsSync(override)) throw new Error('Runtime artifact override must be an existing absolute path');
    return override;
  }
  for (const start of [process.cwd(), __dirname]) {
    let directory = resolve(start);
    for (;;) {
      const candidate = resolve(directory, relative);
      if (existsSync(candidate)) return candidate;
      const parent = dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  throw new Error(`Bundled runtime artifact missing: ${relative}`);
}

/** Reclaimable-aware free RAM: Linux MemAvailable (includes page cache the kernel can drop), else os.freemem(). */
export function memAvailableBytes(): number {
  try {
    const match = /^MemAvailable:\s+(\d+)\s+kB/m.exec(readFileSync('/proc/meminfo', 'utf8'));
    if (match) return Number(match[1]) * 1024;
  } catch { /* non-Linux */ }
  return freemem();
}
