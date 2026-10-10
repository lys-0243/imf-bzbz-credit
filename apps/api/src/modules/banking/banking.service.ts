import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  BankingDecisionNotify,
  BankingLookupResult,
  BankingNotifyResult,
} from '@imf/shared';
import { AuditService } from '../audit/audit.service';
import { CORE_BANKING, type CoreBankingPort } from './core-banking.port';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    @Inject(CORE_BANKING) private readonly cbs: CoreBankingPort,
    private readonly audit: AuditService,
  ) {}

  lookup(numeroCompte: string, produitCode: string): Promise<BankingLookupResult> {
    const compte = (numeroCompte || '').trim();
    const code = (produitCode || '').trim();
    if (!compte) {
      throw new BadRequestException('numeroCompte requis');
    }
    if (!code) {
      throw new BadRequestException('produitCode requis');
    }
    return this.cbs.lookupByAccount({
      numeroCompte: compte,
      produitCode: code,
    });
  }

  async notifyDecision(
    input: BankingDecisionNotify,
  ): Promise<BankingNotifyResult> {
    try {
      const res = await this.cbs.notifyDecision(input);
      await this.audit.log({
        actorId: null,
        action: res.ok ? 'BANKING_NOTIFY_OK' : 'BANKING_NOTIFY_FAIL',
        entityType: 'DOSSIER',
        entityId: input.dossierReference,
        payload: {
          provider: res.provider,
          numeroCompte: input.numeroCompte,
          etatFinal: input.etatFinal,
          message: res.message,
        },
      });
      return res;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'notifyDecision failed';
      this.logger.error(message);
      await this.audit.log({
        actorId: null,
        action: 'BANKING_NOTIFY_FAIL',
        entityType: 'DOSSIER',
        entityId: input.dossierReference,
        payload: {
          numeroCompte: input.numeroCompte,
          etatFinal: input.etatFinal,
          message,
        },
      });
      return { ok: false, provider: 'unknown', message };
    }
  }
}
