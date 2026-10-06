import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveWorkspaceArtifact } from '../runtime.path';

/** Hook library shared with the source-video engine (packages/openshorts-engine/data is the single source). */
export interface HookPattern {
  id: number; group: string; category: string; template: string; useWhen: string; requiresRealClaim: boolean;
}
interface HookGuidance {
  patternsFile: string; maxPatterns: number; rules: string[]; scoring: string;
  kinds: Record<string, { label: string; categories: string[] }>;
}
export type HookKind = 'tutorial' | 'story' | 'product' | 'general';

let cache: { guidance: HookGuidance; patterns: HookPattern[] } | null | undefined;

export function hookLibrary(): { guidance: HookGuidance; patterns: HookPattern[] } | null {
  if (cache !== undefined) return cache;
  try {
    const file = resolveWorkspaceArtifact('packages/openshorts-engine/data/hook_guidance.json', process.env.HOOK_GUIDANCE_PATH);
    const guidance = JSON.parse(readFileSync(file, 'utf8')) as HookGuidance;
    const patterns = JSON.parse(readFileSync(join(dirname(file), guidance.patternsFile), 'utf8')) as HookPattern[];
    cache = { guidance, patterns };
  } catch {
    cache = null; // Library missing in a stripped deployment: the base hook rules still apply.
  }
  return cache;
}

export function topicHookKind(topic: string): HookKind {
  const text = topic.toLocaleLowerCase();
  if (/review|sản phẩm|nên mua|giá bao nhiêu|so sánh|đáng tiền/u.test(text)) return 'product';
  if (/câu chuyện|tâm sự|động lực|bỏ cuộc|cảm xúc|trải nghiệm/u.test(text)) return 'story';
  if (/cách|hướng dẫn|mẹo|bước|làm sao|làm thế nào|how to|tips?\b/u.test(text)) return 'tutorial';
  return 'general';
}

/** Round-robin over the kind's categories so each is represented in a compact subset. */
export function selectHookPatterns(kind: HookKind): HookPattern[] {
  const library = hookLibrary();
  if (!library) return [];
  const { guidance, patterns } = library;
  const categories = (guidance.kinds[kind] || guidance.kinds.general).categories;
  const pools = categories.map((category) => patterns.filter((p) => p.category === category));
  const out: HookPattern[] = [];
  while (out.length < guidance.maxPatterns && pools.some((pool) => pool.length)) {
    for (const pool of pools) if (pool.length && out.length < guidance.maxPatterns) out.push(pool.shift()!);
  }
  return out;
}

export function hookGuidance(kind: HookKind): { text: string; offered: number[] } {
  const library = hookLibrary();
  const patterns = selectHookPatterns(kind);
  if (!library || !patterns.length) return { text: '', offered: [] };
  const { guidance } = library;
  const lines = [
    `HOOK CRAFT (content type: ${(guidance.kinds[kind] || guidance.kinds.general).label}):`,
    ...guidance.rules.map((rule) => `- ${rule}`),
    'HOOK PATTERNS (Vietnamese structures to adapt, never to copy; CLAIM = only with that real claim in FACTS):',
    ...patterns.map((p) => `P${p.id} [${p.category}]${p.requiresRealClaim ? ' CLAIM' : ''} ${p.template}`),
    guidance.scoring,
  ];
  return { text: lines.join('\n'), offered: patterns.map((p) => p.id) };
}

export const normalizeHookText = (text: string): string =>
  (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(' ');

/** True when the text is just a library template line, not adapted to the topic. */
export function isTemplateCopy(text: string): boolean {
  const key = normalizeHookText(text);
  return !!key && !!hookLibrary()?.patterns.some((p) => normalizeHookText(p.template) === key);
}

export function patternById(id: number): HookPattern | undefined {
  return hookLibrary()?.patterns.find((p) => p.id === id);
}
