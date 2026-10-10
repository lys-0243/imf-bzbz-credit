import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: { zone: true },
    });
    if (!user) {
      await this.audit.log({
        action: 'LOGIN_FAILURE',
        entityType: 'AUTH',
        entityId: normalized,
        payload: { reason: 'unknown_email' },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (user.disabledAt) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILURE',
        entityType: 'AUTH',
        entityId: user.id,
        payload: { reason: 'disabled', email: user.email },
      });
      throw new UnauthorizedException('Compte désactivé');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILURE',
        entityType: 'AUTH',
        entityId: user.id,
        payload: { reason: 'bad_password', email: user.email },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    await this.audit.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      payload: { email: user.email, role: user.role },
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        zoneId: user.zoneId,
        zone: user.zone,
        disabledAt: user.disabledAt,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { zone: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.disabledAt) throw new UnauthorizedException('Compte désactivé');
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      zoneId: user.zoneId,
      zone: user.zone,
      disabledAt: user.disabledAt,
    };
  }
}
