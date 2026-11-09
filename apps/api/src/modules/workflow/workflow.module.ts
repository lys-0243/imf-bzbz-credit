import { Module } from '@nestjs/common';
import { BankingModule } from '../banking/banking.module';
import { WorkflowController } from './workflow.controller';
import { FileTravailService } from './file-travail.service';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [BankingModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, FileTravailService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
