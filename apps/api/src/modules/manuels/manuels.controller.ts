import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role, SourceManuel } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { ManuelsService } from './manuels.service';

class CreerManuelDto {
  @ApiProperty({ example: 'Manuel de procédures de crédit' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titre!: string;

  @ApiProperty({ enum: SourceManuel })
  @IsEnum(SourceManuel)
  source!: SourceManuel;

  @ApiProperty({ example: '2026-1' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  version!: string;

  @ApiPropertyOptional({ example: 'Instruction BCC n°…' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateEffet?: string;
}

class StatutDto {
  @ApiProperty()
  @IsBoolean()
  actif!: boolean;
}

const LECTEURS = [
  Role.ANALYSTE,
  Role.CONFORMITE,
  Role.RESPONSABLE_CREDIT,
  Role.DG,
  Role.DGA,
  Role.CA,
  Role.ADMIN,
];

@ApiTags('Manuels')
@ApiBearerAuth('JWT')
@Controller('manuels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManuelsController {
  constructor(private readonly manuels: ManuelsService) {}

  @Get()
  @Roles(...LECTEURS)
  @ApiOperation({ summary: 'Manuels de procédures et instructions BCC' })
  list() {
    return this.manuels.list();
  }

  @Get('recherche')
  @Roles(...LECTEURS)
  @ApiOperation({
    summary: 'Recherche dans les manuels actifs',
    description: 'Plein texte (mots, OR, "expression exacte"), accents ignorés.',
  })
  @ApiQuery({ name: 'q', required: true, example: 'garantie OR caution' })
  rechercher(@Query('q') q = '', @Query('limite') limite?: string) {
    return this.manuels.rechercher(q, Number(limite) || 8);
  }

  @Get('sections/:id')
  @Roles(...LECTEURS)
  @ApiOperation({ summary: 'Section de manuel (citation)' })
  async section(@Param('id') id: string) {
    const s = await this.manuels.section(id);
    if (!s) throw new NotFoundException('Section introuvable');
    return s;
  }

  @Get(':id')
  @Roles(...LECTEURS)
  @ApiOperation({ summary: 'Manuel et ses sections' })
  sections(@Param('id') id: string) {
    return this.manuels.sections(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Ajouter un manuel',
    description: 'PDF (texte), DOCX ou TXT : le texte est extrait, découpé en sections et indexé.',
  })
  creer(
    @CurrentUser() user: { id: string },
    @Body() dto: CreerManuelDto,
    @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype?: string },
  ) {
    return this.manuels.creer(user.id, dto, file);
  }

  @Patch(':id/statut')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activer / désactiver un manuel' })
  statut(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: StatutDto) {
    return this.manuels.majStatut(user.id, id, dto.actif);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un manuel' })
  supprimer(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.manuels.supprimer(user.id, id);
  }
}
