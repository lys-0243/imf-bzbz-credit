import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisParRegles,
  buildContexteClient,
  buildDossierFacts,
  decisionDiverge,
  evaluerProposition,
  finaliserAvis,
  pronosticAvisSchema,
  TAUX_PAR_TRANCHE,
  vueIa,
  type BankingLookupResult,
  type Cf1PourIa,
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
  test('exemple Excel : accord sous conditions, montant demandé plafonné au DSR', () => {
    const f = facts(excelExemple());
    const avis = avisParRegles(f);
    assert.equal(avis.recommandation, 'ACCORD_CONDITIONNEL');
    assert.equal(f.referenceIa.dureeReferenceMois, 12);
    assert.ok(f.referenceIa.montantMaxConseille! < 7000);
    assert.equal(avis.montantSuggere, Math.floor(f.referenceIa.montantMaxConseille!));
    assert.equal(avis.dureeSuggereeMois, 12);
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

  test('montant de repli indépendant du montant saisi par l’agent', () => {
    const a = excelExemple();
    const b = excelExemple();
    b.cf25.montantPropose = '7000';
    assert.equal(
      avisParRegles(facts(a)).montantSuggere,
      avisParRegles(facts(b)).montantSuggere,
    );
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
    assert.doesNotMatch(f.alertesIa.join(' | '), /Proposition de prêt CF 2.5/);
    const avis = avisParRegles(f);
    assert.equal(avis.montantSuggere, Math.floor(f.referenceIa.montantMaxConseille!));
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
    const { avis, ajuste, evaluation } = finaliserAvis({
      avis: { ...avisParRegles(f), montantSuggere: 500 },
      facts: f,
      analyse: null,
    });
    assert.equal(ajuste, true);
    assert.equal(avis.montantSuggere, null);
    assert.equal(evaluation, null);
  });
});

describe('finaliserAvis et decisionDiverge', () => {
  const base = avisParRegles(facts(excelExemple()));

  test('montant IA supérieur au maximum : borné, signalé et réévalué', () => {
    const a = excelExemple();
    const f = facts(a);
    const { avis, ajuste, evaluation } = finaliserAvis({
      avis: { ...base, montantSuggere: 6000, dureeSuggereeMois: 10 },
      facts: f,
      analyse: a,
    });
    assert.equal(ajuste, true);
    assert.ok(evaluation);
    assert.equal(avis.montantSuggere, evaluation.montant);
    assert.ok(avis.montantSuggere! <= evaluation.montantMax!);
    assert.match(avis.pointsVigilance.at(-1)!, /DSR de 40 %/);
    const dsr = evaluation.ratios.find((r) => r.key === 'dsr')!;
    assert.ok(dsr.valeur! <= 0.4 + 1e-6);
  });

  test('montant IA dans la limite : conservé, ratios évalués sur ce montant', () => {
    const a = excelExemple();
    const { avis, ajuste, evaluation } = finaliserAvis({
      avis: { ...base, montantSuggere: 2000, dureeSuggereeMois: 10 },
      facts: facts(a),
      analyse: a,
    });
    assert.equal(ajuste, false);
    assert.equal(avis.montantSuggere, 2000);
    assert.equal(evaluation!.montant, 2000);
    assert.equal(evaluation!.echeanceMois, 10);
  });

  test('refus IA : montant retiré', () => {
    const a = excelExemple();
    const { avis, evaluation } = finaliserAvis({
      avis: { ...base, recommandation: 'REFUS', montantSuggere: 2000 },
      facts: facts(a),
      analyse: a,
    });
    assert.equal(avis.montantSuggere, null);
    assert.equal(evaluation, null);
  });

  test('divergence humaine', () => {
    const m = base.montantSuggere!;
    assert.equal(
      decisionDiverge(base, { recommandation: base.recommandation, montantRetenu: m }),
      false,
    );
    assert.equal(
      decisionDiverge(base, { recommandation: 'ACCORD', montantRetenu: m }),
      true,
    );
    assert.equal(
      decisionDiverge(base, { recommandation: base.recommandation, montantRetenu: m - 100 }),
      true,
    );
  });
});

describe('evaluerProposition', () => {
  test('mêmes ratios que la saisie CF 2.5 pour le même montant', () => {
    const a = excelExemple();
    const ev = evaluerProposition({
      analyse: a,
      montant: 2500,
      echeanceMois: 10,
      grilleTaux: TAUX_PAR_TRANCHE,
      garanties: null,
    });
    assert.deepEqual(ev.ratios, facts(a).ratios);
    close(ev.mensualite, 323.76, 0.01);
    assert.equal(ev.tauxMensuel, 0.05);
  });

  test('caution financière recalculée sur le montant évalué', () => {
    const ev = evaluerProposition({
      analyse: excelExemple(),
      montant: 2000,
      echeanceMois: 10,
      grilleTaux: TAUX_PAR_TRANCHE,
      garanties: { horsCaution: 1000, cautionPct: 0.3 },
    });
    assert.equal(ev.valeurGaranties, 1600);
  });
});

