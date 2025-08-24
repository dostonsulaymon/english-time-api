import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { PlanName } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdatePlanDto {
  @IsOptional()
  @IsEnum(PlanName)
  name?: PlanName;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  duration?: number;
}