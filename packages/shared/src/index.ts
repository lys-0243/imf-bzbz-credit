import { z } from 'zod';

export const DUREE_UNITES = ['MOIS', 'SEMAINES'] as const;
export type DureeUnite = (typeof DUREE_UNITES)[number];

export const FAMILLES_PRODUIT = ['SALAIRE', 'ACTIVITE'] as const;
export type FamilleProduit = (typeof FAMILLES_PRODUIT)[number];

/** Produit crédit tel que renvoyé par l’API (admin / réception). */
export type ProduitCreditDto = {
  id: string;
  code: string;
  label: string;
  montantMin: number;
  montantMax: number;
  dureeMin: number;
  dureeMax: number;
  dureeUnite: DureeUnite;
  refPrefix: string;
  famille: FamilleProduit;
  actif: boolean;
  sortOrder: number;
};

export const ROLES = [
  'RECEPTION',
  'AGENT',
  'ANALYSTE',
  'CONFORMITE',
  'DG',
  'CA',
  'ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

export const MOBILE_ROLES = ['RECEPTION', 'AGENT'] as const;
export type MobileRole = (typeof MOBILE_ROLES)[number];

export const DOSSIER_ETATS = [
  'ENREGISTRE',
  'AFFECTE',
  'DESCENTE',
  'RAPPORT_AGENT',
  'SCORING',
  'ANALYSTE',
  'RETOUR_AGENT',
  'CONFORMITE',
  'RETOUR_ANALYSTE',
  'DIRECTION',
  'CONSEIL',
  'A_DECAISSER',
  'REJETE',
] as const;
export type DossierEtat = (typeof DOSSIER_ETATS)[number];

export const KINSHASA_ZONES = [
  { code: 'ZONE_A', name: 'Zone A' },
  { code: 'ZONE_B', name: 'Zone B' },
  { code: 'ZONE_C', name: 'Zone C' },
  { code: 'ZONE_D', name: 'Zone D' },
  { code: 'ZONE_E', name: 'Zone E' },
] as const;

export const KINSHASA_ZONE_CODES = KINSHASA_ZONES.map((z) => z.code);
export type ZoneCode = (typeof KINSHASA_ZONE_CODES)[number];

/** 24 communes officielles de Kinshasa, réparties sur zones A–E (ajustable plus tard). */
export const KINSHASA_COMMUNES: ReadonlyArray<{
  code: string;
  name: string;
  zoneCode: ZoneCode;
}> = [
  { code: 'GOMBE', name: 'Gombe', zoneCode: 'ZONE_A' },
  { code: 'BARUMBU', name: 'Barumbu', zoneCode: 'ZONE_A' },
  { code: 'KINSHASA', name: 'Kinshasa', zoneCode: 'ZONE_A' },
  { code: 'LINGWALA', name: 'Lingwala', zoneCode: 'ZONE_A' },
  { code: 'KINTAMBO', name: 'Kintambo', zoneCode: 'ZONE_A' },
  { code: 'NGALIEMA', name: 'Ngaliema', zoneCode: 'ZONE_B' },
  { code: 'MONT_NGAFULA', name: 'Mont-Ngafula', zoneCode: 'ZONE_B' },
  { code: 'SELEMBAO', name: 'Selembao', zoneCode: 'ZONE_B' },
  { code: 'BANDALUNGWA', name: 'Bandalungwa', zoneCode: 'ZONE_B' },
  { code: 'NGIRI_NGIRI', name: 'Ngiri-Ngiri', zoneCode: 'ZONE_B' },
  { code: 'KALAMU', name: 'Kalamu', zoneCode: 'ZONE_C' },
  { code: 'KASA_VUBU', name: 'Kasa-Vubu', zoneCode: 'ZONE_C' },
  { code: 'BUMBU', name: 'Bumbu', zoneCode: 'ZONE_C' },
  { code: 'MAKALA', name: 'Makala', zoneCode: 'ZONE_C' },
  { code: 'NGABA', name: 'Ngaba', zoneCode: 'ZONE_C' },
  { code: 'LIMETE', name: 'Limete', zoneCode: 'ZONE_D' },
  { code: 'MATETE', name: 'Matete', zoneCode: 'ZONE_D' },
  { code: 'LEMBA', name: 'Lemba', zoneCode: 'ZONE_D' },
  { code: 'KISENSO', name: 'Kisenso', zoneCode: 'ZONE_D' },
  { code: 'NDJILI', name: 'Ndjili', zoneCode: 'ZONE_D' },
  { code: 'MASINA', name: 'Masina', zoneCode: 'ZONE_E' },
  { code: 'KIMBANSEKE', name: 'Kimbanseke', zoneCode: 'ZONE_E' },
  { code: 'NSELE', name: 'Nsele', zoneCode: 'ZONE_E' },
  { code: 'MALUKU', name: 'Maluku', zoneCode: 'ZONE_E' },
];

export const SEXES = ['Masculin', 'Feminin'] as const;
export const TYPES_PIECE = [
  'Carte Electeur',
  'Passeport',
  'Permis de conduire',
] as const;
export const ETATS_CIVILS = [
  'Celibataire',
  'Marie',
  'Divorce',
  'Veuf',
] as const;
export const PRET_AUTRE_INSTITUTION = [
  'Non',
  "Oui j'avais",
  "Oui j'ai",
] as const;
export const CLIENT_STATUTS = ['NOUVEAU', 'ANCIEN'] as const;
export const DEVISES = ['USD', 'CDF'] as const;
export type Devise = (typeof DEVISES)[number];

/** Payload minimal réception — commun à tous les produits. */
export const receptionPayloadSchema = z.object({
  communeId: z.string().min(1),
  prenom: z.string().min(1),
  nom: z.string().min(1),
  postNom: z.string().min(1),
  sexe: z.enum(SEXES),
  telephone: z.string().min(1),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  adresseDomicile: z.string().min(1),
  devise: z.enum(DEVISES),
  montantSollicite: z.number().positive(),
  duree: z.number().int().positive(),
  motifCredit: z.string().optional(),
});

export type ReceptionPayload = z.infer<typeof receptionPayloadSchema>;

export type ProduitBornes = {
  montantMin: number;
  montantMax: number;
  dureeMin: number;
  dureeMax: number;
  dureeUnite: DureeUnite;
};

export function parseReceptionPayload(payload: unknown): ReceptionPayload {
  return receptionPayloadSchema.parse(payload);
}

/** Valide le payload réception et les bornes du produit. */
export function parseReceptionPayloadAgainstProduit(
  payload: unknown,
  produit: ProduitBornes,
): ReceptionPayload {
  const data = receptionPayloadSchema.parse(payload);
  if (
    data.montantSollicite < produit.montantMin ||
    data.montantSollicite > produit.montantMax
  ) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: `Montant hors bornes (${produit.montantMin} – ${produit.montantMax})`,
        path: ['montantSollicite'],
      },
    ]);
  }
  if (data.duree < produit.dureeMin || data.duree > produit.dureeMax) {
    const u = produit.dureeUnite === 'SEMAINES' ? 'semaines' : 'mois';
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: `Durée hors bornes (${produit.dureeMin} – ${produit.dureeMax} ${u})`,
        path: ['duree'],
      },
    ]);
  }
  return data;
}

