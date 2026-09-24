/** Aligné sur CREDIT_TYPES (évite import circulaire avec index). */
export type CreditTypeRef = 'SALAIRE' | 'INDIVIDUEL' | 'DARE_DARE';

export type ChecklistStage = 'AGENT' | 'LATER';
export type ChecklistCategory =
  | 'DOSSIER'
  | 'CLIENT'
  | 'GARANT'
  | 'CONTROLES';
export type ChecklistInput = 'upload' | 'check' | 'boolean' | 'text';

export type ChecklistWhen = {
  creditTypes?: CreditTypeRef[];
  etatCivilMarie?: boolean;
  societe?: boolean;
  dat?: boolean;
  hypotheque?: boolean;
  hasGarant?: boolean;
};

export type ChecklistItemDef = {
  id: string;
  label: string;
  category: ChecklistCategory;
  stage: ChecklistStage;
  input: ChecklistInput;
  /** Piece.kind when input is upload */
  kind?: string;
  required?: boolean;
  when?: ChecklistWhen;
};

/** Flags saisis par l’agent qui pilotent les items conditionnels. */
export type ChecklistFlags = {
  dat?: boolean;
  hypotheque?: boolean;
  hasGarant?: boolean;
};

export type ChecklistAnswers = {
  flags?: ChecklistFlags;
  /** itemId → check done / boolean answer / text note */
  values?: Record<
    string,
    {
      checked?: boolean;
      booleanValue?: boolean | null;
      note?: string;
      text?: string;
    }
  >;
};

const SOCIETE_KEYWORDS = [
  'sarl',
  'sa',
  'sas',
  'sprl',
  'societe',
  'société',
  'ets',
  'etablissement',
  'établissement',
];

export function isSocieteForme(formeJuridique?: string | null): boolean {
  if (!formeJuridique) return false;
  const n = formeJuridique.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return SOCIETE_KEYWORDS.some((k) => n.includes(k.normalize('NFD').replace(/\p{M}/gu, '')));
}

export function extractChecklistContext(
  type: CreditTypeRef,
  payload: Record<string, any>,
  flags: ChecklistFlags = {},
): {
  type: CreditTypeRef;
  etatCivilMarie: boolean;
  societe: boolean;
  dat: boolean;
  hypotheque: boolean;
  hasGarant: boolean;
} {
  const etatCivil =
    type === 'SALAIRE'
      ? undefined
      : (payload?.demandeur?.etatCivil as string | undefined);
  const forme =
    type === 'SALAIRE'
      ? undefined
      : (payload?.business?.formeJuridique as string | undefined);

  return {
    type,
    etatCivilMarie: etatCivil === 'Marie',
    societe: isSocieteForme(forme),
    dat: Boolean(flags.dat),
    hypotheque: Boolean(flags.hypotheque),
    hasGarant: flags.hasGarant !== false, // défaut: section garant affichée
  };
}

function matchesWhen(
  when: ChecklistWhen | undefined,
  ctx: ReturnType<typeof extractChecklistContext>,
): boolean {
  if (!when) return true;
  if (when.creditTypes && !when.creditTypes.includes(ctx.type)) return false;
  if (when.etatCivilMarie === true && !ctx.etatCivilMarie) return false;
  if (when.societe === true && !ctx.societe) return false;
  if (when.dat === true && !ctx.dat) return false;
  if (when.hypotheque === true && !ctx.hypotheque) return false;
  if (when.hasGarant === true && !ctx.hasGarant) return false;
  return true;
}

