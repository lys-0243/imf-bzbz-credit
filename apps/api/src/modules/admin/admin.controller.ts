import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DureeUnite, FamilleProduit, Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { AdminService } from './admin.service';

class CreateUserDto {
  @ApiProperty({ example: 'nouvel.agent@imf.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nouvel Agent', minLength: 2 })
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiProperty({ example: 'Agent1!', minLength: 4 })
  @IsString()
  @MinLength(4)
  password!: string;

  @ApiProperty({ enum: Role, example: Role.AGENT })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({
    example: 'clxxxxxxxxzone',
    description: 'Zone obligatoire pour AGENT / RECEPTION selon règles métier',
  })
  @IsOptional()
  @IsString()
  zoneId?: string;
}

class UpdateUserDto {
  @ApiPropertyOptional({ example: 'agent.a@imf.local' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Agent A' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Agent1!' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: 'clxxxxxxxxzone', nullable: true })
  @IsOptional()
  @IsString()
  zoneId?: string | null;
}

class UserStatusDto {
  @ApiProperty({
    example: true,
    description: 'true = désactiver le compte, false = réactiver',
  })
  @IsBoolean()
  disabled!: boolean;
}

class CreateZoneDto {
  @ApiProperty({ example: 'LUB', minLength: 2 })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Lubumbashi', minLength: 2 })
  @IsString()
  @MinLength(2)
  name!: string;
}

