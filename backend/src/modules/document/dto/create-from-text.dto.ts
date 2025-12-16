import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFromTextDto {
  @ApiProperty({
    description: '文本内容',
    example: '这是一段文本内容...',
    maxLength: 100000,
  })
  @IsString()
  @IsNotEmpty({ message: '文本内容不能为空' })
  @MaxLength(100000, { message: '文本内容不能超过10万字' })
  text: string;

  @ApiProperty({
    description: '文档标题（可选）',
    example: '我的文档',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;
}

