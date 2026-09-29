import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { AffectationController } from './affectation.controller';
import { AffectationService } from './affectation.service';

@Module({
  imports: [WorkflowModule],
  controllers: [AffectationController],
  providers: [AffectationService],
})
export class AffectationModule {}