class UpdateZoneDto {
  @ApiPropertyOptional({ example: 'LUB' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @ApiPropertyOptional({ example: 'Lubumbashi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

class ReassignCommuneDto {
  @ApiProperty({
    example: 'clxxxxxxxxzone',
    description: 'Nouvelle zone de rattachement',
  })
  @IsString()
  zoneId!: string;
}

class CreateProduitDto {
  @ApiProperty({ example: 'DARE_DARE_PLUS' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Crédit Dare-Dare Plus' })
  @IsString()
  @MinLength(2)
  label!: string;

  @ApiProperty({ example: 100, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  montantMin!: number;

  @ApiProperty({ example: 2000, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  montantMax!: number;

  @ApiProperty({ example: 4, minimum: 1 })
  @IsNumber()
  @Min(1)
  dureeMin!: number;

  @ApiProperty({ example: 24, minimum: 1 })
  @IsNumber()
  @Min(1)
  dureeMax!: number;

  @ApiProperty({ enum: DureeUnite, example: DureeUnite.SEMAINES })
  @IsEnum(DureeUnite)
  dureeUnite!: DureeUnite;

  @ApiProperty({ example: 'DDP', description: 'Préfixe des références dossier' })
  @IsString()
  @MinLength(1)
  refPrefix!: string;

  @ApiProperty({ enum: FamilleProduit, example: FamilleProduit.ACTIVITE })
  @IsEnum(FamilleProduit)
  famille!: FamilleProduit;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

class UpdateProduitDto {
  @ApiPropertyOptional({ example: 'DARE_DARE_PLUS' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @ApiPropertyOptional({ example: 'Crédit Dare-Dare Plus' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  label?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montantMin?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montantMax?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  dureeMin?: number;

  @ApiPropertyOptional({ example: 26 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  dureeMax?: number;

  @ApiPropertyOptional({ enum: DureeUnite })
  @IsOptional()
  @IsEnum(DureeUnite)
  dureeUnite?: DureeUnite;

  @ApiPropertyOptional({ example: 'DDP' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  refPrefix?: string;

  @ApiPropertyOptional({ enum: FamilleProduit })
  @IsOptional()
  @IsEnum(FamilleProduit)
  famille?: FamilleProduit;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class ProduitStatusDto {
  @ApiProperty({
    example: false,
    description: 'true = produit actif à la réception',
  })
  @IsBoolean()
  actif!: boolean;
}

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Vue d’ensemble admin',
    description: 'Compteurs globaux (users, dossiers, zones…).',
  })
  overview() {
    return this.admin.overview();
  }

  @Get('dossiers')
  @ApiOperation({ summary: 'Tous les dossiers (admin)' })
  @ApiQuery({ name: 'q', required: false, example: 'DDP-' })
  listDossiers(@Query('q') q?: string) {
    return this.admin.listDossiers(q);
  }

  @Get('dossiers/:id')
  @ApiOperation({ summary: 'Détail dossier (admin)' })
  @ApiParam({ name: 'id', description: 'ID dossier' })
  getDossier(@Param('id') id: string) {
    return this.admin.getDossier(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Liste des utilisateurs' })
  @ApiQuery({ name: 'q', required: false, example: 'agent' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  listUsers(@Query('q') q?: string, @Query('role') role?: Role) {
    return this.admin.listUsers(q, role);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Détail utilisateur' })
  @ApiParam({ name: 'id', description: 'ID utilisateur' })
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Post('users')
  @ApiOperation({
    summary: 'Créer un utilisateur',
    description: 'Crée un compte avec rôle et zone optionnelle.',
  })
  @ApiBody({
    type: CreateUserDto,
    examples: {
      agent: {
        summary: 'Nouvel agent',
        value: {
          email: 'nouvel.agent@imf.local',
          displayName: 'Nouvel Agent',
          password: 'Agent1!',
          role: 'AGENT',
          zoneId: 'clxxxxxxxxzone',
        },
      },
    },
  })
  createUser(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateUserDto,
  ) {
    return this.admin.createUser(user.id, dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  @ApiParam({ name: 'id', description: 'ID utilisateur' })
  @ApiBody({
    type: UpdateUserDto,
    examples: {
      rename: {
        summary: 'Renommer',
        value: { displayName: 'Agent A (senior)' },
      },
    },
  })
  updateUser(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.admin.updateUser(user.id, id, dto);
  }

  @Patch('users/:id/status')
  @ApiOperation({
    summary: 'Activer / désactiver un compte',
    description: 'Un compte désactivé ne peut plus s’authentifier ni utiliser un JWT existant.',
  })
  @ApiParam({ name: 'id', description: 'ID utilisateur' })
  @ApiBody({
    type: UserStatusDto,
    examples: {
      disable: { summary: 'Désactiver', value: { disabled: true } },
      enable: { summary: 'Réactiver', value: { disabled: false } },
    },
  })
  setStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UserStatusDto,
  ) {
    return this.admin.setUserStatus(user.id, id, dto.disabled);
  }

  @Get('zones')
  @ApiOperation({ summary: 'Liste des zones (admin)' })
  listZones() {
    return this.admin.listZones();
  }

  @Post('zones')
  @ApiOperation({ summary: 'Créer une zone' })
  @ApiBody({
    type: CreateZoneDto,
    examples: {
      lub: {
        summary: 'Zone Lubumbashi',
        value: { code: 'LUB', name: 'Lubumbashi' },
      },
    },
  })
  createZone(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateZoneDto,
  ) {
    return this.admin.createZone(user.id, dto);
  }

  @Patch('zones/:id')
  @ApiOperation({ summary: 'Modifier une zone' })
  @ApiParam({ name: 'id', description: 'ID zone' })
  @ApiBody({
    type: UpdateZoneDto,
    examples: {
      rename: { summary: 'Renommer', value: { name: 'Lubumbashi Centre' } },
    },
  })
  updateZone(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.admin.updateZone(user.id, id, dto);
  }

  @Patch('communes/:id')
  @ApiOperation({
    summary: 'Réaffecter une commune',
    description: 'Change la zone de rattachement d’une commune.',
  })
  @ApiParam({ name: 'id', description: 'ID commune' })
  @ApiBody({
    type: ReassignCommuneDto,
    examples: {
      move: {
        summary: 'Vers une autre zone',
        value: { zoneId: 'clxxxxxxxxzone' },
      },
    },
  })
  reassignCommune(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReassignCommuneDto,
  ) {
    return this.admin.reassignCommune(user.id, id, dto.zoneId);
  }

  @Get('produits')
  @ApiOperation({ summary: 'Catalogue produits (tous, y compris inactifs)' })
  listProduits() {
    return this.admin.listProduits();
  }

  @Post('produits')
  @ApiOperation({ summary: 'Créer un produit crédit' })
  @ApiBody({
    type: CreateProduitDto,
    examples: {
      dare: {
        summary: 'Produit Dare-Dare Plus',
        value: {
          code: 'DARE_DARE_PLUS',
          label: 'Crédit Dare-Dare Plus',
          montantMin: 100,
          montantMax: 2000,
          dureeMin: 4,
          dureeMax: 24,
          dureeUnite: 'SEMAINES',
          refPrefix: 'DDP',
          famille: 'ACTIVITE',
          sortOrder: 10,
          actif: true,
        },
      },
    },
  })
  createProduit(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProduitDto,
  ) {
    return this.admin.createProduit(user.id, dto);
  }

  @Patch('produits/:id')
  @ApiOperation({ summary: 'Modifier un produit' })
  @ApiParam({ name: 'id', description: 'ID produit' })
  @ApiBody({
    type: UpdateProduitDto,
    examples: {
      plafond: {
        summary: 'Augmenter le plafond',
        value: { montantMax: 2500 },
      },
    },
  })
  updateProduit(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateProduitDto,
  ) {
    return this.admin.updateProduit(user.id, id, dto);
  }

  @Patch('produits/:id/status')
  @ApiOperation({ summary: 'Activer / désactiver un produit' })
  @ApiParam({ name: 'id', description: 'ID produit' })
  @ApiBody({
    type: ProduitStatusDto,
    examples: {
      off: { summary: 'Désactiver', value: { actif: false } },
      on: { summary: 'Activer', value: { actif: true } },
    },
  })
  setProduitStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ProduitStatusDto,
  ) {
    return this.admin.setProduitStatus(user.id, id, dto.actif);
  }

  @Delete('produits/:id')
  @ApiOperation({
    summary: 'Supprimer un produit',
    description: 'Suppression si aucun dossier n’y est lié (sinon erreur métier).',
  })
  @ApiParam({ name: 'id', description: 'ID produit' })
  deleteProduit(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.admin.deleteProduit(user.id, id);
  }

  @Get('audit')
  @ApiOperation({
    summary: 'Journal d’audit filtré',
    description: 'Liste paginée des événements (acteur, action, entité, dossier, dates).',
  })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false, example: 'DOSSIER_CREATED' })
  @ApiQuery({ name: 'entityType', required: false, example: 'DOSSIER' })
  @ApiQuery({ name: 'dossierId', required: false })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31T23:59:59.000Z' })
  @ApiQuery({ name: 'skip', required: false, example: '0' })
  @ApiQuery({ name: 'take', required: false, example: '50' })
  listAudit(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('dossierId') dossierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listAudit({
      actorId,
      action,
      entityType,
      dossierId,
      from,
      to,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
