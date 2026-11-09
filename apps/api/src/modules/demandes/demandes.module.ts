import { Module } from '@nestjs/common';
import { BankingModule } from '../banking/banking.module';
import { DocumentsModule } from '../documents/documents.module';
import { DemandesController } from './demandes.controller';
import { DemandesService } from './demandes.service';

@Module({
  imports: [DocumentsModule, BankingModule],
  controllers: [DemandesController],
  providers: [DemandesService],
  exports: [DemandesService],
})
export class DemandesModule {}
