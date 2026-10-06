import type {
  BankingDecisionNotify,
  BankingLookupResult,
  BankingNotifyResult,
} from '@imf/shared';

/** Contrat durable — survivra à la suppression du mock. */
export interface CoreBankingPort {
  lookupByAccount(input: {
    numeroCompte: string;
    produitCode: string;
  }): Promise<BankingLookupResult>;

  notifyDecision(input: BankingDecisionNotify): Promise<BankingNotifyResult>;
}

export const CORE_BANKING = Symbol('CORE_BANKING');
