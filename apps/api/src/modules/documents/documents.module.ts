import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { createFileStorage } from './storage/create-file-storage';
import { FILE_STORAGE } from './storage/file-storage';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    { provide: FILE_STORAGE, useFactory: createFileStorage },
  ],
  exports: [DocumentsService, FILE_STORAGE],
})
export class DocumentsModule {}
