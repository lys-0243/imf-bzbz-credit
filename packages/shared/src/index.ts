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
  'RESPONSABLE_CREDIT',
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
  'EN_ATTENTE_ATTRIBUTION_AGENT',
  'AFFECTE',
  'DESCENTE',
  'RAPPORT_AGENT',
  'SCORING',
  'EN_ATTENTE_VALIDATION_RC',
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
export const ETAT_CIVIL_LABELS: Record<(typeof ETATS_CIVILS)[number], string> = {
  Celibataire: 'Célibataire',
  Marie: 'Marié',
  Divorce: 'Divorcé',
  Veuf: 'Veuf/Veuve',
};
export const TYPE_PIECE_LABELS: Record<(typeof TYPES_PIECE)[number], string> = {
  'Carte Electeur': "Carte d'électeur",
  Passeport: 'Passeport',
  'Permis de conduire': 'Permis de conduire',
};
export const PRET_AUTRE_INSTITUTION = [
  'Non',
  "Oui j'avais",
  "Oui j'ai",
] as const;
export const DEVISES = ['USD', 'CDF'] as const;
export type Devise = (typeof DEVISES)[number];

const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)');

/** Payload réception — identité + prêt (2 étapes). */
export const receptionPayloadSchema = z
  .object({
    communeId: z.string().min(1),
    numeroCompte: z.string().min(1),
    prenom: z.string().min(1),
    nom: z.string().min(1),
    postNom: z.string().min(1),
    dateNaissance: dateIso,
    typePiece: z.enum(TYPES_PIECE),
    numeroPiece: z.string().min(1),
    sexe: z.enum(SEXES),
    telephone: z.string().min(1),
    email: z.union([z.string().email(), z.literal('')]).optional(),
    etatCivil: z.enum(ETATS_CIVILS),
    adresseDomicile: z.string().min(1),
    devise: z.enum(DEVISES).default('USD'),
    montantSollicite: z.number().positive(),
    /** Durée saisie en semaines (tous produits). */
    dureeSemaines: z.number().int().positive(),
    motifCredit: z.string().min(1),
    capaciteMensuelle: z.number().positive(),
    pretAutreInstitution: z.enum(PRET_AUTRE_INSTITUTION),
    autreInstitutionNom: z.string().optional(),
    /** Snapshot lookup CBS à la réception (optionnel). */
    bankingLookup: z
      .object({
        found: z.boolean(),
        creditEnCours: z.boolean(),
        score: z
          .object({
            value: z.number(),
            produitCode: z.string(),
            details: z.array(z.string()),
          })
          .nullable()
          .optional(),
        historiqueCount: z.number().int().nonnegative().optional(),
        checkedAt: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.pretAutreInstitution !== 'Non' &&
      !data.autreInstitutionNom?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Précisez le nom de l'institution",
        path: ['autreInstitutionNom'],
      });
    }
  });

export type ReceptionPayload = z.infer<typeof receptionPayloadSchema>;

export type ProduitBornes = {
  montantMin: number;
  montantMax: number;
  dureeMin: number;
  dureeMax: number;
  dureeUnite: DureeUnite;
};

/** Convertit les bornes produit en semaines pour la saisie réception. */
export function produitDureeBornesEnSemaines(produit: ProduitBornes): {
  min: number;
  max: number;
} {
  if (produit.dureeUnite === 'SEMAINES') {
    return { min: produit.dureeMin, max: produit.dureeMax };
  }
  return { min: produit.dureeMin * 4, max: produit.dureeMax * 4 };
}

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
  const bornes = produitDureeBornesEnSemaines(produit);
  if (data.dureeSemaines < bornes.min || data.dureeSemaines > bornes.max) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: `Durée hors bornes (${bornes.min} – ${bornes.max} semaines)`,
        path: ['dureeSemaines'],
      },
    ]);
  }
  return data;
}

const boolOuiNon = z.boolean();
const optionalText = z.string().optional().default('');
const optionalAmount = z
  .union([z.coerce.number(), z.literal('')])
  .optional()
  .default('');
const optionalDate = z
  .union([dateIso, z.literal('')])
  .optional()
  .default('');

