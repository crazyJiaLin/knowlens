import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCodeDto {
  @ApiProperty({
    description: '手机号',
    example: '13800138000',
  })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^1\d{10}$/, { message: '请输入正确的手机号' })
  phone: string;

  @ApiProperty({
    description: '验证码',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(4, 6, { message: '验证码长度为4-6位' })
  code: string;
}
