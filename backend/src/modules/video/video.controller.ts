import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { VideoService } from './video.service';
import { SubmitVideoDto } from './dto/submit-video.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';

@ApiTags('视频处理')
@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '提交视频链接' })
  @ApiResponse({ status: 200, description: '提交成功' })
  @ApiResponse({ status: 400, description: '无效的视频链接' })
  @ApiResponse({ status: 401, description: '未登录' })
  async submitVideo(@Body() dto: SubmitVideoDto, @User('id') userId: string) {
    return this.videoService.submitVideo(dto, userId);
  }

  @Get('info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取视频信息' })
  @ApiQuery({
    name: 'url',
    description: '视频链接（YouTube 或 B站）',
    example: 'https://www.youtube.com/watch?v=xxxxx',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 400, description: '无效的视频链接' })
  async getVideoInfo(@Query('url') url: string) {
    return this.videoService.getVideoInfo(url);
  }
}
