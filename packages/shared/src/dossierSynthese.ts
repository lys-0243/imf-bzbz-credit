import {
  computeBilan,
  computeCf24Ratios,
  computeCompteResultat,
  computeMensualiteAnnuite,
  resolveMensualite,
  resolveTauxPeriodique,
  sumDepensesFamiliales,
  tauxParTranche,
  type Cf2Analyse,
  type Cf2Bilan,
  type Cf2CompteResultat,
  type Cf2RatioRow,
} from './cf2Analyse';
import { garantActiviteOuEmployeur, garantAnciennete } from './cf4';
import { computeCf5Totaux, GARANTIE_TYPES, type Cf5Totaux, type GarantieType } from './cf5Garanties';
import { conditionsApprouvees } from './decisionComite';
import { echeancier, montantEnLettres } from './documents';
import type { FormulairesData } from './formulaires';
import { num } from './formUtils';
import { computeConditionsDeboursement, type ConditionsDeboursement, type ParametresImf } from './parametresImf';

/** Données nécessaires aux synthèses et documents (assemblées côté client ou API). */
export type DossierContexte = {
  id: string;
  reference: string;
  etat: string;
  createdAt: string;
  produit: { code: string; label: string; famille: string };
  payload: Record<string, any>;
  client: { fullName: string; phone?: string | null; activityAddress?: string | null };
  agent: { displayName: string } | null;
  analyse: Cf2Analyse | null;
  formulaires: FormulairesData;
  parametres: ParametresImf;
  /** null si inconnu (pas d’accès à l’historique client). */
  nouveauClient: boolean | null;
};

const s = (v: unknown) => (v == null ? '' : String(v).trim());

export type IdentiteDemandeur = {
  prenom: string;
  nom: string;
  postNom: string;
  /** Excel : Nom & Post-nom & Prénom (ex. « KAPUMA MUKENDI FRANCIS »). */
  nomComplet: string;
  dateNaissance: string;
  typePiece: string;
  numeroPiece: string;
  sexe: string;
  civilite: 'Monsieur' | 'Madame' | '';
  etatCivil: string;
  adresseDomicile: string;
  telephone: string;
  email: string;
  conjointNomComplet: string;
};

export function identiteDemandeur(p: Record<string, any>): IdentiteDemandeur {
  const dem = (p.demandeur ?? {}) as Record<string, any>;
  const pick = (k: string) => s(dem[k] ?? p[k]);
  const prenom = pick('prenom');
  const nom = pick('nom');
  const postNom = pick('postNom');
  const sexe = pick('sexe');
  return {
    prenom,
    nom,
    postNom,
    nomComplet: [nom, postNom, prenom].filter(Boolean).join(' '),
    dateNaissance: pick('dateNaissance'),
    typePiece: pick('typePiece'),
    numeroPiece: pick('numeroPiece'),
    sexe,
    civilite: /^m(asc)?/i.test(sexe) ? 'Monsieur' : /^f/i.test(sexe) ? 'Madame' : '',
    etatCivil: pick('etatCivil'),
    adresseDomicile: pick('adresseDomicile'),
    telephone: pick('telephone'),
    email: pick('email'),
    conjointNomComplet: [pick('conjointNom'), pick('conjointPostNom'), pick('conjointPrenom')]
      .filter(Boolean)
      .join(' '),
  };
}

export type DemandeInitiale = {
  dateDemande: string;
  montant: number | null;
  devise: string;
  dureeMois: number | null;
  but: string;
  commentaireBut: string;
  capaciteMensuelle: number | null;
  numeroCompte: string;
  business: {
    nom: string;
    adresse: string;
    type: string;
    secteur: string;
    experience: string;
    formeJuridique: string;
  };
};

