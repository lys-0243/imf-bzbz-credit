import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth('JWT')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.RECEPTION,
  Role.AGENT,
  Role.RESPONSABLE_CREDIT,
  Role.ANALYSTE,
  Role.ADMIN,
)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Ping module documents',
    description: 'Confirme que le module documents est disponible.',
  })
  overview() {
    return { module: 'documents', implemented: true };
  }

  @Get('pieces/:id')
  @ApiOperation({
    summary: 'Télécharger une pièce',
    description: 'Retourne le fichier binaire de la pièce jointe.',
  })
  @ApiParam({ name: 'id', description: 'ID de la pièce' })
  @ApiProduces('application/octet-stream')
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const piece = await this.documents.findPiece(id);
    const abs = await this.documents.resolveAbsolutePath(piece.blobPath);
    res.set({
      'Content-Disposition': `attachment; filename="${piece.blobPath}"`,
    });
    return new StreamableFile(createReadStream(abs));
  }

  @Get('dossiers/:dossierId')
  @ApiOperation({
    summary: 'Liste des pièces d’un dossier',
    description: 'Métadonnées des documents liés au dossier (sans binaire).',
  })
  @ApiParam({ name: 'dossierId', description: 'ID du dossier' })
  async list(@Param('dossierId') dossierId: string) {
    return this.documents.listByDossier(dossierId);
  }
}
