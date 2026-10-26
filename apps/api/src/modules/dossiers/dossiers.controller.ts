import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { FORMULAIRE_CODES } from '@imf/shared';
import { IsObject } from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { DossiersService } from './dossiers.service';

class FormulaireDto {
  @ApiProperty({
    description: 'Contenu complet du formulaire (normalisé côté serveur)',
    example: { typeGarant: 'EMPLOYE', identite: { nomComplet: 'MPETEMBA MOSHA BENOIT' } },
  })
  @IsObject()
  data!: Record<string, unknown>;
}

const TOUS_ROLES = [
  Role.RECEPTION,
  Role.AGENT,
  Role.RESPONSABLE_CREDIT,
  Role.ANALYSTE,
  Role.CONFORMITE,
  Role.DG,
  Role.CA,
  Role.ADMIN,
];

@ApiTags('Dossiers')
@ApiBearerAuth('JWT')
@Controller('instruction/dossiers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DossiersController {
  constructor(private readonly dossiers: DossiersService) {}

  @Get()
  @Roles(Role.CONFORMITE, Role.DG, Role.CA, Role.ADMIN)
  @ApiOperation({
    summary: 'Dossiers de la hiérarchie',
    description: 'Conformité : CONFORMITE ; DG : DIRECTION / CONSEIL / A_DECAISSER ; CA : CONSEIL / A_DECAISSER.',
  })
  list(@CurrentUser() user: { id: string; role: Role }) {
    return this.dossiers.list(user);
  }

  @Get(':id')
  @Roles(...TOUS_ROLES)
  @ApiOperation({
    summary: 'Dossier complet',
    description: 'Détail, analyse CF2, formulaires (CF3…CF8) et codes modifiables par l’utilisateur.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  getOne(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string) {
    return this.dossiers.getOne(user, id);
  }

  @Get(':id/formulaires')
  @Roles(...TOUS_ROLES)
  @ApiOperation({ summary: 'Formulaires du dossier (normalisés, vides si absents)' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  listFormulaires(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string) {
    return this.dossiers.listFormulaires(user, id);
  }

  @Put(':id/formulaires/:code')
  @Roles(...TOUS_ROLES)
  @ApiOperation({
    summary: 'Enregistrer un formulaire',
    description: 'Droits selon le rôle et l’état du dossier (registre FORMULAIRES de @imf/shared).',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiParam({ name: 'code', enum: FORMULAIRE_CODES })
  @ApiBody({ type: FormulaireDto })
  saveFormulaire(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Param('code') code: string,
    @Body() dto: FormulaireDto,
  ) {
    return this.dossiers.saveFormulaire(user, id, code, dto.data);
  }

  @Get(':id/cycles-precedents')
  @Roles(...TOUS_ROLES)
  @ApiOperation({ summary: 'Cycles de crédit précédents du client (feuille Historique)' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  cycles(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string) {
    return this.dossiers.cyclesPrecedents(user, id);
  }
}
