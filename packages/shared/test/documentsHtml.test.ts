import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARAMETRES_IMF,
  genererDocumentHtml,
  normalizeFormulaires,
  peutEditerDocument,
  type DossierContexte,
} from '../dist/index.js';
import { excelExemple } from './fixtures.ts';

function contexte(nomGarant = 'MPETEMBA MOSHA BENOIT'): DossierContexte {
  const formulaires = normalizeFormulaires({
    CF4: { identite: { nomComplet: nomGarant, adresseDomicile: 'AV. TELECOM 87' } },
  });
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
      pret: { dureeMois: 12 },
    },
    client: { fullName: 'FRANCIS KAPUMA MUKENDI' },
    agent: { displayName: 'REBECCA MWAKANA' },
    analyse: excelExemple(),
    formulaires,
    parametres: DEFAULT_PARAMETRES_IMF,
    nouveauClient: true,
  };
}

const sansEspaces = (s: string) => s.replace(/[\s  ]/g, '');

describe('Documents éditables — HTML généré', () => {
  test('Lettre : montant accordé et liste d’exclusion', () => {
    const html = genererDocumentHtml('LETTRE', contexte());
    assert.match(sansEspaces(html), /2500,00USD/);
    assert.match(html, /KAPUMA MUKENDI FRANCIS/);
    assert.match(html, /Liste des activités non financées/);
    assert.ok((html.match(/<li>/g) ?? []).length >= 15);
  });

  test('Contrat : 18 articles et plan de remboursement de 10 lignes', () => {
    const html = genererDocumentHtml('CONTRAT', contexte());
    const articles = html.match(/<h2>Article \d+ :/g) ?? [];
    assert.equal(articles.length, 18);
    assert.match(html, /Annexe 1 — Plan de remboursement/);
    const plan = html.split('Annexe 1')[1].split('</table>')[0];
    const lignes = plan.match(/<tr>/g) ?? [];
    assert.equal(lignes.length, 12); // en-tête + 10 échéances + total
    assert.match(html, /<td><p>10<\/p><\/td>/);
  });

  test('Gage : la caution financière figure en annexe', () => {
    const html = genererDocumentHtml('GAGE', contexte());
    assert.match(html, /CAUTION FINANCIERE/);
    assert.match(sansEspaces(html), /750,00USD/);
  });

  test('Caution : le garant CF4 est partie au contrat', () => {
    const html = genererDocumentHtml('CAUTION', contexte());
    assert.match(html, /MPETEMBA MOSHA BENOIT/);
    assert.match(html, /« la Caution »/);
  });

  test('valeurs dynamiques échappées', () => {
    const html = genererDocumentHtml('CAUTION', contexte('<script>alert(1)</script>'));
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });
});

describe('Droits d’édition des documents', () => {
  test('RC, DG et admin de la Direction au décaissement', () => {
    assert.equal(peutEditerDocument('RESPONSABLE_CREDIT', 'DIRECTION'), true);
    assert.equal(peutEditerDocument('DG', 'CONSEIL'), true);
    assert.equal(peutEditerDocument('ADMIN', 'A_DECAISSER'), true);
    assert.equal(peutEditerDocument('AGENT', 'DIRECTION'), false);
    assert.equal(peutEditerDocument('CONFORMITE', 'DIRECTION'), false);
    assert.equal(peutEditerDocument('DG', 'REJETE'), false);
    assert.equal(peutEditerDocument('RESPONSABLE_CREDIT', 'EN_ATTENTE_VALIDATION_RC'), false);
  });
});
