import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

@ApiTags('Clients')
@ApiBearerAuth('JWT')
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  @Get()
  @ApiOperation({
    summary: 'Module clients (stub)',
    description: 'Placeholder — API clients dédiée non encore implémentée.',
  })
  scaffold() {
    return { module: 'clients', implemented: false };
  }
}
