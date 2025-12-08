import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateBilibiliCookieDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string; // Cookie 名称/备注

  @IsString()
  @IsNotEmpty()
  content: string; // Cookie 内容（Netscape 格式）
}
