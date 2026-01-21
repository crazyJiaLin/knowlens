import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadPdfDto {
  @ApiPropertyOptional({
    description: '可选：自定义文档标题',
    example: '年度报告',
  })
  @IsOptional()
  @IsString()
  title?: string;
}