/** Enrichissement agent — brouillon (saisie progressive, aucun champ obligatoire). */
export const agentSalaireEnrichmentSchema = z.object({
  societe: optionalText,
  adresseSociete: optionalText,
  fonctionService: optionalText,
  salaireNet: z.coerce.number().nonnegative().optional().default(0),
  cautionGarantie: optionalText,
  depotBc: optionalText,
  conjointNom: optionalText,
  conjointDateNaissance: optionalDate,
});

/** Enrichissement agent — crédit activité (brouillon). */
export const agentActiviteEnrichmentSchema = z.object({
  eligibilite: z.object({
    age18OuPlus: boolOuiNon,
    proprietaireActivite: boolOuiNon,
    exerceActiviteActuellement: boolOuiNon,
    activiteListeExclusion: boolOuiNon,
    congolaisOuDomiciile: boolOuiNon,
    activiteZoneOperationnelle: boolOuiNon,
    activite6MoisConsecutifs: boolOuiNon,
    activiteEnregistreeLegalement: boolOuiNon,
  }),
  demandeur: z.object({
    prenom: optionalText,
    nom: optionalText,
    postNom: optionalText,
    dateNaissance: optionalText,
    typePiece: optionalText,
    numeroPiece: optionalText,
    sexe: optionalText,
    etatCivil: optionalText,
    adresseDomicile: optionalText,
    telephone: optionalText,
    email: optionalText,
    conjointPrenom: optionalText,
    conjointPostNom: optionalText,
    conjointNom: optionalText,
    conjointDateNaissance: optionalDate,
  }),
  business: z.object({
    nomBusiness: optionalText,
    adresseBusiness: optionalText,
    dureeAdresse: optionalText,
    typeBusiness: optionalText,
    dureeTypeBusiness: optionalText,
    secteurBusiness: optionalText,
    formeJuridique: optionalText,
  }),
  pret: z.object({
    butInvestissement: optionalText,
    commentaireBut: optionalText,
    montantDesire: optionalAmount,
    dureeMois: optionalAmount,
    capaciteMensuelle: optionalAmount,
    pretAutreInstitution: optionalText,
    autreInstitutionNom: optionalText,
    montantPretPrecedent: optionalAmount,
    dureePretPrecedent: optionalText,
  }),
  conjointNom: optionalText,
  conjointDateNaissance: optionalDate,
});

/** Schémas stricts — utilisés uniquement pour vérifier la complétude avant soumission. */
const agentSalaireEnrichmentCompleteSchema = z.object({
  societe: z.string().min(1, 'Société requise'),
  adresseSociete: z.string().min(1, 'Adresse société requise'),
  fonctionService: z.string().min(1, 'Fonction / service requise'),
  salaireNet: z.coerce.number().positive('Salaire net requis'),
  cautionGarantie: z.string().min(1, 'Caution / garantie requise'),
  depotBc: optionalText,
  conjointNom: optionalText,
  conjointDateNaissance: optionalDate,
});

const agentActiviteEnrichmentCompleteSchema = z.object({
  eligibilite: agentActiviteEnrichmentSchema.shape.eligibilite,
  demandeur: z.object({
    prenom: z.string().min(1, 'Prénom requis'),
    nom: z.string().min(1, 'Nom requis'),
    postNom: z.string().min(1, 'Post-nom requis'),
    dateNaissance: z.string().min(1, 'Date de naissance requise'),
    typePiece: z.string().min(1, 'Type de pièce requis'),
    numeroPiece: z.string().min(1, 'Numéro de pièce requis'),
    sexe: z.string().min(1, 'Sexe requis'),
    etatCivil: z.string().min(1, 'État civil requis'),
    adresseDomicile: z.string().min(1, 'Adresse domicile requise'),
    telephone: z.string().min(1, 'Téléphone requis'),
    email: optionalText,
    conjointPrenom: optionalText,
    conjointPostNom: optionalText,
    conjointNom: optionalText,
    conjointDateNaissance: optionalDate,
  }),
  business: z.object({
    nomBusiness: z.string().min(1, 'Nom du business requis'),
    adresseBusiness: z.string().min(1, 'Adresse business requise'),
    dureeAdresse: z.string().min(1, 'Durée à l’adresse requise'),
    typeBusiness: z.string().min(1, 'Type de business requis'),
    dureeTypeBusiness: z.string().min(1, 'Durée du type de business requise'),
    secteurBusiness: z.string().min(1, 'Secteur requis'),
    formeJuridique: z.string().min(1, 'Forme juridique requise'),
  }),
  pret: z.object({
    butInvestissement: z.string().min(1, 'But d’investissement requis'),
    commentaireBut: optionalText,
    montantDesire: optionalAmount,
    dureeMois: optionalAmount,
    capaciteMensuelle: optionalAmount,
    pretAutreInstitution: optionalText,
    autreInstitutionNom: optionalText,
    montantPretPrecedent: optionalAmount,
    dureePretPrecedent: optionalText,
  }),
  conjointNom: optionalText,
  conjointDateNaissance: optionalDate,
});

