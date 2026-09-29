import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';
import { DOSSIER_ETAT_LABELS, montantSouhaiteFromPayload } from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';

type AuthUser = {
  id: string;
  role: Role;
  zoneId?: string | null;
};

const CLOSED: DossierEtat[] = [DossierEtat.A_DECAISSER, DossierEtat.REJETE];

@Injectable()
export class AffectationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
  ) {}

  async listFile() {
    const rows = await this.prisma.dossier.findMany({
      where: { etat: DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT },
      orderBy: { createdAt: 'asc' },
      include: {
        client: { include: { zone: true, commune: true } },
        produit: true,
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
    return rows.map((d) => {
      const montant = montantSouhaiteFromPayload(
        d.payload as Record<string, any>,
      );
      return {
        id: d.id,
        reference: d.reference,
        type: d.produit.code,
        produit: d.produit,
        produitLabel: d.produit.label,
        etat: d.etat,
        etatLabel: DOSSIER_ETAT_LABELS[d.etat],
        client: d.client,
        createdBy: d.createdBy,
        montantSouhaite: montant.montantSouhaite,
        devise: montant.devise,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
  }

  async getOne(id: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        produit: true,
        pieces: { orderBy: { createdAt: 'asc' } },
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    if (d.etat !== DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT) {
      throw new BadRequestException(
        "Ce dossier n'est plus en attente d'attribution",
      );
    }
    return {
      ...d,
      type: d.produit.code,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      editable: false,
    };
  }

  async listAgents() {
    const agents = await this.prisma.user.findMany({
      where: { role: Role.AGENT, disabledAt: null },
      orderBy: [{ displayName: 'asc' }],
      include: {
        zone: { select: { id: true, code: true, name: true } },
      },
    });

    const counts = await this.prisma.dossier.groupBy({
      by: ['agentId'],
      where: {
        agentId: { in: agents.map((a) => a.id) },
        etat: { notIn: CLOSED },
      },
      _count: { _all: true },
    });
    const countMap = Object.fromEntries(
      counts.map((c) => [c.agentId!, c._count._all]),
    );

    return agents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      email: a.email,
      zone: a.zone,
      dossiersEnCours: countMap[a.id] ?? 0,
    }));
  }

  async assign(user: AuthUser, dossierId: string, agentId: string) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    if (dossier.etat !== DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT) {
      throw new BadRequestException(
        "Ce dossier n'est pas en attente d'attribution",
      );
    }

    const agent = await this.prisma.user.findFirst({
      where: { id: agentId, role: Role.AGENT, disabledAt: null },
      include: { zone: { select: { name: true, code: true } } },
    });
    if (!agent) {
      throw new BadRequestException('Agent invalide ou désactivé');
    }

    this.workflow.assertTransition(
      dossier.etat,
      DossierEtat.AFFECTE,
      user.role,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: dossierId },
        data: {
          agentId: agent.id,
          etat: DossierEtat.AFFECTE,
        },
      });
      await tx.transition.create({
        data: {
          dossierId,
          fromEtat: DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT,
          toEtat: DossierEtat.AFFECTE,
          comment: `Affecté à ${agent.displayName}${
            agent.zone ? ` (${agent.zone.name})` : ''
          }`,
          actorId: user.id,
        },
      });
      await this.audit.log(
        {
          dossierId,
          actorId: user.id,
          action: 'DOSSIER_ASSIGNED',
          entityType: 'DOSSIER',
          entityId: dossierId,
          payload: {
            agentId: agent.id,
            agentName: agent.displayName,
            zoneId: agent.zoneId,
          },
        },
        tx,
      );
    });

    return {
      id: dossierId,
      agentId: agent.id,
      agentName: agent.displayName,
      etat: DossierEtat.AFFECTE,
    };
  }
}
