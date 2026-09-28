import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditEntityType =
  | 'DOSSIER'
  | 'USER'
  | 'ZONE'
  | 'COMMUNE'
  | 'AUTH'
  | 'SYSTEM';

export type AuditLogInput = {
  actorId?: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  dossierId?: string | null;
  payload?: Record<string, unknown> | null;
};

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput, db?: DbClient) {
    const client = db ?? this.prisma;
    return client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        dossierId: input.dossierId ?? null,
        payload:
          input.payload == null
            ? undefined
            : (input.payload as Prisma.InputJsonValue),
      },
    });
  }
}
