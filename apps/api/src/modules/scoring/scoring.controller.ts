import { Controller, Get } from '@nestjs/common';

@Controller('scoring')
export class ScoringController {
  @Get()
  scaffold() {
    return { module: 'scoring', implemented: false };
  }
}
