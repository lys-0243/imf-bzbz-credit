import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisParRegles,
  borneAvis,
  buildDossierFacts,
  decisionDiverge,
  pronosticAvisSchema,
  type BankingLookupResult,
  type Cf2Analyse,
} from '../dist/index.js';
import { close, excelExemple } from './fixtures.ts';

function facts(analyse: Cf2Analyse | null, banking: BankingLookupResult | null = null) {
  return buildDossierFacts({
    produit: { code: 'AGR', label: 'Crédit AGR', famille: 'ACTIVITE' },
    demande: { montant: 7000, devise: 'USD', duree: 12, dureeUnite: 'MOIS' },
    analyse,
    checklistIssues: [],
    banking,
  });
}

function banking(statuts: Array<'SOLDE' | 'EN_RETARD' | 'DEFAUT'>): BankingLookupResult {
  return {
    found: true,
    numeroCompte: 'BB/I/0001',
    kyc: null,
    creditEnCours: false,
    creditsActifs: [],
    historique: statuts.map((statut, i) => ({
      reference: `P${i}`,
      produitCode: 'AGR',
      montant: 1000,
      devise: 'USD',
      dateDebut: '2025-01-01',
      statut,
    })),
    score: null,
  };
}

describe('buildDossierFacts — exemple Analyse_AGR.xlsx', () => {
  test('chiffres et proposition', () => {
    const f = facts(excelExemple());
    assert.equal(f.analyseDisponible, true);
    close(f.compteResultat!.capacitePaiement, 810.31, 0.01);
    close(f.proposition.mensualite, 323.76, 0.01);
    assert.equal(f.proposition.tauxGrille, 0.05);
    assert.ok(f.proposition.montantMaxConseille! >= 2500);
    assert.equal(f.ratios.length, 6);
  });

  test('alerte uniquement sur la garantie', () => {
    const f = facts(excelExemple());
    assert.equal(f.alertes.length, 1);
    assert.match(f.alertes[0], /Ratio de Garantie hors norme/);
  });

  test('aucune donnée nominative dans les faits', () => {
    const a = excelExemple();
    a.cf21.references[0].nom = 'KAPUMA MUKENDI';
    const json = JSON.stringify(facts(a));
    assert.doesNotMatch(json, /KAPUMA/);
  });

  test('sans analyse CF2 : alerte dédiée', () => {
    const f = facts(null);
    assert.equal(f.analyseDisponible, false);
    assert.deepEqual(f.alertes, ['Analyse financière CF2 non renseignée']);
  });
});

describe('avisParRegles', () => {
  test('exemple Excel : accord sous conditions, montant 2 500', () => {
    const avis = avisParRegles(facts(excelExemple()));
    assert.equal(avis.recommandation, 'ACCORD_CONDITIONNEL');
    assert.equal(avis.montantSuggere, 2500);
    assert.equal(avis.dureeSuggereeMois, 10);
    assert.equal(pronosticAvisSchema.safeParse(avis).success, true);
  });

  test('défaut CBS : refus sans montant', () => {
    const avis = avisParRegles(facts(excelExemple(), banking(['SOLDE', 'DEFAUT'])));
    assert.equal(avis.recommandation, 'REFUS');
    assert.equal(avis.montantSuggere, null);
  });

  test('capacité négative : refus', () => {
    const a = excelExemple();
    a.cf21.depenses.nourriture = '5000';
    assert.equal(avisParRegles(facts(a)).recommandation, 'REFUS');
  });

  test('montant proposé au-delà du DSR : ramené au maximum', () => {
    const a = excelExemple();
    a.cf25.montantPropose = '7000';
    const f = facts(a);
    const avis = avisParRegles(f);
    assert.equal(avis.montantSuggere, Math.floor(f.proposition.montantMaxConseille!));
  });
});

describe('Proposition CF 2.5 incomplète', () => {
  function sansProposition() {
    const a = excelExemple();
    a.cf25.montantPropose = '';
    a.cf25.echeanceMois = '';
    return a;
  }

  test('maximum calculé sur la durée demandée, montant borné', () => {
    const f = facts(sansProposition());
    assert.equal(f.proposition.echeanceReferenceMois, 12);
    assert.ok(f.proposition.montantMaxConseille! < 7000);
    assert.match(f.alertes.join(' | '), /Proposition de prêt CF 2.5 incomplète/);
    const avis = avisParRegles(f);
    assert.equal(avis.montantSuggere, Math.floor(f.proposition.montantMaxConseille!));
    assert.equal(avis.dureeSuggereeMois, 12);
  });

  test('ratios dépendant du prêt : non calculables (pas « conformes »)', () => {
    const f = facts(sansProposition());
    const dsr = f.ratios.find((r) => r.key === 'dsr')!;
    assert.equal(dsr.valeur, null);
    assert.equal(dsr.respecte, null);
  });

  test('sans maximum calculable : aucun montant suggéré', () => {
    const f = buildDossierFacts({
      produit: { code: 'DARE_DARE', label: 'Dare-dare', famille: 'ACTIVITE' },
      demande: { montant: 500, devise: 'USD', duree: 8, dureeUnite: 'SEMAINES' },
      analyse: null,
      checklistIssues: [],
      banking: null,
    });
    assert.equal(avisParRegles(f).montantSuggere, null);
    const { avis, ajuste } = borneAvis(
      { ...avisParRegles(f), montantSuggere: 500 },
      f,
    );
    assert.equal(ajuste, true);
    assert.equal(avis.montantSuggere, null);
  });
});

describe('borneAvis et decisionDiverge', () => {
  const base = avisParRegles(facts(excelExemple()));

  test('montant IA supérieur au maximum : borné et signalé', () => {
    const f = facts(excelExemple());
    const { avis, ajuste } = borneAvis({ ...base, montantSuggere: 6000 }, f);
    assert.equal(ajuste, true);
    assert.equal(avis.montantSuggere, Math.floor(f.proposition.montantMaxConseille!));
    assert.match(avis.pointsVigilance.at(-1)!, /DSR de 40 %/);
  });

  test('refus IA : montant retiré', () => {
    const { avis } = borneAvis(
      { ...base, recommandation: 'REFUS', montantSuggere: 2000 },
      facts(excelExemple()),
    );
    assert.equal(avis.montantSuggere, null);
  });

  test('divergence humaine', () => {
    assert.equal(
      decisionDiverge(base, { recommandation: base.recommandation, montantRetenu: 2500 }),
      false,
    );
    assert.equal(
      decisionDiverge(base, { recommandation: 'ACCORD', montantRetenu: 2500 }),
      true,
    );
    assert.equal(
      decisionDiverge(base, { recommandation: base.recommandation, montantRetenu: 2000 }),
      true,
    );
  });
});
