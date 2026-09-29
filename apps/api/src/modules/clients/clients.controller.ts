import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  @Get()
  scaffold() {
    return { module: 'clients', implemented: false };
  }
}