export type AgentSalaireEnrichment = z.infer<typeof agentSalaireEnrichmentSchema>;
export type AgentActiviteEnrichment = z.infer<
  typeof agentActiviteEnrichmentSchema
>;

/** Parse un enrichissement agent en mode brouillon (champs optionnels). */
export function parseAgentEnrichment(
  famille: FamilleProduit,
  enrichment: unknown,
  _opts?: { etatCivil?: string },
) {
  if (famille === 'SALAIRE') {
    const data = agentSalaireEnrichmentSchema.parse(enrichment);
    return { famille: 'SALAIRE' as const, data };
  }
  const data = agentActiviteEnrichmentSchema.parse(enrichment);
  return { famille: 'ACTIVITE' as const, data };
}

function assertConjointIfMarie(
  etatCivil: string | undefined,
  conjointNom: string | undefined,
  path: Array<string | number>,
) {
  if (etatCivil === 'Marie' && !conjointNom?.trim()) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: 'Conjoint obligatoire si marié(e)',
        path,
      },
    ]);
  }
}

/** Fusionne l’enrichissement agent dans le payload réception existant. */
export function mergeAgentEnrichmentIntoPayload(
  existing: Record<string, any>,
  famille: FamilleProduit,
  enrichment: AgentSalaireEnrichment | AgentActiviteEnrichment,
): Record<string, any> {
  const base = { ...existing };
  if (famille === 'SALAIRE') {
    const e = enrichment as AgentSalaireEnrichment;
    Object.assign(base, {
      societe: e.societe,
      adresseSociete: e.adresseSociete,
      fonctionService: e.fonctionService,
      salaireNet: e.salaireNet,
      cautionGarantie: e.cautionGarantie,
      depotBc: e.depotBc || '',
      conjointNom: e.conjointNom || '',
      conjointDateNaissance: e.conjointDateNaissance || '',
    });
    return base;
  }
  const e = enrichment as AgentActiviteEnrichment;
  base.eligibilite = { ...e.eligibilite };
  base.business = { ...e.business };

  const dem = e.demandeur;
  if (dem) {
    base.prenom = dem.prenom || base.prenom;
    base.nom = dem.nom || base.nom;
    base.postNom = dem.postNom || base.postNom;
    base.dateNaissance = dem.dateNaissance || base.dateNaissance;
    base.typePiece = dem.typePiece || base.typePiece;
    base.numeroPiece = dem.numeroPiece || base.numeroPiece;
    base.sexe = dem.sexe || base.sexe;
    base.etatCivil = dem.etatCivil || base.etatCivil;
    base.adresseDomicile = dem.adresseDomicile || base.adresseDomicile;
    base.telephone = dem.telephone || base.telephone;
    base.email = dem.email || base.email || '';
  }

  const conjointNom =
    dem?.conjointNom || e.conjointNom || base.conjointNom || '';
  const conjointDateNaissance =
    dem?.conjointDateNaissance ||
    e.conjointDateNaissance ||
    base.conjointDateNaissance ||
    '';
  const conjointPrenom = dem?.conjointPrenom || base.conjointPrenom || '';
  const conjointPostNom = dem?.conjointPostNom || base.conjointPostNom || '';

  base.conjointNom = conjointNom;
  base.conjointDateNaissance = conjointDateNaissance;
  base.conjointPrenom = conjointPrenom;
  base.conjointPostNom = conjointPostNom;

  const montantDesire =
    e.pret.montantDesire === '' || e.pret.montantDesire == null
      ? base.montantSollicite
      : e.pret.montantDesire;
  if (typeof montantDesire === 'number') {
    base.montantSollicite = montantDesire;
  }
  if (e.pret.dureeMois !== '' && e.pret.dureeMois != null) {
    base.dureeMois = e.pret.dureeMois;
  }
  if (e.pret.capaciteMensuelle !== '' && e.pret.capaciteMensuelle != null) {
    base.capaciteMensuelle = e.pret.capaciteMensuelle;
  }
  if (e.pret.pretAutreInstitution) {
    base.pretAutreInstitution = e.pret.pretAutreInstitution;
  }
  if (e.pret.autreInstitutionNom != null) {
    base.autreInstitutionNom = e.pret.autreInstitutionNom;
  }

  base.pret = {
    ...(typeof base.pret === 'object' && base.pret ? base.pret : {}),
    butInvestissement: e.pret.butInvestissement,
    commentaireBut: e.pret.commentaireBut || '',
    montantPretPrecedent:
      e.pret.montantPretPrecedent === '' || e.pret.montantPretPrecedent == null
        ? undefined
        : e.pret.montantPretPrecedent,
    dureePretPrecedent: e.pret.dureePretPrecedent || '',
    montantDesire: base.montantSollicite,
    devise: base.devise,
    dureeMois:
      e.pret.dureeMois !== '' && e.pret.dureeMois != null
        ? e.pret.dureeMois
        : typeof base.dureeSemaines === 'number'
          ? Math.round(base.dureeSemaines / 4)
          : base.dureeMois,
    capaciteMensuelle: base.capaciteMensuelle,
    pretAutreInstitution: base.pretAutreInstitution,
    autreInstitutionNom: base.autreInstitutionNom,
  };

  base.demandeur = {
    ...(typeof base.demandeur === 'object' && base.demandeur
      ? base.demandeur
      : {}),
    prenom: base.prenom,
    nom: base.nom,
    postNom: base.postNom,
    sexe: base.sexe,
    dateNaissance: base.dateNaissance,
    etatCivil: base.etatCivil,
    typePiece: base.typePiece,
    numeroPiece: base.numeroPiece,
    adresseDomicile: base.adresseDomicile,
    telephone: base.telephone,
    email: base.email,
    conjointPrenom,
    conjointPostNom,
    conjointNom,
    conjointDateNaissance,
  };
  return base;
}

