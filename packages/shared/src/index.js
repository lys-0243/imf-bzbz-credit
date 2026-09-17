"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOSSIER_ETAT_LABELS = exports.salairePayloadSchema = exports.dareDarePayloadSchema = exports.individuelPayloadSchema = exports.CLIENT_STATUTS = exports.PRET_AUTRE_INSTITUTION = exports.ETATS_CIVILS = exports.TYPES_PIECE = exports.SEXES = exports.KINSHASA_COMMUNES = exports.KINSHASA_ZONE_CODES = exports.KINSHASA_ZONES = exports.DOSSIER_ETATS = exports.MOBILE_ROLES = exports.ROLES = exports.CREDIT_TYPES = void 0;
exports.parseDossierPayload = parseDossierPayload;
exports.clientFieldsFromPayload = clientFieldsFromPayload;
const zod_1 = require("zod");
exports.CREDIT_TYPES = ['SALAIRE', 'INDIVIDUEL', 'DARE_DARE'];
exports.ROLES = [
    'RECEPTION',
    'AGENT',
    'ANALYSTE',
    'CONFORMITE',
    'DG',
    'CA',
    'ADMIN',
];
exports.MOBILE_ROLES = ['RECEPTION', 'AGENT'];
exports.DOSSIER_ETATS = [
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
];
exports.KINSHASA_ZONES = [
    { code: 'ZONE_A', name: 'Zone A' },
    { code: 'ZONE_B', name: 'Zone B' },
    { code: 'ZONE_C', name: 'Zone C' },
    { code: 'ZONE_D', name: 'Zone D' },
    { code: 'ZONE_E', name: 'Zone E' },
];
exports.KINSHASA_ZONE_CODES = exports.KINSHASA_ZONES.map((z) => z.code);
/** 24 communes officielles de Kinshasa, réparties sur zones A–E (ajustable plus tard). */
exports.KINSHASA_COMMUNES = [
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
const dateIso = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)');
exports.SEXES = ['Masculin', 'Feminin'];
exports.TYPES_PIECE = [
    'Carte Electeur',
    'Passeport',
    'Permis de conduire',
];
exports.ETATS_CIVILS = [
    'Celibataire',
    'Marie',
    'Divorce',
    'Veuf',
];
exports.PRET_AUTRE_INSTITUTION = [
    'Non',
    "Oui j'avais",
    "Oui j'ai",
];
exports.CLIENT_STATUTS = ['NOUVEAU', 'ANCIEN'];
const eligibilitySchema = zod_1.z.object({
    age18OuPlus: zod_1.z.boolean().default(true),
    proprietaireActivite: zod_1.z.boolean().default(true),
    exerceActiviteActuellement: zod_1.z.boolean().default(true),
    activiteListeExclusion: zod_1.z.boolean().default(false),
    congolaisOuDomiciile: zod_1.z.boolean().default(true),
    activiteZoneOperationnelle: zod_1.z.boolean().default(true),
    activite6MoisConsecutifs: zod_1.z.boolean().default(true),
    activiteEnregistreeLegalement: zod_1.z.boolean().default(true),
});
const demandeurBaseSchema = zod_1.z.object({
    prenom: zod_1.z.string().min(1),
    nom: zod_1.z.string().min(1),
    postNom: zod_1.z.string().min(1),
    dateNaissance: dateIso,
    sexe: zod_1.z.enum(exports.SEXES),
    typePiece: zod_1.z.enum(exports.TYPES_PIECE),
    numeroPiece: zod_1.z.string().min(1),
    etatCivil: zod_1.z.enum(exports.ETATS_CIVILS),
    conjointNom: zod_1.z.string().optional(),
    conjointDateNaissance: zod_1.z.union([dateIso, zod_1.z.literal('')]).optional(),
    adresseDomicile: zod_1.z.string().min(1),
    telephone: zod_1.z.string().min(1),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
});
const businessSchema = zod_1.z.object({
    nomBusiness: zod_1.z.string().min(1),
    adresseBusiness: zod_1.z.string().min(1),
    dureeAdresse: zod_1.z.string().min(1),
    typeBusiness: zod_1.z.string().min(1),
    dureeTypeBusiness: zod_1.z.string().min(1),
    secteurBusiness: zod_1.z.string().min(1),
    formeJuridique: zod_1.z.string().min(1),
});
const pretIndividuelSchema = zod_1.z.object({
    montantDesire: zod_1.z.number().positive(),
    dureeMois: zod_1.z.number().int().positive(),
    montantPretPrecedent: zod_1.z.number().nonnegative().optional(),
    dureePretPrecedent: zod_1.z.number().int().nonnegative().optional(),
    capaciteMensuelle: zod_1.z.number().positive(),
    butInvestissement: zod_1.z.string().min(1),
    commentaireBut: zod_1.z.string().min(1),
    pretAutreInstitution: zod_1.z.enum(exports.PRET_AUTRE_INSTITUTION),
    autreInstitutionNom: zod_1.z.string().optional(),
});
function refineIndividuelLike(schema) {
    return schema.superRefine((data, ctx) => {
        if (data.clientStatut === 'ANCIEN' && !data.numeroCompte?.trim()) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'numeroCompte obligatoire pour un ancien client',
                path: ['numeroCompte'],
            });
        }
        if (data.demandeur?.etatCivil === 'Marie') {
            if (!data.demandeur.conjointNom?.trim()) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'conjointNom obligatoire si Marie',
                    path: ['demandeur', 'conjointNom'],
                });
            }
            if (!data.demandeur.conjointDateNaissance?.trim()) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'conjointDateNaissance obligatoire si Marie',
                    path: ['demandeur', 'conjointDateNaissance'],
                });
            }
        }
        if (data.pret?.pretAutreInstitution &&
            data.pret.pretAutreInstitution !== 'Non' &&
            !data.pret.autreInstitutionNom?.trim()) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'autreInstitutionNom obligatoire',
                path: ['pret', 'autreInstitutionNom'],
            });
        }
    });
}
const individuelLikeObject = zod_1.z.object({
    communeId: zod_1.z.string().min(1),
    clientStatut: zod_1.z.enum(exports.CLIENT_STATUTS),
    numeroCompte: zod_1.z.string().optional(),
    eligibilite: eligibilitySchema,
    demandeur: demandeurBaseSchema,
    business: businessSchema,
    pret: pretIndividuelSchema,
});
exports.individuelPayloadSchema = refineIndividuelLike(individuelLikeObject);
exports.dareDarePayloadSchema = refineIndividuelLike(individuelLikeObject);
exports.salairePayloadSchema = zod_1.z.object({
    communeId: zod_1.z.string().min(1),
    nom: zod_1.z.string().min(1),
    postNom: zod_1.z.string().min(1),
    prenom: zod_1.z.string().min(1),
    sexe: zod_1.z.enum(exports.SEXES),
    telephone: zod_1.z.string().min(1),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
    adresseDomicile: zod_1.z.string().min(1),
    societe: zod_1.z.string().min(1),
    adresseSociete: zod_1.z.string().min(1),
    fonctionService: zod_1.z.string().min(1),
    montantSollicite: zod_1.z.number().positive(),
    dureeMois: zod_1.z.number().int().positive(),
    dureeAnnees: zod_1.z.number().int().nonnegative(),
    dureeSemaines: zod_1.z.number().int().nonnegative(),
    motifCredit: zod_1.z.string().optional(),
    salaireNet: zod_1.z.number().positive(),
    cautionGarantie: zod_1.z.string().optional(),
    numeroCompte: zod_1.z.string().optional(),
    depotBc: zod_1.z.string().optional(),
});
function parseDossierPayload(type, payload) {
    switch (type) {
        case 'SALAIRE':
            return exports.salairePayloadSchema.parse(payload);
        case 'INDIVIDUEL':
            return exports.individuelPayloadSchema.parse(payload);
        case 'DARE_DARE':
            return exports.dareDarePayloadSchema.parse(payload);
        default:
            throw new Error(`Type de crédit inconnu: ${type}`);
    }
}
function clientFieldsFromPayload(type, payload) {
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
exports.DOSSIER_ETAT_LABELS = {
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
