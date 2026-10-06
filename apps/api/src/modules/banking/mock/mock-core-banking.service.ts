import { Injectable, Logger } from '@nestjs/common';
import type {
  BankingCreditHistorique,
  BankingDecisionNotify,
  BankingKyc,
  BankingLookupResult,
  BankingNotifyResult,
} from '@imf/shared';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CoreBankingPort } from '../core-banking.port';
import { computeMockScore } from './score-formulas';

type MockClient = {
  numeroCompte: string;
  ouvertLe?: string;
  cas?: string;
  kyc: BankingKyc;
  historique: BankingCreditHistorique[];
};

@Injectable()
export class MockCoreBankingService implements CoreBankingPort {
  private readonly logger = new Logger(MockCoreBankingService.name);
  private readonly byAccount: Map<string, MockClient>;

  constructor() {
    const path = join(__dirname, 'mock-clients.json');
    const raw = readFileSync(path, 'utf8');
    const clients = JSON.parse(raw) as MockClient[];
    this.byAccount = new Map(
      clients.map((c) => [c.numeroCompte.trim().toUpperCase(), c]),
    );
    this.logger.log(
      `Mock CBS chargé : ${this.byAccount.size} comptes (jetable — voir mock/README.md)`,
    );
  }

  async lookupByAccount(input: {
    numeroCompte: string;
    produitCode: string;
  }): Promise<BankingLookupResult> {
    const numeroCompte = input.numeroCompte.trim();
    const key = numeroCompte.toUpperCase();
    const client = this.byAccount.get(key);

    if (!client) {
      return {
        found: false,
        numeroCompte,
        kyc: null,
        creditEnCours: false,
        creditsActifs: [],
        historique: [],
        score: null,
        ouvertLe: null,
      };
    }

    const historique = client.historique ?? [];
    const creditsActifs = historique.filter((h) => h.statut === 'EN_COURS');
    const creditEnCours = creditsActifs.length > 0;
    const score = computeMockScore({
      historique,
      creditEnCours,
      ouvertLe: client.ouvertLe,
      produitCode: input.produitCode.trim().toUpperCase(),
    });

    return {
      found: true,
      numeroCompte: client.numeroCompte,
      kyc: client.kyc,
      creditEnCours,
      creditsActifs,
      historique,
      score,
      ouvertLe: client.ouvertLe ?? null,
    };
  }

  async notifyDecision(
    input: BankingDecisionNotify,
  ): Promise<BankingNotifyResult> {
    this.logger.log(
      `[MOCK CBS] notifyDecision ${input.dossierReference} compte=${input.numeroCompte} etat=${input.etatFinal} montant=${input.montant}`,
    );
    return {
      ok: true,
      provider: 'mock',
      message: 'Décision enregistrée dans le mock (no-op CBS)',
    };
  }
}