export function enrichmentFromPayload(
  famille: FamilleProduit,
  payload: Record<string, any> | null | undefined,
): AgentSalaireEnrichment | AgentActiviteEnrichment {
  const p = payload ?? {};
  if (famille === 'SALAIRE') {
    return {
      societe: String(p.societe ?? ''),
      adresseSociete: String(p.adresseSociete ?? ''),
      fonctionService: String(p.fonctionService ?? ''),
      salaireNet:
        typeof p.salaireNet === 'number'
          ? p.salaireNet
          : Number(p.salaireNet) || 0,
      cautionGarantie: String(p.cautionGarantie ?? ''),
      depotBc: String(p.depotBc ?? ''),
      conjointNom: String(p.conjointNom ?? p.demandeur?.conjointNom ?? ''),
      conjointDateNaissance: String(
        p.conjointDateNaissance ?? p.demandeur?.conjointDateNaissance ?? '',
      ),
    };
  }
  const e = p.eligibilite ?? {};
  const b = p.business ?? {};
  const pret = p.pret ?? {};
  const dem = p.demandeur ?? {};
  const conjointNom = String(
    dem.conjointNom ?? p.conjointNom ?? '',
  );
  const conjointDateNaissance = String(
    dem.conjointDateNaissance ?? p.conjointDateNaissance ?? '',
  );
  return {
    eligibilite: {
      age18OuPlus: Boolean(e.age18OuPlus),
      proprietaireActivite: Boolean(e.proprietaireActivite),
      exerceActiviteActuellement: Boolean(e.exerceActiviteActuellement),
      activiteListeExclusion: Boolean(e.activiteListeExclusion),
      congolaisOuDomiciile: Boolean(e.congolaisOuDomiciile),
      activiteZoneOperationnelle: Boolean(e.activiteZoneOperationnelle),
      activite6MoisConsecutifs: Boolean(e.activite6MoisConsecutifs),
      activiteEnregistreeLegalement: Boolean(e.activiteEnregistreeLegalement),
    },
    demandeur: {
      prenom: String(dem.prenom ?? p.prenom ?? ''),
      nom: String(dem.nom ?? p.nom ?? ''),
      postNom: String(dem.postNom ?? p.postNom ?? ''),
      dateNaissance: String(dem.dateNaissance ?? p.dateNaissance ?? ''),
      typePiece: String(dem.typePiece ?? p.typePiece ?? ''),
      numeroPiece: String(dem.numeroPiece ?? p.numeroPiece ?? ''),
      sexe: String(dem.sexe ?? p.sexe ?? ''),
      etatCivil: String(dem.etatCivil ?? p.etatCivil ?? ''),
      adresseDomicile: String(dem.adresseDomicile ?? p.adresseDomicile ?? ''),
      telephone: String(dem.telephone ?? p.telephone ?? ''),
      email: String(dem.email ?? p.email ?? ''),
      conjointPrenom: String(dem.conjointPrenom ?? p.conjointPrenom ?? ''),
      conjointPostNom: String(dem.conjointPostNom ?? p.conjointPostNom ?? ''),
      conjointNom,
      conjointDateNaissance,
    },
    business: {
      nomBusiness: String(b.nomBusiness ?? ''),
      adresseBusiness: String(b.adresseBusiness ?? ''),
      dureeAdresse: String(b.dureeAdresse ?? ''),
      typeBusiness: String(b.typeBusiness ?? ''),
      dureeTypeBusiness: String(b.dureeTypeBusiness ?? ''),
      secteurBusiness: String(b.secteurBusiness ?? ''),
      formeJuridique: String(b.formeJuridique ?? ''),
    },
    pret: {
      butInvestissement: String(pret.butInvestissement ?? p.motifCredit ?? ''),
      commentaireBut: String(pret.commentaireBut ?? ''),
      montantDesire:
        pret.montantDesire == null && p.montantSollicite == null
          ? ''
          : Number(pret.montantDesire ?? p.montantSollicite),
      dureeMois:
        pret.dureeMois == null && p.dureeMois == null && p.dureeSemaines == null
          ? ''
          : Number(
              pret.dureeMois ??
                p.dureeMois ??
                (typeof p.dureeSemaines === 'number'
                  ? Math.round(p.dureeSemaines / 4)
                  : undefined),
            ),
      capaciteMensuelle:
        pret.capaciteMensuelle == null && p.capaciteMensuelle == null
          ? ''
          : Number(pret.capaciteMensuelle ?? p.capaciteMensuelle),
      pretAutreInstitution: String(
        pret.pretAutreInstitution ?? p.pretAutreInstitution ?? '',
      ),
      autreInstitutionNom: String(
        pret.autreInstitutionNom ?? p.autreInstitutionNom ?? '',
      ),
      montantPretPrecedent:
        pret.montantPretPrecedent == null || pret.montantPretPrecedent === ''
          ? ''
          : Number(pret.montantPretPrecedent),
      dureePretPrecedent: String(pret.dureePretPrecedent ?? ''),
    },
    conjointNom,
    conjointDateNaissance,
  };
}

