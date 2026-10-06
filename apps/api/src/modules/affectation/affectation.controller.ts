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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
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
}

class RenvoyerDto {
  @ApiProperty({
    example: 'Compléter les photos du commerce et le relevé de compte.',
    minLength: 3,
    description: 'Motif du renvoi à l’agent',
  })
  @IsString()
  @MinLength(3)
  comment!: string;
}

@ApiTags('Affectation')
@ApiBearerAuth('JWT')
@Controller('affectation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESPONSABLE_CREDIT)
export class AffectationController {
  constructor(private readonly affectation: AffectationService) {}

  @Get('file')
  @ApiOperation({
    summary: 'File d’attente',
    description: 'Dossiers en attente d’attribution à un agent.',
  })
  listFile() {
    return this.affectation.listFile();
  }

  @Get('dossiers')
  @ApiOperation({
    summary: 'Tous les dossiers RC',
    description:
      'Liste des dossiers visibles du responsable crédit, avec bucket (file, en_cours, a_valider…).',
  })
  listDossiers() {
    return this.affectation.listDossiers();
  }

  @Get('agents')
  @ApiOperation({
    summary: 'Agents disponibles',
    description: 'Agents de la zone avec charge (dossiers en cours / à valider).',
  })
  listAgents() {
    return this.affectation.listAgents();
  }

  @Get('dossiers/:id')
  @ApiOperation({ summary: 'Détail dossier (vue RC)' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  getOne(@Param('id') id: string) {
    return this.affectation.getOne(id);
  }

  @Post('dossiers/:id/assign')
  @ApiOperation({
    summary: 'Affecter à un agent',
    description: 'Passe le dossier à l’état AFFECTE et notifie l’agent.',
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
    return this.affectation.assign(user, id, dto.agentId);
  }

  @Post('dossiers/:id/renvoyer')
  @ApiOperation({
    summary: 'Renvoyer à l’agent',
    description: 'Renvoie le dossier en RETOUR_AGENT avec un commentaire obligatoire.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: RenvoyerDto,
    examples: {
      photos: {
        summary: 'Demande de compléments',
        value: {
          comment: 'Compléter les photos du commerce et le relevé de compte.',
        },
      },
    },
  })
  renvoyer(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: RenvoyerDto,
  ) {
    return this.affectation.renvoyer(user, id, dto.comment);
  }

  @Post('dossiers/:id/soumettre')
  @ApiOperation({
    summary: 'Soumettre en conformité',
    description: 'Valide le dossier côté RC et le fait avancer vers CONFORMITE.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  soumettre(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.affectation.soumettre(user, id);
  }
}
