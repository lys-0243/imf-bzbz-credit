import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsDateString, IsObject, IsString } from 'class-validator';
import type { ChecklistAnswers, Cf2Analyse } from '@imf/shared';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { TerrainService } from './terrain.service';

class ChecklistDto {
  @ApiProperty({
    description: 'Réponses checklist agent (clés = ids items catalogue)',
    example: {
      piece_identite: { done: true, note: 'CNI lisible' },
      photo_business: { done: true },
      releve_compte_3mois: { done: false, note: 'À récupérer' },
    },
  })
  @IsObject()
  answers!: ChecklistAnswers;
}

class Cf2Dto {
  @ApiProperty({
    description: 'Patch analyse CF2 (sections 2.1–2.5)',
    example: {
      cf21: {
        residence: {
          residenceDepuis: '2019',
          statutLogement: 'locataire',
          dateHeureVisite: '06/10/2026 09:30',
        },
      },
    },
  })
  @IsObject()
  analyse!: Partial<Cf2Analyse>;
}

class RapportDto {
  @ApiProperty({
    example:
      'Visite effectuée. Activité commerciale viable. Capacité de remboursement confirmée.',
    description: 'Texte du rapport de descente',
  })
  @IsString()
  rapportTexte!: string;
}

class StartVisiteDto {
  @ApiProperty({
    example: '2026-10-02T09:30:00.000Z',
    description: 'Date/heure de début de visite (ISO 8601)',
  })
  @IsDateString()
  visiteDate!: string;
}

class UploadMetaDto {
  @ApiProperty({
    example: 'piece_identite',
    description: 'Kind de pièce (catalogue checklist / documents)',
  })
  @IsString()
  kind!: string;
}

class PayloadDto {
  @ApiProperty({
    description: 'Enrichissement métier ajouté par l’agent (fusionné au payload)',
    example: {
      activite: 'Commerce de détail',
      chiffreAffairesMensuel: 1200,
      garanties: 'Stock + caution morale',
    },
  })
  @IsObject()
  enrichment!: Record<string, unknown>;
}

@ApiTags('Terrain')
@ApiBearerAuth('JWT')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TerrainController {
  constructor(private readonly terrain: TerrainService) {}

  @Get('terrain')
  @Roles(Role.AGENT, Role.ANALYSTE)
  @ApiOperation({
    summary: 'Ping module terrain',
    description: 'Confirme que le module terrain est implémenté.',
  })
  scaffold() {
    return { module: 'terrain', implemented: true };
  }

  @Get('agent/dossiers')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Mes dossiers agent',
    description: 'Dossiers affectés à l’agent connecté, groupés par bucket.',
  })
  listMine(
    @CurrentUser() user: { id: string; role: Role; zoneId?: string | null },
  ) {
    return this.terrain.listMine(user);
  }

  @Get('agent/dossiers/:id')
  @Roles(Role.AGENT)
  @ApiOperation({ summary: 'Détail dossier agent' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  one(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.getOne(user, id);
  }

  @Post('agent/dossiers/:id/visite/start')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Démarrer une visite',
    description: 'Enregistre la date de descente et avance le workflow (DESCENTE).',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: StartVisiteDto,
    examples: {
      today: {
        summary: 'Visite aujourd’hui',
        value: { visiteDate: '2026-10-02T09:30:00.000Z' },
      },
    },
  })
  start(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: StartVisiteDto,
  ) {
    return this.terrain.startVisite(user, id, dto.visiteDate);
  }

  @Put('agent/dossiers/:id/checklist')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Sauver la checklist',
    description: 'Persiste les réponses de la checklist terrain.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: ChecklistDto,
    examples: {
      partial: {
        summary: 'Checklist partielle',
        value: {
          answers: {
            piece_identite: { done: true },
            photo_business: { done: true, note: 'Façade + intérieur' },
          },
        },
      },
    },
  })
  checklist(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: ChecklistDto,
  ) {
    return this.terrain.saveChecklist(user, id, dto.answers);
  }

  @Put('agent/dossiers/:id/cf2')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Sauver l’analyse CF2',
    description: 'Persiste les sections Analyse AGR (2.1–2.5).',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({ type: Cf2Dto })
  saveCf2(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: Cf2Dto,
  ) {
    return this.terrain.saveCf2(user, id, dto.analyse);
  }

  @Put('agent/dossiers/:id/payload')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Enrichir le payload',
    description: 'Fusionne des champs collectés sur le terrain dans le payload dossier.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: PayloadDto,
    examples: {
      enrichment: {
        summary: 'Données terrain',
        value: {
          enrichment: {
            activite: 'Commerce de détail',
            chiffreAffairesMensuel: 1200,
          },
        },
      },
    },
  })
  payload(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: PayloadDto,
  ) {
    return this.terrain.savePayload(user, id, dto.enrichment);
  }

  @Post('agent/dossiers/:id/rapport')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Enregistrer le rapport',
    description: 'Sauvegarde le texte du rapport de descente.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: RapportDto,
    examples: {
      ok: {
        summary: 'Rapport favorable',
        value: {
          rapportTexte:
            'Visite effectuée. Activité commerciale viable. Capacité de remboursement confirmée.',
        },
      },
    },
  })
  rapport(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: RapportDto,
  ) {
    return this.terrain.saveRapport(user, id, dto.rapportTexte);
  }

  @Post('agent/dossiers/:id/rapport/generate')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Générer un brouillon de rapport',
    description: 'Produit un texte de rapport à partir des données déjà collectées.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  generateRapport(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.generateRapport(user, id);
  }

  @Post('agent/dossiers/:id/pieces')
  @Roles(Role.AGENT)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Uploader une pièce',
    description:
      'Envoi multipart : champ `file` (binaire) + `kind` (type de document).',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['kind', 'file'],
      properties: {
        kind: {
          type: 'string',
          example: 'piece_identite',
          description: 'Type de pièce',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier image ou PDF',
        },
      },
    },
  })
  upload(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() meta: UploadMetaDto,
    @UploadedFile()
    file?: { originalname: string; buffer: Buffer; mimetype?: string },
  ) {
    return this.terrain.uploadPiece(user, id, meta.kind, file as any);
  }

  @Post('agent/dossiers/:id/soumettre')
  @Roles(Role.AGENT)
  @ApiOperation({
    summary: 'Soumettre au RC',
    description:
      'Soumet le dossier après visite/rapport pour validation responsable crédit.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  soumettre(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.soumettre(user, id);
  }

  @Get('analyste/dossiers')
  @Roles(Role.ANALYSTE)
  @ApiOperation({
    summary: 'Dossiers analyste',
    description: 'File analyste (nouveaux / retournés / terminés).',
  })
  analysteList(@CurrentUser() user: { id: string; role: Role }) {
    return this.terrain.listForAnalyste(user);
  }

  @Get('analyste/dossiers/:id')
  @Roles(Role.ANALYSTE)
  @ApiOperation({ summary: 'Détail dossier analyste' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  analysteOne(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.getForAnalyste(user, id);
  }
}
