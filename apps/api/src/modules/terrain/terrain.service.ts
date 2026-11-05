import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Prisma, Role } from '@prisma/client';
import {
  ChecklistAnswers,
  DOSSIER_ETAT_LABELS,
  clientFieldsFromPayload,
  getApplicableChecklistItems,
  getChecklistAc,
  mergeAgentChecklistAnswers,
  mergeAgentEnrichmentIntoPayload,
  mergeCf2Analyse,
  montantSouhaiteFromPayload,
  normalizeCf2Analyse,
  parseAgentEnrichment,
  usesAnalyseAgrPack,
  validateAgentChecklist,
  validateAgentEnrichmentComplete,
  type AgentActiviteEnrichment,
  type AgentSalaireEnrichment,
  type Cf2Analyse,
  type FamilleProduit,
} from '@imf/shared';
import { ZodError } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { redactPii } from '../llm/redact-pii';
import { ScoringService } from '../scoring/scoring.service';
import { WorkflowService } from '../workflow/workflow.service';

type AuthUser = {
  id: string;
  role: Role;
  zoneId?: string | null;
};

const AGENT_ACTIVE_ETATS: DossierEtat[] = [
  DossierEtat.AFFECTE,
  DossierEtat.DESCENTE,
  DossierEtat.RETOUR_AGENT,
];

