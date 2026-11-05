import { Module } from '@nestjs/common';
import { BankingModule } from '../banking/banking.module';
import { LlmModule } from '../llm/llm.module';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

@Module({
  imports: [BankingModule, LlmModule],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
