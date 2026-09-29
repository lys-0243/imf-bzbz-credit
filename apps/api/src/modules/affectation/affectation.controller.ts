import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsString } from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { AffectationService } from './affectation.service';

class AssignDto {
  @IsString()
  agentId!: string;
}

@Controller('affectation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESPONSABLE_CREDIT)
export class AffectationController {
  constructor(private readonly affectation: AffectationService) {}

  @Get('file')
  listFile() {
    return this.affectation.listFile();
  }

  @Get('agents')
  listAgents() {
    return this.affectation.listAgents();
  }

  @Get('dossiers/:id')
  getOne(@Param('id') id: string) {
    return this.affectation.getOne(id);
  }

  @Post('dossiers/:id/assign')
  assign(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: AssignDto,
  ) {
    return this.affectation.assign(user, id, dto.agentId);
  }
}
