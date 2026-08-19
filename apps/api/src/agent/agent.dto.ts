import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { INTERVENTION_TYPES } from '@repo/contracts';

export class StructuredConstraintsDto {
  @IsOptional()
  @IsArray()
  @IsIn(INTERVENTION_TYPES, { each: true })
  forbidInterventionTypes?: (typeof INTERVENTION_TYPES)[number][];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetZoneIds?: string[];

  @IsOptional()
  @IsISO8601()
  horizonStart?: string;

  @IsOptional()
  @IsISO8601()
  horizonEnd?: string;

  @IsOptional()
  @IsString()
  networkId?: string;

  @IsOptional()
  @IsNumber()
  sampleTimeSeconds?: number;
}

export class CreateAgentRunDto {
  @IsString()
  @MinLength(1)
  baselineRunId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  goal!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StructuredConstraintsDto)
  structuredConstraints?: StructuredConstraintsDto;

  @IsOptional()
  @IsObject()
  baselineSummary?: Record<string, unknown>;
}
