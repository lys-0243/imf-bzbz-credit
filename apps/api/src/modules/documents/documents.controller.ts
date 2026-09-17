import { Controller, Get } from '@nestjs/common';

@Controller('documents')
export class DocumentsController {
  @Get()
  scaffold() {
    return { module: 'documents', implemented: false };
  }
}
