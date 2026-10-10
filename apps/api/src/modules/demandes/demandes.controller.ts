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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsObject, IsString } from 'class-validator';
import { CurrentUser } from '../identity/current-user.decorator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { DemandesService } from './demandes.service';

const RECEPTION_PAYLOAD_EXAMPLE = {
  communeId: 'clxxxxxxxxcommune',
  numeroCompte: '100200300',
  prenom: 'Jean',
  nom: 'Mbala',
  postNom: 'Kabila',
  dateNaissance: '1990-05-12',
  typePiece: 'Carte d’électeur',
  numeroPiece: 'CD-123456789',
  sexe: 'M',
  telephone: '+243900000001',
  email: 'jean.mbala@example.com',
  etatCivil: 'Célibataire',
  adresseDomicile: 'Av. de la Paix, Kinshasa',
  devise: 'USD',
  montantSollicite: 500,
  dureeSemaines: 12,
  motifCredit: 'Fonds de roulement commerce',
  capaciteMensuelle: 150,
  pretAutreInstitution: 'Non',
  autreInstitutionNom: '',
};

class CreateDossierDto {
  @ApiProperty({
    example: 'clxxxxxxxxproduit',
    description: 'ID du produit crédit actif (voir GET /produits)',
  })
  @IsString()
  produitId!: string;

  @ApiProperty({
    description: 'Données de réception du dossier (identité, prêt, etc.)',
    example: RECEPTION_PAYLOAD_EXAMPLE,
  })
  @IsObject()
  payload!: Record<string, unknown>;
}

class UpdateDossierDto {
  @ApiProperty({
    description: 'Payload partiel ou complet à fusionner / remplacer selon le service',
    example: {
      telephone: '+243900000099',
      montantSollicite: 750,
      motifCredit: 'Achat stock',
    },
  })
  @IsObject()
  payload!: Record<string, unknown>;
}

@ApiTags('Demandes')
@ApiBearerAuth('JWT')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECEPTION, Role.AGENT)
export class DemandesController {
  constructor(private readonly demandes: DemandesService) {}

  @Get('zones')
  @ApiOperation({
    summary: 'Liste des zones',
    description: 'Référentiel des zones géographiques.',
  })
  zones() {
    return this.demandes.listZones();
  }

  @Get('communes')
  @ApiOperation({
    summary: 'Liste des communes',
    description: 'Communes avec zone associée — requises pour créer un dossier.',
  })
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
  @ApiOperation({
    summary: 'Produits crédit actifs',
    description: 'Catalogue des produits utilisables à la réception.',
  })
  produits() {
    return this.demandes.listProduitsActifs();
  }

  @Post('dossiers')
  @ApiOperation({
    summary: 'Créer un dossier',
    description:
      'Enregistre une demande de crédit (réception). Le dossier passe en ' +
      'EN_ATTENTE_ATTRIBUTION_AGENT pour le responsable crédit.',
  })
  @ApiBody({
    type: CreateDossierDto,
    examples: {
      reception: {
        summary: 'Dossier réception type',
        value: {
          produitId: 'clxxxxxxxxproduit',
          payload: RECEPTION_PAYLOAD_EXAMPLE,
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Dossier créé' })
  @ApiResponse({ status: 400, description: 'Payload ou produit invalide' })
  create(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: CreateDossierDto,
  ) {
    return this.demandes.create(user, dto.produitId, dto.payload);
  }

  @Get('dossiers')
  @ApiOperation({
    summary: 'Rechercher des dossiers',
    description:
      'Liste / recherche les dossiers visibles pour le rôle (réception : ses dossiers).',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Filtre libre (référence, nom, téléphone…)',
    example: 'Mbala',
  })
  search(
    @CurrentUser() user: { id: string; role: Role },
    @Query('q') q?: string,
  ) {
    return this.demandes.search(user, q);
  }

  @Get('dossiers/:id')
  @ApiOperation({ summary: 'Détail d’un dossier' })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  one(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.demandes.findOne(user, id);
  }

  @Patch('dossiers/:id')
  @ApiOperation({
    summary: 'Mettre à jour le payload',
    description: 'Modifie les données du dossier tant qu’il est éditable.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  @ApiBody({
    type: UpdateDossierDto,
    examples: {
      telephone: {
        summary: 'Corriger téléphone et montant',
        value: {
          payload: {
            telephone: '+243900000099',
            montantSollicite: 750,
          },
        },
      },
    },
  })
  update(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
    @Body() dto: UpdateDossierDto,
  ) {
    return this.demandes.update(user, id, dto.payload);
  }

  @Get('dossiers/:id/timeline')
  @ApiOperation({
    summary: 'Timeline des transitions',
    description: 'Historique des changements d’état du dossier.',
  })
  @ApiParam({ name: 'id', description: 'ID du dossier' })
  timeline(
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') id: string,
  ) {
    return this.demandes.timeline(user, id);
  }
}
