import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateResilienceStudyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  eventHours!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  analytics?: string[];

  @IsOptional()
  @IsBoolean()
  runChemistry?: boolean;
}
