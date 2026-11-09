import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionsDisponibles,
  DEFAULT_PARAMETRES_IMF,
  etapeDeEtat,
  montantEnUsd,
  REGLES_TRANSITION,
  requiertApprobationCa,
  routageApprobationDirection,
  verifierTransition,
} from '../dist/index.js';

const titulaires = (over: Record<string, string | null> = {}) => ({
  userId: 'u1',
  agentId: 'ag',
  analysteId: null,
  conformiteId: null,
  ...over,
});

describe('Machine d’états', () => {
  test('l’agent soumet à l’analyste, plus au RC', () => {
    assert.equal(verifierTransition({ from: 'SCORING', to: 'ANALYSTE', role: 'AGENT' }).ok, true);
    assert.equal(verifierTransition({ from: 'SCORING', to: 'EN_ATTENTE_VALIDATION_RC', role: 'AGENT' }).ok, false);
  });

  test('analyste : retour agent avec motif obligatoire', () => {
    const sans = verifierTransition({ from: 'ANALYSTE', to: 'RETOUR_AGENT', role: 'ANALYSTE', motif: ' ' });
    assert.equal(sans.ok, false);
    const avec = verifierTransition({ from: 'ANALYSTE', to: 'RETOUR_AGENT', role: 'ANALYSTE', motif: 'Pièce manquante' });
    assert.equal(avec.ok, true);
  });

  test('titulaire : un autre analyste ne peut pas agir', () => {
    const r = verifierTransition({
      from: 'ANALYSTE',
      to: 'CONFORMITE',
      role: 'ANALYSTE',
      titulaires: titulaires({ analysteId: 'autre' }),
    });
    assert.equal(r.ok, false);
    const libre = verifierTransition({ from: 'ANALYSTE', to: 'CONFORMITE', role: 'ANALYSTE', titulaires: titulaires() });
    assert.equal(libre.ok, true);
  });

  test('conformité : non conforme → analyste, conforme → RC ; pas de rejet ni de direction', () => {
    assert.equal(verifierTransition({ from: 'CONFORMITE', to: 'RETOUR_ANALYSTE', role: 'CONFORMITE', motif: 'x' }).ok, true);
    assert.equal(verifierTransition({ from: 'CONFORMITE', to: 'EN_ATTENTE_VALIDATION_RC', role: 'CONFORMITE' }).ok, true);
    assert.equal(verifierTransition({ from: 'CONFORMITE', to: 'DIRECTION', role: 'CONFORMITE' }).ok, false);
    assert.equal(verifierTransition({ from: 'CONFORMITE', to: 'REJETE', role: 'CONFORMITE', motif: 'x' }).ok, false);
  });

  test('RC : renvoi vers n’importe quelle étape', () => {
    for (const to of ['RETOUR_AGENT', 'RETOUR_ANALYSTE', 'CONFORMITE', 'REJETE'] as const) {
      assert.equal(
        verifierTransition({ from: 'EN_ATTENTE_VALIDATION_RC', to, role: 'RESPONSABLE_CREDIT', motif: 'm' }).ok,
        true,
        to,
      );
    }
    assert.equal(verifierTransition({ from: 'EN_ATTENTE_VALIDATION_RC', to: 'DIRECTION', role: 'RESPONSABLE_CREDIT' }).ok, true);
  });

  test('DG et DGA ont les mêmes droits ; retour au RC seulement', () => {
    for (const role of ['DG', 'DGA'] as const) {
      assert.equal(verifierTransition({ from: 'DIRECTION', to: 'A_DECAISSER', role }).ok, true);
      assert.equal(verifierTransition({ from: 'DIRECTION', to: 'EN_ATTENTE_VALIDATION_RC', role, motif: 'm' }).ok, true);
      assert.equal(verifierTransition({ from: 'DIRECTION', to: 'RETOUR_ANALYSTE', role, motif: 'm' }).ok, false);
    }
    assert.equal(verifierTransition({ from: 'DIRECTION', to: 'A_DECAISSER', role: 'CA' }).ok, false);
  });

  test('CA : approuve ou rejette', () => {
    assert.equal(verifierTransition({ from: 'CONSEIL', to: 'A_DECAISSER', role: 'CA' }).ok, true);
    assert.equal(verifierTransition({ from: 'CONSEIL', to: 'REJETE', role: 'CA', motif: 'm' }).ok, true);
  });

  test('actions de la direction : une seule approbation proposée', () => {
    const a = actionsDisponibles('DIRECTION', 'DGA').map((r) => r.to);
    assert.deepEqual(a.sort(), ['A_DECAISSER', 'EN_ATTENTE_VALIDATION_RC', 'REJETE']);
  });

  test('les transitions système ne sont pas proposées dans la barre de décision', () => {
    assert.deepEqual(actionsDisponibles('SCORING', 'AGENT'), []);
    assert.ok(REGLES_TRANSITION.every((r) => r.nature !== 'retour' || r.motifRequis));
  });

  test('étapes', () => {
    assert.equal(etapeDeEtat('RETOUR_AGENT'), 'AGENT');
    assert.equal(etapeDeEtat('RETOUR_ANALYSTE'), 'ANALYSE');
    assert.equal(etapeDeEtat('A_DECAISSER'), null);
  });
});

describe('Seuil du Conseil d’administration', () => {
  test('≤ 500 USD : clôture par la direction ; au-delà : Conseil', () => {
    assert.equal(routageApprobationDirection(400, 'USD'), 'A_DECAISSER');
    assert.equal(routageApprobationDirection(500, 'USD'), 'A_DECAISSER');
    assert.equal(routageApprobationDirection(501, 'USD'), 'CONSEIL');
  });

  test('montants en CDF convertis au taux paramétré', () => {
    const p = { ...DEFAULT_PARAMETRES_IMF, tauxChangeCdfUsd: 2800 };
    assert.equal(montantEnUsd(1_400_000, 'CDF', p), 500);
    assert.equal(requiertApprobationCa(1_400_000, p, 'CDF'), false);
    assert.equal(requiertApprobationCa(1_500_000, p, 'CDF'), true);
  });
});
