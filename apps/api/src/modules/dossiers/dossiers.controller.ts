import { Body, Controller, Delete, Get, Param, Put, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DOCUMENTS_EDITABLES, FORMULAIRE_CODES } from '@imf/shared';
import { IsInt, IsObject, IsString, Min } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { DocumentsEditesService } from './documents-edites.service';
import { DossiersService } from './dossiers.service';

class FormulaireDto {
  @ApiProperty({
    description: 'Contenu complet du formulaire (normalisé côté serveur)',
    example: { typeGarant: 'EMPLOYE', identite: { nomComplet: 'MPETEMBA MOSHA BENOIT' } },
  })
  @IsObject()
  data!: Record<string, unknown>;
}

class DocumentEditeDto {
  @ApiProperty({ description: 'HTML de l’éditeur (nettoyé côté serveur)' })
  @IsString()
  contenuHtml!: string;

  @ApiProperty({ description: 'Version lue (0 si jamais enregistré) — 409 si obsolète', example: 0 })
  @IsInt()
  @Min(0)
  version!: number;
}

const ROLES_DOCUMENTS = [Role.RESPONSABLE_CREDIT, Role.DG, Role.ADMIN];

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
  constructor(
    private readonly dossiers: DossiersService,
    private readonly documentsEdites: DocumentsEditesService,
  ) {}

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

  @Get(':id/documents/:doc')
  @Roles(...TOUS_ROLES)
  @ApiOperation({
    summary: 'Document éditable (lettre, contrat, gage, caution)',
    description: '`contenuHtml: null` = jamais modifié (le web génère le document depuis le dossier).',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiParam({ name: 'doc', enum: DOCUMENTS_EDITABLES })
  getDocument(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Param('doc') doc: string,
  ) {
    return this.documentsEdites.get(user, id, doc);
  }

  @Put(':id/documents/:doc')
  @Roles(...ROLES_DOCUMENTS)
  @ApiOperation({
    summary: 'Enregistrer un document retouché',
    description: 'RC, DG, admin aux états DIRECTION, CONSEIL, A_DECAISSER. HTML nettoyé ; 409 si la version est obsolète.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiParam({ name: 'doc', enum: DOCUMENTS_EDITABLES })
  @ApiBody({ type: DocumentEditeDto })
  saveDocument(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Param('doc') doc: string,
    @Body() dto: DocumentEditeDto,
  ) {
    return this.documentsEdites.save(user, id, doc, dto.contenuHtml, dto.version);
  }

  @Delete(':id/documents/:doc')
  @Roles(...ROLES_DOCUMENTS)
  @ApiOperation({ summary: 'Revenir au document généré depuis le dossier' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiParam({ name: 'doc', enum: DOCUMENTS_EDITABLES })
  resetDocument(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Param('doc') doc: string,
  ) {
    return this.documentsEdites.reinitialiser(user, id, doc);
  }

  @Get(':id/documents/:doc/docx')
  @Roles(...TOUS_ROLES)
  @ApiOperation({ summary: 'Exporter le document en Word (.docx)' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiParam({ name: 'doc', enum: DOCUMENTS_EDITABLES })
  async exportDocx(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Param('doc') doc: string,
    @Res() res: Response,
  ) {
    const { buffer, nomFichier } = await this.documentsEdites.docx(user, id, doc);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(nomFichier)}`);
    res.send(buffer);
  }
}
