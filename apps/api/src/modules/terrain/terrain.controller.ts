import { Controller, Get } from '@nestjs/common';

@Controller('terrain')
export class TerrainController {
  @Get()
  scaffold() {
    return { module: 'terrain', implemented: false };
  }
}
