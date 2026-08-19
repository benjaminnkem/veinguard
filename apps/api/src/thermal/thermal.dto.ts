import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class TimeDto {
  @IsISO8601()
  start!: string;

  @IsISO8601()
  end!: string;
}

export class CreateThermalAcquisitionDto {
  @IsIn(['LIVE', 'FORECAST', 'HISTORICAL'])
  mode!: 'LIVE' | 'FORECAST' | 'HISTORICAL';

  @IsObject()
  aoi!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => TimeDto)
  time!: TimeDto;

  @IsNumber()
  @IsIn([60, 80, 100])
  granularityMeters!: 60 | 80 | 100;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  analytics!: string[];

  @IsOptional()
  @IsNumber()
  thresholdC?: number;

  @IsOptional()
  @IsIn(['above', 'below'])
  direction?: 'above' | 'below';

  @IsOptional()
  @IsBoolean()
  includeSolarIrradiance?: boolean;
}
