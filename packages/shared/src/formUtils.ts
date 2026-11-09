/** Utilitaires de normalisation des formulaires (saisie en chaînes, comme CF2). */

export function num(s: unknown): number {
  const n = Number(String(s ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

export function str(v: unknown, max = 2000): string {
  if (v == null) return '';
  return String(v).slice(0, max);
}

export function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function arr<T>(v: unknown, map: (x: unknown) => T, max = 50): T[] {
  return Array.isArray(v) ? v.slice(0, max).map(map) : [];
}

export function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const OUI_NON = ['', 'oui', 'non'] as const;
export type OuiNon = (typeof OUI_NON)[number];

export function ouiNon(v: unknown): OuiNon {
  return oneOf(v, OUI_NON, '');
}
