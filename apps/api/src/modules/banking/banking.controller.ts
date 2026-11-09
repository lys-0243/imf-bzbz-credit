import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role, StatutCbsEnvoi } from '@prisma/client';
import { CurrentUser } from '../identity/current-user.decorator';
import { CbsOutboxService } from './cbs-outbox.service';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { BankingService } from './banking.service';

@ApiTags('Banking')
@ApiBearerAuth('JWT')
@Controller('banking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankingController {
  constructor(
    private readonly banking: BankingService,
    private readonly outbox: CbsOutboxService,
  ) {}

  @Get('envois')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Envois au core banking (outbox)' })
  @ApiQuery({ name: 'statut', required: false, enum: StatutCbsEnvoi })
  envois(@Query('statut') statut?: StatutCbsEnvoi) {
    const s = statut && (Object.values(StatutCbsEnvoi) as string[]).includes(statut) ? statut : undefined;
    return this.outbox.list(s);
  }

  @Post('envois/:id/relancer')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Relancer un envoi CBS',
    description: 'Recalcule le message (n° de compte corrigé, etc.) et le renvoie immédiatement.',
  })
  relancer(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.outbox.relancer(user.id, id);
  }

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
