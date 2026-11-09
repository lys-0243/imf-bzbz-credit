import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisAPreparer,
  buildDossierFacts,
  classerAgents,
  controlesDeterministes,
  decouperManuel,
  filtrerCitations,
  fusionnerAnomalies,
  normalizeRapportAnalyse,
  rapportAnalyseManquants,
  verdictDesConstats,
} from '../dist/index.js';

describe('Citations de conformité', () => {
  test('les sections non fournies sont retirées et le constat passe à vérifier', () => {
    const fournis = new Set(['s1', 's2']);
    const { constats, retirees } = filtrerCitations(
      [
        { exigence: 'Garantie ≥ 120 %', statut: 'CONFORME', sectionIds: ['s1'], citation: 'c', commentaire: '' },
        { exigence: 'KYC', statut: 'NON_CONFORME', sectionIds: ['s9'], citation: 'inventé', commentaire: '' },
        { exigence: 'Taux', statut: 'CONFORME', sectionIds: ['s2', 's7'], citation: 'c', commentaire: '' },
      ],
      fournis,
    );
    assert.equal(retirees, 2);
    assert.equal(constats[0].statut, 'CONFORME');
    assert.equal(constats[1].statut, 'A_VERIFIER');
    assert.deepEqual(constats[1].sectionIds, []);
    assert.equal(constats[1].citation, '');
    assert.deepEqual(constats[2].sectionIds, ['s2']);
    assert.equal(constats[2].statut, 'CONFORME');
  });

  test('verdict', () => {
    assert.equal(verdictDesConstats([{ statut: 'CONFORME' }, { statut: 'A_VERIFIER' }]), 'A_VERIFIER');
    assert.equal(verdictDesConstats([{ statut: 'NON_CONFORME' }, { statut: 'A_VERIFIER' }]), 'NON_CONFORME');
    assert.equal(verdictDesConstats([{ statut: 'CONFORME' }]), 'CONFORME');
  });
});

describe('Suggestion d’agents', () => {
  const base = { communes: {}, charge: 0, dossiersTraites: 0, retours: 0, delaiMoyenJours: null, zoneName: null };
  test('même zone et commune connue en tête, charge départage', () => {
    const r = classerAgents(
      [
        { ...base, id: 'a', displayName: 'A', zoneId: 'z2' },
        { ...base, id: 'b', displayName: 'B', zoneId: 'z1', charge: 4 },
        { ...base, id: 'c', displayName: 'C', zoneId: 'z1', communes: { c1: 3 }, charge: 1 },
      ],
      { zoneId: 'z1', communeId: 'c1' },
    );
    assert.deepEqual(r.map((x) => x.agentId), ['c', 'b', 'a']);
    assert.equal(r[0].rang, 1);
    assert.ok(r[0].criteres.some((c) => c.includes('commune')));
  });
});

describe('Contrôles déterministes', () => {
  test('analyse absente, checklist, liste noire, écart avec l’IA', () => {
    const facts = buildDossierFacts({
      produit: { code: 'AGR', label: 'AGR', famille: 'ACTIVITE' },
      demande: { montant: 1000, devise: 'USD', duree: 12, dureeUnite: 'MOIS' },
      analyse: null,
      checklistIssues: [{ id: 'x', label: 'Pièce d’identité', reason: 'manquante' }] as never,
      banking: null,
    });
    const a = controlesDeterministes({
      facts,
      famille: 'ACTIVITE',
      montantAgent: 1000,
      montantIa: 500,
      listeNoire: ['Garant sur liste noire'],
    });
    assert.ok(a.some((x) => x.gravite === 'BLOQUANTE' && x.rubrique === 'Analyse CF2'));
    assert.ok(a.some((x) => x.gravite === 'BLOQUANTE' && x.constat.includes('liste noire')));
    assert.ok(a.some((x) => x.rubrique === 'Checklist'));
    assert.ok(a.some((x) => x.constat.includes('Écart')));
    const f = fusionnerAnomalies(a, [{ gravite: 'MINEURE', rubrique: 'IA', constat: 'c', correction: '' }]);
    assert.equal(f[0].gravite, 'BLOQUANTE');
    assert.equal(f.at(-1)!.source, 'IA');
    assert.deepEqual(f.map((x) => x.id), f.map((_, i) => `A${i + 1}`));
  });

  test('avis à préparer à l’entrée de chaque étape', () => {
    assert.equal(avisAPreparer('ANALYSTE'), 'ANALYSE');
    assert.equal(avisAPreparer('CONFORMITE'), 'CONFORMITE');
    assert.equal(avisAPreparer('DIRECTION'), 'SYNTHESE_DIRECTION');
    assert.equal(avisAPreparer('DESCENTE'), null);
  });
});

describe('Rapport d’analyse', () => {
  test('champs requis selon la recommandation', () => {
    assert.deepEqual(rapportAnalyseManquants(normalizeRapportAnalyse({})), [
      'Synthèse',
      'Analyse financière',
      'Recommandation',
    ]);
    const refus = normalizeRapportAnalyse({ synthese: 's', analyseFinanciere: 'a', recommandation: 'REFUS' });
    assert.deepEqual(rapportAnalyseManquants(refus), []);
    const accord = normalizeRapportAnalyse({
      synthese: 's',
      analyseFinanciere: 'a',
      recommandation: 'ACCORD',
      montantPropose: '500',
    });
    assert.deepEqual(rapportAnalyseManquants(accord), ['Durée (mois)']);
  });
});

describe('Découpage des manuels', () => {
  test('sections par articles et chapitres', () => {
    const texte = [
      'MANUEL DE PROCÉDURES DE CRÉDIT',
      'Introduction générale du manuel.',
      'CHAPITRE 1 - Dispositions générales',
      'Le présent manuel s’applique à tous les crédits.',
      'Article 1 : Garanties',
      'Tout crédit supérieur à 500 USD doit être couvert par une garantie d’au moins 120 %.',
      'Article 2 - Approbation',
      'Les crédits supérieurs à 500 USD sont approuvés par le Conseil d’administration.',
      '3.1 Taux d’intérêt applicables',
      'Le taux est fixé par la grille en vigueur.',
    ].join('\n');
    const s = decouperManuel(texte);
    assert.deepEqual(
      s.map((x) => x.numero),
      ['', 'CHAPITRE 1', 'Article 1', 'Article 2', '3.1'],
    );
    assert.equal(s[2].titre, 'Garanties');
    assert.ok(s[3].contenu.includes('Conseil'));
    assert.deepEqual(s.map((x) => x.ordre), [0, 1, 2, 3, 4]);
  });

  test('section trop longue redécoupée avec recouvrement', () => {
    const para = (i: number) => `Paragraphe ${i} ` + 'mot '.repeat(60);
    const texte = 'Article 9 : Long\n' + Array.from({ length: 10 }, (_, i) => para(i)).join('\n\n');
    const s = decouperManuel(texte, 150);
    assert.ok(s.length > 1);
    assert.ok(s.every((x) => x.numero === 'Article 9'));
    assert.ok(s[0].titre.includes('partie 1'));
    const dernierDuPremier = s[0].contenu.split('\n\n').at(-1)!;
    assert.ok(s[1].contenu.startsWith(dernierDuPremier));
  });
});
