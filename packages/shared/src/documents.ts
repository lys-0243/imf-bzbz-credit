/** Calculs communs aux documents imprimables (contrat, transfert…). */

export type EcheanceLigne = {
  numero: number;
  mensualite: number;
  interet: number;
  principal: number;
  capitalRestant: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Plan de remboursement à mensualités constantes (taux dégressif sur
 * capital restant) — annexe 1 du contrat de prêt.
 */
export function echeancier(
  montant: number,
  tauxMensuel: number,
  nombreMois: number,
): { lignes: EcheanceLigne[]; totalMensualites: number; totalInterets: number } {
  const n = Math.floor(nombreMois);
  if (montant <= 0 || n <= 0 || tauxMensuel < 0) {
    return { lignes: [], totalMensualites: 0, totalInterets: 0 };
  }
  const mensualite =
    tauxMensuel === 0
      ? montant / n
      : (montant * tauxMensuel * Math.pow(1 + tauxMensuel, n)) /
        (Math.pow(1 + tauxMensuel, n) - 1);
  const lignes: EcheanceLigne[] = [];
  let restant = montant;
  for (let i = 1; i <= n; i++) {
    const interet = restant * tauxMensuel;
    // Dernière échéance : solde exact du capital (arrondis).
    const principal = i === n ? restant : mensualite - interet;
    restant = Math.max(0, restant - principal);
    lignes.push({
      numero: i,
      mensualite: round2(principal + interet),
      interet: round2(interet),
      principal: round2(principal),
      capitalRestant: round2(restant),
    });
  }
  return {
    lignes,
    totalMensualites: round2(lignes.reduce((a, l) => a + l.mensualite, 0)),
    totalInterets: round2(lignes.reduce((a, l) => a + l.interet, 0)),
  };
}

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function moinsDeCent(n: number): string {
  if (n < 17) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return DIZAINES[d];
    return u === 1 ? `${DIZAINES[d]} et un` : `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) {
    const reste = n - 60;
    return reste === 11 ? 'soixante et onze' : `soixante-${moinsDeCent(reste)}`;
  }
  const reste = n - 80;
  if (reste === 0) return 'quatre-vingts';
  return `quatre-vingt-${moinsDeCent(reste)}`;
}

function moinsDeMille(n: number): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 0) return moinsDeCent(r);
  const cent = c === 1 ? 'cent' : `${UNITES[c]} cent${r === 0 ? 's' : ''}`;
  return r === 0 ? cent : `${cent} ${moinsDeCent(r)}`;
}

/** Nombre entier en toutes lettres (français, orthographe traditionnelle). */
export function nombreEnLettres(n: number): string {
  const v = Math.floor(Math.abs(n));
  if (v === 0) return 'zéro';
  const parts: string[] = [];
  const milliards = Math.floor(v / 1e9);
  const millions = Math.floor((v % 1e9) / 1e6);
  const milliers = Math.floor((v % 1e6) / 1000);
  const reste = v % 1000;
  if (milliards) parts.push(`${moinsDeMille(milliards)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) parts.push(`${moinsDeMille(millions)} million${millions > 1 ? 's' : ''}`);
  if (milliers) {
    // « mille » invariable ; « quatre-vingts » et « cents » perdent leur s devant mille.
    const m = milliers === 1 ? '' : moinsDeMille(milliers).replace(/(vingt|cent)s$/, '$1');
    parts.push(m ? `${m} mille` : 'mille');
  }
  if (reste) parts.push(moinsDeMille(reste));
  return parts.join(' ');
}

const DEVISE_LETTRES: Record<string, { unite: string; centime: string }> = {
  USD: { unite: 'dollars américains', centime: 'cents' },
  CDF: { unite: 'francs congolais', centime: 'centimes' },
};

/** Montant en lettres pour le document de transfert. */
export function montantEnLettres(montant: number, devise = 'USD'): string {
  const d = DEVISE_LETTRES[devise] ?? { unite: devise, centime: 'centimes' };
  const entier = Math.floor(Math.abs(montant));
  const cents = Math.round((Math.abs(montant) - entier) * 100);
  const base = `${nombreEnLettres(entier)} ${d.unite}`;
  return cents ? `${base} et ${nombreEnLettres(cents)} ${d.centime}` : base;
}
