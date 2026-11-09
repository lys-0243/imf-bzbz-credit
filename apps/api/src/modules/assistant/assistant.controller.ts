import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TYPES_AVIS_IA, type TypeAvisIa } from '@imf/shared';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { AssistantService } from './assistant.service';

class DemandeAvisDto {
  @ApiProperty({ enum: TYPES_AVIS_IA })
  @IsIn(TYPES_AVIS_IA)
  type!: TypeAvisIa;
}

const ROLES = [
  Role.AGENT,
  Role.RESPONSABLE_CREDIT,
  Role.ANALYSTE,
  Role.CONFORMITE,
  Role.DG,
  Role.DGA,
  Role.CA,
  Role.ADMIN,
];

@ApiTags('Assistant IA')
@ApiBearerAuth('JWT')
@Controller('assistant/dossiers/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('avis')
  @ApiOperation({
    summary: 'Dernier avis IA d’un type',
    description: 'Avis consultatif (statut EN_ATTENTE / EN_COURS / PRET / ECHEC) et fraîcheur (`aJour`).',
  })
  @ApiQuery({ name: 'type', enum: TYPES_AVIS_IA })
  dernier(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Query('type') type: TypeAvisIa,
    @Query('fraicheur') fraicheur?: string,
  ) {
    return this.assistant.dernier(user, id, type, fraicheur !== '0');
  }

  @Get('avis/tous')
  @ApiOperation({ summary: 'Derniers avis prêts de chaque étape (parcours)' })
  tous(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string) {
    return this.assistant.tous(user, id);
  }

  @Post('avis')
  @ApiOperation({
    summary: '(Re)générer un avis IA',
    description: 'Met l’avis en file ; il est préparé en arrière-plan (interroger GET /avis).',
  })
  demander(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: DemandeAvisDto,
  ) {
    return this.assistant.demander(user, id, dto.type);
  }
}
