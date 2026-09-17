import { promises as fs } from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  getUploadRoot(): string {
    return (
      process.env.UPLOAD_DIR ||
      path.join(process.cwd(), 'uploads')
    );
  }

  async ensureUploadRoot(): Promise<string> {
    const root = this.getUploadRoot();
    await fs.mkdir(root, { recursive: true });
    return root;
  }

  async savePiece(params: {
    dossierId: string;
    kind: string;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }) {
    const root = await this.ensureUploadRoot();
    const safeKind = params.kind.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(params.originalName) || '';
    const fileName = `${params.dossierId}_${safeKind}_${Date.now()}${ext}`;
    const abs = path.join(root, fileName);
    await fs.writeFile(abs, params.buffer);

    const blobPath = fileName;
    return this.prisma.piece.create({
      data: {
        dossierId: params.dossierId,
        kind: params.kind,
        blobPath,
      },
    });
  }

  async findPiece(id: string) {
    const piece = await this.prisma.piece.findUnique({ where: { id } });
    if (!piece) throw new NotFoundException('Pièce introuvable');
    return piece;
  }

  async resolveAbsolutePath(blobPath: string): Promise<string> {
    const root = this.getUploadRoot();
    const abs = path.join(root, path.basename(blobPath));
    try {
      await fs.access(abs);
    } catch {
      throw new NotFoundException('Fichier introuvable');
    }
    return abs;
  }

  async listByDossier(dossierId: string) {
    return this.prisma.piece.findMany({
      where: { dossierId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
