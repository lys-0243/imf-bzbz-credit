import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Prisma, Role } from '@prisma/client';
import {
  computeBilan,
  computeCf24Ratios,
  computeCompteResultat,
  DOSSIER_ETAT_LABELS,
  FORMULAIRES,
  isFormulaireCode,
  montantSouhaiteFromPayload,
  normalizeCf2Analyse,
  actionsDisponibles,
  etapeDeEtat,
  montantEnUsd,
  regleTransition,
  normalizeFormulaire,
  normalizeFormulaires,
  peutEditerFormulaire,
  usesAnalyseAgrPack,
  type CyclePrecedent,
  type FormulaireCode,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { ParametresService } from '../parametres/parametres.service';
import { TerrainService } from '../terrain/terrain.service';

type AuthUser = { id: string; role: Role };

/** États listés par défaut pour chaque rôle de la hiérarchie. */
const ETATS_PAR_ROLE: Partial<Record<Role, DossierEtat[]>> = {
  [Role.CONFORMITE]: [DossierEtat.CONFORMITE],
  [Role.DG]: [DossierEtat.DIRECTION, DossierEtat.CONSEIL, DossierEtat.A_DECAISSER],
  [Role.DGA]: [DossierEtat.DIRECTION, DossierEtat.CONSEIL, DossierEtat.A_DECAISSER],
  [Role.CA]: [DossierEtat.CONSEIL, DossierEtat.A_DECAISSER],
  [Role.ADMIN]: [
    DossierEtat.CONFORMITE,
    DossierEtat.DIRECTION,
    DossierEtat.CONSEIL,
    DossierEtat.A_DECAISSER,
    DossierEtat.REJETE,
  ],
};

@Injectable()
export class DossiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly terrain: TerrainService,
    private readonly parametres: ParametresService,
  ) {}

  async list(user: AuthUser) {
    const etats = ETATS_PAR_ROLE[user.role];
    if (!etats) throw new ForbiddenException('Liste non disponible pour ce rôle');
    const rows = await this.prisma.dossier.findMany({
      where: { etat: { in: etats } },
      orderBy: { updatedAt: 'desc' },
      take: 300,
      include: {
        client: { include: { zone: true, commune: true } },
        produit: true,
        agent: { select: { id: true, displayName: true } },
      },
    });
    return rows.map((d) => {
      const montant = montantSouhaiteFromPayload(d.payload as Record<string, any>);
      return {
        id: d.id,
        reference: d.reference,
        type: d.produit.code,
        produitLabel: d.produit.label,
        etat: d.etat,
        etatLabel: DOSSIER_ETAT_LABELS[d.etat],
        bucket: d.etat,
        client: d.client,
        agent: d.agent,
        updatedAt: d.updatedAt,
        montantSouhaite: montant.montantSouhaite,
        devise: montant.devise,
      };
    });
  }

  async getOne(user: AuthUser, id: string) {
    await this.documents.assertCanAccessDossier(user, id);
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        produit: true,
        pieces: { orderBy: { createdAt: 'asc' } },
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
        formulaires: true,
        analyste: { select: { id: true, displayName: true } },
        conformite: { select: { id: true, displayName: true } },
        decisions: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { id: true, displayName: true } } },
        },
        cbsEnvois: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    const acteurs = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(d.transitions.map((t) => t.actorId))] } },
      select: { id: true, displayName: true, role: true },
    });
    const parametres = await this.parametres.get();
    const anterieurs = await this.prisma.dossier.count({
      where: { clientId: d.clientId, createdAt: { lt: d.createdAt } },
    });
    const { formulaires, decisions, cbsEnvois, ...rest } = d;
    const titulaires = {
      userId: user.id,
      agentId: d.agentId,
      analysteId: d.analysteId,
      conformiteId: d.conformiteId,
    };
    const montant = montantSouhaiteFromPayload((d.payload ?? {}) as Record<string, any>);
    return {
      ...rest,
      transitions: d.transitions.map((t) => {
        const a = acteurs.find((x) => x.id === t.actorId);
        return {
          ...t,
          acteur: a ? { id: a.id, displayName: a.displayName, role: a.role } : null,
          nature: t.fromEtat ? (regleTransition(t.fromEtat, t.toEtat)?.nature ?? 'avance') : 'avance',
        };
      }),
      decisions: decisions.map((x) => ({
        id: x.id,
        etape: x.etape,
        role: x.role,
        acteur: x.actor,
        recommandation: x.recommandation,
        montantRetenu: x.montantRetenu,
        dureeRetenueMois: x.dureeRetenueMois,
        accordAvecIa: x.accordAvecIa,
        commentaire: x.commentaire,
        avisIaId: x.avisIaId,
        createdAt: x.createdAt,
      })),
      etape: etapeDeEtat(d.etat),
      titulaires: { agent: d.agent, analyste: d.analyste, conformite: d.conformite },
      peutPrendreEnCharge:
        (user.role === Role.ANALYSTE &&
          (d.etat === DossierEtat.ANALYSTE || d.etat === DossierEtat.RETOUR_ANALYSTE) &&
          !d.analysteId) ||
        (user.role === Role.CONFORMITE && d.etat === DossierEtat.CONFORMITE && !d.conformiteId),
      actions: actionsDisponibles(d.etat, user.role, titulaires).map((r) => ({
        toEtat: r.to,
        label: r.label,
        nature: r.nature,
        motifRequis: r.motifRequis,
      })),
      seuil: {
        seuilConseilUsd: parametres.seuilApprobationCa,
        montantUsd: montant.montantSouhaite ? montantEnUsd(montant.montantSouhaite, montant.devise, parametres) : null,
        delaiCibleJours: (() => {
          const e = etapeDeEtat(d.etat);
          return e ? parametres.delaisCiblesJours[e] : null;
        })(),
      },
      cbs: cbsEnvois[0]
        ? {
            statut: cbsEnvois[0].statut,
            tentatives: cbsEnvois[0].tentatives,
            dernierMessage: cbsEnvois[0].dernierMessage,
            envoyeAt: cbsEnvois[0].envoyeAt,
            updatedAt: cbsEnvois[0].updatedAt,
          }
        : null,
      type: d.produit.code,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      checklistAnswers: d.visite?.checklistJson ?? null,
      analyseCf2: normalizeCf2Analyse(d.visite?.analyseCf2Json, {
        visiteStartedAt: d.visite?.startedAt?.toISOString() ?? null,
      }),
      usesAnalyseAgrPack: usesAnalyseAgrPack(d.produit.code),
      formulaires: normalizeFormulaires(
        Object.fromEntries(formulaires.map((f) => [f.code, f.data])),
      ),
      formulairesEditables: this.editables(user, d),
      nouveauClient: anterieurs === 0,
    };
  }

  private editables(
    user: AuthUser,
    d: {
      etat: DossierEtat;
      agentId: string | null;
      agentValideAt: Date | null;
      analysteId: string | null;
      conformiteId: string | null;
    },
  ): FormulaireCode[] {
    const ctx = {
      role: user.role,
      etat: d.etat,
      agentAssigne: d.agentId === user.id,
      agentAValide: d.agentValideAt != null,
      titulaireAnalyse: !d.analysteId || d.analysteId === user.id,
      titulaireConformite: !d.conformiteId || d.conformiteId === user.id,
    };
    return (Object.keys(FORMULAIRES) as FormulaireCode[]).filter((code) =>
      peutEditerFormulaire(code, ctx),
    );
  }

  async listFormulaires(user: AuthUser, id: string) {
    await this.documents.assertCanAccessDossier(user, id);
    const rows = await this.prisma.dossierFormulaire.findMany({ where: { dossierId: id } });
    return normalizeFormulaires(Object.fromEntries(rows.map((f) => [f.code, f.data])));
  }

  async saveFormulaire(user: AuthUser, id: string, code: string, raw: unknown) {
    if (!isFormulaireCode(code)) {
      throw new BadRequestException(`Formulaire inconnu : ${code}`);
    }
    await this.documents.assertCanAccessDossier(user, id);
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      select: { etat: true, agentId: true, agentValideAt: true, analysteId: true, conformiteId: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    if (!this.editables(user, d).includes(code)) {
      throw new ForbiddenException(
        `${FORMULAIRES[code].label} non modifiable par ${user.role} à l’état ${d.etat}`,
      );
    }
    // Comme les autres saisies agent : ouvre le travail terrain (AFFECTE → DESCENTE).
    if (user.role === Role.AGENT && FORMULAIRES[code].edition.some((r) => r.agentTerrain)) {
      await this.terrain.ensureAgentTerrain(user, id);
    }

    // Saisir le rapport ou l'avis de conformité vaut prise en charge.
    if (code === 'RAPPORT_ANALYSE' && user.role === Role.ANALYSTE && !d.analysteId) {
      await this.prisma.dossier.updateMany({ where: { id, analysteId: null }, data: { analysteId: user.id } });
    }
    if (code === 'AVIS_CONFORMITE' && user.role === Role.CONFORMITE && !d.conformiteId) {
      await this.prisma.dossier.updateMany({ where: { id, conformiteId: null }, data: { conformiteId: user.id } });
    }
    const data = normalizeFormulaire(code, raw);
    if (JSON.stringify(data).length > 200_000) {
      throw new BadRequestException('Formulaire trop volumineux');
    }
    const json = data as unknown as Prisma.InputJsonValue;
    await this.prisma.dossierFormulaire.upsert({
      where: { dossierId_code: { dossierId: id, code } },
      create: { dossierId: id, code, data: json, updatedById: user.id },
      update: { data: json, updatedById: user.id },
    });
    await this.audit.log({
      dossierId: id,
      actorId: user.id,
      action: 'FORMULAIRE_ENREGISTRE',
      entityType: 'DOSSIER',
      entityId: id,
      payload: { code },
    });
    return data;
  }

  /** Feuille « Histotique » : cycles précédents du même client (CF2 recalculé). */
  async cyclesPrecedents(user: AuthUser, id: string): Promise<CyclePrecedent[]> {
    await this.documents.assertCanAccessDossier(user, id);
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      select: { clientId: true, createdAt: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    const rows = await this.prisma.dossier.findMany({
      where: { clientId: d.clientId, createdAt: { lt: d.createdAt } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { visite: true },
    });
    return rows.map((p) => {
      const analyse = p.visite?.analyseCf2Json
        ? normalizeCf2Analyse(p.visite.analyseCf2Json)
        : null;
      const cr = analyse ? computeCompteResultat(analyse) : null;
      const b = analyse ? computeBilan(analyse) : null;
      return {
        dossierId: p.id,
        reference: p.reference,
        etat: p.etat,
        createdAt: p.createdAt.toISOString(),
        montantSollicite: montantSouhaiteFromPayload(p.payload as Record<string, any>)
          .montantSouhaite,
        compteResultat:
          cr && cr.chiffreAffaires > 0
            ? {
                chiffreAffaires: cr.chiffreAffaires,
                cmv: cr.cmv,
                profitBrut: cr.profitBrut,
                depensesExploitation: cr.depensesExploitation,
                profitNetExploitation: cr.profitNetExploitation,
                depensesPrivees: cr.depensesPrivees,
                capacitePaiement: cr.capacitePaiement,
              }
            : null,
        bilan: b
          ? {
              actifsCirculants: b.actifsCirculants,
              caisse: b.caisse,
              banque: b.banque,
              creances: b.creances,
              stock: b.stock,
              actifsImmobilises: b.actifsImmobilises,
              totalActifs: b.totalActifs,
              dettesCourtTerme: b.dettesCourtTerme,
              dettesLongTerme: b.dettesLongTerme,
              capitalPropre: b.capitalPropre,
            }
          : null,
        ratios: analyse
          ? computeCf24Ratios(analyse).map((r) => ({
              key: r.key,
              label: r.label,
              value: r.value,
              asPercent: r.asPercent,
            }))
          : [],
      };
    });
  }
}
