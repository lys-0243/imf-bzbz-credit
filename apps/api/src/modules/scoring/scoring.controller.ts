import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  @Get()
  scaffold() {
    return { module: 'scoring', implemented: false };
  }
}
