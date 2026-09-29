import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DossierEtat,
  DureeUnite,
  FamilleProduit,
  Prisma,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DOSSIER_ETAT_LABELS, montantSouhaiteFromPayload } from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  zoneId: true,
  disabledAt: true,
  createdAt: true,
  zone: { select: { id: true, code: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async overview() {
    const [
      dossiersByEtat,
      usersByRole,
      zoneStats,
      totalDossiers,
      totalUsers,
      recentAudit,
    ] = await Promise.all([
      this.prisma.dossier.groupBy({
        by: ['etat'],
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),
      this.prisma.zone.findMany({
        orderBy: { code: 'asc' },
        include: {
          _count: { select: { users: true, communes: true, clients: true } },
          users: {
            where: { role: Role.AGENT, disabledAt: null },
            select: {
              id: true,
              displayName: true,
              _count: { select: { dossiersAgent: true } },
            },
          },
        },
      }),
      this.prisma.dossier.count(),
      this.prisma.user.count(),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const actorIds = [
      ...new Set(
        recentAudit.map((a) => a.actorId).filter((id): id is string => !!id),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true, email: true, role: true },
        })
      : [];
    const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

    const activeEtats: DossierEtat[] = [
      DossierEtat.EN_ATTENTE_ATTRIBUTION_AGENT,
      DossierEtat.AFFECTE,
      DossierEtat.DESCENTE,
      DossierEtat.RETOUR_AGENT,
      DossierEtat.RAPPORT_AGENT,
      DossierEtat.SCORING,
      DossierEtat.ANALYSTE,
      DossierEtat.RETOUR_ANALYSTE,
      DossierEtat.CONFORMITE,
      DossierEtat.DIRECTION,
      DossierEtat.CONSEIL,
    ];

    return {
      totalDossiers,
      totalUsers,
      dossiersByEtat: Object.fromEntries(
        dossiersByEtat.map((r) => [r.etat, r._count._all]),
      ),
      usersByRole: Object.fromEntries(
        usersByRole.map((r) => [r.role, r._count._all]),
      ),
      zones: zoneStats.map((z) => ({
        id: z.id,
        code: z.code,
        name: z.name,
        agentsCount: z.users.length,
        communesCount: z._count.communes,
        clientsCount: z._count.clients,
        agents: z.users.map((u) => ({
          id: u.id,
          displayName: u.displayName,
          dossiersCount: u._count.dossiersAgent,
        })),
      })),
      recentAudit: recentAudit.map((a) => ({
        ...a,
        actor: a.actorId ? actorMap[a.actorId] ?? null : null,
      })),
      activeDossiersHint: activeEtats,
    };
  }

  async listDossiers(q?: string) {
    const term = (q || '').trim();
    const where: Prisma.DossierWhereInput = term
      ? {
          OR: [
            { reference: { contains: term, mode: 'insensitive' } },
            { client: { fullName: { contains: term, mode: 'insensitive' } } },
            { client: { phone: { contains: term, mode: 'insensitive' } } },
            { produit: { label: { contains: term, mode: 'insensitive' } } },
            { produit: { code: { contains: term, mode: 'insensitive' } } },
          ],
        }
      : {};
    const rows = await this.prisma.dossier.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        client: { include: { zone: true, commune: true } },
        agent: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        produit: true,
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
        agent: d.agent,
        createdBy: d.createdBy,
        montantSouhaite: montant.montantSouhaite,
        devise: montant.devise,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
  }

  async getDossier(id: string) {
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
    return {
      ...d,
      type: d.produit.code,
      etatLabel: DOSSIER_ETAT_LABELS[d.etat],
      editable: false,
    };
  }

  async listUsers(q?: string, role?: Role) {
    const term = (q || '').trim();
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(term
        ? {
            OR: [
              { email: { contains: term, mode: 'insensitive' } },
              { displayName: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      select: USER_SELECT,
    });
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const recentActions = await this.prisma.auditLog.findMany({
      where: { actorId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { ...user, recentActions };
  }

  async createUser(
    actorId: string,
    data: {
      email: string;
      displayName: string;
      password: string;
      role: Role;
      zoneId?: string | null;
    },
  ) {
    const email = data.email.trim().toLowerCase();
    if (data.password.length < 4) {
      throw new BadRequestException('Mot de passe trop court');
    }
    this.assertZoneForRole(data.role, data.zoneId);
    if (data.zoneId) await this.assertZoneExists(data.zoneId);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: data.displayName.trim(),
        passwordHash,
        role: data.role,
        zoneId: data.role === Role.AGENT ? data.zoneId! : null,
      },
      select: USER_SELECT,
    });

    await this.audit.log({
      actorId,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      payload: {
        email: user.email,
        role: user.role,
        zoneId: user.zoneId,
      },
    });

    return user;
  }

  async updateUser(
    actorId: string,
    id: string,
    data: {
      email?: string;
      displayName?: string;
      password?: string;
      role?: Role;
      zoneId?: string | null;
    },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Utilisateur introuvable');

    const nextRole = data.role ?? existing.role;
    const nextZoneId =
      data.zoneId !== undefined ? data.zoneId : existing.zoneId;
    this.assertZoneForRole(nextRole, nextZoneId);
    if (nextRole === Role.AGENT && nextZoneId) {
      await this.assertZoneExists(nextZoneId);
    }

    if (data.email) {
      const email = data.email.trim().toLowerCase();
      const clash = await this.prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (clash) throw new ConflictException('Email déjà utilisé');
    }

    const passwordChanged = !!(data.password && data.password.length >= 4);
    const passwordHash = passwordChanged
      ? await bcrypt.hash(data.password!, 10)
      : undefined;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.email
          ? { email: data.email.trim().toLowerCase() }
          : {}),
        ...(data.displayName
          ? { displayName: data.displayName.trim() }
          : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(data.role ? { role: data.role } : {}),
        zoneId: nextRole === Role.AGENT ? nextZoneId : null,
      },
      select: USER_SELECT,
    });

    await this.audit.log({
      actorId,
      action: passwordChanged ? 'USER_PASSWORD_RESET' : 'USER_UPDATED',
      entityType: 'USER',
      entityId: user.id,
      payload: {
        email: user.email,
        role: user.role,
        zoneId: user.zoneId,
        passwordChanged,
        fields: Object.keys(data).filter((k) => k !== 'password'),
      },
    });

    return user;
  }

  async setUserStatus(actorId: string, id: string, disabled: boolean) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Utilisateur introuvable');

    if (disabled && existing.role === Role.ADMIN) {
      const otherAdmins = await this.prisma.user.count({
        where: {
          role: Role.ADMIN,
          disabledAt: null,
          NOT: { id },
        },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException(
          'Impossible de désactiver le dernier administrateur actif',
        );
      }
    }
    if (disabled && actorId === id) {
      throw new BadRequestException(
        'Impossible de désactiver votre propre compte',
      );
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { disabledAt: disabled ? new Date() : null },
      select: USER_SELECT,
    });

    await this.audit.log({
      actorId,
      action: disabled ? 'USER_DISABLED' : 'USER_ENABLED',
      entityType: 'USER',
      entityId: user.id,
      payload: { email: user.email, role: user.role },
    });

    return user;
  }

  async listZones() {
    return this.prisma.zone.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { users: true, communes: true, clients: true } },
        communes: {
          orderBy: { name: 'asc' },
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async createZone(
    actorId: string,
    data: { code: string; name: string },
  ) {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    if (!code || !name) {
      throw new BadRequestException('Code et nom requis');
    }
    const existing = await this.prisma.zone.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Code zone déjà utilisé');

    const zone = await this.prisma.zone.create({
      data: { code, name },
    });
    await this.audit.log({
      actorId,
      action: 'ZONE_CREATED',
      entityType: 'ZONE',
      entityId: zone.id,
      payload: { code: zone.code, name: zone.name },
    });
    return zone;
  }

  async updateZone(
    actorId: string,
    id: string,
    data: { name?: string; code?: string },
  ) {
    const existing = await this.prisma.zone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Zone introuvable');

    if (data.code) {
      const code = data.code.trim().toUpperCase();
      const clash = await this.prisma.zone.findFirst({
        where: { code, NOT: { id } },
      });
      if (clash) throw new ConflictException('Code zone déjà utilisé');
    }

    const zone = await this.prisma.zone.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
      },
    });
    await this.audit.log({
      actorId,
      action: 'ZONE_UPDATED',
      entityType: 'ZONE',
      entityId: zone.id,
      payload: { code: zone.code, name: zone.name },
    });
    return zone;
  }

  async reassignCommune(actorId: string, id: string, zoneId: string) {
    const commune = await this.prisma.commune.findUnique({ where: { id } });
    if (!commune) throw new NotFoundException('Commune introuvable');
    await this.assertZoneExists(zoneId);

    const updated = await this.prisma.commune.update({
      where: { id },
      data: { zoneId },
      include: { zone: true },
    });
    await this.audit.log({
      actorId,
      action: 'COMMUNE_REASSIGNED',
      entityType: 'COMMUNE',
      entityId: updated.id,
      payload: {
        code: updated.code,
        fromZoneId: commune.zoneId,
        toZoneId: zoneId,
      },
    });
    return updated;
  }

  async listProduits() {
    return this.prisma.produitCredit.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { dossiers: true } } },
    });
  }

  private assertProduitBornes(data: {
    montantMin: number;
    montantMax: number;
    dureeMin: number;
    dureeMax: number;
  }) {
    if (!(data.montantMin > 0) || !(data.montantMax > 0)) {
      throw new BadRequestException('Montants invalides');
    }
    if (data.montantMin > data.montantMax) {
      throw new BadRequestException('montantMin doit être ≤ montantMax');
    }
    if (!(data.dureeMin > 0) || !(data.dureeMax > 0)) {
      throw new BadRequestException('Durées invalides');
    }
    if (data.dureeMin > data.dureeMax) {
      throw new BadRequestException('dureeMin doit être ≤ dureeMax');
    }
  }

  async createProduit(
    actorId: string,
    data: {
      code: string;
      label: string;
      montantMin: number;
      montantMax: number;
      dureeMin: number;
      dureeMax: number;
      dureeUnite: DureeUnite;
      refPrefix: string;
      famille: FamilleProduit;
      sortOrder?: number;
      actif?: boolean;
    },
  ) {
    const code = data.code.trim().toUpperCase().replace(/\s+/g, '_');
    const label = data.label.trim();
    const refPrefix = data.refPrefix.trim().toUpperCase();
    if (!code || !label || !refPrefix) {
      throw new BadRequestException('code, label et refPrefix requis');
    }
    this.assertProduitBornes(data);
    const existing = await this.prisma.produitCredit.findUnique({
      where: { code },
    });
    if (existing) throw new ConflictException('Code produit déjà utilisé');

    const produit = await this.prisma.produitCredit.create({
      data: {
        code,
        label,
        montantMin: data.montantMin,
        montantMax: data.montantMax,
        dureeMin: data.dureeMin,
        dureeMax: data.dureeMax,
        dureeUnite: data.dureeUnite,
        refPrefix,
        famille: data.famille,
        sortOrder: data.sortOrder ?? 100,
        actif: data.actif ?? true,
      },
    });
    await this.audit.log({
      actorId,
      action: 'PRODUIT_CREATED',
      entityType: 'PRODUIT',
      entityId: produit.id,
      payload: { code: produit.code, label: produit.label },
    });
    return produit;
  }

  async updateProduit(
    actorId: string,
    id: string,
    data: {
      code?: string;
      label?: string;
      montantMin?: number;
      montantMax?: number;
      dureeMin?: number;
      dureeMax?: number;
      dureeUnite?: DureeUnite;
      refPrefix?: string;
      famille?: FamilleProduit;
      sortOrder?: number;
    },
  ) {
    const existing = await this.prisma.produitCredit.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Produit introuvable');

    if (data.code) {
      const code = data.code.trim().toUpperCase().replace(/\s+/g, '_');
      const clash = await this.prisma.produitCredit.findFirst({
        where: { code, NOT: { id } },
      });
      if (clash) throw new ConflictException('Code produit déjà utilisé');
    }

    const montantMin = data.montantMin ?? existing.montantMin;
    const montantMax = data.montantMax ?? existing.montantMax;
    const dureeMin = data.dureeMin ?? existing.dureeMin;
    const dureeMax = data.dureeMax ?? existing.dureeMax;
    this.assertProduitBornes({ montantMin, montantMax, dureeMin, dureeMax });

    const produit = await this.prisma.produitCredit.update({
      where: { id },
      data: {
        ...(data.code
          ? { code: data.code.trim().toUpperCase().replace(/\s+/g, '_') }
          : {}),
        ...(data.label ? { label: data.label.trim() } : {}),
        ...(data.montantMin != null ? { montantMin: data.montantMin } : {}),
        ...(data.montantMax != null ? { montantMax: data.montantMax } : {}),
        ...(data.dureeMin != null ? { dureeMin: data.dureeMin } : {}),
        ...(data.dureeMax != null ? { dureeMax: data.dureeMax } : {}),
        ...(data.dureeUnite ? { dureeUnite: data.dureeUnite } : {}),
        ...(data.refPrefix
          ? { refPrefix: data.refPrefix.trim().toUpperCase() }
          : {}),
        ...(data.famille ? { famille: data.famille } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });
    await this.audit.log({
      actorId,
      action: 'PRODUIT_UPDATED',
      entityType: 'PRODUIT',
      entityId: produit.id,
      payload: { code: produit.code, label: produit.label },
    });
    return produit;
  }

  async setProduitStatus(actorId: string, id: string, actif: boolean) {
    const existing = await this.prisma.produitCredit.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Produit introuvable');

    const produit = await this.prisma.produitCredit.update({
      where: { id },
      data: { actif },
    });
    await this.audit.log({
      actorId,
      action: actif ? 'PRODUIT_ENABLED' : 'PRODUIT_DISABLED',
      entityType: 'PRODUIT',
      entityId: produit.id,
      payload: { code: produit.code, label: produit.label },
    });
    return produit;
  }

  async deleteProduit(actorId: string, id: string) {
    const existing = await this.prisma.produitCredit.findUnique({
      where: { id },
      include: { _count: { select: { dossiers: true } } },
    });
    if (!existing) throw new NotFoundException('Produit introuvable');
    if (existing._count.dossiers > 0) {
      throw new BadRequestException(
        'Des dossiers sont liés à ce produit — désactivez-le plutôt',
      );
    }
    await this.prisma.produitCredit.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'PRODUIT_DELETED',
      entityType: 'PRODUIT',
      entityId: id,
      payload: { code: existing.code, label: existing.label },
    });
    return { ok: true };
  }

  async listAudit(filters: {
    actorId?: string;
    action?: string;
    entityType?: string;
    dossierId?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(filters.take ?? 50, 200);
    const skip = filters.skip ?? 0;
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.dossierId ? { dossierId: filters.dossierId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    const actorIds = [
      ...new Set(
        rows.map((r) => r.actorId).filter((id): id is string => !!id),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true, email: true, role: true },
        })
      : [];
    const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

    return {
      total,
      skip,
      take,
      items: rows.map((r) => ({
        ...r,
        actor: r.actorId ? actorMap[r.actorId] ?? null : null,
      })),
    };
  }

  private assertZoneForRole(role: Role, zoneId?: string | null) {
    if (role === Role.AGENT && !zoneId) {
      throw new BadRequestException('zoneId obligatoire pour un AGENT');
    }
  }

  private async assertZoneExists(zoneId: string) {
    const z = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!z) throw new BadRequestException('Zone invalide');
  }
}
