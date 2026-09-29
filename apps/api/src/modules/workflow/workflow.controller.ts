import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { ALLOWED_TRANSITIONS } from './workflow.service';

@Controller('workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.RECEPTION,
  Role.AGENT,
  Role.ANALYSTE,
)
export class WorkflowController {
  @Get()
  overview() {
    return {
      module: 'workflow',
      implemented: true,
      transitions: ALLOWED_TRANSITIONS,
    };
  }

  @Get('allowed')
  allowed() {
    return ALLOWED_TRANSITIONS;
  }
}
