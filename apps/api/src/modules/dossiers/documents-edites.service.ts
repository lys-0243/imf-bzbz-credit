import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  DOCUMENT_EDITABLE_LABELS,
  genererDocumentHtml,
  isDocumentEditable,
  peutEditerDocument,
  type DocumentEditable,
  type DossierContexte,
} from '@imf/shared';
import HTMLtoDOCX from '@turbodocx/html-to-docx';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ParametresService } from '../parametres/parametres.service';
import { DossiersService } from './dossiers.service';

type AuthUser = { id: string; role: Role };

const TAILLE_MAX = 500_000;

const ALIGNEMENT = { 'text-align': [/^(left|right|center|justify)$/] };
const LARGEUR = { width: [/^\d+(\.\d+)?px$/], 'min-width': [/^\d+(\.\d+)?px$/] };

/** Liste blanche alignée sur les extensions de l’éditeur web (TipTap). */
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
    'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'blockquote',
  ],
  allowedAttributes: {
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
    th: ['colspan', 'rowspan', 'colwidth', 'style'],
    td: ['colspan', 'rowspan', 'colwidth', 'style'],
    col: ['style', 'span'],
    table: ['style'],
  },
  allowedStyles: {
    p: ALIGNEMENT,
    h1: ALIGNEMENT,
    h2: ALIGNEMENT,
    h3: ALIGNEMENT,
    h4: ALIGNEMENT,
    th: LARGEUR,
    td: LARGEUR,
    col: LARGEUR,
    table: LARGEUR,
  },
  disallowedTagsMode: 'discard',
};

export function nettoyerHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE);
}

/** Documents juridiques retouchés dans l’éditeur web (lettre, contrat, gage, caution). */
@Injectable()
export class DocumentsEditesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly parametres: ParametresService,
    private readonly dossiers: DossiersService,
  ) {}

  private docOuErreur(doc: string): DocumentEditable {
    const code = doc.toUpperCase();
    if (!isDocumentEditable(code)) throw new BadRequestException(`Document non éditable : ${doc}`);
    return code;
  }

  /** Contexte complet du dossier (accès contrôlé par DossiersService.getOne). */
  private async contexte(user: AuthUser, id: string): Promise<DossierContexte> {
    const d = await this.dossiers.getOne(user, id);
    return {
      id: d.id,
      reference: d.reference,
      etat: d.etat,
      createdAt: d.createdAt.toISOString(),
      produit: { code: d.produit.code, label: d.produit.label, famille: d.produit.famille },
      payload: (d.payload ?? {}) as Record<string, any>,
      client: d.client,
      agent: d.agent,
      analyse: d.analyseCf2,
      formulaires: d.formulaires,
      parametres: await this.parametres.get(),
      nouveauClient: d.nouveauClient,
    };
  }

  private async etat(user: AuthUser, id: string) {
    // getOne contrôle l’accès au dossier (agent assigné, réception créatrice…).
    const d = await this.dossiers.getOne(user, id);
    return d.etat;
  }

  async get(user: AuthUser, id: string, docRaw: string) {
    const doc = this.docOuErreur(docRaw);
    const etat = await this.etat(user, id);
    const row = await this.prisma.documentEdite.findUnique({
      where: { dossierId_doc: { dossierId: id, doc } },
    });
    const auteur = row?.updatedById
      ? await this.prisma.user.findUnique({
          where: { id: row.updatedById },
          select: { displayName: true },
        })
      : null;
    return {
      doc,
      contenuHtml: row?.contenuHtml ?? null,
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: auteur?.displayName ?? null,
      editable: peutEditerDocument(user.role, etat),
    };
  }

  private async assertEditable(user: AuthUser, id: string, doc: DocumentEditable) {
    const etat = await this.etat(user, id);
    if (!peutEditerDocument(user.role, etat)) {
      throw new ForbiddenException(
        `${DOCUMENT_EDITABLE_LABELS[doc]} non modifiable par ${user.role} à l’état ${etat}`,
      );
    }
  }

  async save(user: AuthUser, id: string, docRaw: string, contenuHtml: string, version: number) {
    const doc = this.docOuErreur(docRaw);
    await this.assertEditable(user, id, doc);
    if (contenuHtml.length > TAILLE_MAX) throw new BadRequestException('Document trop volumineux');
    const propre = nettoyerHtml(contenuHtml);
    if (!propre.trim()) throw new BadRequestException('Document vide');

    const existant = await this.prisma.documentEdite.findUnique({
      where: { dossierId_doc: { dossierId: id, doc } },
    });
    const versionCourante = existant?.version ?? 0;
    if (version !== versionCourante) {
      throw new ConflictException(
        'Ce document a été modifié entre-temps par un autre utilisateur : rechargez-le avant d’enregistrer.',
      );
    }
    const enregistre = existant
      ? await this.prisma.documentEdite.update({
          where: { id: existant.id },
          data: { contenuHtml: propre, version: versionCourante + 1, updatedById: user.id },
        })
      : await this.prisma.documentEdite.create({
          data: { dossierId: id, doc, contenuHtml: propre, version: 1, updatedById: user.id },
        });
    await this.audit.log({
      dossierId: id,
      actorId: user.id,
      action: 'DOCUMENT_MODIFIE',
      entityType: 'DOSSIER',
      entityId: id,
      payload: { doc, version: enregistre.version },
    });
    return this.get(user, id, doc);
  }

  /** Revient au document généré depuis le dossier. */
  async reinitialiser(user: AuthUser, id: string, docRaw: string) {
    const doc = this.docOuErreur(docRaw);
    await this.assertEditable(user, id, doc);
    const { count } = await this.prisma.documentEdite.deleteMany({ where: { dossierId: id, doc } });
    if (count) {
      await this.audit.log({
        dossierId: id,
        actorId: user.id,
        action: 'DOCUMENT_REINITIALISE',
        entityType: 'DOSSIER',
        entityId: id,
        payload: { doc },
      });
    }
    return this.get(user, id, doc);
  }

  /** Export Word : version enregistrée, sinon document généré depuis le dossier. */
  async docx(user: AuthUser, id: string, docRaw: string): Promise<{ buffer: Buffer; nomFichier: string }> {
    const doc = this.docOuErreur(docRaw);
    const ctx = await this.contexte(user, id);
    const row = await this.prisma.documentEdite.findUnique({
      where: { dossierId_doc: { dossierId: id, doc } },
    });
    const html = row?.contenuHtml ?? genererDocumentHtml(doc, ctx);
    const sortie = await HTMLtoDOCX(`<!DOCTYPE html><html lang="fr"><body>${html}</body></html>`, null, {
      title: `${DOCUMENT_EDITABLE_LABELS[doc]} — ${ctx.reference}`,
      creator: ctx.parametres.institution.raisonSociale,
      lang: 'fr-FR',
      font: 'Calibri',
      fontSize: 22,
      pageNumber: true,
      table: { row: { cantSplit: true } },
    });
    const buffer = Buffer.isBuffer(sortie)
      ? sortie
      : sortie instanceof ArrayBuffer
        ? Buffer.from(sortie)
        : Buffer.from(await (sortie as Blob).arrayBuffer());
    if (!buffer.length) throw new NotFoundException('Export Word impossible');
    const nom = DOCUMENT_EDITABLE_LABELS[doc].normalize('NFD').replace(/[^\w]+/g, '_');
    return { buffer, nomFichier: `${nom}_${ctx.reference}.docx` };
  }
}