describe('Données client pour l’IA', () => {
  function cf1(): Cf1PourIa {
    return {
      eligibilite: {
        age18OuPlus: true,
        proprietaireActivite: true,
        exerceActiviteActuellement: true,
        activiteListeExclusion: false,
        congolaisOuDomiciile: true,
        activiteZoneOperationnelle: true,
        activite6MoisConsecutifs: true,
        activiteEnregistreeLegalement: false,
        clientListeNoire: false,
        garantListeNoire: false,
        codebiteurListeNoire: false,
      },
      business: {
        nomBusiness: 'ETS KABONGO TELECOM',
        adresseBusiness: '12 avenue Kasa-Vubu, Kalamu',
        dureeAdresse: '3 ans',
        typeBusiness: 'Vente de crédit téléphonique',
        dureeTypeBusiness: '5 ans',
        secteurBusiness: 'Commerce',
        formeJuridique: 'Informel',
      },
      pret: {
        butInvestissement: 'Achat de stock',
        commentaireBut: '',
        montantDesire: 7000,
        dureeMois: 12,
        capaciteMensuelle: 400,
        pretAutreInstitution: 'non',
        autreInstitutionNom: '',
        montantPretPrecedent: '',
        dureePretPrecedent: '',
      },
    };
  }

  function analyseNominative() {
    const a = excelExemple();
    a.cf21.membres = [
      { id: 'm1', nom: 'MBUYI TSHALA', age: '9', lienParente: 'Fille', vitAvecDemandeur: 'oui', profession: 'Élève' },
    ];
    a.cf21.references = [{ id: 'r1', nom: 'KAPUMA MUKENDI', relationTelephone: 'Voisin +243 81 234 5678' }];
    a.cf21.revenuConjoint.employeurOuBusiness = 'BRALIMA SARL';
    a.cf21.revenuConjoint.adresse = '45 rue Lumumba';
    a.cf22.business.nomBailleur = 'NGALULA BIBI';
    a.cf23.referencesBusiness = [{ id: 'rb1', nom: 'FOURNISSEUR ILUNGA', relationTelephone: '+243 99 000 1111' }];
    return a;
  }

  test('aucune donnée nominative, sections CF1 et CF2 présentes', () => {
    const ctx = buildContexteClient({ cf1: cf1(), analyse: analyseNominative() });
    assert.ok(ctx?.cf1 && ctx.cf2);
    const json = JSON.stringify(ctx);
    for (const pii of [
      'KABONGO', 'Kasa-Vubu', 'MBUYI', 'KAPUMA', '+243', 'BRALIMA',
      'Lumumba', 'NGALULA', 'ILUNGA',
    ]) {
      assert.ok(!json.includes(pii), `fuite : ${pii}`);
    }
    assert.deepEqual(Object.keys(ctx.cf1).sort(), ['business', 'eligibilite', 'pretSollicite']);
    assert.deepEqual(Object.keys(ctx.cf2).sort(), [
      'cf21_uniteFamiliale',
      'cf22_activiteCommerciale',
      'cf23_saisonnaliteMargesDepenses',
      // cf24_saisies absente : la fixture n'y renseigne que Σ gages, qui vient de la CF5.1.
      'cf25_resume',
    ]);
    const cf21 = ctx.cf2.cf21_uniteFamiliale as Record<string, unknown>;
    assert.equal(cf21.nombreReferences, 1);
    assert.match(json, /Élève/);
    assert.match(json, /"activiteEnregistreeLegalement":false/);
    // La saisie manuelle CF 2.4 de Σ gages n'est plus transmise (la CF5.1 fait foi).
    assert.ok(!json.includes('valeurGaranties'));
  });

  test('ni identifiant technique ni proposition de l’agent', () => {
    const a = analyseNominative();
    a.cf25.montantPropose = '2468';
    a.cf25.mensualite = '987.65';
    const json = JSON.stringify(buildContexteClient({ cf1: cf1(), analyse: a }));
    assert.doesNotMatch(json, /"id"/);
    assert.doesNotMatch(json, /2468|987\.65/);
  });

  test('éligibilité non renseignée : section omise', () => {
    const ctx = buildContexteClient({ cf1: { ...cf1(), eligibilite: null }, analyse: null });
    assert.equal(ctx?.cf1?.eligibilite, undefined);
    assert.equal(ctx?.cf2, null);
  });

  test('famille SALAIRE sans CF1 ni CF2 : null', () => {
    assert.equal(buildContexteClient({ cf1: null, analyse: null }), null);
  });

  test('vueIa : le montant proposé par l’agent n’est pas transmis', () => {
    const a = excelExemple();
    a.cf25.montantPropose = '2468';
    const f = buildDossierFacts({
      produit: { code: 'AGR', label: 'Crédit AGR', famille: 'ACTIVITE' },
      demande: { montant: 7000, devise: 'USD', duree: 12, dureeUnite: 'MOIS' },
      analyse: a,
      checklistIssues: [],
      banking: null,
      contexteClient: buildContexteClient({ cf1: cf1(), analyse: a }),
    });
    assert.equal(f.proposition.montantPropose, 2468);
    const vue = vueIa(f);
    const json = JSON.stringify(vue);
    assert.doesNotMatch(json, /2468/);
    assert.ok(vue.ratiosIndependantsDuMontant.every((r) => r.key === 'rotation'));
    assert.ok(vue.contexteClient?.cf2);
  });
});
