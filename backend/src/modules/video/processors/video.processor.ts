import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Document,
  DocumentDocument,
} from '../../document/schemas/document.schema';
import {
  Segment,
  SegmentDocument,
} from '../../document/schemas/segment.schema';
import { YoutubeService } from '../services/youtube.service';
import { BilibiliService } from '../services/bilibili.service';
import { XfyunService } from '../services/xfyun.service';
import { MoonshotService } from '../../../shared/services/moonshot.service';

interface VideoJobData {
  documentId: string;
  videoUrl: string;
  userId: string;
  platform: 'youtube' | 'bilibili';
  videoId: string;
}

@Processor('video-queue')
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    @InjectModel(Segment.name)
    private segmentModel: Model<SegmentDocument>,
    private youtubeService: YoutubeService,
    private bilibiliService: BilibiliService,
    private xfyunService: XfyunService,
    private llmService: MoonshotService,
  ) {
    super();
  }

  async process(job: Job<VideoJobData>) {
    const { documentId, videoUrl, platform } = job.data;

    this.logger.log(
      `开始处理视频任务: jobId=${job.id}, documentId=${documentId}, platform=${platform}`,
    );

    try {
      // 更新进度：开始处理
      await job.updateProgress({ progress: 5, message: '正在获取视频信息...' });

      // 获取视频信息（标题、时长等）- 在队列任务中异步获取，不阻塞提交接口
      let videoInfo:
        | Awaited<ReturnType<typeof this.youtubeService.getVideoInfo>>
        | Awaited<ReturnType<typeof this.bilibiliService.getVideoInfo>>
        | undefined;
      try {
        if (platform === 'youtube') {
          videoInfo = await this.youtubeService.getVideoInfo(videoUrl);
        } else {
          videoInfo = await this.bilibiliService.getVideoInfo(videoUrl);
        }

        // 更新文档标题和视频信息
        await this.documentModel.updateOne(
          { _id: documentId },
          {
            title: videoInfo.title || undefined,
            'video.duration': videoInfo.duration,
          },
        );
      } catch (error) {
        this.logger.warn(`获取视频信息失败: ${error}，继续处理`);
        // 获取视频信息失败不影响后续流程
      }

      await job.updateProgress({ progress: 10, message: '视频信息获取完成' });

      // 获取字幕
      let transcript: Array<{ text: string; start: number; end: number }> = [];
      let transcriptSource: 'native' | 'asr' = 'native';

      // 尝试获取原生字幕
      try {
        if (platform === 'youtube') {
          transcript = await this.youtubeService.getTranscript(videoUrl);
        } else if (platform === 'bilibili') {
          transcript = await this.bilibiliService.getTranscript(videoUrl);
        }

        // 如果成功获取到字幕
        if (transcript && transcript.length > 0) {
          this.logger.log(`字幕获取成功，共 ${transcript.length} 个片段`);
        } else {
          this.logger.warn('未找到字幕，将使用语音识别');
          transcript = []; // 确保为空数组，触发降级
        }
      } catch (error) {
        // 字幕获取失败，记录日志但不抛出错误，尝试降级到语音识别
        this.logger.warn(
          `获取原生字幕失败: ${error instanceof Error ? error.message : String(error)}，将尝试使用语音识别`,
        );
        transcript = []; // 设置为空数组，触发降级
      }

      // 如果没有字幕或获取失败，使用语音识别
      if (!transcript || transcript.length === 0) {
        this.logger.log('使用科大讯飞进行语音转写');

        // 检查科大讯飞服务是否可用
        if (!this.xfyunService.isAvailable()) {
          throw new Error(
            '无法获取视频字幕，且科大讯飞服务未配置，无法进行语音转写。请配置 XFYUN_APP_ID 和 XFYUN_SECRET_KEY',
          );
        }

        try {
          // 1. 先提取音频
          await job.updateProgress({
            progress: 20,
            message: '正在提取音频...',
          });
          this.logger.log('开始提取音频...');
          const audioPath = await this.xfyunService.extractAudio(videoUrl);

          // 2. 调用科大讯飞 API 转写音频
          await job.updateProgress({
            progress: 40,
            message: '正在转写音频...',
          });
          this.logger.log('开始转写音频...');
          // transcript = await this.xfyunService.transcribe(
          //   '/Users/chenjialin/Desktop/WorkSpace/personal/knowlens/backend/temp/audio/3_1_3_3_sap_in_chinese.mp3',
          // );
          transcript = await this.xfyunService.transcribe(audioPath);

          // 3. 清理临时音频文件
          await this.xfyunService.cleanupAudio(audioPath);

          transcriptSource = 'asr';
          this.logger.log(`语音转写完成，共 ${transcript.length} 个片段`);
        } catch (error) {
          this.logger.error(`语音转写失败: ${error}`);
          throw new Error(
            `语音转写失败: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      await job.updateProgress({ progress: 60, message: '字幕获取完成' });

      // 使用大语言模型对字幕进行格式规整（分段、错别字纠正）
      // 重要：保证原文内容不变，只进行格式优化
      let formattedTranscript = transcript;
      if (this.llmService.isAvailable() && transcript.length > 0) {
        try {
          await job.updateProgress({
            progress: 65,
            message: '正在规整字幕格式...',
          });
          this.logger.log('开始使用大语言模型规整字幕格式');
          formattedTranscript =
            await this.llmService.formatTranscript(transcript);
          await job.updateProgress({
            progress: 70,
            message: '字幕格式规整完成',
          });
        } catch (error) {
          this.logger.warn(
            `字幕格式规整失败，使用原始字幕: ${error instanceof Error ? error.message : String(error)}`,
          );
          // 格式规整失败不影响后续流程，使用原始字幕
          await job.updateProgress({
            progress: 70,
            message: '字幕格式规整完成',
          });
        }
      } else {
        this.logger.log('Moonshot 服务未配置，跳过字幕格式规整');
        await job.updateProgress({
          progress: 70,
          message: '字幕格式规整完成',
        });
      }

      // 保存 segments
      await job.updateProgress({ progress: 75, message: '正在保存数据...' });
      if (formattedTranscript.length > 0) {
        const segments = formattedTranscript.map((item, index) => ({
          documentId,
          segmentIndex: index,
          text: item.text,
          startTime: item.start,
          endTime: item.end,
        }));

        await this.segmentModel.insertMany(segments);
        this.logger.log(`保存了 ${segments.length} 个片段到数据库`);
      }

      await job.updateProgress({ progress: 80, message: '数据保存完成' });

      // 计算总字数
      const wordCount = formattedTranscript.reduce(
        (sum, t) => sum + t.text.length,
        0,
      );

      // 更新文档状态
      await this.documentModel.updateOne(
        { _id: documentId },
        {
          status: 'completed',
          'video.transcriptSource': transcriptSource,
          wordCount,
        },
      );

      await job.updateProgress({ progress: 100, message: '处理完成' });

      this.logger.log(
        `视频任务完成: jobId=${job.id}, documentId=${documentId}`,
      );

      return { success: true, documentId };
    } catch (error) {
      this.logger.error(
        `视频任务失败: jobId=${job.id}, documentId=${documentId}`,
        error,
      );

      // 更新文档状态为失败
      try {
        await this.documentModel.updateOne(
          { _id: documentId },
          {
            status: 'failed',
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        );
      } catch (updateError) {
        this.logger.error(
          `更新文档状态失败: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
        );
      }

      // 重新抛出错误，让 BullMQ 处理重试
      throw error;
    }
  }
}
