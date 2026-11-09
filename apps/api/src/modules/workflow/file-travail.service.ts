import { Injectable } from '@nestjs/common';
import { DossierEtat, Prisma, Role, StatutAvisIa } from '@prisma/client';
import {
  avisAPreparer,
  CLASSE_RISQUE_LABELS,
  DOSSIER_ETAT_LABELS,
  ETAPE_WORKFLOW_LABELS,
  etapeDeEtat,
  montantEnUsd,
  montantSouhaiteFromPayload,
  type ClasseRisque,
  type EtapeWorkflow,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.service';

type AuthUser = { id: string; role: Role };

export type Onglet = { key: string; label: string; count: number; aTraiter: boolean };

type Regle = {
  key: string;
  label: string;
  /** Onglet « à traiter » (compté dans le badge de navigation). */
  aTraiter: boolean;
  match: (d: LigneBrute, user: AuthUser) => boolean;
};

const E = DossierEtat;
const ACTIFS_AGENT: DossierEtat[] = [E.AFFECTE, E.DESCENTE, E.RETOUR_AGENT];
const TERRAIN: DossierEtat[] = [E.AFFECTE, E.DESCENTE, E.RAPPORT_AGENT, E.SCORING, E.RETOUR_AGENT];
const FINAUX: DossierEtat[] = [E.A_DECAISSER, E.REJETE];

const INCLUDE = {
  client: { select: { fullName: true, phone: true, commune: { select: { name: true } }, zone: { select: { name: true } } } },
  produit: { select: { code: true, label: true } },
  agent: { select: { id: true, displayName: true } },
  analyste: { select: { id: true, displayName: true } },
  conformite: { select: { id: true, displayName: true } },
  _count: { select: { transitions: { where: { toEtat: { in: [E.RETOUR_AGENT, E.RETOUR_ANALYSTE] } } } } },
} satisfies Prisma.DossierInclude;

type LigneBrute = Prisma.DossierGetPayload<{ include: typeof INCLUDE }>;

/** Onglets de la file par rôle (ordre d'affichage). */
const ONGLETS: Partial<Record<Role, Regle[]>> = {
  [Role.AGENT]: [
    { key: 'nouveaux', label: 'Nouveaux', aTraiter: true, match: (d) => d.etat === E.AFFECTE },
    { key: 'retournes', label: 'Retournés', aTraiter: true, match: (d) => d.etat === E.RETOUR_AGENT },
    { key: 'en_cours', label: 'En cours', aTraiter: true, match: (d) => d.etat === E.DESCENTE },
    { key: 'soumis', label: 'Soumis', aTraiter: false, match: (d) => !ACTIFS_AGENT.includes(d.etat) && !FINAUX.includes(d.etat) },
    { key: 'clotures', label: 'Clôturés', aTraiter: false, match: (d) => FINAUX.includes(d.etat) },
  ],
  [Role.RESPONSABLE_CREDIT]: [
    { key: 'attribution', label: 'À attribuer', aTraiter: true, match: (d) => d.etat === E.EN_ATTENTE_ATTRIBUTION_AGENT },
    { key: 'validation', label: 'Validation finale', aTraiter: true, match: (d) => d.etat === E.EN_ATTENTE_VALIDATION_RC },
    { key: 'terrain', label: 'Chez les agents', aTraiter: false, match: (d) => TERRAIN.includes(d.etat) },
    { key: 'analyse', label: 'En analyse', aTraiter: false, match: (d) => d.etat === E.ANALYSTE || d.etat === E.RETOUR_ANALYSTE },
    { key: 'conformite', label: 'En conformité', aTraiter: false, match: (d) => d.etat === E.CONFORMITE },
    { key: 'direction', label: 'Direction / Conseil', aTraiter: false, match: (d) => d.etat === E.DIRECTION || d.etat === E.CONSEIL },
    { key: 'clotures', label: 'Clôturés', aTraiter: false, match: (d) => FINAUX.includes(d.etat) },
  ],
  [Role.ANALYSTE]: [
    { key: 'nouveaux', label: 'File commune', aTraiter: true, match: (d) => (d.etat === E.ANALYSTE || d.etat === E.RETOUR_ANALYSTE) && !d.analysteId },
    { key: 'mes_dossiers', label: 'Mes dossiers', aTraiter: true, match: (d, u) => d.etat === E.ANALYSTE && d.analysteId === u.id },
    { key: 'retournes', label: 'Retournés', aTraiter: true, match: (d, u) => d.etat === E.RETOUR_ANALYSTE && d.analysteId === u.id },
    { key: 'chez_agent', label: 'Renvoyés à l’agent', aTraiter: false, match: (d, u) => TERRAIN.includes(d.etat) && d.analysteId === u.id },
    { key: 'suivis', label: 'Transmis', aTraiter: false, match: (d, u) => d.analysteId === u.id && !TERRAIN.includes(d.etat) && d.etat !== E.ANALYSTE && d.etat !== E.RETOUR_ANALYSTE },
  ],
  [Role.CONFORMITE]: [
    { key: 'nouveaux', label: 'File commune', aTraiter: true, match: (d) => d.etat === E.CONFORMITE && !d.conformiteId },
    { key: 'mes_dossiers', label: 'Mes dossiers', aTraiter: true, match: (d, u) => d.etat === E.CONFORMITE && d.conformiteId === u.id },
    { key: 'suivis', label: 'Traités', aTraiter: false, match: (d, u) => d.conformiteId === u.id && d.etat !== E.CONFORMITE },
  ],
  [Role.DG]: [
    { key: 'a_decider', label: 'À décider', aTraiter: true, match: (d) => d.etat === E.DIRECTION },
    { key: 'conseil', label: 'Au Conseil', aTraiter: false, match: (d) => d.etat === E.CONSEIL },
    { key: 'clotures', label: 'Clôturés', aTraiter: false, match: (d) => FINAUX.includes(d.etat) },
  ],
  [Role.CA]: [
    { key: 'a_decider', label: 'À décider', aTraiter: true, match: (d) => d.etat === E.CONSEIL },
    { key: 'clotures', label: 'Clôturés', aTraiter: false, match: (d) => FINAUX.includes(d.etat) },
  ],
  [Role.ADMIN]: [
    { key: 'actifs', label: 'En cours', aTraiter: false, match: (d) => !FINAUX.includes(d.etat) },
    { key: 'clotures', label: 'Clôturés', aTraiter: false, match: (d) => FINAUX.includes(d.etat) },
  ],
};
ONGLETS[Role.DGA] = ONGLETS[Role.DG];

/** Filtre SQL du périmètre de chaque rôle. */
function perimetre(user: AuthUser): Prisma.DossierWhereInput {
  switch (user.role) {
    case Role.AGENT:
      return { agentId: user.id };
    case Role.ANALYSTE:
      return {
        OR: [
          { etat: { in: [E.ANALYSTE, E.RETOUR_ANALYSTE] }, analysteId: null },
          { analysteId: user.id },
        ],
      };
    case Role.CONFORMITE:
      return { OR: [{ etat: E.CONFORMITE, conformiteId: null }, { conformiteId: user.id }] };
    case Role.DG:
    case Role.DGA:
      return { etat: { in: [E.DIRECTION, E.CONSEIL, E.A_DECAISSER, E.REJETE] } };
    case Role.CA:
      return { etat: { in: [E.CONSEIL, E.A_DECAISSER, E.REJETE] } };
    case Role.RESPONSABLE_CREDIT:
    case Role.ADMIN:
      return { etat: { not: E.ENREGISTRE } };
    default:
      return { id: '__aucun__' };
  }
}

const JOUR = 86_400_000;

@Injectable()
export class FileTravailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
  ) {}

  async file(user: AuthUser) {
    const regles = ONGLETS[user.role] ?? [];
    const [rows, params] = await Promise.all([
      this.prisma.dossier.findMany({
        where: perimetre(user),
        include: INCLUDE,
        orderBy: { etatDepuis: 'asc' },
        take: 600,
      }),
      this.parametres.get(),
    ]);

    // Statut de l'avis IA de l'étape courante (pré-génération).
    const avis = rows.length
      ? await this.prisma.avisIa.findMany({
          where: { dossierId: { in: rows.map((r) => r.id) } },
          orderBy: { createdAt: 'desc' },
          select: { dossierId: true, type: true, statut: true },
        })
      : [];
    const statutAvis = new Map<string, StatutAvisIa>();
    for (const a of avis) {
      const k = `${a.dossierId}:${a.type}`;
      if (!statutAvis.has(k)) statutAvis.set(k, a.statut);
    }

    const now = Date.now();
    const lignes = rows.map((d) => {
      const regle = regles.find((r) => r.match(d, user));
      const etape = etapeDeEtat(d.etat);
      const montant = montantSouhaiteFromPayload((d.payload ?? {}) as Record<string, any>);
      const jours = Math.floor((now - d.etatDepuis.getTime()) / JOUR);
      const delai = etape ? params.delaisCiblesJours[etape] : null;
      const typeAvis = avisAPreparer(d.etat);
      const score = d.scoreReasons as { retenu?: { total: number; classe: ClasseRisque } } | null;
      const aTraiter = Boolean(regle?.aTraiter);
      const retour = d.etat === E.RETOUR_AGENT || d.etat === E.RETOUR_ANALYSTE;
      return {
        id: d.id,
        reference: d.reference,
        type: d.produit.code,
        produitLabel: d.produit.label,
        client: { fullName: d.client.fullName, commune: d.client.commune, zone: d.client.zone },
        etat: d.etat,
        etatLabel: DOSSIER_ETAT_LABELS[d.etat],
        etape,
        etapeLabel: etape ? ETAPE_WORKFLOW_LABELS[etape] : null,
        onglet: regle?.key ?? null,
        aTraiter,
        etatDepuis: d.etatDepuis,
        joursDansEtape: jours,
        enRetard: delai != null && jours > delai && !FINAUX.includes(d.etat),
        retours: d._count.transitions,
        montantSouhaite: montant.montantSouhaite,
        devise: montant.devise,
        agent: d.agent,
        analyste: d.analyste,
        conformite: d.conformite,
        score: score?.retenu ? { total: score.retenu.total, classe: score.retenu.classe } : null,
        avisIa: typeAvis ? (statutAvis.get(`${d.id}:${typeAvis}`) ?? null) : null,
        updatedAt: d.updatedAt,
        // Priorité : à traiter, retours, retard, ancienneté dans l'étape.
        priorite: (aTraiter ? 1000 : 0) + (retour ? 200 : 0) + (delai != null && jours > delai ? 100 : 0) + Math.min(99, jours),
      };
    });
    lignes.sort((a, b) => b.priorite - a.priorite || a.etatDepuis.getTime() - b.etatDepuis.getTime());

    const onglets: Onglet[] = regles.map((r) => ({
      key: r.key,
      label: r.label,
      aTraiter: r.aTraiter,
      count: lignes.filter((l) => l.onglet === r.key).length,
    }));
    return {
      onglets,
      aTraiter: lignes.filter((l) => l.aTraiter).length,
      dossiers: lignes.filter((l) => l.onglet != null),
    };
  }

  /** Indicateurs du tableau de bord. */
  async stats(user: AuthUser) {
    const params = await this.parametres.get();
    const [parEtat, decisions, retours, dossiersDirection] = await Promise.all([
      this.prisma.dossier.groupBy({ by: ['etat'], _count: { _all: true } }),
      this.prisma.decisionHumaine.findMany({
        where: { accordAvecIa: { not: null }, createdAt: { gte: new Date(Date.now() - 90 * JOUR) } },
        select: { etape: true, role: true, accordAvecIa: true },
      }),
      this.prisma.transition.groupBy({
        by: ['toEtat'],
        where: { toEtat: { in: [E.RETOUR_AGENT, E.RETOUR_ANALYSTE] }, createdAt: { gte: new Date(Date.now() - 90 * JOUR) } },
        _count: { _all: true },
      }),
      this.prisma.dossier.findMany({
        where: { etat: { in: [E.DIRECTION, E.CONSEIL] } },
        select: { payload: true },
      }),
    ]);

    const etapes: EtapeWorkflow[] = ['AFFECTATION', 'AGENT', 'ANALYSE', 'CONFORMITE', 'VALIDATION_RC', 'DIRECTION', 'CONSEIL'];
    const pipeline = etapes.map((etape) => ({
      etape,
      label: ETAPE_WORKFLOW_LABELS[etape],
      count: parEtat.filter((p) => etapeDeEtat(p.etat) === etape).reduce((s, p) => s + p._count._all, 0),
    }));
    const clotures = {
      accordes: parEtat.find((p) => p.etat === E.A_DECAISSER)?._count._all ?? 0,
      rejetes: parEtat.find((p) => p.etat === E.REJETE)?._count._all ?? 0,
    };

    const accordIa = etapes
      .map((etape) => {
        const xs = decisions.filter((d) => d.etape === etape);
        return {
          etape,
          label: ETAPE_WORKFLOW_LABELS[etape],
          decisions: xs.length,
          tauxAccord: xs.length ? xs.filter((d) => d.accordAvecIa).length / xs.length : null,
        };
      })
      .filter((x) => x.decisions > 0);

    const enJeu = dossiersDirection.reduce(
      (acc, d) => {
        const m = montantSouhaiteFromPayload((d.payload ?? {}) as Record<string, any>);
        const usd = m.montantSouhaite ? montantEnUsd(m.montantSouhaite, m.devise, params) : 0;
        acc.totalUsd += usd;
        if (usd > params.seuilApprobationCa) acc.auDessusSeuil++;
        else acc.sousSeuil++;
        return acc;
      },
      { totalUsd: 0, sousSeuil: 0, auDessusSeuil: 0 },
    );

    const file = await this.file(user);
    return {
      role: user.role,
      aTraiter: file.aTraiter,
      enRetard: file.dossiers.filter((d) => d.aTraiter && d.enRetard).length,
      onglets: file.onglets,
      pipeline,
      clotures,
      retours90j: {
        versAgent: retours.find((r) => r.toEtat === E.RETOUR_AGENT)?._count._all ?? 0,
        versAnalyste: retours.find((r) => r.toEtat === E.RETOUR_ANALYSTE)?._count._all ?? 0,
      },
      accordIa,
      direction: { ...enJeu, seuil: params.seuilApprobationCa },
      classes: CLASSE_RISQUE_LABELS,
    };
  }
}
