import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquerAjustementsIa,
  appliquerNotesAnalyste,
  buildDossierFacts,
  computeScoreCredit,
  DEFAULT_GRILLE_SCORE,
  ecartScoreImposeCommentaire,
  evaluerProposition,
  moisDepuis,
  TAUX_PAR_TRANCHE,
  type BankingLookupResult,
  type PilierScore,
} from '../dist/index.js';
import { excelExemple } from './fixtures.ts';

const maintenant = new Date('2026-11-09T12:00:00Z');

function banking(statuts: Array<'SOLDE' | 'EN_RETARD' | 'DEFAUT'>): BankingLookupResult {
  return {
    found: true,
    numeroCompte: 'X',
    kyc: null,
    creditEnCours: false,
    creditsActifs: [],
    historique: statuts.map((statut, i) => ({
      reference: `P${i}`,
      produitCode: 'AGR',
      montant: 1000,
      devise: 'USD',
      dateDebut: '2024-01-01',
      dateFin: '2024-12-31',
      statut,
    })),
    score: null,
  } as unknown as BankingLookupResult;
}

function facts(b: BankingLookupResult | null = null) {
  return buildDossierFacts({
    produit: { code: 'AGR', label: 'Crédit AGR', famille: 'ACTIVITE' },
    demande: { montant: 7000, devise: 'USD', duree: 12, dureeUnite: 'MOIS' },
    analyse: excelExemple(),
    checklistIssues: [],
    banking: b,
  });
}

const pilier = (s: ReturnType<typeof computeScoreCredit>, p: PilierScore) =>
  s.piliers.find((x) => x.pilier === p)!.score;

describe('Score de crédit moteur', () => {
  test('piliers, total pondéré et classe', () => {
    const s = computeScoreCredit({ facts: facts(), activiteDepuis: '2019', lieuDepuis: '2020', maintenant });
    assert.equal(s.piliers.length, 6);
    assert.ok(s.total >= 0 && s.total <= 100);
    const attendu = Math.round(s.piliers.reduce((t, p) => t + p.score * p.poids, 0));
    assert.equal(s.total, attendu);
    assert.ok(['A', 'B', 'C', 'D', 'E'].includes(s.classe));
    assert.equal(s.eliminatoires.length, 0);
    assert.ok(s.piliers.every((p) => p.details.length > 0));
  });

  test('critère éliminatoire : plafonné, classe E, refus', () => {
    const s = computeScoreCredit({
      facts: facts(banking(['DEFAUT'])),
      eligibilite: { clientListeNoire: true },
      maintenant,
    });
    assert.ok(s.total <= DEFAULT_GRILLE_SCORE.plafondEliminatoire);
    assert.equal(s.classe, 'E');
    assert.equal(s.recommandation, 'REFUS');
    assert.ok(s.eliminatoires.includes('Client sur liste noire'));
    assert.ok(s.eliminatoires.some((e) => e.includes('Défaut')));
  });

  test('historique sain mieux noté que des retards', () => {
    const bon = computeScoreCredit({ facts: facts(banking(['SOLDE', 'SOLDE'])), maintenant });
    const mauvais = computeScoreCredit({ facts: facts(banking(['EN_RETARD', 'EN_RETARD'])), maintenant });
    assert.ok(pilier(bon, 'HISTORIQUE') > pilier(mauvais, 'HISTORIQUE'));
  });

  test('recalcul sur le montant retenu', () => {
    const f = facts();
    const ev = (montant: number) =>
      evaluerProposition({ analyse: excelExemple(), montant, echeanceMois: 12, grilleTaux: TAUX_PAR_TRANCHE, garanties: null });
    const petit = computeScoreCredit({ facts: f, evaluation: ev(1000), maintenant });
    const grand = computeScoreCredit({ facts: f, evaluation: ev(9000), maintenant });
    assert.ok(pilier(petit, 'CAPACITE') >= pilier(grand, 'CAPACITE'));
    assert.equal(petit.montantEvalue, 1000);
    assert.equal(petit.echeanceMois, 12);
  });

  test('retours agent pénalisent la qualité', () => {
    const s = computeScoreCredit({ facts: facts(), retoursAgent: 2, maintenant });
    assert.equal(pilier(s, 'QUALITE'), 80);
  });
});

describe('Ajustements IA et analyste', () => {
  test('ajustement IA borné à ±marge par pilier', () => {
    const moteur = computeScoreCredit({ facts: facts(), maintenant });
    const r = appliquerAjustementsIa(moteur, [
      { pilier: 'STABILITE', delta: 40, justification: 'Activité ancienne et stable' },
      { pilier: 'GARANTIES', delta: -3, justification: 'Biens peu liquides' },
    ]);
    assert.equal(r.recadre, true);
    assert.equal(r.ajustements.find((a) => a.pilier === 'STABILITE')!.delta, DEFAULT_GRILLE_SCORE.margeIaParPilier);
    assert.equal(pilier(r.score, 'GARANTIES'), Math.max(0, pilier(moteur, 'GARANTIES') - 3));
  });

  test('l’IA ne lève pas un critère éliminatoire', () => {
    const moteur = computeScoreCredit({ facts: facts(), eligibilite: { garantListeNoire: true }, maintenant });
    const tous: PilierScore[] = ['CAPACITE', 'STRUCTURE', 'GARANTIES', 'HISTORIQUE', 'STABILITE', 'QUALITE'];
    const r = appliquerAjustementsIa(
      moteur,
      tous.map((p) => ({ pilier: p, delta: 10, justification: 'x' })),
    );
    assert.equal(r.score.classe, 'E');
    assert.ok(r.score.total <= DEFAULT_GRILLE_SCORE.plafondEliminatoire);
  });

  test('notes analyste et commentaire imposé au-delà de l’écart', () => {
    const moteur = computeScoreCredit({ facts: facts(), maintenant });
    const retenu = appliquerNotesAnalyste(moteur, { CAPACITE: 100, STRUCTURE: 100, GARANTIES: 100 });
    assert.ok(retenu.total >= moteur.total);
    assert.equal(ecartScoreImposeCommentaire(moteur, { total: moteur.total + 4 }), false);
    assert.equal(ecartScoreImposeCommentaire(moteur, { total: moteur.total + 5 }), true);
  });
});

describe('Anciennetés', () => {
  test('formats libres', () => {
    assert.equal(moisDepuis('3 ans', maintenant), 36);
    assert.equal(moisDepuis('18 mois', maintenant), 18);
    assert.equal(moisDepuis('2024-11-01', maintenant), 24);
    assert.equal(moisDepuis('11/2023', maintenant), 36);
    assert.equal(moisDepuis('2026', maintenant), 5);
    assert.equal(moisDepuis('n/a', maintenant), null);
    assert.equal(moisDepuis('', maintenant), null);
  });
});
