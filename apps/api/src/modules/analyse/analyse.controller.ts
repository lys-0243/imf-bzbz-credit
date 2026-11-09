import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { PilierScore } from '@imf/shared';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { AnalyseService } from './analyse.service';

class ValiderScoreDto {
  @ApiPropertyOptional({
    description: 'Notes retenues par pilier (0–100) ; absent = proposition IA',
    example: { STABILITE: 70 },
  })
  @IsOptional()
  @IsObject()
  notes?: Partial<Record<PilierScore, number>>;

  @ApiPropertyOptional({ description: 'Obligatoire si l’écart avec la proposition IA dépasse le seuil' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;

  @ApiPropertyOptional({ description: 'Montant sur lequel les ratios sont évalués' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montant?: number;

  @ApiPropertyOptional({ description: 'Durée (mois) d’évaluation' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dureeMois?: number;
}

const LECTEURS = [Role.ANALYSTE, Role.CONFORMITE, Role.RESPONSABLE_CREDIT, Role.DG, Role.DGA, Role.CA, Role.ADMIN];

@ApiTags('Analyse')
@ApiBearerAuth('JWT')
@Controller('analyse/dossiers/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyseController {
  constructor(private readonly analyse: AnalyseService) {}

  @Get('score')
  @Roles(...LECTEURS)
  @ApiOperation({
    summary: 'Score de crédit : moteur, proposition IA, score validé',
    description: 'Le score moteur est recalculé sur le montant / la durée demandés (ratios CF 2.4).',
  })
  apercu(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Query('montant') montant?: string,
    @Query('dureeMois') dureeMois?: string,
  ) {
    return this.analyse.apercu(user, id, {
      montant: Number(montant) > 0 ? Number(montant) : null,
      dureeMois: Number(dureeMois) > 0 ? Math.round(Number(dureeMois)) : null,
    });
  }

  @Put('score')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  @ApiOperation({ summary: 'Valider le score de crédit (analyste)' })
  valider(@CurrentUser() user: { id: string; role: Role }, @Param('id') id: string, @Body() dto: ValiderScoreDto) {
    return this.analyse.valider(user, id, dto);
  }
}