export function demandeInitiale(ctx: Pick<DossierContexte, 'payload' | 'createdAt'>): DemandeInitiale {
  const p = ctx.payload ?? {};
  const pret = (p.pret ?? {}) as Record<string, any>;
  const b = (p.business ?? {}) as Record<string, any>;
  const montant = typeof p.montantSollicite === 'number' ? p.montantSollicite : num(pret.montantDesire) || null;
  const dureeMois =
    num(pret.dureeMois) ||
    num(p.dureeMois) ||
    (typeof p.dureeSemaines === 'number' ? Math.round(p.dureeSemaines / 4) : 0) ||
    null;
  return {
    dateDemande: ctx.createdAt,
    montant,
    devise: s(p.devise ?? pret.devise) || 'USD',
    dureeMois,
    but: s(pret.butInvestissement ?? p.motifCredit),
    commentaireBut: s(pret.commentaireBut),
    capaciteMensuelle: num(pret.capaciteMensuelle ?? p.capaciteMensuelle) || null,
    numeroCompte: s(p.numeroCompte),
    business: {
      nom: s(b.nomBusiness),
      adresse: s(b.adresseBusiness),
      type: s(b.typeBusiness),
      secteur: s(b.secteurBusiness),
      experience: s(b.dureeTypeBusiness),
      formeJuridique: s(b.formeJuridique),
    },
  };
}

export type ConditionsPret = {
  /** Origine des montant/durée retenus. */
  source: 'APPRO_PCA' | 'DECISION_COMITE' | 'CF2_5' | 'DEMANDE';
  montant: number | null;
  dureeMois: number | null;
  tauxMensuel: number | null;
  mensualite: number | null;
  totalRembourse: number | null;
  frais: ConditionsDeboursement | null;
};

/** Montant, durée et taux de référence : PCA > PV comité > proposition CF 2.5 > demande. */
export function conditionsPret(ctx: DossierContexte): ConditionsPret {
  const f = ctx.formulaires;
  const approuve = conditionsApprouvees(f.DECISION_COMITE, f.APPRO_PCA);
  const f25 = ctx.analyse?.cf25;
  const demande = demandeInitiale(ctx);
  let source: ConditionsPret['source'] = 'DEMANDE';
  let montant = demande.montant;
  let dureeMois = demande.dureeMois;
  if (approuve?.montant) {
    source = approuve.source;
    montant = approuve.montant;
    dureeMois = approuve.dureeMois ?? dureeMois;
  } else if (f25 && num(f25.montantPropose) > 0) {
    source = 'CF2_5';
    montant = num(f25.montantPropose);
    dureeMois = num(f25.echeanceMois) || dureeMois;
  }
  const tauxMensuel =
    resolveTauxPeriodique(f.DECISION_COMITE.tauxMensuel) ??
    (source === 'CF2_5' && f25 ? resolveTauxPeriodique(f25.tauxPeriodique) : null) ??
    (montant ? tauxParTranche(montant, ctx.parametres.grilleTaux) : null);
  const mensualite =
    montant && dureeMois && tauxMensuel
      ? computeMensualiteAnnuite(montant, dureeMois, tauxMensuel)
      : source === 'CF2_5' && f25
        ? resolveMensualite(f25) || null
        : null;
  return {
    source,
    montant,
    dureeMois,
    tauxMensuel,
    mensualite,
    totalRembourse: mensualite && dureeMois ? mensualite * dureeMois : null,
    frais: montant ? computeConditionsDeboursement(montant, ctx.parametres) : null,
  };
}

export function totauxGaranties(ctx: DossierContexte): {
  demandeur: Cf5Totaux;
  garant: Cf5Totaux;
} {
  const montantPropose = num(ctx.analyse?.cf25.montantPropose) || conditionsPret(ctx).montant || 0;
  const c = { montantPropose, cautionPct: ctx.parametres.conditions.cautionPct };
  return {
    demandeur: computeCf5Totaux(ctx.formulaires.CF5_1_DEMANDEUR, c),
    garant: computeCf5Totaux(ctx.formulaires.CF5_1_GARANT, c),
  };
}

/** Ratios CF 2.4 avec Σ gages = total CF5.1 du demandeur (Excel I8). */
export function ratiosDossier(ctx: DossierContexte): Cf2RatioRow[] {
  if (!ctx.analyse) return [];
  const total = totauxGaranties(ctx).demandeur.total;
  return computeCf24Ratios(ctx.analyse, total > 0 ? { valeurGaranties: total } : {});
}

