import { Controller, Get } from '@nestjs/common';

@Controller('affectation')
export class AffectationController {
  @Get()
  scaffold() {
    return { module: 'affectation', implemented: false };
  }
}
