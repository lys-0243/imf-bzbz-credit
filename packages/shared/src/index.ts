import { z } from 'zod';

export const CREDIT_TYPES = ['SALAIRE', 'INDIVIDUEL', 'DARE_DARE'] as const;
export type CreditType = (typeof CREDIT_TYPES)[number];

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

const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)');

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

const eligibilitySchema = z.object({
  age18OuPlus: z.boolean().default(true),
  proprietaireActivite: z.boolean().default(true),
  exerceActiviteActuellement: z.boolean().default(true),
  activiteListeExclusion: z.boolean().default(false),
  congolaisOuDomiciile: z.boolean().default(true),
  activiteZoneOperationnelle: z.boolean().default(true),
  activite6MoisConsecutifs: z.boolean().default(true),
  activiteEnregistreeLegalement: z.boolean().default(true),
});

const demandeurBaseSchema = z.object({
  prenom: z.string().min(1),
  nom: z.string().min(1),
  postNom: z.string().min(1),
  dateNaissance: dateIso,
  sexe: z.enum(SEXES),
  typePiece: z.enum(TYPES_PIECE),
  numeroPiece: z.string().min(1),
  etatCivil: z.enum(ETATS_CIVILS),
  conjointNom: z.string().optional(),
  conjointDateNaissance: z.union([dateIso, z.literal('')]).optional(),
  adresseDomicile: z.string().min(1),
  telephone: z.string().min(1),
  email: z.union([z.string().email(), z.literal('')]).optional(),
});

const businessSchema = z.object({
  nomBusiness: z.string().min(1),
  adresseBusiness: z.string().min(1),
  dureeAdresse: z.string().min(1),
  typeBusiness: z.string().min(1),
  dureeTypeBusiness: z.string().min(1),
  secteurBusiness: z.string().min(1),
  formeJuridique: z.string().min(1),
});

const pretIndividuelSchema = z.object({
  devise: z.enum(DEVISES),
  montantDesire: z.number().positive(),
  dureeMois: z.number().int().positive(),
  montantPretPrecedent: z.number().nonnegative().optional(),
  dureePretPrecedent: z.number().int().nonnegative().optional(),
  capaciteMensuelle: z.number().positive(),
  butInvestissement: z.string().min(1),
  commentaireBut: z.string().min(1),
  pretAutreInstitution: z.enum(PRET_AUTRE_INSTITUTION),
  autreInstitutionNom: z.string().optional(),
});

function refineIndividuelLike<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: any, ctx) => {
    if (data.clientStatut === 'ANCIEN' && !data.numeroCompte?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'numeroCompte obligatoire pour un ancien client',
        path: ['numeroCompte'],
      });
    }
    if (data.demandeur?.etatCivil === 'Marie') {
      if (!data.demandeur.conjointNom?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'conjointNom obligatoire si Marie',
          path: ['demandeur', 'conjointNom'],
        });
      }
      if (!data.demandeur.conjointDateNaissance?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'conjointDateNaissance obligatoire si Marie',
          path: ['demandeur', 'conjointDateNaissance'],
        });
      }
    }
    if (
      data.pret?.pretAutreInstitution &&
      data.pret.pretAutreInstitution !== 'Non' &&
      !data.pret.autreInstitutionNom?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'autreInstitutionNom obligatoire',
        path: ['pret', 'autreInstitutionNom'],
      });
    }
  });
}

const individuelLikeObject = z.object({
  communeId: z.string().min(1),
  clientStatut: z.enum(CLIENT_STATUTS),
  numeroCompte: z.string().optional(),
  eligibilite: eligibilitySchema,
  demandeur: demandeurBaseSchema,
  business: businessSchema,
  pret: pretIndividuelSchema,
});

export const individuelPayloadSchema = refineIndividuelLike(individuelLikeObject);
export const dareDarePayloadSchema = refineIndividuelLike(individuelLikeObject);

export const salairePayloadSchema = z.object({
  communeId: z.string().min(1),
  nom: z.string().min(1),
  postNom: z.string().min(1),
  prenom: z.string().min(1),
  sexe: z.enum(SEXES),
  telephone: z.string().min(1),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  adresseDomicile: z.string().min(1),
  societe: z.string().min(1),
  adresseSociete: z.string().min(1),
  fonctionService: z.string().min(1),
  devise: z.enum(DEVISES),
  montantSollicite: z.number().positive(),
  dureeMois: z.number().int().positive(),
  dureeAnnees: z.number().int().nonnegative(),
  dureeSemaines: z.number().int().nonnegative(),
  motifCredit: z.string().optional(),
  salaireNet: z.number().positive(),
  capaciteMensuelle: z.number().positive(),
  cautionGarantie: z.string().optional(),
  numeroCompte: z.string().optional(),
  depotBc: z.string().optional(),
});

export type IndividuelPayload = z.infer<typeof individuelPayloadSchema>;
export type DareDarePayload = z.infer<typeof dareDarePayloadSchema>;
export type SalairePayload = z.infer<typeof salairePayloadSchema>;

export function parseDossierPayload(type: CreditType, payload: unknown) {
  switch (type) {
    case 'SALAIRE':
      return salairePayloadSchema.parse(payload);
    case 'INDIVIDUEL':
      return individuelPayloadSchema.parse(payload);
    case 'DARE_DARE':
      return dareDarePayloadSchema.parse(payload);
    default:
      throw new Error(`Type de crédit inconnu: ${type}`);
  }
}

export function clientFieldsFromPayload(
  type: CreditType,
  payload: Record<string, any>,
): {
  fullName: string;
  phone: string;
  activityAddress: string;
  communeId: string;
} {
  if (type === 'SALAIRE') {
    return {
      fullName: `${payload.prenom} ${payload.nom} ${payload.postNom}`.trim(),
      phone: payload.telephone,
      activityAddress: payload.adresseSociete || payload.adresseDomicile,
      communeId: payload.communeId,
    };
  }
  return {
    fullName: `${payload.demandeur.prenom} ${payload.demandeur.nom} ${payload.demandeur.postNom}`.trim(),
    phone: payload.demandeur.telephone,
    activityAddress: payload.business.adresseBusiness,
    communeId: payload.communeId,
  };
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

export * from './agentChecklist';