export function clientFieldsFromPayload(payload: Record<string, any>): {
  fullName: string;
  phone: string;
  activityAddress: string;
  communeId: string;
} {
  // Nouveau format réception
  if (payload?.prenom && payload?.telephone && !payload?.demandeur) {
    return {
      fullName: `${payload.prenom} ${payload.nom} ${payload.postNom}`.trim(),
      phone: payload.telephone,
      activityAddress: payload.adresseDomicile || '',
      communeId: payload.communeId,
    };
  }
  // Legacy salaire
  if (payload?.prenom && payload?.telephone && payload?.societe != null) {
    return {
      fullName: `${payload.prenom} ${payload.nom} ${payload.postNom}`.trim(),
      phone: payload.telephone,
      activityAddress: payload.adresseSociete || payload.adresseDomicile || '',
      communeId: payload.communeId,
    };
  }
  // Legacy individuel / dare-dare
  if (payload?.demandeur) {
    return {
      fullName:
        `${payload.demandeur.prenom} ${payload.demandeur.nom} ${payload.demandeur.postNom}`.trim(),
      phone: payload.demandeur.telephone,
      activityAddress:
        payload.business?.adresseBusiness ||
        payload.demandeur.adresseDomicile ||
        '',
      communeId: payload.communeId,
    };
  }
  return {
    fullName: `${payload.prenom || ''} ${payload.nom || ''} ${payload.postNom || ''}`.trim(),
    phone: payload.telephone || '',
    activityAddress: payload.adresseDomicile || '',
    communeId: payload.communeId || '',
  };
}