export function garantResume(ctx: DossierContexte) {
  const g = ctx.formulaires.CF4;
  return {
    nomComplet: g.identite.nomComplet,
    adresse: g.identite.adresseDomicile,
    telephone: g.identite.telephone,
    relation: g.identite.relationDemandeur,
    anciennete: garantAnciennete(g),
    activiteOuEmployeur: garantActiviteOuEmployeur(g),
    revenuMensuelNet: num(g.emploi.revenuMensuelNet) || null,
  };
}

/** CF6.1 — Décision de prêt : synthèse calculée. */
export function buildCf61Synthese(ctx: DossierContexte) {
  const id = identiteDemandeur(ctx.payload);
  const demande = demandeInitiale(ctx);
  const a = ctx.analyse;
  return {
    nouveauClient: ctx.nouveauClient,
    numeroCompte: demande.numeroCompte,
    dateDemande: demande.dateDemande,
    dateVisiteActivite: a?.cf22.business.dateHeureVisite ?? '',
    dateVisiteDomicile: ctx.formulaires.CF6_1.dateVisiteDomicile || a?.cf21.residence.dateHeureVisite || '',
    demandeur: {
      nomComplet: id.nomComplet,
      dateNaissance: id.dateNaissance,
      conjoint: id.conjointNomComplet,
      adresse: id.adresseDomicile,
      etatCivil: id.etatCivil,
      residenceDepuis: a?.cf21.residence.residenceDepuis ?? '',
      statutLogement: a?.cf21.residence.statutLogement ?? '',
    },
    activite: {
      nom: demande.business.nom || demande.business.type,
      depuis: a?.cf22.business.activiteDepuis ?? '',
      proprieteLocaux: a?.cf22.business.proprieteLocaux ?? '',
      locationDepuis: a?.cf22.business.lieuDepuis ?? '',
      adresse: demande.business.adresse,
    },
    garant: garantResume(ctx),
    garanties: totauxGaranties(ctx).demandeur,
    proposition: {
      montantPropose: num(a?.cf25.montantPropose) || null,
      echeanceMois: num(a?.cf25.echeanceMois) || null,
      mensualite: a ? resolveMensualite(a.cf25) || null : null,
      montantSollicite: demande.montant,
      echeanceSollicitee: demande.dureeMois,
    },
  };
}

/** Ligne garantie du Formulaire d’analyse (types regroupés comme l’Excel). */
export type GarantieAnalyseLigne = {
  type: GarantieType;
  valeurMarche: number;
  valeurGage: number;
  contribution: number | null;
};

export type FormulaireAnalyse = {
  demandeur: IdentiteDemandeur;
  demande: DemandeInitiale;
  conditions: ConditionsPret;
  compteResultat: Cf2CompteResultat | null;
  bilan: Cf2Bilan | null;
  ratios: Cf2RatioRow[];
  garanties: { lignes: GarantieAnalyseLigne[]; totalMarche: number; totalGage: number };
  menage: {
    nombrePersonnes: number;
    enfantsMoins18: number;
    adultesAvecRevenu: number;
    adultesSansRevenu: number;
    plusDe60Ans: number;
    depensesFamiliales: number;
  };
  personnes: Array<{ role: string; nom: string; contact: string; revenu: number | null }>;
  risques: Array<{ risque: string; mitigation: string }>;
  historique: FormulairesData['HISTORIQUE']['cycles'];
};

