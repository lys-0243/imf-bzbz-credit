import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Piece, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import { destroyLegacyCloudinary } from './cloudinary';
import { FILE_STORAGE, type FileStorage } from './storage/file-storage';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
};

const MAX_BYTES = 10 * 1024 * 1024;

const safeSegment = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, '_');

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  private assertFile(params: {
    buffer: Buffer;
    mimeType?: string;
    originalName: string;
  }) {
    if (!params.buffer?.length) {
      throw new BadRequestException('Fichier requis');
    }
    if (params.buffer.length > MAX_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (max 10 Mo)');
    }
    const mime = (params.mimeType || '').toLowerCase();
    if (mime && !ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Type de fichier non autorisé (images ou PDF)',
      );
    }
  }

  /** `dossiers/<dossierId>/<kind>_<horodatage>_<aléa><ext>` */
  private buildKey(dossierId: string, kind: string, originalName: string, mimeType?: string) {
    const fromName = extname(originalName || '').toLowerCase();
    const ext = /^\.[a-z0-9]{1,8}$/.test(fromName)
      ? fromName
      : EXT_BY_MIME[(mimeType || '').toLowerCase()] || '';
    const unique = `${Date.now()}_${randomBytes(4).toString('hex')}`;
    return `dossiers/${safeSegment(dossierId)}/${safeSegment(kind)}_${unique}${ext}`;
  }

  /** Les pièces avec `url` sont d'anciens envois Cloudinary ; les autres sont dans `storage`. */
  private async deleteBinary(piece: Pick<Piece, 'blobPath' | 'url'>) {
    try {
      if (piece.url) await destroyLegacyCloudinary(piece.blobPath);
      else await this.storage.delete(piece.blobPath);
    } catch {
      /* best-effort : un fichier orphelin ne doit pas bloquer le remplacement */
    }
  }

  /** Enregistre une pièce ; remplace la précédente du même `kind` sur le dossier. */
  async savePiece(params: {
    dossierId: string;
    kind: string;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }) {
    this.assertFile(params);
    const key = this.buildKey(
      params.dossierId,
      params.kind,
      params.originalName,
      params.mimeType,
    );

    const existing = await this.prisma.piece.findFirst({
      where: { dossierId: params.dossierId, kind: params.kind },
      orderBy: { createdAt: 'desc' },
    });

    const { bytes } = await this.storage.put(key, params.buffer, params.mimeType);

    let piece: Piece;
    try {
      piece = await this.prisma.$transaction(async (tx) => {
        if (existing) await tx.piece.delete({ where: { id: existing.id } });
        return tx.piece.create({
          data: {
            dossierId: params.dossierId,
            kind: params.kind,
            blobPath: key,
            url: null,
            mimeType: params.mimeType || null,
            bytes,
            originalName: params.originalName,
          },
        });
      });
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined);
      throw err;
    }

    if (existing) await this.deleteBinary(existing);
    return piece;
  }

  /** Contenu binaire d'une pièce (stockage courant, ou URL Cloudinary pour l'historique). */
  async openPiece(
    piece: Piece,
  ): Promise<{ body: Readable | Buffer; bytes: number; contentType: string }> {
    const fallbackType = piece.mimeType || 'application/octet-stream';
    if (piece.url) {
      const upstream = await fetch(piece.url);
      if (!upstream.ok) {
        throw new NotFoundException('Fichier introuvable sur Cloudinary');
      }
      const body = Buffer.from(await upstream.arrayBuffer());
      return {
        body,
        bytes: body.length,
        contentType: piece.mimeType || upstream.headers.get('content-type') || fallbackType,
      };
    }
    const { stream, bytes } = await this.storage.get(piece.blobPath);
    return { body: stream, bytes, contentType: fallbackType };
  }

  /**
   * Agent : dossiers qui lui sont assignés ; réception : dossiers qu'elle a créés.
   * Les autres rôles autorisés par le contrôleur voient tous les dossiers.
   */
  async assertCanAccessDossier(
    user: { id: string; role: Role },
    dossierId: string,
  ) {
    const d = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { agentId: true, createdById: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    if (user.role === Role.AGENT && d.agentId !== user.id) {
      throw new ForbiddenException('Dossier non assigné à cet agent');
    }
    if (user.role === Role.RECEPTION && d.createdById !== user.id) {
      throw new ForbiddenException('Dossier non créé par cet utilisateur');
    }
  }

  async findPiece(id: string) {
    const piece = await this.prisma.piece.findUnique({ where: { id } });
    if (!piece) throw new NotFoundException('Pièce introuvable');
    return piece;
  }

  async listByDossier(dossierId: string) {
    return this.prisma.piece.findMany({
      where: { dossierId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
