import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { TerrainController } from './terrain.controller';
import { TerrainService } from './terrain.service';

@Module({
  imports: [DocumentsModule, WorkflowModule],
  controllers: [TerrainController],
  providers: [TerrainService],
  exports: [TerrainService],
})
export class TerrainModule {}
