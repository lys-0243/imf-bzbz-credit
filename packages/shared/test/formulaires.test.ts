import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCf61Synthese,
  buildDocumentsContexte,
  buildFormulaireAnalyse,
  computeCf5Totaux,
  computeConditionsDeboursement,
  computeMbmp,
  conditionsPret,
  coutTotalProduit,
  DEFAULT_PARAMETRES_IMF,
  echeancier,
  emptyCf3,
  identiteDemandeur,
  montantEnLettres,
  nombreEnLettres,
  normalizeFormulaires,
  normalizeParametresImf,
  peutEditerFormulaire,
  ratiosDossier,
  requiertApprobationCa,
  tauxParTranche,
  type DossierContexte,
} from '../dist/index.js';
import { close, excelExemple } from './fixtures.ts';

/** Dossier exemple Analyse_AGR.xlsx (CF 1 + CF 2 + CF5.1). */
function contexte(): DossierContexte {
  const formulaires = normalizeFormulaires({});
  return {
    id: 'd1',
    reference: 'AGR-TEST',
    etat: 'DIRECTION',
    createdAt: '2026-01-07T00:00:00.000Z',
    produit: { code: 'AGR', label: 'Crédit AGR', famille: 'ACTIVITE' },
    payload: {
      numeroCompte: 'BB/I/015485',
      devise: 'USD',
      montantSollicite: 7000,
      demandeur: { prenom: 'FRANCIS', nom: 'KAPUMA', postNom: 'MUKENDI', sexe: 'Masculin' },
      pret: { dureeMois: 12, butInvestissement: 'Fonds de roulement' },
    },
    client: { fullName: 'FRANCIS KAPUMA MUKENDI' },
    agent: { displayName: 'REBECCA MWAKANA' },
    analyse: excelExemple(),
    formulaires,
    parametres: DEFAULT_PARAMETRES_IMF,
    nouveauClient: true,
  };
}

describe('Paramètres IMF et frais du PV', () => {
  test('frais « Décision du comité » pour 2 500 USD', () => {
    const f = computeConditionsDeboursement(2500);
    close(f.caution, 750);
    close(f.fraisDossier, 50);
    close(f.fraisDecaissement, 12.5);
    close(f.tva, 10);
  });

  test('seuil d’approbation CA et grille paramétrée', () => {
    assert.equal(requiertApprobationCa(2500), true);
    assert.equal(requiertApprobationCa(400), false);
    const p = normalizeParametresImf({ grilleTaux: [{ min: 0, max: 100000, tauxMensuel: 0.03 }] });
    assert.equal(tauxParTranche(2500, p.grilleTaux), 0.03);
    assert.equal(normalizeParametresImf({ conditions: { tvaPct: 5 } }).conditions.tvaPct, 0.16);
  });
});

describe('CF3 et CF5.1', () => {
  test('coûts de production et MBMP', () => {
    const d = emptyCf3();
    d.produits[0].materiels[0] = { id: 'm', quantite: '10', materiel: 'Farine', prixUnitaire: '2' };
    d.produits[0].materiels[1] = { id: 'n', quantite: '5', materiel: 'Sucre', prixUnitaire: '1' };
    assert.equal(coutTotalProduit(d.produits[0]), 25);
    d.mbmp[0] = { id: 'a', produit: 'Pain', coutUnitaire: '0.5', prixVente: '1', qteVendueMois: '100' };
    d.mbmp[1] = { id: 'b', produit: 'Gâteau', coutUnitaire: '3', prixVente: '4', qteVendueMois: '50' };
    const r = computeMbmp(d);
    close(r.coutMensuel, 200);
    close(r.venteMensuelle, 300);
    close(r.mbmp, 1 - 200 / 300);
  });

  test('CF5.1 demandeur : caution financière 30 % calculée (W28 = 750)', () => {
    const f = normalizeFormulaires({});
    const t = computeCf5Totaux(f.CF5_1_DEMANDEUR, { montantPropose: 2500, cautionPct: 0.3 });
    close(t.total, 750);
    close(t.parType.CDTG, 750);
  });

  test('CF5.2 garant : solde compte + stock', () => {
    const f = normalizeFormulaires({
      CF5_1_GARANT: {
        biens: [
          { type: 'AUTRE', description: 'SOLDE Compte Courant', valeurMarchande: '2500' },
          { type: 'ST', description: 'STOCK', prixAchat: '4500', valeurMarchande: '900' },
        ],
      },
    });
    const t = computeCf5Totaux(f.CF5_1_GARANT);
    close(t.total, 3400);
    close(t.parType.ST, 900);
  });

  test('ratio de garantie CF 2.4 alimenté par CF5.1', () => {
    const r = ratiosDossier(contexte()).find((x) => x.key === 'garantie')!;
    close(r.numerateur, 750);
    close(r.value, 750 / 3237.6143741364172);
  });
});