export function validateAgentEnrichmentComplete(
  famille: FamilleProduit,
  payload: Record<string, any>,
): { ok: true } | { ok: false; message: string } {
  try {
    const draft = enrichmentFromPayload(famille, payload);
    if (famille === 'SALAIRE') {
      const data = agentSalaireEnrichmentCompleteSchema.parse(draft);
      assertConjointIfMarie(
        payload.etatCivil,
        data.conjointNom,
        ['conjointNom'],
      );
    } else {
      const data = agentActiviteEnrichmentCompleteSchema.parse(draft);
      assertConjointIfMarie(
        payload.etatCivil || data.demandeur?.etatCivil,
        data.demandeur?.conjointNom || data.conjointNom,
        ['demandeur', 'conjointNom'],
      );
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return {
        ok: false,
        message: first?.message || 'Complétez les champs du dossier',
      };
    }
    return { ok: false, message: 'Complétez les champs du dossier' };
  }
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
      devise: asDevise(p.devise) ?? 'USD',
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
  if (typeof p.dureeSemaines === 'number') return p.dureeSemaines;
  if (typeof p.duree === 'number') return p.duree;
  if (typeof p.dureeMois === 'number') return p.dureeMois;
  if (typeof p.pret?.dureeMois === 'number') return p.pret.dureeMois;
  return null;
}

