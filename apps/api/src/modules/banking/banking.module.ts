import { Module } from '@nestjs/common';
import { CORE_BANKING } from './core-banking.port';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { MockCoreBankingService } from './mock/mock-core-banking.service';

const provider = (process.env.CORE_BANKING_PROVIDER || 'mock').toLowerCase();

@Module({
  controllers: [BankingController],
  providers: [
    BankingService,
    MockCoreBankingService,
    {
      provide: CORE_BANKING,
      useExisting:
        provider === 'mock'
          ? MockCoreBankingService
          : MockCoreBankingService /* real: remplacer ici */,
    },
  ],
  exports: [BankingService, CORE_BANKING],
})
export class BankingModule {}
