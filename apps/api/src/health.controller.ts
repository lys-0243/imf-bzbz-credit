import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Healthcheck',
    description: 'Indique que l’API répond. Aucune authentification requise.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service up',
    schema: { example: { status: 'ok' } },
  })
  ok() {
    return { status: 'ok' };
  }
}
