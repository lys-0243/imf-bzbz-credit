import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRONOSTIC_RECOMMANDATIONS,
  type PronosticRecommandation,
} from '@imf/shared';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Décision humaine au vu du pronostic (agent avant soumission, puis RC). */
export class DecisionPronosticDto {
  @ApiProperty({
    enum: PRONOSTIC_RECOMMANDATIONS,
    example: 'ACCORD_CONDITIONNEL',
    description: 'Avis retenu (pré-rempli avec l’avis IA)',
  })
  @IsIn(PRONOSTIC_RECOMMANDATIONS)
  recommandation!: PronosticRecommandation;

  @ApiPropertyOptional({ example: 2500, description: 'Montant retenu' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantRetenu?: number;

  @ApiPropertyOptional({ example: 10, description: 'Durée retenue (mois)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dureeRetenueMois?: number;

  @ApiPropertyOptional({
    example: 'Garantie complétée par un gage de stock.',
    description: 'Obligatoire si la décision s’écarte de l’avis IA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;
}
