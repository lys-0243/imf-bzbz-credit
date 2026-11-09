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
import { Role } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MOTIFS_ECART_AFFECTATION, type MotifEcartAffectation } from '@imf/shared';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { AffectationService } from './affectation.service';

class AssignDto {
  @ApiProperty({
    example: 'clxxxxxxxxagent',
    description: 'ID de l’agent terrain (voir GET /affectation/agents)',
  })
  @IsString()
  agentId!: string;

  @ApiPropertyOptional({ description: 'Avis IA « agents suggérés » consulté (traçabilité)' })
  @IsOptional()
  @IsString()
  avisIaId?: string;

  @ApiPropertyOptional({
    enum: MOTIFS_ECART_AFFECTATION,
    description: 'Obligatoire si l’agent choisi n’est pas le n°1 suggéré par l’IA',
  })
  @IsOptional()
  @IsIn(MOTIFS_ECART_AFFECTATION as unknown as string[])
  motifCategorie?: MotifEcartAffectation;

  @ApiPropertyOptional({
    example: 'Connaît bien les commerçants du marché de Matete',
    description: 'Explication de l’écart (obligatoire avec motifCategorie) — réutilisée par l’IA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}

@ApiTags('Affectation')
@ApiBearerAuth('JWT')
@Controller('affectation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESPONSABLE_CREDIT)
export class AffectationController {
  constructor(private readonly affectation: AffectationService) {}

  @Get('agents')
  @ApiOperation({
    summary: 'Agents disponibles',
    description: 'Agents de la zone avec charge (dossiers en cours / à valider).',
  })
  listAgents() {
    return this.affectation.listAgents();
  }

  @Post('dossiers/:id/assign')
  @ApiOperation({
    summary: 'Affecter à un agent',
    description:
      'Passe le dossier à l’état AFFECTE et notifie l’agent. Si l’agent n’est pas le n°1 de la suggestion IA, ' +
      'motifCategorie + motif sont obligatoires : ils sont tracés et réutilisés par les suggestions suivantes.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: AssignDto,
    examples: {
      assign: {
        summary: 'Affecter agent A',
        value: { agentId: 'clxxxxxxxxagent' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Dossier affecté' })
  @ApiResponse({ status: 400, description: 'Transition ou agent invalide' })
  assign(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: AssignDto,
  ) {
    return this.affectation.assign(user, id, dto.agentId, dto.avisIaId, {
      categorie: dto.motifCategorie,
      texte: dto.motif,
    });
  }
}
