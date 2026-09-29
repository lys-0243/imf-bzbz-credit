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
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  zoneId?: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  zoneId?: string | null;
}

class UserStatusDto {
  @IsBoolean()
  disabled!: boolean;
}

class CreateZoneDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}

class UpdateZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

class ReassignCommuneDto {
  @IsString()
  zoneId!: string;
}

class CreateProduitDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  label!: string;

  @IsNumber()
  @Min(0.01)
  montantMin!: number;

  @IsNumber()
  @Min(0.01)
  montantMax!: number;

  @IsNumber()
  @Min(1)
  dureeMin!: number;

  @IsNumber()
  @Min(1)
  dureeMax!: number;

  @IsEnum(DureeUnite)
  dureeUnite!: DureeUnite;

  @IsString()
  @MinLength(1)
  refPrefix!: string;

  @IsEnum(FamilleProduit)
  famille!: FamilleProduit;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

class UpdateProduitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montantMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montantMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dureeMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dureeMax?: number;

  @IsOptional()
  @IsEnum(DureeUnite)
  dureeUnite?: DureeUnite;

  @IsOptional()
  @IsString()
  @MinLength(1)
  refPrefix?: string;

  @IsOptional()
  @IsEnum(FamilleProduit)
  famille?: FamilleProduit;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class ProduitStatusDto {
  @IsBoolean()
  actif!: boolean;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('dossiers')
  listDossiers(@Query('q') q?: string) {
    return this.admin.listDossiers(q);
  }

  @Get('dossiers/:id')
  getDossier(@Param('id') id: string) {
    return this.admin.getDossier(id);
  }

  @Get('users')
  listUsers(@Query('q') q?: string, @Query('role') role?: Role) {
    return this.admin.listUsers(q, role);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Post('users')
  createUser(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateUserDto,
  ) {
    return this.admin.createUser(user.id, dto);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.admin.updateUser(user.id, id, dto);
  }

  @Patch('users/:id/status')
  setStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UserStatusDto,
  ) {
    return this.admin.setUserStatus(user.id, id, dto.disabled);
  }

  @Get('zones')
  listZones() {
    return this.admin.listZones();
  }

  @Post('zones')
  createZone(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateZoneDto,
  ) {
    return this.admin.createZone(user.id, dto);
  }

  @Patch('zones/:id')
  updateZone(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.admin.updateZone(user.id, id, dto);
  }

  @Patch('communes/:id')
  reassignCommune(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReassignCommuneDto,
  ) {
    return this.admin.reassignCommune(user.id, id, dto.zoneId);
  }

  @Get('produits')
  listProduits() {
    return this.admin.listProduits();
  }

  @Post('produits')
  createProduit(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProduitDto,
  ) {
    return this.admin.createProduit(user.id, dto);
  }

  @Patch('produits/:id')
  updateProduit(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateProduitDto,
  ) {
    return this.admin.updateProduit(user.id, id, dto);
  }

  @Patch('produits/:id/status')
  setProduitStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ProduitStatusDto,
  ) {
    return this.admin.setProduitStatus(user.id, id, dto.actif);
  }

  @Delete('produits/:id')
  deleteProduit(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.admin.deleteProduit(user.id, id);
  }

  @Get('audit')
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
