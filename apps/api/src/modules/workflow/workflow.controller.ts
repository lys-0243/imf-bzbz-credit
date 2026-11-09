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
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PRONOSTIC_RECOMMANDATIONS, type PronosticRecommandation } from '@imf/shared';
import { FileTravailService } from './file-travail.service';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import {
  ALLOWED_TRANSITIONS,
  WorkflowService,
} from './workflow.service';

class DecisionDto {
  @ApiProperty({ enum: PRONOSTIC_RECOMMANDATIONS })
  @IsIn(PRONOSTIC_RECOMMANDATIONS)
  recommandation!: PronosticRecommandation;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantRetenu?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dureeRetenueMois?: number;
}

class TransitionDto {
  @ApiProperty({
    enum: DossierEtat,
    example: DossierEtat.CONFORMITE,
    description: 'État cible. Pour la direction, A_DECAISSER signifie « Approuver » : la plateforme route vers le Conseil au-delà du seuil.',
  })
  @IsEnum(DossierEtat)
  toEtat!: DossierEtat;

  @ApiPropertyOptional({
    example: 'Pièces manquantes',
    description: 'Motif (obligatoire pour un retour ou un rejet) ou justification d’un écart avec l’IA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  motif?: string;

  @ApiPropertyOptional({ description: 'Ancien nom du motif (compatibilité)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Points à corriger / non-conformités retenus (retours)' })
  @IsOptional()
  @IsArray()
  details?: unknown[];

  @ApiPropertyOptional({ type: DecisionDto, description: 'Décision chiffrée (validation finale RC)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DecisionDto)
  decision?: DecisionDto;
}

const ROLES_INTERNES = [
  Role.AGENT,
  Role.ANALYSTE,
  Role.RESPONSABLE_CREDIT,
  Role.CONFORMITE,
  Role.DG,
  Role.DGA,
  Role.CA,
  Role.ADMIN,
];

@ApiTags('Workflow')
@ApiBearerAuth('JWT')
@Controller('workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly files: FileTravailService,
  ) {}

  @Get('file')
  @Roles(...ROLES_INTERNES)
  @ApiOperation({
    summary: 'File de travail',
    description: 'Dossiers de l’utilisateur selon son rôle, classés par priorité, avec compteurs par onglet.',
  })
  file(@CurrentUser() user: { id: string; role: Role }) {
    return this.files.file(user);
  }

  @Get('stats')
  @Roles(...ROLES_INTERNES)
  @ApiOperation({ summary: 'Indicateurs du tableau de bord (selon le rôle)' })
  stats(@CurrentUser() user: { id: string; role: Role }) {
    return this.files.stats(user);
  }

  @Post('dossiers/:id/prendre-en-charge')
  @Roles(Role.ANALYSTE, Role.CONFORMITE)
  @ApiOperation({ summary: 'Prendre en charge un dossier de la file commune' })
  prendre(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string) {
    return this.workflow.prendreEnCharge(user, id);
  }

  @Get()
  @Roles(
    Role.RECEPTION,
    Role.AGENT,
    Role.ANALYSTE,
    Role.RESPONSABLE_CREDIT,
    Role.CONFORMITE,
    Role.DG,
    Role.DGA,
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
    Role.DGA,
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
    Role.DGA,
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
          motif: 'Rapport validé',
        },
      },
      retourAgent: {
        summary: 'Retour agent',
        value: {
          toEtat: 'RETOUR_AGENT',
          motif: 'Pièces manquantes',
          details: [{ id: 'A1', constat: 'Photo du commerce absente' }],
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
    return this.workflow.decider(user, id, {
      toEtat: dto.toEtat,
      motif: dto.motif ?? dto.comment,
      details: dto.details,
      decision: dto.decision,
    });
  }
}