@Injectable()
export class TerrainService {
  private readonly logger = new Logger(TerrainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
    private readonly scoring: ScoringService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  private assertAgentOwns(
    dossier: { agentId: string | null },
    user: AuthUser,
  ) {
    if (user.role !== Role.AGENT) {
      throw new ForbiddenException('Rôle agent requis');
    }
    if (dossier.agentId !== user.id) {
      throw new ForbiddenException('Dossier non assigné à cet agent');
    }
  }

  async listMine(user: AuthUser) {
    if (user.role !== Role.AGENT) {
      throw new ForbiddenException('Rôle agent requis');
    }
    const where: Prisma.DossierWhereInput = { agentId: user.id };

    const rows = await this.prisma.dossier.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { include: { zone: true, commune: true } },
        produit: true,
        visite: true,
      },
    });
    return rows.map((d) => {
      const montant = montantSouhaiteFromPayload(
        d.payload as Record<string, any>,
      );
      return {
        id: d.id,
        reference: d.reference,
        produit: d.produit,
        produitLabel: d.produit.label,
        type: d.produit.code,
        etat: d.etat,
        etatLabel: DOSSIER_ETAT_LABELS[d.etat],
        client: d.client,
        agentValideAt: d.agentValideAt,
        visiteStartedAt: d.visite?.startedAt ?? null,
        updatedAt: d.updatedAt,
        createdAt: d.createdAt,
        bucket: this.agentBucket(d.etat, d.agentValideAt),
        montantSouhaite: montant.montantSouhaite,
        devise: montant.devise,
      };
    });
  }

  private agentBucket(
    etat: DossierEtat,
    agentValideAt: Date | null,
  ): 'nouveaux' | 'en_cours' | 'retournes' | 'termines' {
    if (etat === DossierEtat.AFFECTE) return 'nouveaux';
    if (etat === DossierEtat.DESCENTE) return 'en_cours';
    if (etat === DossierEtat.RETOUR_AGENT) return 'retournes';
    if (agentValideAt != null || !AGENT_ACTIVE_ETATS.includes(etat)) {
      return 'termines';
    }
    return 'en_cours';
  }

  async getOne(user: AuthUser, id: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        produit: true,
        pieces: { orderBy: { createdAt: 'asc' } },
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);

    const answers = (d.visite?.checklistJson as ChecklistAnswers | null) ?? {
      flags: { hasGarant: true },
      values: {},
    };
    const flags = answers.flags ?? { hasGarant: true };
    const payload = (d.payload ?? {}) as Record<string, any>;
    const checklist = getApplicableChecklistItems(
      d.produit.famille,
      payload,
      flags,
      'AGENT',
    );

    return {
      ...d,
      type: d.produit.code,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      editable: d.agentValideAt == null,
      checklist,
      checklistAnswers: answers,
      flags,
      analyseCf2: normalizeCf2Analyse(d.visite?.analyseCf2Json, {
        visiteStartedAt: d.visite?.startedAt?.toISOString() ?? null,
      }),
      usesAnalyseAgrPack: usesAnalyseAgrPack(d.produit.code),
    };
  }

  /**
   * Plus de « démarrer la descente » manuel : crée la VisiteTerrain si besoin
   * et passe AFFECTE / RETOUR_AGENT → DESCENTE pour débloquer le travail agent.
   */
  async ensureAgentTerrain(
    user: AuthUser,
    id: string,
  ): Promise<void> {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { visite: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);
    if (d.agentValideAt) {
      throw new ForbiddenException('Dossier déjà soumis');
    }
    if (
      d.etat !== DossierEtat.AFFECTE &&
      d.etat !== DossierEtat.DESCENTE &&
      d.etat !== DossierEtat.RETOUR_AGENT
    ) {
      throw new BadRequestException(
        `Travail agent impossible depuis l'état ${d.etat}`,
      );
    }

    const needsVisite = !d.visite;
    const needsDescente =
      d.etat === DossierEtat.AFFECTE || d.etat === DossierEtat.RETOUR_AGENT;

    if (!needsVisite && !needsDescente) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (needsDescente) {
        this.workflow.assertTransition(d.etat, DossierEtat.DESCENTE, user.role);
        await tx.dossier.update({
          where: { id },
          data: { etat: DossierEtat.DESCENTE },
        });
        await tx.transition.create({
          data: {
            dossierId: id,
            fromEtat: d.etat,
            toEtat: DossierEtat.DESCENTE,
            comment: 'Ouverture du travail terrain (sans démarrage manuel)',
            actorId: user.id,
          },
        });
        await this.audit.log(
          {
            dossierId: id,
            actorId: user.id,
            action: 'TERRAIN_OPENED',
            entityType: 'DOSSIER',
            entityId: id,
            payload: { reference: d.reference },
          },
          tx,
        );
      }
      if (needsVisite) {
        await tx.visiteTerrain.create({
          data: {
            dossierId: id,
            agentId: user.id,
            startedAt: now,
            checklistJson: {
              flags: { hasGarant: true, dat: false, hypotheque: false },
              values: {},
            } as Prisma.InputJsonValue,
          },
        });
      } else if (needsDescente) {
        await tx.visiteTerrain.update({
          where: { dossierId: id },
          data: { agentId: user.id, completedAt: null },
        });
      }
    });
  }

  async startVisite(user: AuthUser, id: string, visiteDateRaw: string) {
    // Conservé pour compat API : délègue à ensure + met à jour la date.
    await this.ensureAgentTerrain(user, id);
    const visiteDate = this.parseVisiteDate(visiteDateRaw);
    await this.prisma.visiteTerrain.update({
      where: { dossierId: id },
      data: { startedAt: visiteDate, agentId: user.id },
    });
    return this.getOne(user, id);
  }

  private parseVisiteDate(raw: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || '').trim());
    if (!m) {
      throw new BadRequestException(
        'Date de descente invalide (format attendu AAAA-MM-JJ)',
      );
    }
    const date = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Date de descente invalide');
    }
    const today = new Date();
    const max = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 30),
    );
    const min = new Date(
      Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()),
    );
    if (date < min || date > max) {
      throw new BadRequestException(
        'La date de descente doit être comprise dans une plage raisonnable',
      );
    }
    return date;
  }

  async generateRapport(user: AuthUser, id: string) {
    await this.ensureAgentTerrain(user, id);

    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { commune: true, zone: true } },
        agent: { select: { displayName: true } },
        produit: true,
        pieces: true,
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d?.visite) throw new NotFoundException('Dossier introuvable');

    const payload = (d.payload ?? {}) as Record<string, any>;
    const { montantSouhaite, devise } = montantSouhaiteFromPayload(payload);
    const context = {
      reference: d.reference,
      type: d.produit.code,
      produitLabel: d.produit.label,
      famille: d.produit.famille,
      etat: d.etat,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      client: {
        fullName: d.client.fullName,
        phone: d.client.phone,
        commune: d.client.commune?.name ?? null,
        zone: d.client.zone?.name ?? null,
        activityAddress: d.client.activityAddress,
      },
      agent: d.agent?.displayName ?? null,
      visiteDate: d.visite.startedAt,
      montantSouhaite,
      devise,
      pieces: d.pieces.map((p) => p.kind),
      payload,
      transitions: d.transitions.map((t) => ({
        from: t.fromEtat,
        to: t.toEtat,
        comment: t.comment,
        at: t.createdAt,
      })),
    };

    const rapportTexte = await this.buildAiResume(context);
    return { rapportTexte };
  }

  private async buildAiResume(context: Record<string, unknown>): Promise<string> {
    const fallback = this.buildFallbackResume(context);
    if (!this.llm.isConfigured()) return fallback;

    try {
      const res = await this.llm.complete({
        temperature: 0.3,
        system:
          "Tu es un agent de crédit IMF en RDC. Rédige un résumé exécutif de descente terrain en français, professionnel, structuré (contexte client, activité/emploi, demande de crédit, points d'attention, recommandation). 180 à 280 mots. Pas de markdown. Les données nominatives sont retirées : désigne le demandeur par « le client ».",
        user: `Analyse ce dossier et génère le résumé exécutif à valider par l'agent :
${JSON.stringify(redactPii(context), null, 2)}`,
      });
      return res.text;
    } catch {
      return fallback;
    }
  }

  private buildFallbackResume(context: Record<string, unknown>): string {
    const client = (context.client ?? {}) as Record<string, unknown>;
    const payload = (context.payload ?? {}) as Record<string, any>;
    const montant = context.montantSouhaite;
    const devise = context.devise || '';
    const type = String(context.produitLabel || context.type || '');
    const famille = String(context.famille || '');
    const pieces = Array.isArray(context.pieces)
      ? (context.pieces as string[])
      : [];
    const visiteDate = context.visiteDate
      ? new Date(String(context.visiteDate)).toLocaleDateString('fr-FR')
      : '—';

    const lines = [
      `Résumé exécutif — dossier ${context.reference} (${type}).`,
      `Descente effectuée le ${visiteDate} pour le client ${client.fullName || '—'}, joignable au ${client.phone || '—'}, zone ${client.zone || '—'} / commune ${client.commune || '—'}.`,
      `Montant sollicité : ${montant != null ? `${devise} ${Number(montant).toLocaleString('fr-FR')}` : 'non précisé'}.`,
    ];

    if (famille === 'SALAIRE' || payload.societe != null) {
      lines.push(
        `Emploi : ${payload.societe || '—'}, fonction ${payload.fonctionService || '—'}, salaire net déclaré ${payload.salaireNet || '—'}, capacité mensuelle ${payload.capaciteMensuelle || '—'}. Motif : ${payload.motifCredit || '—'}.`,
      );
    } else if (payload.demandeur) {
      const dem = payload.demandeur ?? {};
      const biz = payload.business ?? {};
      const pret = payload.pret ?? {};
      lines.push(
        `Demandeur : ${[dem.prenom, dem.nom, dem.postNom].filter(Boolean).join(' ') || client.fullName || '—'}. Activité : ${biz.nomBusiness || '—'} (${biz.typeBusiness || '—'}, secteur ${biz.secteurBusiness || '—'}).`,
        `Prêt souhaité : ${pret.montantDesire != null ? `${pret.devise || ''} ${pret.montantDesire}` : '—'} sur ${pret.dureeMois || '—'} mois. But : ${pret.butInvestissement || '—'}.`,
      );
    } else {
      lines.push(
        `Client : ${[payload.prenom, payload.nom, payload.postNom].filter(Boolean).join(' ') || client.fullName || '—'}. Motif : ${payload.motifCredit || '—'}. Durée : ${payload.duree ?? '—'}.`,
      );
    }

    lines.push(
      `Pièces déjà présentes au dossier : ${pieces.length ? pieces.join(', ') : 'aucune'}.`,
      `Points d’attention : vérifier la cohérence des revenus/activité, la complétude documentaire et l’adresse d’activité déclarée (${client.activityAddress || '—'}).`,
      `Recommandation provisoire : poursuivre l’instruction sous réserve de validation terrain et de complétude des pièces manquantes.`,
    );

    return lines.join('\n\n');
  }

  async saveChecklist(
    user: AuthUser,
    id: string,
    answers: ChecklistAnswers,
  ) {
    await this.ensureAgentTerrain(user, id);

    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { visite: true, pieces: true, produit: true },
    });
    if (!d?.visite) throw new NotFoundException('Dossier introuvable');

    const existing = (d.visite.checklistJson as ChecklistAnswers | null) ?? {
      flags: { hasGarant: true },
      values: {},
    };
    const merged = mergeAgentChecklistAnswers(existing, answers);

    const uploadedKinds = new Set(d.pieces.map((p) => p.kind));
    const uploadItems = getApplicableChecklistItems(
      d.produit.famille,
      (d.payload ?? {}) as Record<string, any>,
      merged.flags ?? {},
      'ALL',
    ).filter((item) => item.input === 'upload');

    for (const item of uploadItems) {
      const val = merged.values?.[item.id];
      if (!getChecklistAc(val)) continue;
      const kind = item.kind ?? item.id;
      const hasPiece = uploadedKinds.has(kind);
      const hasAvis = Boolean((val?.note ?? '').trim());
      if (!hasPiece && !hasAvis) {
        throw new BadRequestException(
          `Impossible de valider AC sans pièce ni avis : ${item.label}`,
        );
      }
    }

    await this.prisma.visiteTerrain.update({
      where: { dossierId: id },
      data: { checklistJson: merged as Prisma.InputJsonValue },
    });
    return this.getOne(user, id);
  }

  async saveCf2(user: AuthUser, id: string, patch: Partial<Cf2Analyse>) {
    await this.ensureAgentTerrain(user, id);

    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { visite: true, produit: true },
    });
    if (!d?.visite) throw new NotFoundException('Dossier introuvable');
    if (!usesAnalyseAgrPack(d.produit.code)) {
      throw new BadRequestException(
        'Analyse CF2 non applicable au produit DARE_DARE',
      );
    }

    const existing = normalizeCf2Analyse(d.visite.analyseCf2Json, {
      visiteStartedAt: d.visite.startedAt?.toISOString() ?? null,
    });
    const merged = mergeCf2Analyse(existing, patch);

    await this.prisma.visiteTerrain.update({
      where: { dossierId: id },
      data: {
        analyseCf2Json: merged as Prisma.InputJsonValue,
      },
    });
    return this.getOne(user, id);
  }

  async saveRapport(user: AuthUser, id: string, rapportTexte: string) {
    await this.ensureAgentTerrain(user, id);

    await this.prisma.visiteTerrain.update({
      where: { dossierId: id },
      data: { rapportTexte },
    });
    return this.getOne(user, id);
  }

  async savePayload(user: AuthUser, id: string, enrichmentRaw: unknown) {
    await this.ensureAgentTerrain(user, id);

    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { produit: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);
    if (d.agentValideAt) {
      throw new ForbiddenException(
        'Dossier déjà soumis — modification interdite',
      );
    }

    const existing = (d.payload ?? {}) as Record<string, any>;
    const famille = d.produit.famille as FamilleProduit;
    let enrichment: AgentSalaireEnrichment | AgentActiviteEnrichment;
    try {
      enrichment = parseAgentEnrichment(famille, enrichmentRaw, {
        etatCivil: existing.etatCivil,
      }).data;
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException({
          message: 'Enrichissement invalide',
          issues: e.issues,
        });
      }
      throw e;
    }

    const merged = mergeAgentEnrichmentIntoPayload(
      existing,
      famille,
      enrichment,
    );
    const fields = clientFieldsFromPayload(merged);

    await this.prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id },
        data: { payload: merged as Prisma.InputJsonValue },
      });
      await tx.client.update({
        where: { id: d.clientId },
        data: {
          ...(fields.fullName ? { fullName: fields.fullName } : {}),
          ...(fields.phone ? { phone: fields.phone } : {}),
          activityAddress:
            famille === 'SALAIRE'
              ? String(merged.adresseSociete || fields.activityAddress || '')
              : String(
                  merged.business?.adresseBusiness ||
                    fields.activityAddress ||
                    '',
                ),
        },
      });
      await this.audit.log(
        {
          dossierId: id,
          actorId: user.id,
          action: 'AGENT_PAYLOAD_UPDATED',
          entityType: 'DOSSIER',
          entityId: id,
          payload: { famille },
        },
        tx,
      );
    });

    return this.getOne(user, id);
  }

  async uploadPiece(
    user: AuthUser,
    id: string,
    kind: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string },
  ) {
    await this.ensureAgentTerrain(user, id);

    if (!kind?.trim()) {
      throw new BadRequestException('kind requis');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier requis');
    }

    const piece = await this.documents.savePiece({
      dossierId: id,
      kind: kind.trim(),
      originalName: file.originalname || 'upload.bin',
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    await this.audit.log({
      dossierId: id,
      actorId: user.id,
      action: 'PIECE_UPLOADED',
      entityType: 'DOSSIER',
      entityId: id,
      payload: { kind: piece.kind, pieceId: piece.id },
    });

    return piece;
  }

  async soumettre(user: AuthUser, id: string) {
    await this.ensureAgentTerrain(user, id);

    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { visite: true, pieces: true, produit: true },
    });
    if (!d?.visite) throw new NotFoundException('Dossier introuvable');
    if (d.etat !== DossierEtat.DESCENTE) {
      throw new BadRequestException(
        `Impossible de soumettre depuis l'état ${d.etat}`,
      );
    }

    const answers = (d.visite.checklistJson as ChecklistAnswers | null) ?? {
      flags: {},
      values: {},
    };
    const payload = (d.payload ?? {}) as Record<string, any>;
    const enrichCheck = validateAgentEnrichmentComplete(
      d.produit.famille as FamilleProduit,
      payload,
    );
    if (!enrichCheck.ok) {
      throw new BadRequestException(enrichCheck.message);
    }
    const uploadedKinds = new Set(d.pieces.map((p) => p.kind));
    const issues = validateAgentChecklist(
      d.produit.famille,
      payload,
      answers,
      uploadedKinds,
      d.visite.rapportTexte,
    );
    if (issues.length) {
      throw new BadRequestException({
        message: 'Checklist incomplète',
        issues,
      });
    }

    const now = new Date();
    const chain: Array<{ from: DossierEtat; to: DossierEtat; comment: string }> =
      [
        {
          from: DossierEtat.DESCENTE,
          to: DossierEtat.RAPPORT_AGENT,
          comment: 'Rapport agent soumis',
        },
        {
          from: DossierEtat.RAPPORT_AGENT,
          to: DossierEtat.SCORING,
          comment: 'Pronostic automatique (faits CF2 + avis IA)',
        },
        {
          from: DossierEtat.SCORING,
          to: DossierEtat.EN_ATTENTE_VALIDATION_RC,
          comment: 'Transmission au responsable crédit',
        },
      ];

    for (const step of chain) {
      this.workflow.assertTransition(step.from, step.to, user.role);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.visiteTerrain.update({
        where: { dossierId: id },
        data: { completedAt: now },
      });
      await tx.dossier.update({
        where: { id },
        data: {
          etat: DossierEtat.EN_ATTENTE_VALIDATION_RC,
          agentValideAt: now,
        },
      });
      for (const step of chain) {
        await tx.transition.create({
          data: {
            dossierId: id,
            fromEtat: step.from,
            toEtat: step.to,
            comment: step.comment,
            actorId: user.id,
          },
        });
      }
      await this.audit.log(
        {
          dossierId: id,
          actorId: user.id,
          action: 'AGENT_SOUMIS',
          entityType: 'DOSSIER',
          entityId: id,
          payload: {
            reference: d.reference,
            toEtat: DossierEtat.EN_ATTENTE_VALIDATION_RC,
          },
        },
        tx,
      );
    });

    // Hors transaction et sans bloquer l'agent : le RC peut régénérer l'avis.
    void this.scoring.generate(id, user.id).catch((e) => {
      this.logger.error(
        `Pronostic non généré pour ${id}: ${e instanceof Error ? e.message : e}`,
      );
    });

    return this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        pieces: true,
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async listForAnalyste(user: AuthUser) {
    if (user.role !== Role.ANALYSTE) {
      throw new ForbiddenException('Rôle analyste requis');
    }
    const rows = await this.prisma.dossier.findMany({
      where: {
        etat: {
          in: [
            DossierEtat.ANALYSTE,
            DossierEtat.RETOUR_ANALYSTE,
            DossierEtat.CONFORMITE,
            DossierEtat.DIRECTION,
            DossierEtat.CONSEIL,
            DossierEtat.A_DECAISSER,
            DossierEtat.REJETE,
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        produit: true,
        visite: true,
      },
    });
    return rows.map((d) => {
      const montant = montantSouhaiteFromPayload(
        d.payload as Record<string, any>,
      );
      return {
        id: d.id,
        reference: d.reference,
        produit: d.produit,
        produitLabel: d.produit.label,
        type: d.produit.code,
        etat: d.etat,
        etatLabel: DOSSIER_ETAT_LABELS[d.etat],
        client: d.client,
        agent: d.agent,
        scoreValue: d.scoreValue,
        agentValideAt: d.agentValideAt,
        rapportTexte: d.visite?.rapportTexte ?? null,
        updatedAt: d.updatedAt,
        bucket: this.analysteBucket(d.etat),
        montantSouhaite: montant.montantSouhaite,
        devise: montant.devise,
      };
    });
  }

  private analysteBucket(
    etat: DossierEtat,
  ): 'nouveaux' | 'en_cours' | 'retournes' | 'termines' {
    if (etat === DossierEtat.ANALYSTE) return 'nouveaux';
    if (etat === DossierEtat.RETOUR_ANALYSTE) return 'retournes';
    return 'termines';
  }

  async getForAnalyste(user: AuthUser, id: string) {
    if (user.role !== Role.ANALYSTE) {
      throw new ForbiddenException('Rôle analyste requis');
    }
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        produit: true,
        pieces: { orderBy: { createdAt: 'asc' } },
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    return {
      ...d,
      type: d.produit.code,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      checklistAnswers: d.visite?.checklistJson ?? null,
      analyseCf2: normalizeCf2Analyse(d.visite?.analyseCf2Json, {
        visiteStartedAt: d.visite?.startedAt?.toISOString() ?? null,
      }),
      usesAnalyseAgrPack: usesAnalyseAgrPack(d.produit.code),
    };
  }
}
