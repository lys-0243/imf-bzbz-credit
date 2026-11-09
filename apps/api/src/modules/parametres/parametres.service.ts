import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizeParametresImf,
  parametresImfSchema,
  type ParametresImf,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const ID = 'default';

@Injectable()
export class ParametresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ParametresImf> {
    const row = await this.prisma.parametresImf.findUnique({ where: { id: ID } });
    return normalizeParametresImf(row?.data);
  }

  async update(actorId: string, raw: unknown): Promise<ParametresImf> {
    const parsed = parametresImfSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Paramètres invalides',
        issues: parsed.error.issues,
      });
    }
    const avant = await this.get();
    const data = parsed.data as unknown as Prisma.InputJsonValue;
    await this.prisma.parametresImf.upsert({
      where: { id: ID },
      create: { id: ID, data, updatedById: actorId },
      update: { data, updatedById: actorId },
    });
    await this.audit.log({
      actorId,
      action: 'PARAMETRES_IMF_MODIFIES',
      entityType: 'SYSTEM',
      entityId: ID,
      payload: { avant, apres: parsed.data },
    });
    return parsed.data;
  }
}
