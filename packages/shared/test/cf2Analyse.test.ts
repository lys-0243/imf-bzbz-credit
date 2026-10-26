import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBilan,
  computeCf24Ratios,
  computeCompteResultat,
  computeMensualiteAnnuite,
  montantMaxConseille,
  tauxParTranche,
  type Cf2Analyse,
} from '../dist/index.js';
import { close, excelExemple } from './fixtures.ts';

function ratio(a: Cf2Analyse, key: string) {
  const row = computeCf24Ratios(a).find((r) => r.key === key);
  assert.ok(row, `ratio ${key} absent`);
  return row;
}

describe('CF2 — parité avec Analyse_AGR.xlsx', () => {
  test('mensualité annuité (CF 2.5 L38)', () => {
    close(computeMensualiteAnnuite(2500, 10, 0.05), 323.76143741364172);
  });

  test('compte de résultat (CF 2.5 F7:F14)', () => {
    const cr = computeCompteResultat(excelExemple());
    assert.equal(cr.chiffreAffairesSource, 'recents');
    close(cr.chiffreAffaires, 8151);
    close(cr.margeTousProduits, 0.12149532710280386);
    close(cr.cmv, 7160.6915887850455);
    close(cr.profitBrut, 990.3084112149545);
    close(cr.profitNetExploitation, 740.3084112149545);
    close(cr.autresRevenus, 350);
    close(cr.depensesPrivees, 280);
    close(cr.capacitePaiement, 810.3084112149545);
  });

  test('bilan (CF 2.5 E16:F32)', () => {
    const b = computeBilan(excelExemple());
    close(b.caisse, 590);
    close(b.stock, 3364.18);
    close(b.actifsCirculants, 5454.18);
    close(b.actifsImmobilises, 2200);
    close(b.totalActifs, 7654.18);
    close(b.capitalPropre, 7654.18);
  });

  test('ratios identiques à l’Excel sans dettes existantes (CF 2.4)', () => {
    const a = excelExemple();
    close(ratio(a, 'dsr').value, 0.39955334651926243);
    assert.equal(ratio(a, 'dsr').ok, true);
    close(ratio(a, 'liquidite').value, 5.6154309621414971);
    close(ratio(a, 'levier').value, 0.45836404372426282);
    close(ratio(a, 'rotation').value, 1.312881420999132);
    close(ratio(a, 'endettement').value, 0.32661891933557874);
  });
});

describe('CF 2.4 — ratios corrigés selon leurs libellés', () => {
  test('garantie = gages / (principal + intérêts)', () => {
    const r = ratio(excelExemple(), 'garantie');
    close(r.denominateur, 3237.6143741364172); // CF 2.5 P39
    close(r.value, 750 / 3237.6143741364172);
    assert.equal(r.ok, false);
  });

  test('liquidité et endettement intègrent les dettes existantes', () => {
    const a = excelExemple();
    a.cf25.dettesCourtTerme = '1000';
    a.cf25.dettesLongTerme = '2000';
    const mensualite = 323.76143741364172;
    const capital = 7654.18 - 3000;

    const liq = ratio(a, 'liquidite');
    close(liq.denominateur, 1000 + 3 * mensualite);
    close(liq.value, 5454.18 / (1000 + 3 * mensualite));

    const end = ratio(a, 'endettement');
    close(end.numerateur, 3000 + 2500);
    close(end.value, 5500 / capital);
    assert.equal(end.ok, false); // 1,18 > 0,5
  });
});

describe('Proposition de prêt', () => {
  test('montant max conseillé : DSR 40 % ≈ montant retenu par l’AC (2 500)', () => {
    const max = montantMaxConseille(810.3084112149545, 10, 0.05);
    assert.ok(max != null && max >= 2500 && max < 2510, `reçu ${max}`);
    close(computeMensualiteAnnuite(max, 10, 0.05), 0.4 * 810.3084112149545);
  });

  test('montant max : null si capacité nulle ou négative', () => {
    assert.equal(montantMaxConseille(0, 10, 0.05), null);
    assert.equal(montantMaxConseille(-100, 10, 0.05), null);
  });

  test('taux par tranche (CF 2.5 S26:T30)', () => {
    assert.equal(tauxParTranche(300), 0.06);
    assert.equal(tauxParTranche(2500), 0.05);
    assert.equal(tauxParTranche(7000), 0.045);
    assert.equal(tauxParTranche(20000), 0.035);
    assert.equal(tauxParTranche(80000), null);
  });
});
