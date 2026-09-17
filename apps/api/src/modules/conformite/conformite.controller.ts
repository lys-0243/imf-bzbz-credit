import { Controller, Get } from '@nestjs/common';

@Controller('conformite')
export class ConformiteController {
  @Get()
  scaffold() {
    return { module: 'conformite', implemented: false };
  }
}
