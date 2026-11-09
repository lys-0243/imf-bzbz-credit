import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, StatutCbsEnvoi } from '@prisma/client';
import {
  computeConditionsDeboursement,
  montantSouhaiteFromPayload,
  normalizeFormulaire,
  tauxParTranche,
  valeurBien,
  type BankingDecisionNotify,
} from '@imf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ParametresService } from '../parametres/parametres.service';
import { BankingService } from './banking.service';

type Db = PrismaService | Prisma.TransactionClient;

const MAX_TENTATIVES = 8;
const INTERVALLE_MS = 30_000;

export type ConditionsAccordees = { montant: number | null; dureeMois: number | null };

/**
 * Outbox des envois au core banking : l'envoi est enregistré dans la même
 * transaction que l'accord du crédit, puis transmis (et retransmis) en
 * arrière-plan jusqu'à acceptation par le CBS.
 */
@Injectable()
export class CbsOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CbsOutboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private enCours = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly banking: BankingService,
    private readonly audit: AuditService,
    private readonly parametres: ParametresService,
  ) {}

  onModuleInit() {
    if (process.env.CBS_OUTBOX_DISABLED === '1') return;
    this.timer = setInterval(() => void this.traiterFile(), INTERVALLE_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Construit le message CBS d'un dossier accordé (conditions approuvées, approbations). */
  async construirePayload(db: Db, dossierId: string, conditions: ConditionsAccordees): Promise<BankingDecisionNotify> {
    const d = await db.dossier.findUnique({
      where: { id: dossierId },
      include: {
        produit: true,
        client: true,
        formulaires: { where: { code: { in: ['CF5_1_DEMANDEUR', 'RAPPORT_ANALYSE'] } } },
        decisions: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { displayName: true } } } },
      },
    });
    if (!d) throw new NotFoundException('Dossier introuvable');
    const params = await this.parametres.get();
    const payload = (d.payload ?? {}) as Record<string, any>;
    const demande = montantSouhaiteFromPayload(payload);
    const montant = conditions.montant ?? demande.montantSouhaite;
    const duree = conditions.dureeMois;
    const cf5 = normalizeFormulaire(
      'CF5_1_DEMANDEUR',
      d.formulaires.find((f) => f.code === 'CF5_1_DEMANDEUR')?.data,
    );
    const rapport = normalizeFormulaire(
      'RAPPORT_ANALYSE',
      d.formulaires.find((f) => f.code === 'RAPPORT_ANALYSE')?.data,
    );
    const ctx = { montantPropose: montant ?? 0, cautionPct: params.conditions.cautionPct };
    const garanties = cf5.biens
      .map((b) => ({ libelle: b.description || b.type || 'Bien', valeur: valeurBien(b, ctx) }))
      .filter((g) => g.valeur > 0);
    const frais = montant ? computeConditionsDeboursement(montant, params) : null;
    const score = (d.scoreReasons as { retenu?: { total: number; classe: string } } | null)?.retenu;
    return {
      numeroCompte: String(payload.numeroCompte || '').trim(),
      dossierReference: d.reference,
      produitCode: d.produit.code,
      etatFinal: 'A_DECAISSER',
      montant: montant ?? null,
      dureeSemaines: duree ? Math.round((duree * 52) / 12) : null,
      dureeMois: duree ?? null,
      devise: demande.devise,
      tauxMensuel: montant ? tauxParTranche(montant, params.grilleTaux) : null,
      frais: frais
        ? {
            fraisDossier: frais.fraisDossier,
            fraisDecaissement: frais.fraisDecaissement,
            tva: frais.tva,
            caution: frais.caution,
            totalFrais: frais.totalFrais,
          }
        : null,
      garanties,
      score: score ? { total: score.total, classe: score.classe } : null,
      approbations: d.decisions
        .filter((x) => ['RESPONSABLE_CREDIT', 'DG', 'DGA', 'CA'].includes(x.role))
        .map((x) => ({
          role: x.role,
          nom: x.actor.displayName,
          date: x.createdAt.toISOString(),
          recommandation: x.recommandation,
        })),
      conditions: rapport.conditions
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean),
      client: { fullName: d.client.fullName, phone: d.client.phone },
      decidedAt: new Date().toISOString(),
    };
  }

  /** À appeler dans la transaction qui accorde le crédit. */
  async enqueueTx(tx: Prisma.TransactionClient, dossierId: string, conditions: ConditionsAccordees) {
    const payload = await this.construirePayload(tx, dossierId, conditions);
    const sansCompte = !payload.numeroCompte;
    const data = {
      payload: payload as unknown as Prisma.InputJsonValue,
      statut: sansCompte ? StatutCbsEnvoi.ECHEC : StatutCbsEnvoi.EN_ATTENTE,
      tentatives: 0,
      dernierMessage: sansCompte ? 'Numéro de compte client manquant : compléter le dossier puis relancer' : null,
      prochainEssaiAt: new Date(),
      envoyeAt: null,
    };
    await tx.cbsEnvoi.upsert({
      where: { idempotencyKey: payload.dossierReference },
      create: { dossierId, idempotencyKey: payload.dossierReference, ...data },
      update: data,
    });
  }

  async traiterFile(): Promise<number> {
    if (this.enCours) return 0;
    this.enCours = true;
    let traites = 0;
    try {
      const lot = await this.prisma.cbsEnvoi.findMany({
        where: { statut: StatutCbsEnvoi.EN_ATTENTE, prochainEssaiAt: { lte: new Date() } },
        orderBy: { prochainEssaiAt: 'asc' },
        take: 20,
      });
      for (const e of lot) {
        await this.envoyer(e.id);
        traites++;
      }
    } catch (err) {
      this.logger.error(`Outbox CBS : ${err instanceof Error ? err.message : err}`);
    } finally {
      this.enCours = false;
    }
    return traites;
  }

  private async envoyer(id: string) {
    const e = await this.prisma.cbsEnvoi.findUnique({ where: { id } });
    if (!e || e.statut !== StatutCbsEnvoi.EN_ATTENTE) return;
    const res = await this.banking.notifyDecision(e.payload as unknown as BankingDecisionNotify);
    const tentatives = e.tentatives + 1;
    if (res.ok) {
      await this.prisma.cbsEnvoi.update({
        where: { id },
        data: { statut: StatutCbsEnvoi.ENVOYE, tentatives, envoyeAt: new Date(), dernierMessage: res.message ?? null },
      });
      await this.audit.log({
        dossierId: e.dossierId,
        actorId: null,
        action: 'CBS_ENVOYE',
        entityType: 'DOSSIER',
        entityId: e.dossierId,
        payload: { provider: res.provider, tentatives },
      });
      return;
    }
    const abandon = tentatives >= MAX_TENTATIVES;
    await this.prisma.cbsEnvoi.update({
      where: { id },
      data: {
        statut: abandon ? StatutCbsEnvoi.ECHEC : StatutCbsEnvoi.EN_ATTENTE,
        tentatives,
        dernierMessage: res.message ?? 'Échec de l’envoi',
        // Reprise exponentielle : 1, 2, 4, 8… minutes.
        prochainEssaiAt: new Date(Date.now() + 60_000 * 2 ** (tentatives - 1)),
      },
    });
  }

  list(statut?: StatutCbsEnvoi) {
    return this.prisma.cbsEnvoi.findMany({
      where: statut ? { statut } : {},
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { dossier: { select: { id: true, reference: true, client: { select: { fullName: true } } } } },
    });
  }

  latest(dossierId: string) {
    return this.prisma.cbsEnvoi.findFirst({ where: { dossierId }, orderBy: { createdAt: 'desc' } });
  }

  /** Relance manuelle : recalcule le message (n° de compte corrigé…) et renvoie. */
  async relancer(actorId: string, id: string) {
    const e = await this.prisma.cbsEnvoi.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Envoi introuvable');
    const ancien = e.payload as unknown as BankingDecisionNotify;
    await this.prisma.$transaction(async (tx) => {
      await this.enqueueTx(tx, e.dossierId, { montant: ancien.montant, dureeMois: ancien.dureeMois ?? null });
      await this.audit.log(
        { dossierId: e.dossierId, actorId, action: 'CBS_RELANCE', entityType: 'DOSSIER', entityId: e.dossierId },
        tx,
      );
    });
    await this.traiterFile();
    return this.prisma.cbsEnvoi.findUnique({ where: { id } });
  }
}
