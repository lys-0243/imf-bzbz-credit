import { z } from 'zod';
export declare const CREDIT_TYPES: readonly ["SALAIRE", "INDIVIDUEL", "DARE_DARE"];
export type CreditType = (typeof CREDIT_TYPES)[number];
export declare const ROLES: readonly ["RECEPTION", "AGENT", "ANALYSTE", "CONFORMITE", "DG", "CA", "ADMIN"];
export type Role = (typeof ROLES)[number];
export declare const MOBILE_ROLES: readonly ["RECEPTION", "AGENT"];
export type MobileRole = (typeof MOBILE_ROLES)[number];
export declare const DOSSIER_ETATS: readonly ["ENREGISTRE", "AFFECTE", "DESCENTE", "RAPPORT_AGENT", "SCORING", "ANALYSTE", "RETOUR_AGENT", "CONFORMITE", "RETOUR_ANALYSTE", "DIRECTION", "CONSEIL", "A_DECAISSER", "REJETE"];
export type DossierEtat = (typeof DOSSIER_ETATS)[number];
export declare const KINSHASA_ZONES: readonly [{
    readonly code: "ZONE_A";
    readonly name: "Zone A";
}, {
    readonly code: "ZONE_B";
    readonly name: "Zone B";
}, {
    readonly code: "ZONE_C";
    readonly name: "Zone C";
}, {
    readonly code: "ZONE_D";
    readonly name: "Zone D";
}, {
    readonly code: "ZONE_E";
    readonly name: "Zone E";
}];
export declare const KINSHASA_ZONE_CODES: ("ZONE_A" | "ZONE_B" | "ZONE_C" | "ZONE_D" | "ZONE_E")[];
export type ZoneCode = (typeof KINSHASA_ZONE_CODES)[number];
/** 24 communes officielles de Kinshasa, réparties sur zones A–E (ajustable plus tard). */
export declare const KINSHASA_COMMUNES: ReadonlyArray<{
    code: string;
    name: string;
    zoneCode: ZoneCode;
}>;
export declare const SEXES: readonly ["Masculin", "Feminin"];
export declare const TYPES_PIECE: readonly ["Carte Electeur", "Passeport", "Permis de conduire"];
export declare const ETATS_CIVILS: readonly ["Celibataire", "Marie", "Divorce", "Veuf"];
export declare const PRET_AUTRE_INSTITUTION: readonly ["Non", "Oui j'avais", "Oui j'ai"];
export declare const CLIENT_STATUTS: readonly ["NOUVEAU", "ANCIEN"];
export declare const individuelPayloadSchema: z.ZodEffects<z.ZodObject<{
    communeId: z.ZodString;
    clientStatut: z.ZodEnum<["NOUVEAU", "ANCIEN"]>;
    numeroCompte: z.ZodOptional<z.ZodString>;
    eligibilite: z.ZodObject<{
        age18OuPlus: z.ZodDefault<z.ZodBoolean>;
        proprietaireActivite: z.ZodDefault<z.ZodBoolean>;
        exerceActiviteActuellement: z.ZodDefault<z.ZodBoolean>;
        activiteListeExclusion: z.ZodDefault<z.ZodBoolean>;
        congolaisOuDomiciile: z.ZodDefault<z.ZodBoolean>;
        activiteZoneOperationnelle: z.ZodDefault<z.ZodBoolean>;
        activite6MoisConsecutifs: z.ZodDefault<z.ZodBoolean>;
        activiteEnregistreeLegalement: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        age18OuPlus: boolean;
        proprietaireActivite: boolean;
        exerceActiviteActuellement: boolean;
        activiteListeExclusion: boolean;
        congolaisOuDomiciile: boolean;
        activiteZoneOperationnelle: boolean;
        activite6MoisConsecutifs: boolean;
        activiteEnregistreeLegalement: boolean;
    }, {
        age18OuPlus?: boolean | undefined;
        proprietaireActivite?: boolean | undefined;
        exerceActiviteActuellement?: boolean | undefined;
        activiteListeExclusion?: boolean | undefined;
        congolaisOuDomiciile?: boolean | undefined;
        activiteZoneOperationnelle?: boolean | undefined;
        activite6MoisConsecutifs?: boolean | undefined;
        activiteEnregistreeLegalement?: boolean | undefined;
    }>;
    demandeur: z.ZodObject<{
        prenom: z.ZodString;
        nom: z.ZodString;
        postNom: z.ZodString;
        dateNaissance: z.ZodString;
        sexe: z.ZodEnum<["Masculin", "Feminin"]>;
        typePiece: z.ZodEnum<["Carte Electeur", "Passeport", "Permis de conduire"]>;
        numeroPiece: z.ZodString;
        etatCivil: z.ZodEnum<["Celibataire", "Marie", "Divorce", "Veuf"]>;
        conjointNom: z.ZodOptional<z.ZodString>;
        conjointDateNaissance: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
        adresseDomicile: z.ZodString;
        telephone: z.ZodString;
        email: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    }, "strip", z.ZodTypeAny, {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    }, {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    }>;
    business: z.ZodObject<{
        nomBusiness: z.ZodString;
        adresseBusiness: z.ZodString;
        dureeAdresse: z.ZodString;
        typeBusiness: z.ZodString;
        dureeTypeBusiness: z.ZodString;
        secteurBusiness: z.ZodString;
        formeJuridique: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    }, {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    }>;
    pret: z.ZodObject<{
        montantDesire: z.ZodNumber;
        dureeMois: z.ZodNumber;
        montantPretPrecedent: z.ZodOptional<z.ZodNumber>;
        dureePretPrecedent: z.ZodOptional<z.ZodNumber>;
        capaciteMensuelle: z.ZodNumber;
        butInvestissement: z.ZodString;
        commentaireBut: z.ZodString;
        pretAutreInstitution: z.ZodEnum<["Non", "Oui j'avais", "Oui j'ai"]>;
        autreInstitutionNom: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    }, {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    communeId: string;
    clientStatut: "NOUVEAU" | "ANCIEN";
    eligibilite: {
        age18OuPlus: boolean;
        proprietaireActivite: boolean;
        exerceActiviteActuellement: boolean;
        activiteListeExclusion: boolean;
        congolaisOuDomiciile: boolean;
        activiteZoneOperationnelle: boolean;
        activite6MoisConsecutifs: boolean;
        activiteEnregistreeLegalement: boolean;
    };
    demandeur: {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    };
    business: {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    };
    pret: {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    };
    numeroCompte?: string | undefined;
}, {
    communeId: string;
    clientStatut: "NOUVEAU" | "ANCIEN";
    eligibilite: {
        age18OuPlus?: boolean | undefined;
        proprietaireActivite?: boolean | undefined;
        exerceActiviteActuellement?: boolean | undefined;
        activiteListeExclusion?: boolean | undefined;
        congolaisOuDomiciile?: boolean | undefined;
        activiteZoneOperationnelle?: boolean | undefined;
        activite6MoisConsecutifs?: boolean | undefined;
        activiteEnregistreeLegalement?: boolean | undefined;
    };
    demandeur: {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    };
    business: {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    };
    pret: {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    };
    numeroCompte?: string | undefined;
}>, any, any>;
export declare const dareDarePayloadSchema: z.ZodEffects<z.ZodObject<{
    communeId: z.ZodString;
    clientStatut: z.ZodEnum<["NOUVEAU", "ANCIEN"]>;
    numeroCompte: z.ZodOptional<z.ZodString>;
    eligibilite: z.ZodObject<{
        age18OuPlus: z.ZodDefault<z.ZodBoolean>;
        proprietaireActivite: z.ZodDefault<z.ZodBoolean>;
        exerceActiviteActuellement: z.ZodDefault<z.ZodBoolean>;
        activiteListeExclusion: z.ZodDefault<z.ZodBoolean>;
        congolaisOuDomiciile: z.ZodDefault<z.ZodBoolean>;
        activiteZoneOperationnelle: z.ZodDefault<z.ZodBoolean>;
        activite6MoisConsecutifs: z.ZodDefault<z.ZodBoolean>;
        activiteEnregistreeLegalement: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        age18OuPlus: boolean;
        proprietaireActivite: boolean;
        exerceActiviteActuellement: boolean;
        activiteListeExclusion: boolean;
        congolaisOuDomiciile: boolean;
        activiteZoneOperationnelle: boolean;
        activite6MoisConsecutifs: boolean;
        activiteEnregistreeLegalement: boolean;
    }, {
        age18OuPlus?: boolean | undefined;
        proprietaireActivite?: boolean | undefined;
        exerceActiviteActuellement?: boolean | undefined;
        activiteListeExclusion?: boolean | undefined;
        congolaisOuDomiciile?: boolean | undefined;
        activiteZoneOperationnelle?: boolean | undefined;
        activite6MoisConsecutifs?: boolean | undefined;
        activiteEnregistreeLegalement?: boolean | undefined;
    }>;
    demandeur: z.ZodObject<{
        prenom: z.ZodString;
        nom: z.ZodString;
        postNom: z.ZodString;
        dateNaissance: z.ZodString;
        sexe: z.ZodEnum<["Masculin", "Feminin"]>;
        typePiece: z.ZodEnum<["Carte Electeur", "Passeport", "Permis de conduire"]>;
        numeroPiece: z.ZodString;
        etatCivil: z.ZodEnum<["Celibataire", "Marie", "Divorce", "Veuf"]>;
        conjointNom: z.ZodOptional<z.ZodString>;
        conjointDateNaissance: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
        adresseDomicile: z.ZodString;
        telephone: z.ZodString;
        email: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    }, "strip", z.ZodTypeAny, {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    }, {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    }>;
    business: z.ZodObject<{
        nomBusiness: z.ZodString;
        adresseBusiness: z.ZodString;
        dureeAdresse: z.ZodString;
        typeBusiness: z.ZodString;
        dureeTypeBusiness: z.ZodString;
        secteurBusiness: z.ZodString;
        formeJuridique: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    }, {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    }>;
    pret: z.ZodObject<{
        montantDesire: z.ZodNumber;
        dureeMois: z.ZodNumber;
        montantPretPrecedent: z.ZodOptional<z.ZodNumber>;
        dureePretPrecedent: z.ZodOptional<z.ZodNumber>;
        capaciteMensuelle: z.ZodNumber;
        butInvestissement: z.ZodString;
        commentaireBut: z.ZodString;
        pretAutreInstitution: z.ZodEnum<["Non", "Oui j'avais", "Oui j'ai"]>;
        autreInstitutionNom: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    }, {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    communeId: string;
    clientStatut: "NOUVEAU" | "ANCIEN";
    eligibilite: {
        age18OuPlus: boolean;
        proprietaireActivite: boolean;
        exerceActiviteActuellement: boolean;
        activiteListeExclusion: boolean;
        congolaisOuDomiciile: boolean;
        activiteZoneOperationnelle: boolean;
        activite6MoisConsecutifs: boolean;
        activiteEnregistreeLegalement: boolean;
    };
    demandeur: {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    };
    business: {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    };
    pret: {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    };
    numeroCompte?: string | undefined;
}, {
    communeId: string;
    clientStatut: "NOUVEAU" | "ANCIEN";
    eligibilite: {
        age18OuPlus?: boolean | undefined;
        proprietaireActivite?: boolean | undefined;
        exerceActiviteActuellement?: boolean | undefined;
        activiteListeExclusion?: boolean | undefined;
        congolaisOuDomiciile?: boolean | undefined;
        activiteZoneOperationnelle?: boolean | undefined;
        activite6MoisConsecutifs?: boolean | undefined;
        activiteEnregistreeLegalement?: boolean | undefined;
    };
    demandeur: {
        nom: string;
        postNom: string;
        prenom: string;
        sexe: "Masculin" | "Feminin";
        telephone: string;
        adresseDomicile: string;
        dateNaissance: string;
        typePiece: "Carte Electeur" | "Passeport" | "Permis de conduire";
        numeroPiece: string;
        etatCivil: "Celibataire" | "Marie" | "Divorce" | "Veuf";
        email?: string | undefined;
        conjointNom?: string | undefined;
        conjointDateNaissance?: string | undefined;
    };
    business: {
        nomBusiness: string;
        adresseBusiness: string;
        dureeAdresse: string;
        typeBusiness: string;
        dureeTypeBusiness: string;
        secteurBusiness: string;
        formeJuridique: string;
    };
    pret: {
        dureeMois: number;
        montantDesire: number;
        capaciteMensuelle: number;
        butInvestissement: string;
        commentaireBut: string;
        pretAutreInstitution: "Non" | "Oui j'avais" | "Oui j'ai";
        montantPretPrecedent?: number | undefined;
        dureePretPrecedent?: number | undefined;
        autreInstitutionNom?: string | undefined;
    };
    numeroCompte?: string | undefined;
}>, any, any>;
export declare const salairePayloadSchema: z.ZodObject<{
    communeId: z.ZodString;
    nom: z.ZodString;
    postNom: z.ZodString;
    prenom: z.ZodString;
    sexe: z.ZodEnum<["Masculin", "Feminin"]>;
    telephone: z.ZodString;
    email: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    adresseDomicile: z.ZodString;
    societe: z.ZodString;
    adresseSociete: z.ZodString;
    fonctionService: z.ZodString;
    montantSollicite: z.ZodNumber;
    dureeMois: z.ZodNumber;
    dureeAnnees: z.ZodNumber;
    dureeSemaines: z.ZodNumber;
    motifCredit: z.ZodOptional<z.ZodString>;
    salaireNet: z.ZodNumber;
    cautionGarantie: z.ZodOptional<z.ZodString>;
    numeroCompte: z.ZodOptional<z.ZodString>;
    depotBc: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    communeId: string;
    nom: string;
    postNom: string;
    prenom: string;
    sexe: "Masculin" | "Feminin";
    telephone: string;
    adresseDomicile: string;
    societe: string;
    adresseSociete: string;
    fonctionService: string;
    montantSollicite: number;
    dureeMois: number;
    dureeAnnees: number;
    dureeSemaines: number;
    salaireNet: number;
    email?: string | undefined;
    motifCredit?: string | undefined;
    cautionGarantie?: string | undefined;
    numeroCompte?: string | undefined;
    depotBc?: string | undefined;
}, {
    communeId: string;
    nom: string;
    postNom: string;
    prenom: string;
    sexe: "Masculin" | "Feminin";
    telephone: string;
    adresseDomicile: string;
    societe: string;
    adresseSociete: string;
    fonctionService: string;
    montantSollicite: number;
    dureeMois: number;
    dureeAnnees: number;
    dureeSemaines: number;
    salaireNet: number;
    email?: string | undefined;
    motifCredit?: string | undefined;
    cautionGarantie?: string | undefined;
    numeroCompte?: string | undefined;
    depotBc?: string | undefined;
}>;
export type IndividuelPayload = z.infer<typeof individuelPayloadSchema>;
export type DareDarePayload = z.infer<typeof dareDarePayloadSchema>;
export type SalairePayload = z.infer<typeof salairePayloadSchema>;
export declare function parseDossierPayload(type: CreditType, payload: unknown): any;
export declare function clientFieldsFromPayload(type: CreditType, payload: Record<string, any>): {
    fullName: string;
    phone: string;
    activityAddress: string;
    communeId: string;
};
export declare const DOSSIER_ETAT_LABELS: Record<DossierEtat, string>;
