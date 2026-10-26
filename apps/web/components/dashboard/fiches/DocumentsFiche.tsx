'use client';

import { conditionsPret, type DossierContexte } from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import { FormBlock, FormRow, formatMoney } from '../FormKit';

export const DOCUMENTS_IMPRIMABLES = [
  { key: 'lettre', label: 'Lettre d’octroi', feuille: 'LETTRE', apresDecision: true },
  { key: 'contrat', label: 'Contrat de prêt (+ plan de remboursement)', feuille: 'CONTRAT', apresDecision: true },
  { key: 'gage', label: 'Contrat de gage', feuille: 'GAGE', apresDecision: true },
  { key: 'caution', label: 'Contrat de cautionnement', feuille: 'CAUTION', apresDecision: true },
  { key: 'transfert', label: 'Document de transfert', feuille: 'TRANSFERT', apresDecision: true },
  { key: 'pv-comite', label: 'PV du comité de crédit', feuille: 'Décision du comité', apresDecision: false },
  { key: 'memo-pca', label: 'Mémo d’approbation PCA', feuille: 'APPRO PCA', apresDecision: false },
  { key: 'formulaire-analyse', label: 'Formulaire d’analyse', feuille: 'Formulaire d’analyse', apresDecision: false },
  { key: 'cf6-1', label: 'CF6.1 — Décision de prêt', feuille: 'CF6.1', apresDecision: false },
] as const;
export type DocumentKey = (typeof DOCUMENTS_IMPRIMABLES)[number]['key'];

export function DocumentsFiche({ ctx }: { ctx: DossierContexte }) {
  const conditions = conditionsPret(ctx);
  const approuve = conditions.source === 'DECISION_COMITE' || conditions.source === 'APPRO_PCA';
  const devise = String(ctx.payload.devise || 'USD');
  return (
    <>
      <FormBlock title="Conditions retenues">
        <FormRow label="Source">
          {approuve
            ? conditions.source === 'APPRO_PCA'
              ? 'Mémo d’approbation PCA'
              : 'PV du comité de crédit'
            : 'Non encore approuvé (proposition ou demande)'}
        </FormRow>
        <FormRow label="Montant / durée">
          {conditions.montant != null ? formatMoney(conditions.montant, devise) : '—'} — {conditions.dureeMois ?? '—'} mois
        </FormRow>
      </FormBlock>
      <div className={styles.detailTableBlock}>
        <h3 className={styles.detailTableTitle}>Documents</h3>
        <ul className={styles.pronosticList}>
          {DOCUMENTS_IMPRIMABLES.map((doc) => {
            const actif = !doc.apresDecision || (approuve && ['A_DECAISSER', 'CONSEIL', 'DIRECTION'].includes(ctx.etat));
            return (
              <li key={doc.key}>
                {actif ? (
                  <a href={`/documents/${ctx.id}/${doc.key}`} target="_blank" rel="noopener noreferrer">
                    {doc.label}
                  </a>
                ) : (
                  <span className={styles.assignMeta}>{doc.label} — disponible après approbation</span>
                )}{' '}
                <span className={styles.assignMeta}>(feuille « {doc.feuille} »)</span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
