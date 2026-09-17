import { Controller, Get } from '@nestjs/common';

@Controller('clients')
export class ClientsController {
  @Get()
  scaffold() {
    return { module: 'clients', implemented: false };
  }
}
