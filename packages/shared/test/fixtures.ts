import assert from 'node:assert/strict';
import { emptyCf2Analyse, type Cf2Analyse } from '../dist/index.js';

export function close(actual: number | null, expected: number, eps = 1e-6) {
  assert.ok(actual != null, `attendu ${expected}, reçu null`);
  assert.ok(
    Math.abs(actual - expected) < eps,
    `attendu ${expected}, reçu ${actual}`,
  );
}

/** Dossier exemple de docs/Analyse_AGR.xlsx (CF 2.1 → CF 2.5). */
export function excelExemple(): Cf2Analyse {
  const a = emptyCf2Analyse();
  // CF 2.1 — dépenses familiales (X25:X36 = 280)
  Object.assign(a.cf21.depenses, {
    nourriture: '100',
    loyer: '130',
    transport: '10',
    communication: '10',
    education: '10',
    services: '20',
  });
  // CF 2.2 — stock (C14:AR17 + ligne « Autres » BI24 = 500)
  a.cf22.stock = [
    ['VODACOM', '290'],
    ['ORANGE', '897'],
    ['AIRTEL', '951'],
    ['AFRICELL', '909'],
  ].map(([produit, quantite], i) => ({
    id: `st${i}`,
    produit,
    quantite,
    prixAchat: '0.94',
    prixVente: '1.07',
    principal: false,
  }));
  a.cf22.stock.push({
    id: 'st_autres',
    produit: 'Autres',
    quantite: '500',
    prixAchat: '1',
    prixVente: '',
    principal: false,
  });
  // CF 2.2 — 3 derniers jours + vente prévue, 26 jours ouvrables (P36 = 8151)
  a.cf22.ventesRecents = ['292', '389', '451'].map((montant, i) => ({
    id: `vr${i}`,
    jour: '',
    montant,
  }));
  a.cf22.aujourdHui = { heure: '12H00', especes: '590', ventePrevue: '122' };
  a.cf22.joursOuvrablesMois = '26';
  // CF 2.3 — opex (T33 = 250) et autres revenus (BG38 = 350)
  Object.assign(a.cf23.opex, {
    transportJournalier: '30',
    loyer: '150',
    communication: '10',
    taxesLicence: '10',
    autresMontant: '50',
  });
  a.cf23.autresRevenus = [
    { id: 'or1', description: 'COMMISSION', depuis: '', revenuMensuel: '350' },
  ];
  // CF 2.5 — bilan et proposition
  Object.assign(a.cf25, {
    banque: '1500',
    equipement: '700',
    autresImmobilises: '1500',
    montantPropose: '2500',
    echeanceMois: '10',
    tauxPeriodique: '0.05',
  });
  // CF5.1 — caution financière W28 = 750
  a.cf24.valeurGaranties = '750';
  return a;
}
