import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitVideoDto {
  @ApiProperty({
    description: '视频链接（YouTube 或 B站）',
    example: 'https://www.youtube.com/watch?v=xxxxx',
  })
  @IsString()
  @IsUrl()
  videoUrl: string;
}
