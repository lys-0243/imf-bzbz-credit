import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { BankingService } from './banking.service';

@ApiTags('Banking')
@ApiBearerAuth('JWT')
@Controller('banking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankingController {
  constructor(private readonly banking: BankingService) {}

  @Get('lookup')
  @Roles(Role.RECEPTION, Role.ADMIN, Role.RESPONSABLE_CREDIT)
  @ApiOperation({
    summary: 'Lookup compte core banking',
    description:
      'Interroge le mock / connecteur banking pour préremplir une réception ' +
      '(numéro de compte + code produit).',
  })
  @ApiQuery({
    name: 'numeroCompte',
    required: true,
    example: '100200300',
    description: 'Numéro de compte client',
  })
  @ApiQuery({
    name: 'produitCode',
    required: true,
    example: 'DARE_DARE',
    description: 'Code produit crédit',
  })
  lookup(
    @Query('numeroCompte') numeroCompte?: string,
    @Query('produitCode') produitCode?: string,
  ) {
    return this.banking.lookup(numeroCompte || '', produitCode || '');
  }
}
