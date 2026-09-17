import { Controller, Get } from '@nestjs/common';

@Controller('audit')
export class AuditController {
  @Get()
  scaffold() {
    return { module: 'audit', implemented: false };
  }
}
