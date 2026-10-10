import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DossierEtat, Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import {
  ALLOWED_TRANSITIONS,
  WorkflowService,
} from './workflow.service';

class TransitionDto {
  @ApiProperty({
    enum: DossierEtat,
    example: DossierEtat.CONFORMITE,
    description: 'Nouvel état cible (doit être autorisé depuis l’état courant)',
  })
  @IsEnum(DossierEtat)
  toEtat!: DossierEtat;

  @ApiPropertyOptional({
    example: 'Dossier conforme — transmission direction',
    description: 'Commentaire libre enregistré sur la transition',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags('Workflow')
@ApiBearerAuth('JWT')
@Controller('workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get()
  @Roles(
    Role.RECEPTION,
    Role.AGENT,
    Role.ANALYSTE,
    Role.RESPONSABLE_CREDIT,
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
  )
  @ApiOperation({
    summary: 'Vue d’ensemble workflow',
    description: 'Indique que le module est actif et expose la carte des transitions.',
  })
  overview() {
    return {
      module: 'workflow',
      implemented: true,
      transitions: ALLOWED_TRANSITIONS,
    };
  }

  @Get('allowed')
  @Roles(
    Role.RECEPTION,
    Role.AGENT,
    Role.ANALYSTE,
    Role.RESPONSABLE_CREDIT,
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
  )
  @ApiOperation({
    summary: 'Transitions autorisées',
    description: 'Map fromEtat → toEtat[] utilisée par le moteur de workflow.',
  })
  allowed() {
    return ALLOWED_TRANSITIONS;
  }

  @Post('dossiers/:id/transition')
  @Roles(
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
    Role.RESPONSABLE_CREDIT,
    Role.ANALYSTE,
  )
  @ApiOperation({
    summary: 'Appliquer une transition',
    description:
      'Change l’état du dossier si la transition et le rôle sont autorisés. ' +
      'Réservé aux rôles conformité / direction / RC / analyste / admin.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: TransitionDto,
    examples: {
      conformite: {
        summary: 'Vers conformité',
        value: {
          toEtat: 'CONFORMITE',
          comment: 'Validation RC OK',
        },
      },
      retourAgent: {
        summary: 'Retour agent',
        value: {
          toEtat: 'RETOUR_AGENT',
          comment: 'Pièces manquantes',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Transition appliquée' })
  @ApiResponse({ status: 400, description: 'Transition ou rôle non autorisé' })
  transition(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.workflow.applyTransition(
      user,
      id,
      dto.toEtat,
      dto.comment,
    );
  }
}
