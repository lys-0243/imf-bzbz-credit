/** Clés nominatives retirées avant tout envoi à un LLM. */
const PII_EXACT =
  /^(full_?name|display_?name|nom|prenom|post_?nom|nom_?complet|nom_?conjoint|prenom_?conjoint)$/i;
const PII_CONTAINS =
  /(telephone|phone|email|adresse|address|naissance|numero_?piece|num_?piece|numero_?compte|signature)/i;

function isPiiKey(key: string): boolean {
  return PII_EXACT.test(key) || PII_CONTAINS.test(key);
}

export function redactPii<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => redactPii(v)) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !isPiiKey(k))
        .map(([k, v]) => [k, redactPii(v)]),
    ) as T;
  }
  return value;
}
