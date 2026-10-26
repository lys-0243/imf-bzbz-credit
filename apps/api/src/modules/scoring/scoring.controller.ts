import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { ScoringService } from './scoring.service';

@ApiTags('Scoring')
@ApiBearerAuth('JWT')
@Controller('scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Get('dossiers/:id/pronostic')
  @Roles(
    Role.RESPONSABLE_CREDIT,
    Role.ANALYSTE,
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
  )
  @ApiOperation({
    summary: 'Dernier pronostic du dossier',
    description:
      'Avis IA (ou règles CF 2.4 en repli) et faits déterministes utilisés. `null` si aucun pronostic.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  latest(@Param('id') id: string) {
    return this.scoring.latest(id);
  }

  @Post('dossiers/:id/pronostic')
  @Roles(Role.RESPONSABLE_CREDIT, Role.ANALYSTE, Role.ADMIN)
  @ApiOperation({
    summary: 'Générer / régénérer le pronostic',
    description:
      'Recalcule les faits (CF2, checklist, historique CBS) et redemande un avis à l’IA.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  generate(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.scoring.generate(id, user.id);
  }
}
