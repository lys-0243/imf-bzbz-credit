import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { ParametresService } from './parametres.service';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParametresController {
  constructor(private readonly parametres: ParametresService) {}

  @Get('parametres')
  @Roles(
    Role.RECEPTION,
    Role.AGENT,
    Role.RESPONSABLE_CREDIT,
    Role.ANALYSTE,
    Role.CONFORMITE,
    Role.DG,
    Role.CA,
    Role.ADMIN,
  )
  @ApiOperation({
    summary: 'Paramètres IMF',
    description: 'Institution, conditions tarifaires, seuil CA et grille de taux.',
  })
  get() {
    return this.parametres.get();
  }

  @Put('admin/parametres')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier les paramètres IMF (audité)' })
  @ApiBody({ description: 'Objet ParametresImf complet (voir GET /parametres)' })
  update(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.parametres.update(user.id, body);
  }
}