export const AGENT_CHECKLIST_CATALOG: ChecklistItemDef[] = [
  // —— DOSSIER (AGENT) ——
  {
    id: 'piece_identite',
    label: "Pièce d'identité visible et valide",
    category: 'DOSSIER',
    stage: 'AGENT',
    input: 'upload',
    kind: 'piece_identite',
    required: true,
  },
  {
    id: 'acte_engagement_agent',
    label: "Acte d'engagement de l'agent de crédit",
    category: 'DOSSIER',
    stage: 'AGENT',
    input: 'upload',
    kind: 'acte_engagement_agent',
    required: true,
  },
  {
    id: 'demande_lettre_signees',
    label: 'Demande de crédit signée + Lettre du client signée',
    category: 'DOSSIER',
    stage: 'AGENT',
    input: 'upload',
    kind: 'demande_lettre_signees',
    required: true,
  },
  {
    id: 'resume_executif',
    label: "Résumé exécutif de l'agent de crédit",
    category: 'DOSSIER',
    stage: 'AGENT',
    input: 'text',
    required: true,
  },
  {
    id: 'resume_executif_pdf',
    label: 'Résumé exécutif (PDF / scan, optionnel)',
    category: 'DOSSIER',
    stage: 'AGENT',
    input: 'upload',
    kind: 'resume_executif_pdf',
    required: false,
  },

  // —— CLIENT ——
  {
    id: 'releve_compte_3mois',
    label: 'Relevé de compte client de 3 mois (du jour de la signature)',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'releve_compte_3mois',
    required: true,
  },
  {
    id: 'releve_concurrents',
    label: 'Relevé de compte auprès des concurrents',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'releve_concurrents',
    required: false,
  },
  {
    id: 'contrat_travail',
    label: 'Contrat de travail',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'contrat_travail',
    required: true,
    when: { creditTypes: ['SALAIRE'] },
  },
  {
    id: 'fiches_salaire_3',
    label: '3 dernières fiches de salaire',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'fiches_salaire_3',
    required: true,
    when: { creditTypes: ['SALAIRE'] },
  },
  {
    id: 'contrat_dat',
    label: 'Contrat du DAT',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'contrat_dat',
    required: true,
    when: { dat: true },
  },
  {
    id: 'dat_reconduction',
    label: 'Signature de reconduction DAT (si fin avant fin du crédit)',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'dat_reconduction',
    required: false,
    when: { dat: true },
  },
  {
    id: 'acte_hypotheque',
    label: "Acte de consentement d'hypothèque",
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'acte_hypotheque',
    required: true,
    when: { hypotheque: true },
  },
  {
    id: 'pv_expertise_hypotheque',
    label: "PV d'expertise d'hypothèque",
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'pv_expertise_hypotheque',
    required: true,
    when: { hypotheque: true },
  },
  {
    id: 'acte_mariage',
    label: 'Acte de mariage civil',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'acte_mariage',
    required: true,
    when: { etatCivilMarie: true },
  },
  {
    id: 'lettre_demande_societe',
    label: 'Lettre de demande de prêt par la société',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'lettre_demande_societe',
    required: true,
    when: { societe: true },
  },
  {
    id: 'statut_notarie',
    label: 'Statut notarié à jour',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'statut_notarie',
    required: true,
    when: { societe: true },
  },
  {
    id: 'rccm_societe',
    label: 'RCCM (société)',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'rccm_societe',
    required: true,
    when: { societe: true },
  },
  {
    id: 'id_nat_societe',
    label: 'ID NAT (société)',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'id_nat_societe',
    required: true,
    when: { societe: true },
  },
  {
    id: 'nif_societe',
    label: 'N.I.F (société)',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'nif_societe',
    required: true,
    when: { societe: true },
  },
  {
    id: 'doc_rccm',
    label: 'Document commercial — RCCM',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'doc_rccm',
    required: true,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },
  {
    id: 'doc_patente',
    label: 'Document commercial — Patente',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'doc_patente',
    required: true,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },
  {
    id: 'doc_id_nat',
    label: 'Document commercial — ID NAT',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'doc_id_nat',
    required: true,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },
  {
    id: 'doc_ao',
    label: 'Document commercial — AO',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'doc_ao',
    required: false,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },
  {
    id: 'doc_autorisation_exploitation',
    label: "Autorisation d'exploitation",
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'doc_autorisation_exploitation',
    required: false,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },
  {
    id: 'contrat_bail_business',
    label: 'Contrat de bail (business)',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'contrat_bail_business',
    required: true,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },
  {
    id: 'contrat_bail_domicile',
    label: 'Contrat de bail (domicile)',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'contrat_bail_domicile',
    required: false,
  },
  {
    id: 'photo_business',
    label: 'Photo du business',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'photo_business',
    required: true,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },
  {
    id: 'photo_garanties',
    label: 'Photo de garanties',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'photo_garanties',
    required: true,
  },
  {
    id: 'factures_marchandises',
    label: 'Factures achat marchandises',
    category: 'CLIENT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'factures_marchandises',
    required: false,
    when: { creditTypes: ['INDIVIDUEL', 'DARE_DARE'] },
  },

  // —— GARANT ——
  {
    id: 'garant_piece_identite',
    label: "Garant — Pièce d'identité visible et valide",
    category: 'GARANT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'garant_piece_identite',
    required: true,
    when: { hasGarant: true },
  },
  {
    id: 'garant_docs_commerciaux',
    label: 'Garant — Documents commerciaux (ID.NAT, RCCM, AO, patente)',
    category: 'GARANT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'garant_docs_commerciaux',
    required: false,
    when: { hasGarant: true },
  },
  {
    id: 'garant_lettre_cautionnement',
    label: 'Garant — Lettre de cautionnement légalisée',
    category: 'GARANT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'garant_lettre_cautionnement',
    required: true,
    when: { hasGarant: true },
  },
  {
    id: 'garant_releve_compte',
    label: 'Garant — Relevé de compte récent',
    category: 'GARANT',
    stage: 'AGENT',
    input: 'upload',
    kind: 'garant_releve_compte',
    required: true,
    when: { hasGarant: true },
  },

  // —— CONTRÔLES ——
  {
    id: 'liste_noire_client',
    label: 'Le client est-il sur la liste noire ?',
    category: 'CONTROLES',
    stage: 'AGENT',
    input: 'boolean',
    required: true,
  },
  {
    id: 'liste_noire_garant',
    label: 'Le garant est-il sur la liste noire ?',
    category: 'CONTROLES',
    stage: 'AGENT',
    input: 'boolean',
    required: true,
    when: { hasGarant: true },
  },
  {
    id: 'liste_noire_codebiteur',
    label: 'Le codebiteur est-il sur la liste noire ?',
    category: 'CONTROLES',
    stage: 'AGENT',
    input: 'boolean',
    required: true,
  },

  // —— LATER (catalogue, non exigés à la soumission agent) ——
  {
    id: 'contrats_a_signer',
    label: 'Contrat de crédit, de cautionnement et de FAFE à signer par le client',
    category: 'DOSSIER',
    stage: 'LATER',
    input: 'upload',
    kind: 'contrats_a_signer',
  },
  {
    id: 'fiche_analyse',
    label: "Fiche d'analyse",
    category: 'DOSSIER',
    stage: 'LATER',
    input: 'upload',
    kind: 'fiche_analyse',
  },
  {
    id: 'fiche_credit',
    label: 'Fiche de crédit',
    category: 'DOSSIER',
    stage: 'LATER',
    input: 'upload',
    kind: 'fiche_credit',
  },
  {
    id: 'pv_comite_credit',
    label: 'Feuille de signature 1 — PV du comité de crédit',
    category: 'DOSSIER',
    stage: 'LATER',
    input: 'upload',
    kind: 'pv_comite_credit',
  },
  {
    id: 'memo_approbation',
    label: "Feuille de signature 2 — Mémo d'approbation de crédit",
    category: 'DOSSIER',
    stage: 'LATER',
    input: 'upload',
    kind: 'memo_approbation',
  },
];

