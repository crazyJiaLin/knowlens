import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import {
  Document,
  DocumentDocument,
} from '../document/schemas/document.schema';
import { SubmitVideoDto } from './dto/submit-video.dto';
import { YoutubeService } from './services/youtube.service';
import { BilibiliService } from './services/bilibili.service';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    @InjectQueue('video-queue')
    private videoQueue: Queue,
    private youtubeService: YoutubeService,
    private bilibiliService: BilibiliService,
  ) {}

  /**
   * 解析视频平台类型
   */
  private parsePlatform(url: string): 'youtube' | 'bilibili' {
    if (this.youtubeService.isValidUrl(url)) {
      return 'youtube';
    }
    if (this.bilibiliService.isValidUrl(url)) {
      return 'bilibili';
    }
    throw new BadRequestException('不支持的视频平台，仅支持 YouTube 和 B站');
  }

  /**
   * 提交视频处理任务
   * 优化：快速返回，视频信息在队列任务中异步获取
   */
  async submitVideo(
    dto: SubmitVideoDto,
    userId: string,
  ): Promise<{
    documentId: string;
    status: string;
    message: string;
  }> {
    const { videoUrl } = dto;

    // 解析视频平台
    const platform = this.parsePlatform(videoUrl);

    // 快速提取 videoId（不调用外部 API）
    let videoId: string;
    if (platform === 'youtube') {
      videoId = this.youtubeService.extractVideoId(videoUrl) || 'unknown';
    } else {
      const bvidResult = this.bilibiliService.extractVideoId(videoUrl);
      videoId = bvidResult?.bvid || `av${bvidResult?.aid || 'unknown'}`;
    }

    // 创建文档记录（标题等信息将在队列任务中更新）
    const document = await this.documentModel.create({
      userId,
      sourceType: 'video',
      originalUrl: videoUrl,
      status: 'processing',
      video: {
        platform,
        videoId,
      },
    });

    // 投递到任务队列
    await this.videoQueue.add(
      'process-video',
      {
        documentId: document._id.toString(),
        videoUrl,
        userId,
        platform,
        videoId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(
      `视频处理任务已提交: documentId=${String(document._id)}, platform=${platform}`,
    );

    return {
      documentId: String(document._id),
      status: 'processing',
      message: '视频处理任务已提交',
    };
  }

  /**
   * 获取视频信息（不创建文档）
   */
  async getVideoInfo(videoUrl: string): Promise<{
    platform: 'youtube' | 'bilibili';
    videoId: string;
    title: string;
    duration?: number;
    thumbnail?: string;
    embedUrl: string;
  }> {
    const platform = this.parsePlatform(videoUrl);

    let videoInfo:
      | Awaited<ReturnType<typeof this.youtubeService.getVideoInfo>>
      | Awaited<ReturnType<typeof this.bilibiliService.getVideoInfo>>;
    let embedUrl: string;

    if (platform === 'youtube') {
      videoInfo = await this.youtubeService.getVideoInfo(videoUrl);
      embedUrl = this.youtubeService.getEmbedUrl(videoInfo.videoId);
    } else {
      videoInfo = await this.bilibiliService.getVideoInfo(videoUrl);
      const bilibiliInfo = videoInfo as Awaited<
        ReturnType<typeof this.bilibiliService.getVideoInfo>
      >;
      embedUrl = this.bilibiliService.getEmbedUrl(
        bilibiliInfo.bvid || bilibiliInfo.videoId,
      );
    }

    return {
      platform,
      videoId: videoInfo.videoId,
      title: videoInfo.title,
      duration: videoInfo.duration,
      thumbnail: videoInfo.thumbnail,
      embedUrl,
    };
  }
}
