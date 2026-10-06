/**
 * Per-fact source attribution for the AGY factual self-check (idea15 job 3a0ae677: NSF was given as the basis of all
 * 5 facts). Nothing here is looked up; it only refuses attributions that cannot be about the individual fact, so the
 * UI line "Theo AI (chưa xác minh): <basis>" never shows a borrowed or meaningless source.
 */
export const UNATTRIBUTED_BASIS = 'Không có nguồn cụ thể cho dữ kiện này';
export type BasisRejection = 'blanket' | 'generic';
export interface FactLike { claim: string; basis: string }

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/giu, 'd').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** A URL basis is an unchecked link: keep only its host, which is also the key for spotting one reused URL. */
function hostOf(basis: string): string | undefined {
  const match = basis.trim().match(/^(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#:]\S*)?$/iu);
  return match?.[1].toLowerCase();
}

const GENERIC = new Set([
  'nghien cuu', 'nghien cuu khoa hoc', 'cac nghien cuu', 'nhieu nghien cuu', 'cac nghien cuu khoa hoc', 'nhieu nghien cuu khoa hoc',
  'chuyen gia', 'cac chuyen gia', 'chuyen gia suc khoe', 'cac chuyen gia suc khoe', 'khoa hoc', 'kien thuc chung', 'kien thuc pho thong',
  'thong tin chung', 'hieu biet chung', 'tai lieu khoa hoc', 'khong ro', 'khong ro nguon', 'khong co', 'chua xac minh', 'internet', 'nguon tong hop',
  'research', 'studies', 'scientific studies', 'scientific research', 'various studies', 'multiple studies', 'experts', 'health experts',
  'science', 'general knowledge', 'common knowledge', 'unknown', 'unverified', 'none', 'n a', 'na', 'various sources', 'multiple sources',
]);

const acronymsOf = (basis: string): string[] => {
  const host = hostOf(basis);
  return host ? [host.split('.').slice(-2, -1)[0].toUpperCase()] : basis.match(/\b[A-Z][A-Z0-9&]{1,7}\b/gu) ?? [];
};

/** Key used to compare bases: host for URLs, otherwise the folded text without a leading "theo"/"according to". */
export function basisKey(basis: string): string {
  return hostOf(basis) ?? fold(basis).replace(/^(?:theo|according to|source|nguon)\s+/u, '');
}

/** Which organization a basis points at: "NSF", "National Science Foundation (NSF)" and nsf.gov are one source. */
export function sourceId(basis: string): string {
  return acronymsOf(basis).at(-1) ?? basisKey(basis);
}

/** True when the claim itself names the source (e.g. "EFSA khuyến nghị …"), so sharing that basis is legitimate. */
function claimNamesBasis(claim: string, basis: string): boolean {
  const foldedClaim = ` ${fold(claim)} `, key = basisKey(basis);
  if (key && foldedClaim.includes(` ${key} `)) return true;
  return acronymsOf(basis).some((acronym) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${acronym.replace(/&/gu, '\\&')}(?:$|[^\\p{L}\\p{N}])`, 'u').test(claim));
}

/**
 * Each fact keeps its own basis, or gets UNATTRIBUTED_BASIS when the basis is generic ("nghiên cứu", "experts")
 * or blanket: one source reused for ≥3 facts and more than half of them (facts whose claim names that source
 * themselves don't count toward the reuse and keep it). URLs are shown as their host only.
 */
export function attributeFactSources<T extends FactLike>(facts: T[]): { facts: T[]; unattributed: number; rejections: BasisRejection[] } {
  const keys = facts.map((fact) => basisKey(fact.basis)), sources = facts.map((fact) => sourceId(fact.basis));
  const borrowed = facts.map((fact) => !claimNamesBasis(fact.claim, fact.basis));
  const reuse = new Map<string, number>();
  sources.forEach((source, index) => { if (source && borrowed[index]) reuse.set(source, (reuse.get(source) ?? 0) + 1); });
  const rejections: BasisRejection[] = [];
  const out = facts.map((fact, index) => {
    const key = keys[index], count = reuse.get(sources[index]) ?? 0;
    const rejection: BasisRejection | undefined = !key || GENERIC.has(key) ? 'generic'
      : borrowed[index] && count >= 3 && count * 2 > facts.length ? 'blanket' : undefined;
    if (rejection) { rejections.push(rejection); return { ...fact, basis: UNATTRIBUTED_BASIS }; }
    const host = hostOf(fact.basis);
    return host ? { ...fact, basis: host } : fact;
  });
  return { facts: out, unattributed: rejections.length, rejections };
}
