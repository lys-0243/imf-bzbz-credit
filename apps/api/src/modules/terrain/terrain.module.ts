import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { LlmModule } from '../llm/llm.module';
import { ScoringModule } from '../scoring/scoring.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { TerrainController } from './terrain.controller';
import { TerrainService } from './terrain.service';

@Module({
  imports: [DocumentsModule, WorkflowModule, ScoringModule, LlmModule],
  controllers: [TerrainController],
  providers: [TerrainService],
  exports: [TerrainService],
})
export class TerrainModule {}
