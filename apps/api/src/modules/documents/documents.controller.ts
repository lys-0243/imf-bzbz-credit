import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECEPTION, Role.AGENT, Role.ANALYSTE)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  overview() {
    return { module: 'documents', implemented: true };
  }

  @Get('pieces/:id')
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
  async list(@Param('dossierId') dossierId: string) {
    return this.documents.listByDossier(dossierId);
  }
}
