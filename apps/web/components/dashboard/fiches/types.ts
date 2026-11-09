import type { DossierContexte } from '@imf/shared';

/** Props communes des fiches Analyse_AGR (valeur contrôlée par FichesPanel). */
export type FicheProps<T> = {
  value: T;
  onChange: (next: T) => void;
  disabled: boolean;
  ctx: DossierContexte;
  devise: string;
};

/** Remplace l’élément d’index `idx` d’une liste par `patch` fusionné. */
export function patchAt<T>(list: T[], idx: number, patch: Partial<T>): T[] {
  return list.map((row, i) => (i === idx ? { ...row, ...patch } : row));
}

export function numOrNull(v: string): number | null {
  const n = Number(String(v).replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
}
