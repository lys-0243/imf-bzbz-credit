import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SourceManuel } from '@prisma/client';
import { decouperManuel, sansAccents, type ExtraitManuel } from '@imf/shared';
import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FILE_STORAGE, type FileStorage } from '../documents/storage/file-storage';

const MAX_BYTES = 25 * 1024 * 1024;

export type MetaManuel = {
  titre: string;
  source: SourceManuel;
  reference?: string | null;
  version: string;
  dateEffet?: string | null;
};

type LigneRecherche = {
  id: string;
  manuelId: string;
  numero: string;
  titre: string;
  contenu: string;
  manuelTitre: string;
  source: SourceManuel;
  version: string;
  rang: number;
};

/** Extrait de texte d'un PDF, DOCX ou fichier texte. */
async function extraireTexte(buffer: Buffer, nom: string, mime?: string): Promise<string> {
  const ext = extname(nom).toLowerCase();
  const m = (mime || '').toLowerCase();
  if (ext === '.pdf' || m === 'application/pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).join('\n\n');
  }
  if (ext === '.docx' || m.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    const res = await mammoth.extractRawText({ buffer });
    return res.value;
  }
  if (['.txt', '.md', ''].includes(ext) || m.startsWith('text/')) {
    return buffer.toString('utf8');
  }
  throw new BadRequestException('Format non pris en charge : PDF, DOCX ou TXT');
}

@Injectable()
export class ManuelsService {
  private readonly logger = new Logger(ManuelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  list() {
    return this.prisma.manuel.findMany({
      orderBy: [{ actif: 'desc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { sections: true } } },
    });
  }

  async sections(id: string) {
    const m = await this.prisma.manuel.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { ordre: 'asc' },
          select: { id: true, ordre: true, numero: true, titre: true, contenu: true },
        },
      },
    });
    if (!m) throw new NotFoundException('Manuel introuvable');
    return m;
  }

  section(id: string) {
    return this.prisma.manuelSection.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        titre: true,
        contenu: true,
        manuel: { select: { id: true, titre: true, source: true, version: true } },
      },
    });
  }

  async creer(
    actorId: string,
    meta: MetaManuel,
    file: { originalname: string; buffer: Buffer; mimetype?: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Fichier requis');
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException('Fichier trop volumineux (max 25 Mo)');
    if (!meta.titre?.trim() || !meta.version?.trim()) {
      throw new BadRequestException('Titre et version requis');
    }
    let texte: string;
    try {
      texte = await extraireTexte(file.buffer, file.originalname, file.mimetype);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(`Extraction impossible : ${e instanceof Error ? e.message : e}`);
      throw new BadRequestException('Impossible de lire le texte du fichier (PDF scanné ?)');
    }
    const sections = decouperManuel(texte);
    if (!sections.length) {
      throw new BadRequestException('Aucun texte exploitable dans le fichier (PDF scanné sans OCR ?)');
    }

    const ext = extname(file.originalname).toLowerCase() || '.txt';
    const blobPath = `manuels/${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
    await this.storage.put(blobPath, file.buffer, file.mimetype);

    const manuel = await this.prisma.manuel.create({
      data: {
        titre: meta.titre.trim(),
        source: meta.source,
        reference: meta.reference?.trim() || null,
        version: meta.version.trim(),
        dateEffet: meta.dateEffet ? new Date(meta.dateEffet) : null,
        actif: true,
        blobPath,
        mimeType: file.mimetype || null,
        nomFichier: file.originalname,
        nbMots: texte.split(/\s+/).filter(Boolean).length,
        createdById: actorId,
        sections: {
          create: sections.map((s) => ({
            ordre: s.ordre,
            numero: s.numero,
            titre: s.titre,
            contenu: s.contenu,
            titreRecherche: sansAccents(`${s.numero} ${s.titre}`),
            contenuRecherche: sansAccents(s.contenu),
          })),
        },
      },
      include: { _count: { select: { sections: true } } },
    });
    await this.audit.log({
      actorId,
      action: 'MANUEL_AJOUTE',
      entityType: 'SYSTEM',
      entityId: manuel.id,
      payload: { titre: manuel.titre, version: manuel.version, sections: sections.length },
    });
    return manuel;
  }

  async majStatut(actorId: string, id: string, actif: boolean) {
    const m = await this.prisma.manuel.update({ where: { id }, data: { actif } }).catch(() => null);
    if (!m) throw new NotFoundException('Manuel introuvable');
    await this.audit.log({
      actorId,
      action: actif ? 'MANUEL_ACTIVE' : 'MANUEL_DESACTIVE',
      entityType: 'SYSTEM',
      entityId: id,
      payload: { titre: m.titre },
    });
    return m;
  }

  async supprimer(actorId: string, id: string) {
    const m = await this.prisma.manuel.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Manuel introuvable');
    await this.prisma.manuel.delete({ where: { id } });
    if (m.blobPath) await this.storage.delete(m.blobPath).catch(() => undefined);
    await this.audit.log({
      actorId,
      action: 'MANUEL_SUPPRIME',
      entityType: 'SYSTEM',
      entityId: id,
      payload: { titre: m.titre, version: m.version },
    });
    return { id };
  }

  manuelsActifs() {
    return this.prisma.manuel.findMany({
      where: { actif: true },
      select: { id: true, titre: true, version: true, source: true },
    });
  }

  /**
   * Recherche plein texte dans les manuels actifs (syntaxe websearch :
   * mots, « OR », guillemets). Accents ignorés des deux côtés.
   */
  async rechercher(requete: string, limite = 8, theme = ''): Promise<Array<ExtraitManuel & { rang: number }>> {
    const q = sansAccents(requete.trim()).slice(0, 500);
    if (!q) return [];
    const max = Math.max(1, Math.min(30, limite));
    let rows = await this.prisma.$queryRaw<LigneRecherche[]>(Prisma.sql`
      SELECT s.id, s."manuelId", s.numero, s.titre, s.contenu,
             m.titre AS "manuelTitre", m.source, m.version,
             ts_rank_cd(s.tsv, q)::float AS rang
      FROM "ManuelSection" s
      JOIN "Manuel" m ON m.id = s."manuelId",
           websearch_to_tsquery('french', ${q}) q
      WHERE m.actif AND s.tsv @@ q
      ORDER BY rang DESC, s.ordre ASC
      LIMIT ${max}
    `);
    if (!rows.length) {
      // Repli : sous-chaîne (sigles, termes courts non racinisés).
      const terme = `%${q.replace(/[%_]/g, '').split(/\s+/).filter((t) => t.length >= 2 && t.toUpperCase() !== 'OR')[0] ?? ''}%`;
      if (terme.length > 3) {
        rows = await this.prisma.$queryRaw<LigneRecherche[]>(Prisma.sql`
          SELECT s.id, s."manuelId", s.numero, s.titre, s.contenu,
                 m.titre AS "manuelTitre", m.source, m.version, 0.01::float AS rang
          FROM "ManuelSection" s JOIN "Manuel" m ON m.id = s."manuelId"
          WHERE m.actif AND (s."contenuRecherche" ILIKE ${terme} OR s."titreRecherche" ILIKE ${terme})
          ORDER BY s.ordre ASC
          LIMIT ${max}
        `);
      }
    }
    return rows.map((r) => ({
      sectionId: r.id,
      manuelId: r.manuelId,
      manuelTitre: r.manuelTitre,
      source: r.source,
      version: r.version,
      numero: r.numero,
      titre: r.titre,
      contenu: r.contenu,
      theme,
      rang: Number(r.rang) || 0,
    }));
  }
}
