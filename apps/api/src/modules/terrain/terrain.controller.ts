import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { IsDateString, IsObject, IsString } from 'class-validator';
import type { ChecklistAnswers } from '@imf/shared';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { TerrainService } from './terrain.service';

class ChecklistDto {
  @IsObject()
  answers!: ChecklistAnswers;
}

class RapportDto {
  @IsString()
  rapportTexte!: string;
}

class StartVisiteDto {
  @IsDateString()
  visiteDate!: string;
}

class UploadMetaDto {
  @IsString()
  kind!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TerrainController {
  constructor(private readonly terrain: TerrainService) {}

  @Get('terrain')
  @Roles(Role.AGENT, Role.ADMIN, Role.ANALYSTE)
  scaffold() {
    return { module: 'terrain', implemented: true };
  }

  @Get('agent/dossiers')
  @Roles(Role.AGENT, Role.ADMIN)
  listMine(
    @CurrentUser() user: { id: string; role: Role; zoneId?: string | null },
  ) {
    return this.terrain.listMine(user);
  }

  @Get('agent/dossiers/:id')
  @Roles(Role.AGENT, Role.ADMIN)
  one(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.getOne(user, id);
  }

  @Post('agent/dossiers/:id/visite/start')
  @Roles(Role.AGENT, Role.ADMIN)
  start(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: StartVisiteDto,
  ) {
    return this.terrain.startVisite(user, id, dto.visiteDate);
  }

  @Put('agent/dossiers/:id/checklist')
  @Roles(Role.AGENT, Role.ADMIN)
  checklist(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: ChecklistDto,
  ) {
    return this.terrain.saveChecklist(user, id, dto.answers);
  }

  @Post('agent/dossiers/:id/rapport')
  @Roles(Role.AGENT, Role.ADMIN)
  rapport(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: RapportDto,
  ) {
    return this.terrain.saveRapport(user, id, dto.rapportTexte);
  }

  @Post('agent/dossiers/:id/rapport/generate')
  @Roles(Role.AGENT, Role.ADMIN)
  generateRapport(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.generateRapport(user, id);
  }

  @Post('agent/dossiers/:id/pieces')
  @Roles(Role.AGENT, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() meta: UploadMetaDto,
    @UploadedFile()
    file?: { originalname: string; buffer: Buffer; mimetype?: string },
  ) {
    return this.terrain.uploadPiece(user, id, meta.kind, file as any);
  }

  @Post('agent/dossiers/:id/soumettre')
  @Roles(Role.AGENT, Role.ADMIN)
  soumettre(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.soumettre(user, id);
  }

  @Get('analyste/dossiers')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  analysteList(@CurrentUser() user: { id: string; role: Role }) {
    return this.terrain.listForAnalyste(user);
  }

  @Get('analyste/dossiers/:id')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  analysteOne(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.terrain.getForAnalyste(user, id);
  }
}
