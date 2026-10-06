import { createHash } from 'crypto';

/** Short-term cache for the Polotno "AI thiết kế" flow: an identical resend within 60 s reuses the result. */
export const DESIGN_EDIT_CACHE = { ttlMs: 60_000, entries: 50 };

/** Cache key: org + screenshot (bytes or uploaded URL) + instruction + serialized elements/page/variants. */
export function designEditCacheKey(orgId: string, screenshot: string | Buffer, instruction: string, state: string): string {
  return createHash('sha256').update(orgId).update('\0').update(screenshot).update('\0').update(instruction.trim()).update('\0').update(state).digest('hex');
}

/** Small in-process TTL cache that also shares an in-flight request; failures are never cached. */
export class DesignEditCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T> }>();
  constructor(private readonly ttlMs = DESIGN_EDIT_CACHE.ttlMs, private readonly max = DESIGN_EDIT_CACHE.entries, private readonly now = () => Date.now()) {}

  get(key: string, produce: () => Promise<T>): Promise<T> {
    const current = this.now();
    for (const [entryKey, entry] of this.entries) if (current - entry.at > this.ttlMs) this.entries.delete(entryKey);
    const hit = this.entries.get(key);
    if (hit) return hit.value;
    const value = produce();
    this.entries.set(key, { at: current, value });
    value.catch(() => { if (this.entries.get(key)?.value === value) this.entries.delete(key); });
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value as string);
    return value;
  }
}
