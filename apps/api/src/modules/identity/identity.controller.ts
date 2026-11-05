import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles, RolesGuard } from './roles.guard';

@ApiTags('Auth')
@Controller()
export class IdentityController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/login')
  @ApiOperation({
    summary: 'Connexion',
    description:
      'Authentifie un utilisateur et renvoie un JWT (`accessToken`) plus le profil. ' +
      'Utiliser ce token dans Authorize pour les routes protégées.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      agent: {
        summary: 'Agent terrain',
        value: { email: 'agent.a@imf.local', password: 'Agent1!' },
      },
      reception: {
        summary: 'Réception',
        value: { email: 'reception@imf.local', password: 'Reception1!' },
      },
      admin: {
        summary: 'Administrateur',
        value: { email: 'admin@imf.local', password: 'Admin1!' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
        user: {
          id: 'clx…',
          email: 'agent.a@imf.local',
          displayName: 'Agent A',
          role: 'AGENT',
          zoneId: 'clx…',
          zone: { id: 'clx…', code: 'KIN', name: 'Kinshasa' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Identifiants invalides ou compte désactivé' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives — réessayer dans une minute' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.RECEPTION,
    Role.AGENT,
    Role.RESPONSABLE_CREDIT,
    Role.ANALYSTE,
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
  )
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Profil courant',
    description: 'Retourne l’utilisateur authentifié (recharge le profil depuis la base).',
  })
  @ApiResponse({ status: 200, description: 'Profil' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  me(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }
}
