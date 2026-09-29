import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsObject, IsString } from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { DemandesService } from './demandes.service';

class CreateDossierDto {
  @IsString()
  produitId!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

class UpdateDossierDto {
  @IsObject()
  payload!: Record<string, unknown>;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECEPTION, Role.AGENT)
export class DemandesController {
  constructor(private readonly demandes: DemandesService) {}

  @Get('zones')
  zones() {
    return this.demandes.listZones();
  }

  @Get('communes')
  communes() {
    return this.demandes.listCommunes();
  }

  @Get('produits')
  @Roles(
    Role.RECEPTION,
    Role.AGENT,
    Role.ANALYSTE,
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
  )
  produits() {
    return this.demandes.listProduitsActifs();
  }

  @Post('dossiers')
  create(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateDossierDto,
  ) {
    return this.demandes.create(user, dto.produitId, dto.payload);
  }

  @Get('dossiers')
  search(@Query('q') q?: string) {
    return this.demandes.search(q);
  }

  @Get('dossiers/:id')
  one(@Param('id') id: string) {
    return this.demandes.findOne(id);
  }

  @Patch('dossiers/:id')
  update(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: UpdateDossierDto,
  ) {
    return this.demandes.update(user, id, dto.payload);
  }

  @Get('dossiers/:id/timeline')
  timeline(@Param('id') id: string) {
    return this.demandes.timeline(id);
  }
}