export function getApplicableChecklistItems(
  type: CreditTypeRef,
  payload: Record<string, any>,
  flags: ChecklistFlags = {},
  stage: ChecklistStage | 'ALL' = 'AGENT',
): ChecklistItemDef[] {
  const ctx = extractChecklistContext(type, payload, flags);
  return AGENT_CHECKLIST_CATALOG.filter((item) => {
    if (stage !== 'ALL' && item.stage !== stage) return false;
    return matchesWhen(item.when, ctx);
  });
}

export type ChecklistValidationIssue = {
  itemId: string;
  label: string;
  reason: string;
};

export function validateAgentChecklist(
  type: CreditTypeRef,
  payload: Record<string, any>,
  answers: ChecklistAnswers,
  uploadedKinds: Set<string>,
  rapportTexte?: string | null,
): ChecklistValidationIssue[] {
  const flags = answers.flags ?? {};
  const items = getApplicableChecklistItems(type, payload, flags, 'AGENT');
  const issues: ChecklistValidationIssue[] = [];

  for (const item of items) {
    if (!item.required) continue;
    const val = answers.values?.[item.id];

    if (item.input === 'upload') {
      const kind = item.kind ?? item.id;
      if (!uploadedKinds.has(kind)) {
        const avis = (val?.note ?? '').trim();
        if (avis) continue;
        issues.push({
          itemId: item.id,
          label: item.label,
          reason: 'Pièce manquante',
        });
      }
    } else if (item.input === 'boolean') {
      if (val?.booleanValue === undefined || val?.booleanValue === null) {
        issues.push({
          itemId: item.id,
          label: item.label,
          reason: 'Réponse obligatoire (oui/non)',
        });
      }
    } else if (item.input === 'check') {
      if (!val?.checked) {
        issues.push({
          itemId: item.id,
          label: item.label,
          reason: 'Non coché',
        });
      }
    } else if (item.input === 'text') {
      const text =
        item.id === 'resume_executif'
          ? (rapportTexte ?? val?.text ?? '').trim()
          : (val?.text ?? '').trim();
      if (!text) {
        issues.push({
          itemId: item.id,
          label: item.label,
          reason: 'Texte obligatoire',
        });
      }
    }
  }

  return issues;
}

export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  DOSSIER: 'Dossier',
  CLIENT: 'Documents client',
  GARANT: 'Éléments du garant / caution',
  CONTROLES: 'Contrôles liste noire',
};
