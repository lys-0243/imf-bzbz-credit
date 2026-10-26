import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { TerrainModule } from '../terrain/terrain.module';
import { DossiersController } from './dossiers.controller';
import { DossiersService } from './dossiers.service';

@Module({
  imports: [DocumentsModule, TerrainModule],
  controllers: [DossiersController],
  providers: [DossiersService],
})
export class DossiersModule {}
