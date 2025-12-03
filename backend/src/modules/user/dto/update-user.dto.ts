import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    description: '昵称',
    example: '张三',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  @MaxLength(20, { message: '昵称长度不能超过20个字符' })
  nickname?: string;

  @ApiProperty({
    description: '头像URL',
    example: 'https://oss.example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '头像URL必须是字符串' })
  avatarUrl?: string;
}