describe('Documents', () => {
  test('échéancier 2 500 / 5 % / 10 mois : total = CF 2.5 P39', () => {
    const e = echeancier(2500, 0.05, 10);
    assert.equal(e.lignes.length, 10);
    close(e.totalMensualites, 3237.61, 0.02);
    assert.equal(e.lignes.at(-1)!.capitalRestant, 0);
  });

  test('montant en lettres', () => {
    assert.equal(montantEnLettres(2500), 'deux mille cinq cents dollars américains');
    assert.equal(
      montantEnLettres(3237.61),
      'trois mille deux cent trente-sept dollars américains et soixante et un cents',
    );
    assert.equal(nombreEnLettres(71), 'soixante et onze');
    assert.equal(nombreEnLettres(80), 'quatre-vingts');
    assert.equal(nombreEnLettres(81), 'quatre-vingt-un');
    assert.equal(nombreEnLettres(200000), 'deux cent mille');
    assert.equal(nombreEnLettres(80000), 'quatre-vingt mille');
    assert.equal(nombreEnLettres(1000), 'mille');
    assert.equal(nombreEnLettres(2000000), 'deux millions');
  });

  test('conditions retenues : PV puis mémo PCA prioritaires', () => {
    const ctx = contexte();
    assert.equal(conditionsPret(ctx).source, 'CF2_5');
    assert.equal(conditionsPret(ctx).montant, 2500);
    ctx.formulaires.DECISION_COMITE.decision = 'APPROUVE';
    ctx.formulaires.DECISION_COMITE.montantApprouve = '2000';
    ctx.formulaires.DECISION_COMITE.dureeMois = '8';
    const pv = conditionsPret(ctx);
    assert.equal(pv.source, 'DECISION_COMITE');
    assert.equal(pv.tauxMensuel, 0.05);
    close(pv.frais!.caution, 600);
    ctx.formulaires.APPRO_PCA.decision = 'APPROUVE';
    ctx.formulaires.APPRO_PCA.montantApprouve = '1800';
    assert.equal(conditionsPret(ctx).montant, 1800);
    assert.equal(conditionsPret(ctx).dureeMois, 8);
  });

  test('contexte documents : nom au format Excel et montant en lettres', () => {
    const doc = buildDocumentsContexte(contexte());
    assert.equal(doc.demandeur.nomComplet, 'KAPUMA MUKENDI FRANCIS');
    assert.equal(doc.demandeur.civilite, 'Monsieur');
    assert.equal(doc.montantEnLettres, 'deux mille cinq cents dollars américains');
    assert.equal(doc.echeancier!.lignes.length, 10);
  });
});

describe('Synthèses', () => {
  test('CF6.1 et Formulaire d’analyse', () => {
    const ctx = contexte();
    const cf61 = buildCf61Synthese(ctx);
    assert.equal(cf61.proposition.montantPropose, 2500);
    assert.equal(cf61.proposition.montantSollicite, 7000);
    close(cf61.garanties.parType.CDTG, 750);
    const fa = buildFormulaireAnalyse(ctx);
    close(fa.compteResultat!.capacitePaiement, 810.3084112149545);
    assert.equal(fa.garanties.lignes.length, 1);
    close(fa.garanties.lignes[0].contribution, 1);
    close(fa.menage.depensesFamiliales, 280);
    assert.equal(identiteDemandeur(ctx.payload).nomComplet, 'KAPUMA MUKENDI FRANCIS');
  });
});

describe('Droits d’édition des formulaires', () => {
  const agent = { role: 'AGENT', agentAssigne: true, agentAValide: false };
  test('matrice rôle × état', () => {
    assert.equal(peutEditerFormulaire('CF4', { ...agent, etat: 'DESCENTE' }), true);
    assert.equal(peutEditerFormulaire('CF4', { ...agent, etat: 'DESCENTE', agentAValide: true }), false);
    assert.equal(peutEditerFormulaire('CF4', { ...agent, etat: 'DESCENTE', agentAssigne: false }), false);
    assert.equal(peutEditerFormulaire('PRE_COMITE', { role: 'RESPONSABLE_CREDIT', etat: 'EN_ATTENTE_VALIDATION_RC', agentAssigne: false, agentAValide: true }), true);
    assert.equal(peutEditerFormulaire('DECISION_COMITE', { role: 'DG', etat: 'DIRECTION', agentAssigne: false, agentAValide: true }), true);
    assert.equal(peutEditerFormulaire('DECISION_COMITE', { role: 'AGENT', etat: 'DIRECTION', agentAssigne: true, agentAValide: true }), false);
    assert.equal(peutEditerFormulaire('APPRO_PCA', { role: 'CA', etat: 'CONSEIL', agentAssigne: false, agentAValide: true }), true);
    assert.equal(peutEditerFormulaire('CF8', { ...agent, etat: 'A_DECAISSER', agentAValide: true }), true);
  });
});
