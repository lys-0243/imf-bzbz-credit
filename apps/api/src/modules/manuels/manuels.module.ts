import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ManuelsController } from './manuels.controller';
import { ManuelsService } from './manuels.service';

@Module({
  imports: [DocumentsModule],
  controllers: [ManuelsController],
  providers: [ManuelsService],
  exports: [ManuelsService],
})
export class ManuelsModule {}
