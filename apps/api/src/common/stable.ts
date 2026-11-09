import { createHash } from 'node:crypto';

/** JSON à clés triées : Postgres (jsonb) ne conserve pas l'ordre des clés. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Empreinte courte et stable d'une entrée (détection d'avis périmés). */
export function empreinte(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 32);
}

/**
 * Retire d'un texte libre les identifiants du client avant envoi à un LLM
 * (noms, téléphone, n° de compte) : les clés JSON sont déjà filtrées par
 * `redactPii`, mais pas le contenu des textes saisis.
 */
export function masquerIdentite(texte: string, identifiants: Array<string | null | undefined>): string {
  let out = texte;
  const termes = identifiants
    .flatMap((t) => String(t ?? '').split(/\s+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  for (const t of [...new Set(termes)].sort((a, b) => b.length - a.length)) {
    const echappe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(echappe, 'gi'), '[…]');
  }
  // Numéros de téléphone RDC
  return out.replace(/(\+?243|0)\s?\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, '[tél.]');
}
