import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreditType, DossierEtat, Prisma, Role } from '@prisma/client';
import {
  clientFieldsFromPayload,
  parseDossierPayload,
} from '@imf/shared';
import { ZodError } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type AuthUser = {
  id: string;
  role: Role;
  zoneId?: string | null;
};

const CLOSED: DossierEtat[] = [DossierEtat.A_DECAISSER, DossierEtat.REJETE];

@Injectable()
export class DemandesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listZones() {
    return this.prisma.zone.findMany({ orderBy: { code: 'asc' } });
  }

  async listCommunes() {
    return this.prisma.commune.findMany({
      orderBy: { name: 'asc' },
      include: { zone: { select: { id: true, code: true, name: true } } },
    });
  }

  private async resolveCommune(communeId: string) {
    const commune = await this.prisma.commune.findUnique({
      where: { id: communeId },
      include: { zone: true },
    });
    if (!commune) throw new BadRequestException('Commune invalide');
    return commune;
  }

  async assignLeastBusyAgent(zoneId: string) {
    const agents = await this.prisma.user.findMany({
      where: { role: Role.AGENT, zoneId, disabledAt: null },
    });
    if (!agents.length) {
      throw new BadRequestException('Aucun agent pour cette zone');
    }
    let best = agents[0];
    let bestCount = Number.POSITIVE_INFINITY;
    for (const agent of agents) {
      const count = await this.prisma.dossier.count({
        where: {
          agentId: agent.id,
          etat: { notIn: CLOSED },
        },
      });
      if (count < bestCount) {
        bestCount = count;
        best = agent;
      }
    }
    return best;
  }

  private nextReference(type: CreditType) {
    const prefix =
      type === 'SALAIRE' ? 'SAL' : type === 'DARE_DARE' ? 'DDR' : 'IND';
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${prefix}-${stamp}-${rand}`;
  }

  private validatePayload(type: CreditType, payload: unknown) {
    try {
      return parseDossierPayload(type, payload) as Record<string, any>;
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException({
          message: 'Payload invalide',
          issues: e.issues,
        });
      }
      throw e;
    }
  }

  async create(user: AuthUser, type: CreditType, payloadRaw: unknown) {
    if (!['SALAIRE', 'INDIVIDUEL', 'DARE_DARE'].includes(type)) {
      throw new BadRequestException('Type de crédit invalide');
    }
    const payload = this.validatePayload(type, payloadRaw);
    const fields = clientFieldsFromPayload(type, payload);
    const commune = await this.resolveCommune(fields.communeId);
    const zoneId = commune.zoneId;

    const agent = await this.assignLeastBusyAgent(zoneId);
    const reference = this.nextReference(type);

    const dossier = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          fullName: fields.fullName,
          phone: fields.phone,
          activityAddress: fields.activityAddress,
          zoneId,
          communeId: commune.id,
        },
      });
      const created = await tx.dossier.create({
        data: {
          reference,
          type,
          etat: DossierEtat.AFFECTE,
          payload: payload as Prisma.InputJsonValue,
          clientId: client.id,
          agentId: agent.id,
        },
        include: {
          client: true,
          agent: { select: { id: true, displayName: true, email: true } },
          transitions: true,
        },
      });
      await tx.transition.create({
        data: {
          dossierId: created.id,
          fromEtat: DossierEtat.ENREGISTRE,
          toEtat: DossierEtat.AFFECTE,
          comment: `Affecté à ${agent.displayName} (${commune.name})`,
          actorId: user.id,
        },
      });
      await this.audit.log(
        {
          dossierId: created.id,
          actorId: user.id,
          action: 'DOSSIER_CREATED',
          entityType: 'DOSSIER',
          entityId: created.id,
          payload: {
            reference,
            type,
            agentId: agent.id,
            communeId: commune.id,
          },
        },
        tx,
      );
      return created;
    });

    return this.findOne(dossier.id);
  }

  async search(q?: string) {
    const term = (q || '').trim();
    const where: Prisma.DossierWhereInput = term
      ? {
          OR: [
            { reference: { contains: term, mode: 'insensitive' } },
            { client: { fullName: { contains: term, mode: 'insensitive' } } },
            { client: { phone: { contains: term, mode: 'insensitive' } } },
          ],
        }
      : {};
    const rows = await this.prisma.dossier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
      },
    });
    return rows.map((d) => ({
      ...d,
      editable: d.agentValideAt == null,
    }));
  }

  async findOne(id: string) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    return { ...d, editable: d.agentValideAt == null };
  }

  async update(user: AuthUser, id: string, payloadRaw: unknown) {
    const existing = await this.prisma.dossier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dossier introuvable');
    if (existing.agentValideAt != null) {
      throw new ForbiddenException(
        "Dossier déjà validé par l'agent — modification interdite",
      );
    }
    const payload = this.validatePayload(existing.type, payloadRaw);
    const fields = clientFieldsFromPayload(existing.type, payload);
    const commune = await this.resolveCommune(fields.communeId);

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: existing.clientId },
        data: {
          fullName: fields.fullName,
          phone: fields.phone,
          activityAddress: fields.activityAddress,
          zoneId: commune.zoneId,
          communeId: commune.id,
        },
      });
      await tx.dossier.update({
        where: { id },
        data: { payload: payload as Prisma.InputJsonValue },
      });
      await this.audit.log(
        {
          dossierId: id,
          actorId: user.id,
          action: 'DOSSIER_UPDATED',
          entityType: 'DOSSIER',
          entityId: id,
          payload: { reference: existing.reference },
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  async timeline(id: string) {
    const d = await this.prisma.dossier.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dossier introuvable');
    return this.prisma.transition.findMany({
      where: { dossierId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
}
