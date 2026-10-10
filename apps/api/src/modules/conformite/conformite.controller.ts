import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

@ApiTags('Conformite')
@ApiBearerAuth('JWT')
@Controller('conformite')
@UseGuards(JwtAuthGuard)
export class ConformiteController {
  @Get()
  @ApiOperation({
    summary: 'Module conformité (stub)',
    description: 'Placeholder — écrans conformité non encore branchés.',
  })
  scaffold() {
    return { module: 'conformite', implemented: false };
  }
}
