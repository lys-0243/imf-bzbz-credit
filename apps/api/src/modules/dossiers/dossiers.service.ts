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
import { TerrainService } from '../terrain/terrain.service';

type AuthUser = { id: string; role: Role };

/** États listés par défaut pour chaque rôle de la hiérarchie. */
const ETATS_PAR_ROLE: Partial<Record<Role, DossierEtat[]>> = {
  [Role.CONFORMITE]: [DossierEtat.CONFORMITE],
  [Role.DG]: [DossierEtat.DIRECTION, DossierEtat.CONSEIL, DossierEtat.A_DECAISSER],
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
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    const anterieurs = await this.prisma.dossier.count({
      where: { clientId: d.clientId, createdAt: { lt: d.createdAt } },
    });
    const { formulaires, ...rest } = d;
    return {
      ...rest,
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
    d: { etat: DossierEtat; agentId: string | null; agentValideAt: Date | null },
  ): FormulaireCode[] {
    const ctx = {
      role: user.role,
      etat: d.etat,
      agentAssigne: d.agentId === user.id,
      agentAValide: d.agentValideAt != null,
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
      select: { etat: true, agentId: true, agentValideAt: true },
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
