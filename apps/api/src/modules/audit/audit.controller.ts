import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';

@ApiTags('Audit')
@ApiBearerAuth('JWT')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  @Get()
  @ApiOperation({
    summary: 'Point d’entrée audit',
    description:
      'Stub : le journal filtré est exposé sur `GET /admin/audit`.',
  })
  overview() {
    return {
      module: 'audit',
      implemented: true,
      note: 'Use GET /admin/audit for filtered journal',
    };
  }
}
