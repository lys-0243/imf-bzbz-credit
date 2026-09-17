import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Prisma, Role } from '@prisma/client';
import {
  ChecklistAnswers,
  DOSSIER_ETAT_LABELS,
  getApplicableChecklistItems,
  validateAgentChecklist,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { WorkflowService } from '../workflow/workflow.service';

type AuthUser = {
  id: string;
  role: Role;
  zoneId?: string | null;
};

const AGENT_INBOX_ETATS: DossierEtat[] = [
  DossierEtat.AFFECTE,
  DossierEtat.DESCENTE,
  DossierEtat.RETOUR_AGENT,
];

@Injectable()
export class TerrainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly workflow: WorkflowService,
  ) {}

  private assertAgentOwns(
    dossier: { agentId: string | null },
    user: AuthUser,
  ) {
    if (user.role === Role.ADMIN) return;
    if (user.role !== Role.AGENT) {
      throw new ForbiddenException('Rôle agent requis');
    }
    if (dossier.agentId !== user.id) {
      throw new ForbiddenException('Dossier non assigné à cet agent');
    }
  }

  async listMine(user: AuthUser) {
    if (user.role !== Role.AGENT && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Rôle agent requis');
    }
    const where: Prisma.DossierWhereInput =
      user.role === Role.ADMIN
        ? { etat: { in: AGENT_INBOX_ETATS } }
        : { agentId: user.id, etat: { in: AGENT_INBOX_ETATS } };

    const rows = await this.prisma.dossier.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { include: { zone: true, commune: true } },
        visite: true,
      },
    });
    return rows.map((d) => ({
      id: d.id,
      reference: d.reference,
      type: d.type,
      etat: d.etat,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      client: d.client,
      agentValideAt: d.agentValideAt,
      visiteStartedAt: d.visite?.startedAt ?? null,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    }));
  }

  async getOne(user: AuthUser, id: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
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
      d.type,
      payload,
      flags,
      'AGENT',
    );

    return {
      ...d,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      editable: d.agentValideAt == null,
      checklist,
      checklistAnswers: answers,
      flags,
    };
  }

  async startVisite(user: AuthUser, id: string) {
    const d = await this.prisma.dossier.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);

    if (d.etat === DossierEtat.DESCENTE) {
      const existing = await this.prisma.visiteTerrain.findUnique({
        where: { dossierId: id },
      });
      if (existing) return this.getOne(user, id);
    }

    if (
      d.etat !== DossierEtat.AFFECTE &&
      d.etat !== DossierEtat.RETOUR_AGENT
    ) {
      throw new BadRequestException(
        `Impossible de démarrer la visite depuis l'état ${d.etat}`,
      );
    }

    this.workflow.assertTransition(d.etat, DossierEtat.DESCENTE, user.role);

    await this.prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id },
        data: { etat: DossierEtat.DESCENTE },
      });
      await tx.transition.create({
        data: {
          dossierId: id,
          fromEtat: d.etat,
          toEtat: DossierEtat.DESCENTE,
          comment: 'Début de la descente terrain',
          actorId: user.id,
        },
      });
      await tx.visiteTerrain.upsert({
        where: { dossierId: id },
        create: {
          dossierId: id,
          agentId: user.id,
          checklistJson: {
            flags: { hasGarant: true, dat: false, hypotheque: false },
            values: {},
          } as Prisma.InputJsonValue,
        },
        update: {
          startedAt: new Date(),
          completedAt: null,
          agentId: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          dossierId: id,
          actorId: user.id,
          action: 'VISITE_STARTED',
          payload: { reference: d.reference },
        },
      });
    });

    return this.getOne(user, id);
  }

  async saveChecklist(
    user: AuthUser,
    id: string,
    answers: ChecklistAnswers,
  ) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { visite: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);
    if (d.agentValideAt) {
      throw new ForbiddenException('Dossier déjà soumis');
    }
    if (d.etat !== DossierEtat.DESCENTE && d.etat !== DossierEtat.AFFECTE) {
      throw new BadRequestException(
        'Checklist modifiable uniquement en descente',
      );
    }
    if (!d.visite) {
      throw new BadRequestException('Démarrez la visite d’abord');
    }

    await this.prisma.visiteTerrain.update({
      where: { dossierId: id },
      data: { checklistJson: answers as Prisma.InputJsonValue },
    });
    return this.getOne(user, id);
  }

  async saveRapport(user: AuthUser, id: string, rapportTexte: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { visite: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);
    if (d.agentValideAt) {
      throw new ForbiddenException('Dossier déjà soumis');
    }
    if (!d.visite) {
      throw new BadRequestException('Démarrez la visite d’abord');
    }

    await this.prisma.visiteTerrain.update({
      where: { dossierId: id },
      data: { rapportTexte },
    });
    return this.getOne(user, id);
  }

  async uploadPiece(
    user: AuthUser,
    id: string,
    kind: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string },
  ) {
    const d = await this.prisma.dossier.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);
    if (d.agentValideAt) {
      throw new ForbiddenException('Dossier déjà soumis');
    }
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

    await this.prisma.auditLog.create({
      data: {
        dossierId: id,
        actorId: user.id,
        action: 'PIECE_UPLOADED',
        payload: { kind: piece.kind, pieceId: piece.id },
      },
    });

    return piece;
  }

  async soumettre(user: AuthUser, id: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: { visite: true, pieces: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    this.assertAgentOwns(d, user);
    if (d.agentValideAt) {
      throw new ForbiddenException('Dossier déjà soumis');
    }
    if (d.etat !== DossierEtat.DESCENTE) {
      throw new BadRequestException(
        'La visite doit être en cours (DESCENTE) pour soumettre',
      );
    }
    if (!d.visite) {
      throw new BadRequestException('Visite introuvable');
    }

    const answers = (d.visite.checklistJson as ChecklistAnswers | null) ?? {
      flags: {},
      values: {},
    };
    const uploadedKinds = new Set(d.pieces.map((p) => p.kind));
    const payload = (d.payload ?? {}) as Record<string, any>;
    const issues = validateAgentChecklist(
      d.type,
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
          comment: 'Scoring automatique (stub)',
        },
        {
          from: DossierEtat.SCORING,
          to: DossierEtat.ANALYSTE,
          comment: 'Transmission à l’analyste',
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
          etat: DossierEtat.ANALYSTE,
          agentValideAt: now,
          scoreValue: 50,
          scoreReasons: {
            stub: true,
            message: 'Score provisoire — moteur règles à brancher',
          } as Prisma.InputJsonValue,
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
      await tx.auditLog.create({
        data: {
          dossierId: id,
          actorId: user.id,
          action: 'AGENT_SOUMIS',
          payload: { reference: d.reference, toEtat: DossierEtat.ANALYSTE },
        },
      });
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
    if (
      user.role !== Role.ANALYSTE &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Rôle analyste requis');
    }
    const rows = await this.prisma.dossier.findMany({
      where: { etat: DossierEtat.ANALYSTE },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        visite: true,
      },
    });
    return rows.map((d) => ({
      id: d.id,
      reference: d.reference,
      type: d.type,
      etat: d.etat,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      client: d.client,
      agent: d.agent,
      scoreValue: d.scoreValue,
      agentValideAt: d.agentValideAt,
      rapportTexte: d.visite?.rapportTexte ?? null,
      updatedAt: d.updatedAt,
    }));
  }

  async getForAnalyste(user: AuthUser, id: string) {
    if (
      user.role !== Role.ANALYSTE &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Rôle analyste requis');
    }
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        pieces: { orderBy: { createdAt: 'asc' } },
        visite: true,
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    return {
      ...d,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      checklistAnswers: d.visite?.checklistJson ?? null,
    };
  }
}
