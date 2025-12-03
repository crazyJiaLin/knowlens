import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { BilibiliCookieStatus } from '../schemas/bilibili-cookie.schema';

export class UpdateBilibiliCookieDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(BilibiliCookieStatus, {
    message: 'status 必须是 enabled、disabled 或 expired 之一',
  })
  status?: BilibiliCookieStatus;
}

