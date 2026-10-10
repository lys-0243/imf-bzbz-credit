import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

@ApiTags('Scoring')
@ApiBearerAuth('JWT')
@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  @Get()
  @ApiOperation({
    summary: 'Module scoring (stub)',
    description: 'Placeholder — scoring non encore implémenté (`implemented: false`).',
  })
  scaffold() {
    return { module: 'scoring', implemented: false };
  }
}
