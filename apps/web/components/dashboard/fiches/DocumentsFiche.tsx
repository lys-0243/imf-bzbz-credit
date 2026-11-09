/** Documents imprimables (route /documents/[id]/[doc]). */
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