/** Montant demandé — nouveau format + fallbacks legacy. */
export function montantSouhaiteFromPayload(
  payload: Record<string, any> | null | undefined,
): { montantSouhaite: number | null; devise: Devise | null } {
  const p = payload ?? {};
  const asDevise = (v: unknown): Devise | null =>
    typeof v === 'string' && (DEVISES as readonly string[]).includes(v)
      ? (v as Devise)
      : null;

  if (typeof p.montantSollicite === 'number') {
    return {
      montantSouhaite: p.montantSollicite,
      devise: asDevise(p.devise),
    };
  }
  const pret = p.pret ?? {};
  return {
    montantSouhaite:
      typeof pret.montantDesire === 'number' ? pret.montantDesire : null,
    devise: asDevise(pret.devise ?? p.devise),
  };
}

export function dureeFromPayload(
  payload: Record<string, any> | null | undefined,
): number | null {
  const p = payload ?? {};
  if (typeof p.duree === 'number') return p.duree;
  if (typeof p.dureeMois === 'number') return p.dureeMois;
  if (typeof p.pret?.dureeMois === 'number') return p.pret.dureeMois;
  return null;
}

export function formatMontantSouhaite(
  montant: number | null | undefined,
  devise: string | null | undefined,
): string {
  if (montant == null || Number.isNaN(montant)) return '—';
  const n = montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return devise ? `${devise} ${n}` : n;
}

export function formatDureeLabel(
  duree: number | null | undefined,
  unite: DureeUnite | string | null | undefined,
): string {
  if (duree == null || Number.isNaN(duree)) return '—';
  const u = unite === 'SEMAINES' ? (duree > 1 ? 'semaines' : 'semaine') : duree > 1 ? 'mois' : 'mois';
  return `${duree} ${u}`;
}

export function formatProduitBornesHint(p: ProduitBornes): string {
  const montant = `${p.montantMin.toLocaleString('fr-FR')} – ${p.montantMax.toLocaleString('fr-FR')} US$`;
  const u = p.dureeUnite === 'SEMAINES' ? 'sem.' : 'mois';
  const d =
    p.dureeMin === p.dureeMax
      ? `${p.dureeMin} ${u}`
      : `${p.dureeMin}–${p.dureeMax} ${u}`;
  return `${montant} · ${d}`;
}

export const DOSSIER_ETAT_LABELS: Record<DossierEtat, string> = {
  ENREGISTRE: 'Enregistré',
  AFFECTE: 'Affecté à un agent',
  DESCENTE: 'Descente terrain',
  RAPPORT_AGENT: 'Rapport agent',
  SCORING: 'Scoring',
  ANALYSTE: 'Analyste crédit',
  RETOUR_AGENT: 'Retour agent',
  CONFORMITE: 'Conformité',
  RETOUR_ANALYSTE: 'Retour analyste',
  DIRECTION: 'Direction générale',
  CONSEIL: "Conseil d'administration",
  A_DECAISSER: 'À décaisser',
  REJETE: 'Rejeté',
};

export const FAMILLE_PRODUIT_LABELS: Record<FamilleProduit, string> = {
  SALAIRE: 'Salaire',
  ACTIVITE: 'Activité',
};

export * from './agentChecklist';
