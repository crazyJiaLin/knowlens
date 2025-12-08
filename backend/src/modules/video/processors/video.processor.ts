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
import {
  KnowledgePoint,
  KnowledgePointDocument,
} from '../../knowledge/schemas/knowledge-point.schema';
import { YoutubeService } from '../services/youtube.service';
import { BilibiliService } from '../services/bilibili.service';
import { XfyunService } from '../services/xfyun.service';
import { MoonshotService } from '../../../common/services/moonshot.service';

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
    @InjectModel(KnowledgePoint.name)
    private knowledgePointModel: Model<KnowledgePointDocument>,
    private youtubeService: YoutubeService,
    private bilibiliService: BilibiliService,
    private xfyunService: XfyunService,
    private moonshotService: MoonshotService,
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

      // 保存 segments
      await job.updateProgress({
        progress: 65,
        message: '正在保存片段数据...',
      });
      let savedSegments: SegmentDocument[] = [];
      if (transcript.length > 0) {
        const segmentsData = transcript.map((item, index) => ({
          documentId,
          segmentIndex: index,
          text: item.text,
          startTime: item.start,
          endTime: item.end,
        }));

        savedSegments = await this.segmentModel.insertMany(segmentsData);
        this.logger.log(`保存了 ${savedSegments.length} 个片段到数据库`);
      }

      await job.updateProgress({ progress: 70, message: '片段数据保存完成' });

      // 计算总字数
      const wordCount = transcript.reduce((sum, t) => sum + t.text.length, 0);

      // 知识点提炼（如果Moonshot服务可用且有片段数据）
      if (this.moonshotService.isAvailable() && savedSegments.length > 0) {
        try {
          await job.updateProgress({
            progress: 72,
            message: '正在构建内容文本...',
          });

          // 构建完整内容文本
          const contentText = savedSegments.map((seg) => seg.text).join('\n');

          // 构建分段信息（用于定位）
          const segmentsForLLM = savedSegments.map((seg) => ({
            text: seg.text,
            start: seg.startTime,
            end: seg.endTime,
            segmentId: seg._id.toString(),
          }));

          await job.updateProgress({
            progress: 75,
            message: '正在调用AI提炼知识点...',
          });

          // 调用Moonshot API提炼知识点
          this.logger.log('开始调用Moonshot API提炼知识点');
          const knowledgePoints =
            await this.moonshotService.extractKnowledgePoints(
              contentText,
              segmentsForLLM,
              {
                maxPoints: 8,
              },
            );

          this.logger.log(`AI提炼完成，共 ${knowledgePoints.length} 个知识点`);

          await job.updateProgress({
            progress: 90,
            message: '正在保存知识点...',
          });

          // 获取文档信息（用于构建sourceAnchor）
          const document = await this.documentModel.findById(documentId);
          if (!document) {
            throw new Error(`文档不存在: ${documentId}`);
          }

          // 保存知识点到数据库
          const knowledgePointDocs = knowledgePoints.map((kp) => {
            // 查找对应的segment
            // 优先通过 segmentId 匹配
            let segment = savedSegments.find(
              (seg) => seg._id.toString() === kp.segmentId,
            );

            // 如果通过 segmentId 找不到，尝试通过时间段匹配（作为备选方案）
            if (
              !segment &&
              kp.startTime !== undefined &&
              kp.endTime !== undefined
            ) {
              segment = savedSegments.find(
                (seg) =>
                  seg.startTime !== undefined &&
                  seg.endTime !== undefined &&
                  Math.abs(seg.startTime - kp.startTime!) < 1 && // 允许1秒误差
                  Math.abs(seg.endTime - kp.endTime!) < 1,
              );
            }

            // 构建sourceAnchor
            const sourceAnchor: {
              type: string;
              startTime?: number;
              endTime?: number;
              page?: number;
              startOffset?: number;
              endOffset?: number;
              segmentId?: any;
            } = {
              type: document.sourceType,
            };

            if (document.sourceType === 'video') {
              // 优先使用大模型返回的时间，如果没有则使用 segment 的时间
              sourceAnchor.startTime = kp.startTime ?? segment?.startTime;
              sourceAnchor.endTime = kp.endTime ?? segment?.endTime;
            } else if (document.sourceType === 'pdf') {
              sourceAnchor.page = segment?.pageNumber;
              sourceAnchor.startOffset = segment?.startOffset;
              sourceAnchor.endOffset = segment?.endOffset;
            } else if (document.sourceType === 'text') {
              sourceAnchor.startOffset = segment?.charStart;
              sourceAnchor.endOffset = segment?.charEnd;
            }

            if (segment) {
              sourceAnchor.segmentId = segment._id;
            }

            return {
              documentId,
              topic: kp.topic,
              excerpt: kp.excerpt,
              confidenceScore: kp.confidenceScore,
              displayOrder: kp.displayOrder,
              sourceAnchor,
            };
          });

          await this.knowledgePointModel.insertMany(knowledgePointDocs);
          this.logger.log(
            `保存了 ${knowledgePointDocs.length} 个知识点到数据库`,
          );

          await job.updateProgress({
            progress: 95,
            message: '知识点保存完成',
          });
        } catch (error) {
          // 知识点提炼失败不影响视频处理结果，只记录警告
          this.logger.warn(
            `知识点提炼失败: ${error instanceof Error ? error.message : String(error)}，继续完成视频处理`,
          );
        }
      } else {
        if (!this.moonshotService.isAvailable()) {
          this.logger.log('Moonshot 服务未配置，跳过知识点提炼');
        }
      }

      // 更新文档状态
      await job.updateProgress({
        progress: 98,
        message: '正在更新文档状态...',
      });
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
