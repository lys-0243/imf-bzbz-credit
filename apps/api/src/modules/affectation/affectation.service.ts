import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';
import {
  DOSSIER_ETAT_LABELS,
  montantSouhaiteFromPayload,
  type SuggestionAgents,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';

type AuthUser = {
  id: string;
  role: Role;
  zoneId?: string | null;
};

const EN_COURS_ETATS: DossierEtat[] = [
  DossierEtat.AFFECTE,
  DossierEtat.DESCENTE,
  DossierEtat.RETOUR_AGENT,
];

const AGENT_CHARGE_ETATS: DossierEtat[] = [
  DossierEtat.AFFECTE,
  DossierEtat.DESCENTE,
  DossierEtat.RETOUR_AGENT,
];

@Injectable()
export class AffectationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
  ) {}

  private assertRc(user: AuthUser) {
    if (user.role !== Role.RESPONSABLE_CREDIT) {
      throw new ForbiddenException('Rôle responsable crédit requis');
    }
  }

  async listAgents() {
    const agents = await this.prisma.user.findMany({
      where: { role: Role.AGENT, disabledAt: null },
      orderBy: [{ displayName: 'asc' }],
      include: {
        zone: { select: { id: true, code: true, name: true } },
        dossiersAgent: {
          where: { etat: { in: AGENT_CHARGE_ETATS } },
          orderBy: { updatedAt: 'desc' },
          include: {
            client: {
              select: {
                fullName: true,
                commune: { select: { name: true } },
                zone: { select: { name: true } },
              },
            },
            produit: { select: { code: true, label: true } },
          },
        },
      },
    });

    return agents.map((a) => {
      const dossiers = a.dossiersAgent.map((d) => {
        const montant = montantSouhaiteFromPayload(
          d.payload as Record<string, any>,
        );
        return {
          id: d.id,
          reference: d.reference,
          type: d.produit.code,
          produitLabel: d.produit.label,
          etat: d.etat,
          etatLabel: DOSSIER_ETAT_LABELS[d.etat],
          client: d.client,
          montantSouhaite: montant.montantSouhaite,
          devise: montant.devise,
          updatedAt: d.updatedAt,
        };
      });
      const actifs = dossiers.filter((d) =>
        EN_COURS_ETATS.includes(d.etat as DossierEtat),
      );
      const aValider = dossiers.filter(
        (d) => d.etat === DossierEtat.EN_ATTENTE_VALIDATION_RC,
      );
      let statut: 'disponible' | 'occupe' | 'a_valider' = 'disponible';
      if (aValider.length > 0) statut = 'a_valider';
      else if (actifs.length > 0 || dossiers.length > 0) statut = 'occupe';

      return {
        id: a.id,
        displayName: a.displayName,
        email: a.email,
        zone: a.zone,
        statut,
        dossiersEnCours: dossiers.length,
        dossiersActifs: actifs.length,
        dossiersAValider: aValider.length,
        dossiers,
      };
    });
  }

  async assign(user: AuthUser, dossierId: string, agentId: string, avisIaId?: string | null) {
    this.assertRc(user);
    const dossier = await this.prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) throw new NotFoundException('Dossier introuvable');
    if (dossier.etat !== DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT) {
      throw new BadRequestException("Ce dossier n'est pas en attente d'attribution");
    }
    const agent = await this.prisma.user.findFirst({
      where: { id: agentId, role: Role.AGENT, disabledAt: null },
      include: { zone: { select: { name: true, code: true } } },
    });
    if (!agent) throw new BadRequestException('Agent invalide ou désactivé');

    // Suggestion IA consultée : le choix du RC est tracé (rang proposé, accord).
    const avis = avisIaId
      ? await this.prisma.avisIa.findFirst({ where: { id: avisIaId, dossierId, type: 'SUGGESTION_AGENTS' } })
      : await this.prisma.avisIa.findFirst({
          where: { dossierId, type: 'SUGGESTION_AGENTS', statut: 'PRET' },
          orderBy: { createdAt: 'desc' },
        });
    const candidats = ((avis?.contenu as unknown as SuggestionAgents | null)?.candidats ?? []);
    const rangIa = candidats.find((c) => c.agentId === agent.id)?.rang ?? null;
    const accordAvecIa = avis ? rangIa === 1 : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.dossier.update({ where: { id: dossierId }, data: { agentId: agent.id } });
      await this.workflow.transitionTx(
        tx,
        user,
        { ...dossier, agentId: agent.id },
        DossierEtat.AFFECTE,
        {
          comment: `Affecté à ${agent.displayName}${agent.zone ? ` (${agent.zone.name})` : ''}${
            rangIa ? ` — suggestion IA n°${rangIa}` : avis ? ' — hors suggestions IA' : ''
          }`,
        },
      );
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
            avisIaId: avis?.id ?? null,
            rangIa,
            accordAvecIa,
          },
        },
        tx,
      );
    });

    return { id: dossierId, agentId: agent.id, agentName: agent.displayName, etat: DossierEtat.AFFECTE, rangIa };
  }
}
