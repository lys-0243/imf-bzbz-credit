import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DossierEtat, Prisma, Role, StatutAvisIa } from '@prisma/client';
import {
  appliquerAjustementsIa,
  appliquerNotesAnalyste,
  ecartScoreImposeCommentaire,
  normalizeFormulaire,
  PILIERS_SCORE,
  type AvisAnalyse,
  type PilierScore,
  type ScoreCredit,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ScoringService } from '../scoring/scoring.service';

type AuthUser = { id: string; role: Role };

export type ScoreValide = {
  moteur: ScoreCredit;
  propose: ScoreCredit;
  retenu: ScoreCredit;
  avisIaId: string | null;
  commentaire: string | null;
  valideParId: string;
  valideLe: string;
};

const ETATS_ANALYSE: DossierEtat[] = [DossierEtat.ANALYSTE, DossierEtat.RETOUR_ANALYSTE];

@Injectable()
export class AnalyseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scoring: ScoringService,
  ) {}

  private async dossierAnalyse(user: AuthUser, id: string, ecriture: boolean) {
    const d = await this.prisma.dossier.findUnique({
      where: { id },
      select: { id: true, etat: true, analysteId: true, scoreReasons: true, agentValideAt: true },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    if (ecriture) {
      if (!ETATS_ANALYSE.includes(d.etat)) throw new BadRequestException('Le dossier n’est pas en analyse');
      if (user.role !== Role.ADMIN && d.analysteId && d.analysteId !== user.id) {
        throw new ForbiddenException('Dossier pris en charge par un autre analyste');
      }
    }
    return d;
  }

  private async dernierAvis(dossierId: string) {
    const a = await this.prisma.avisIa.findFirst({
      where: { dossierId, type: 'ANALYSE', statut: StatutAvisIa.PRET },
      orderBy: { createdAt: 'desc' },
    });
    return a ? { id: a.id, contenu: a.contenu as unknown as AvisAnalyse } : null;
  }

  /** Montant / durée de référence : rapport d'analyse, sinon décision de l'agent. */
  private async cibleParDefaut(dossierId: string) {
    const row = await this.prisma.dossierFormulaire.findUnique({
      where: { dossierId_code: { dossierId, code: 'RAPPORT_ANALYSE' } },
    });
    const r = normalizeFormulaire('RAPPORT_ANALYSE', row?.data);
    return { montant: Number(r.montantPropose) || null, dureeMois: Number(r.dureeMois) || null };
  }

  /**
   * Score moteur recalculé sur un montant / une durée, et proposition IA
   * (ajustements de l'avis ré-appliqués au nouveau calcul).
   */
  async apercu(user: AuthUser, id: string, cible: { montant?: number | null; dureeMois?: number | null }) {
    const d = await this.dossierAnalyse(user, id, false);
    const ctx = await this.scoring.contexteAnalyse(id);
    const defaut = await this.cibleParDefaut(id);
    const montant = cible.montant ?? defaut.montant;
    const dureeMois = cible.dureeMois ?? defaut.dureeMois;
    const moteur = this.scoring.scoreMoteur(ctx, { montant, dureeMois });
    const avis = await this.dernierAvis(id);
    const propose = avis
      ? appliquerAjustementsIa(moteur, avis.contenu.score.ajustements, ctx.grille).score
      : moteur;
    const valide = d.scoreReasons as ScoreValide | null;
    return {
      moteur,
      propose,
      ajustements: avis?.contenu.score.ajustements ?? [],
      avisIaId: avis?.id ?? null,
      grille: ctx.grille,
      montant: moteur.montantEvalue,
      dureeMois: moteur.echeanceMois,
      valide: valide?.valideLe
        ? { ...valide, perime: Boolean(d.agentValideAt && new Date(valide.valideLe) < d.agentValideAt) }
        : null,
    };
  }

  async valider(
    user: AuthUser,
    id: string,
    input: {
      notes?: Partial<Record<PilierScore, number>>;
      commentaire?: string | null;
      montant?: number | null;
      dureeMois?: number | null;
    },
  ) {
    await this.dossierAnalyse(user, id, true);
    const a = await this.apercu(user, id, { montant: input.montant, dureeMois: input.dureeMois });
    const notes: Partial<Record<PilierScore, number>> = {};
    for (const p of PILIERS_SCORE) {
      const v = input.notes?.[p];
      notes[p] = v != null && Number.isFinite(Number(v)) ? Number(v) : a.propose.piliers.find((x) => x.pilier === p)!.score;
    }
    const retenu = appliquerNotesAnalyste(a.moteur, notes, a.grille);
    const commentaire = input.commentaire?.trim() || null;
    if (ecartScoreImposeCommentaire(a.propose, retenu, a.grille) && !commentaire) {
      throw new BadRequestException(
        `Commentaire obligatoire : le score retenu (${retenu.total}) s’écarte de la proposition IA (${a.propose.total})`,
      );
    }
    const valeur: ScoreValide = {
      moteur: a.moteur,
      propose: a.propose,
      retenu,
      avisIaId: a.avisIaId,
      commentaire,
      valideParId: user.id,
      valideLe: new Date().toISOString(),
    };
    const maj = await this.prisma.dossier.updateMany({
      where: {
        id,
        etat: { in: ETATS_ANALYSE },
        ...(user.role === Role.ADMIN ? {} : { OR: [{ analysteId: null }, { analysteId: user.id }] }),
      },
      data: {
        scoreValue: retenu.total,
        scoreReasons: valeur as unknown as Prisma.InputJsonValue,
        ...(user.role === Role.ANALYSTE ? { analysteId: user.id } : {}),
      },
    });
    if (!maj.count) throw new ConflictException('Le dossier a changé : rechargez-le');
    await this.audit.log({
      dossierId: id,
      actorId: user.id,
      action: 'SCORE_VALIDE',
      entityType: 'DOSSIER',
      entityId: id,
      payload: {
        moteur: a.moteur.total,
        propose: a.propose.total,
        retenu: retenu.total,
        classe: retenu.classe,
        avisIaId: a.avisIaId,
        accordAvecIa: !ecartScoreImposeCommentaire(a.propose, retenu, a.grille),
      },
    });
    return valeur;
  }
}
