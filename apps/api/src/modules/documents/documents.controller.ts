import {
  Controller,
  Get,
  NotFoundException,
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
      'Proxie le binaire Cloudinary (aperçu iframe / téléchargement disque).',
  })
  @ApiParam({ name: 'id', description: 'ID de la pièce' })
  async download(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const piece = await this.documents.findPiece(id);
    await this.documents.assertCanAccessDossier(user, piece.dossierId);
    if (!piece.url) {
      throw new NotFoundException('URL Cloudinary introuvable pour cette pièce');
    }
    const upstream = await fetch(piece.url);
    if (!upstream.ok) {
      throw new NotFoundException('Fichier introuvable sur Cloudinary');
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const mime =
      piece.mimeType ||
      upstream.headers.get('content-type') ||
      'application/octet-stream';
    const filename = piece.originalName || `piece-${piece.id}`;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.send(buffer);
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
