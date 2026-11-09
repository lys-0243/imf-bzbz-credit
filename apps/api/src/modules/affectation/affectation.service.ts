import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Role } from '@prisma/client';
import {
  DOSSIER_ETAT_LABELS,
  MOTIF_ECART_AFFECTATION_LABELS,
  MOTIF_ECART_MIN_CARACTERES,
  montantSouhaiteFromPayload,
  NOM_ASSISTANT_IA,
  type MotifEcartAffectation,
  type SuggestionAgents,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowService } from '../workflow/workflow.service';

/** Retire les noms du client d'un texte libre avant de le confier à l'IA. */
function sansNomsClient(texte: string, noms: Array<string | null | undefined>): string {
  let t = texte;
  const mots = noms
    .flatMap((n) => String(n ?? '').split(/\s+/))
    .map((m) => m.trim())
    .filter((m) => m.length >= 3)
    .sort((a, b) => b.length - a.length);
  for (const m of mots) {
    t = t.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'le client');
  }
  return t.replace(/(le client\s*){2,}/gi, 'le client ').trim();
}

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

  async assign(
    user: AuthUser,
    dossierId: string,
    agentId: string,
    avisIaId?: string | null,
    motif?: { categorie?: MotifEcartAffectation; texte?: string },
  ) {
    this.assertRc(user);
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        client: {
          select: {
            fullName: true,
            zoneId: true,
            communeId: true,
            zone: { select: { name: true } },
            commune: { select: { name: true } },
          },
        },
        produit: { select: { code: true, label: true } },
      },
    });
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
    const suggere = candidats.find((c) => c.rang === 1) ?? null;

    // Écart avec le n°1 de l'IA : la raison est obligatoire (traçabilité + apprentissage).
    const ecart = avis != null && suggere != null && rangIa !== 1;
    const motifTexte = (motif?.texte ?? '').trim();
    if (ecart && (!motif?.categorie || motifTexte.length < MOTIF_ECART_MIN_CARACTERES)) {
      throw new BadRequestException(
        `${suggere!.displayName} était le n°1 suggéré par ${NOM_ASSISTANT_IA} : indiquez la raison de votre choix ` +
          `(motif et explication d’au moins ${MOTIF_ECART_MIN_CARACTERES} caractères).`,
      );
    }
    const p = (dossier.payload ?? {}) as Record<string, any>;
    const retour = ecart
      ? {
          motifCategorie: motif!.categorie!,
          motif: motifTexte,
          // Version destinée à l'IA : sans le nom du client.
          motifIa: sansNomsClient(motifTexte, [dossier.client.fullName, p.prenom, p.nom, p.postNom]),
          agentSuggereId: suggere!.agentId,
          agentSuggereNom: suggere!.displayName,
          contexte: {
            produitCode: dossier.produit.code,
            produitLabel: dossier.produit.label,
            zoneId: dossier.client.zoneId,
            communeId: dossier.client.communeId,
            zone: dossier.client.zone?.name ?? null,
            commune: dossier.client.commune?.name ?? null,
            montant: montantSouhaiteFromPayload(p).montantSouhaite,
          },
        }
      : null;

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
          }${retour ? ` — écart motivé : ${MOTIF_ECART_AFFECTATION_LABELS[retour.motifCategorie]}` : ''}`,
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
            ...(retour ?? {}),
          },
        },
        tx,
      );
    });

    return { id: dossierId, agentId: agent.id, agentName: agent.displayName, etat: DossierEtat.AFFECTE, rangIa };
  }
}