export function dureeUniteFromPayload(
  payload: Record<string, any> | null | undefined,
  produitUnite?: DureeUnite | string | null,
): DureeUnite {
  const p = payload ?? {};
  if (typeof p.dureeSemaines === 'number') return 'SEMAINES';
  if (produitUnite === 'SEMAINES' || produitUnite === 'MOIS') return produitUnite;
  return 'MOIS';
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
  const u =
    unite === 'SEMAINES'
      ? duree > 1
        ? 'semaines'
        : 'semaine'
      : 'mois';
  return `${duree} ${u}`;
}

export function formatProduitBornesHint(p: ProduitBornes): string {
  const montant = `${p.montantMin.toLocaleString('fr-FR')} – ${p.montantMax.toLocaleString('fr-FR')} USD`;
  const weeks = produitDureeBornesEnSemaines(p);
  const d =
    weeks.min === weeks.max
      ? `${weeks.min} sem.`
      : `${weeks.min}–${weeks.max} sem.`;
  return `${montant} · ${d}`;
}

export const DOSSIER_ETAT_LABELS: Record<DossierEtat, string> = {
  ENREGISTRE: 'Enregistré',
  EN_ATTENTE_ATTRIBUTION_AGENT: "En attente d'attribution agent",
  AFFECTE: 'Affecté à un agent',
  DESCENTE: 'Descente terrain',
  RAPPORT_AGENT: 'Rapport agent',
  SCORING: 'Scoring',
  EN_ATTENTE_VALIDATION_RC: 'En attente de validation responsable crédit',
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

/** Statuts d’un crédit dans l’historique core banking. */
export const BANKING_CREDIT_STATUTS = [
  'SOLDE',
  'EN_COURS',
  'EN_RETARD',
  'DEFAUT',
] as const;
export type BankingCreditStatut = (typeof BANKING_CREDIT_STATUTS)[number];

export type BankingKyc = {
  prenom: string;
  nom: string;
  postNom: string;
  dateNaissance: string;
  typePiece: string;
  numeroPiece: string;
  sexe: string;
  telephone: string;
  email?: string;
  etatCivil: string;
  adresseDomicile: string;
  communeCode?: string;
};

export type BankingCreditHistorique = {
  reference: string;
  produitCode: string;
  montant: number;
  devise: string;
  dateDebut: string;
  dateFin?: string | null;
  statut: BankingCreditStatut;
};

export type BankingScore = {
  value: number;
  produitCode: string;
  details: string[];
};

export type BankingLookupResult = {
  found: boolean;
  numeroCompte: string;
  kyc: BankingKyc | null;
  creditEnCours: boolean;
  creditsActifs: BankingCreditHistorique[];
  historique: BankingCreditHistorique[];
  score: BankingScore | null;
  ouvertLe?: string | null;
};

export type BankingDecisionNotify = {
  numeroCompte: string;
  dossierReference: string;
  produitCode: string;
  etatFinal: string;
  montant: number | null;
  dureeSemaines: number | null;
  devise: string | null;
  client: {
    fullName: string;
    phone: string;
  };
  decidedAt: string;
};

export type BankingNotifyResult = {
  ok: boolean;
  provider: string;
  message?: string;
};

export * from './agentChecklist';
export * from './analyseAgrPack';
export * from './cf2Analyse';
export * from './pronostic';
export * from './parametresImf';
export * from './cf3';
export * from './cf4';
export * from './cf5Garanties';
export * from './cf6Decision';
export * from './planRoute';
export * from './historique';
export * from './preComite';
export * from './decisionComite';
export * from './cf8Suivi';
export * from './formulaires';
export * from './documents';
export * from './dossierSynthese';
