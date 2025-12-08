import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class GenerateInsightDto {
  @IsString()
  kp_id: string;

  @IsOptional()
  @IsBoolean()
  force_regenerate?: boolean;
}
