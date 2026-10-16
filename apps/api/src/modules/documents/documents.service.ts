import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  cloudinary,
  cloudinaryFolder,
  configureCloudinary,
} from './cloudinary';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private uploadBuffer(
    buffer: Buffer,
    opts: {
      folder: string;
      publicId: string;
      mimeType?: string;
      originalName: string;
    },
  ): Promise<{
    public_id: string;
    secure_url: string;
    bytes: number;
    format?: string;
    resource_type: string;
  }> {
    configureCloudinary();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: opts.folder,
          public_id: opts.publicId,
          resource_type: 'auto',
          overwrite: true,
          invalidate: true,
        },
        (err, result) => {
          if (err || !result) {
            reject(
              err ||
                new BadRequestException('Échec upload Cloudinary'),
            );
            return;
          }
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            bytes: result.bytes ?? buffer.length,
            format: result.format,
            resource_type: result.resource_type,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async savePiece(params: {
    dossierId: string;
    kind: string;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }) {
    this.assertFile(params);
    const safeKind = params.kind.replace(/[^a-zA-Z0-9_-]/g, '_');
    const folder = cloudinaryFolder(params.dossierId);
    const publicId = `${safeKind}_${Date.now()}`;

    const existing = await this.prisma.piece.findFirst({
      where: { dossierId: params.dossierId, kind: params.kind },
      orderBy: { createdAt: 'desc' },
    });

    const uploaded = await this.uploadBuffer(params.buffer, {
      folder,
      publicId,
      mimeType: params.mimeType,
      originalName: params.originalName,
    });

    if (existing?.blobPath) {
      try {
        configureCloudinary();
        await cloudinary.uploader.destroy(existing.blobPath, {
          resource_type: 'image',
        });
      } catch {
        try {
          await cloudinary.uploader.destroy(existing.blobPath, {
            resource_type: 'raw',
          });
        } catch {
          /* best-effort cleanup */
        }
      }
      await this.prisma.piece.delete({ where: { id: existing.id } });
    }

    return this.prisma.piece.create({
      data: {
        dossierId: params.dossierId,
        kind: params.kind,
        blobPath: uploaded.public_id,
        url: uploaded.secure_url,
        mimeType: params.mimeType || null,
        bytes: uploaded.bytes,
        originalName: params.originalName,
      },
    });
  }

  async findPiece(id: string) {
    const piece = await this.prisma.piece.findUnique({ where: { id } });
    if (!piece) throw new NotFoundException('Pièce introuvable');
    return piece;
  }

  /** @deprecated local disk — kept for legacy pieces without url */
  async resolveAbsolutePath(_blobPath: string): Promise<string> {
    throw new NotFoundException(
      'Fichier local indisponible — utiliser Cloudinary (url)',
    );
  }

  async listByDossier(dossierId: string) {
    return this.prisma.piece.findMany({
      where: { dossierId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
