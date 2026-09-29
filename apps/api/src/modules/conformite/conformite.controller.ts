import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

@Controller('conformite')
@UseGuards(JwtAuthGuard)
export class ConformiteController {
  @Get()
  scaffold() {
    return { module: 'conformite', implemented: false };
  }
}
