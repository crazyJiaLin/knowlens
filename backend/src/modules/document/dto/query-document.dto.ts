import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryDocumentDto {
  @ApiProperty({
    description: '页码',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiProperty({
    description: '搜索关键词（按标题）',
    example: 'AI',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({
    description: '文档类型',
    enum: ['video', 'pdf', 'text'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['video', 'pdf', 'text'])
  sourceType?: 'video' | 'pdf' | 'text';

  @ApiProperty({
    description: '文档状态',
    enum: ['processing', 'completed', 'failed'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['processing', 'completed', 'failed'])
  status?: 'processing' | 'completed' | 'failed';
}