/** Formulaire d’analyse de prêt IL — synthèse (les #REF! de l’Excel réparés via CF5.1). */
export function buildFormulaireAnalyse(ctx: DossierContexte): FormulaireAnalyse {
  const a = ctx.analyse;
  const g = totauxGaranties(ctx);
  // Valeur de gage = valeur marchande (pas de décote définie dans l’Excel).
  const lignes = GARANTIE_TYPES.map((type) => {
    const v = g.demandeur.parType[type] + g.garant.parType[type];
    return { type, valeurMarche: v, valeurGage: v, contribution: null as number | null };
  }).filter((l) => l.valeurMarche > 0);
  const totalGage = lignes.reduce((acc, l) => acc + l.valeurGage, 0);
  for (const l of lignes) l.contribution = totalGage > 0 ? l.valeurGage / totalGage : null;

  const membres = a?.cf21.membres ?? [];
  const ages = membres.map((m) => num(m.age));
  const adultes = membres.filter((m) => num(m.age) >= 18);
  const garant = garantResume(ctx);
  const id = identiteDemandeur(ctx.payload);
  const personnes: FormulaireAnalyse['personnes'] = [];
  if (id.conjointNomComplet) {
    personnes.push({ role: 'Co-débiteur(trice)', nom: id.conjointNomComplet, contact: '', revenu: num(a?.cf21.revenuConjoint.salaireOuProfitNet) || null });
  }
  if (garant.nomComplet) {
    personnes.push({ role: 'Garant', nom: garant.nomComplet, contact: [garant.adresse, garant.telephone].filter(Boolean).join(' — '), revenu: garant.revenuMensuelNet });
  }
  for (const r of [...(a?.cf21.references ?? []), ...(a?.cf23.referencesBusiness ?? [])]) {
    if (r.nom.trim()) personnes.push({ role: 'Référence', nom: r.nom, contact: r.relationTelephone, revenu: null });
  }

  return {
    demandeur: id,
    demande: demandeInitiale(ctx),
    conditions: conditionsPret(ctx),
    compteResultat: a ? computeCompteResultat(a) : null,
    bilan: a ? computeBilan(a) : null,
    ratios: ratiosDossier(ctx),
    garanties: { lignes, totalMarche: lignes.reduce((acc, l) => acc + l.valeurMarche, 0), totalGage },
    menage: {
      nombrePersonnes: membres.filter((m) => m.nom.trim() || m.age.trim()).length,
      enfantsMoins18: ages.filter((x) => x > 0 && x < 18).length,
      adultesAvecRevenu: adultes.filter((m) => m.profession.trim()).length,
      adultesSansRevenu: adultes.filter((m) => !m.profession.trim()).length,
      plusDe60Ans: ages.filter((x) => x > 60).length,
      depensesFamiliales: a ? sumDepensesFamiliales(a.cf21.depenses) : 0,
    },
    personnes,
    risques: (a?.cf25.risques ?? [])
      .filter((r) => r.titre.trim())
      .map((r) => ({ risque: r.titre, mitigation: r.mitigation })),
    historique: ctx.formulaires.HISTORIQUE.cycles,
  };
}

/** Données communes aux documents imprimables (lettre, contrats, transfert). */
export function buildDocumentsContexte(ctx: DossierContexte, aujourdhui = new Date()) {
  const conditions = conditionsPret(ctx);
  const devise = demandeInitiale(ctx).devise;
  const plan =
    conditions.montant && conditions.dureeMois && conditions.tauxMensuel != null
      ? echeancier(conditions.montant, conditions.tauxMensuel, conditions.dureeMois)
      : null;
  const pv = ctx.formulaires.DECISION_COMITE;
  return {
    institution: ctx.parametres.institution,
    conditionsTarifaires: ctx.parametres.conditions,
    dateDocument: aujourdhui.toISOString(),
    demandeur: identiteDemandeur(ctx.payload),
    demande: demandeInitiale(ctx),
    garant: garantResume(ctx),
    conditions,
    devise,
    echeancier: plan,
    biensGages: [
      ...ctx.formulaires.CF5_1_DEMANDEUR.biens,
      ...ctx.formulaires.CF5_1_GARANT.biens,
    ].filter((b) => b.description.trim() || b.auto),
    numeroCredit: pv.numeroCredit,
    dateDeboursement: pv.dateDeboursement,
    montantEnLettres: conditions.montant ? montantEnLettres(conditions.montant, devise) : '',
  };
}
