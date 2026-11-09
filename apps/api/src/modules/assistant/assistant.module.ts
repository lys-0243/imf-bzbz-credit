import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ManuelsModule } from '../manuels/manuels.module';
import { ScoringModule } from '../scoring/scoring.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [ScoringModule, ManuelsModule, LlmModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
