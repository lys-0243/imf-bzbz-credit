import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { CurrentUser } from '../identity/current-user.decorator';
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
  Role.CONFORMITE,
  Role.DG,
  Role.DGA,
  Role.CA,
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
    summary: 'Ouvrir / télécharger une pièce',
    description:
      'Renvoie le binaire de la pièce depuis le stockage serveur (aperçu iframe / téléchargement).',
  })
  @ApiParam({ name: 'id', description: 'ID de la pièce' })
  async download(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const piece = await this.documents.findPiece(id);
    await this.documents.assertCanAccessDossier(user, piece.dossierId);
    const file = await this.documents.openPiece(piece);
    const filename = piece.originalName || `piece-${piece.id}`;
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.bytes));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    if (Buffer.isBuffer(file.body)) {
      res.send(file.body);
      return;
    }
    try {
      await pipeline(file.body, res);
    } catch {
      res.destroy();
    }
  }

  @Get('dossiers/:dossierId')
  @ApiOperation({
    summary: 'Liste des pièces d’un dossier',
    description: 'Métadonnées des documents liés au dossier (sans binaire).',
  })
  @ApiParam({ name: 'dossierId', description: 'ID du dossier' })
  async list(
    @CurrentUser() user: { id: string; role: Role },
    @Param('dossierId') dossierId: string,
  ) {
    await this.documents.assertCanAccessDossier(user, dossierId);
    return this.documents.listByDossier(dossierId);
  }
}
