import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StructuredConstraintsDto } from '../agent/agent.dto';

export class CreateScenarioDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  baselineRunId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  interventions!: Record<string, unknown>[];

  @IsOptional()
  @IsISO8601()
  horizonStart?: string;

  @IsOptional()
  @IsNumber()
  sampleTimeSeconds?: number;
}

export class CompareScenariosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scenarioRunIds!: string[];
}

export class CreateLabAgentDto {
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
