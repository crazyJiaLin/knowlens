import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Insight, InsightDocument } from './schemas/insight.schema';
import {
  KnowledgePoint,
  KnowledgePointDocument,
} from '../knowledge/schemas/knowledge-point.schema';
import { Segment, SegmentDocument } from '../document/schemas/segment.schema';
import { MoonshotService } from '../../common/services/moonshot.service';

@Injectable()
export class InsightService {
  private readonly logger = new Logger(InsightService.name);

  constructor(
    @InjectModel(Insight.name)
    private insightModel: Model<InsightDocument>,
    @InjectModel(KnowledgePoint.name)
    private knowledgePointModel: Model<KnowledgePointDocument>,
    @InjectModel(Segment.name)
    private segmentModel: Model<SegmentDocument>,
    private moonshotService: MoonshotService,
  ) {}

  /**
   * 生成或获取知识点的洞察
   * @param knowledgePointId 知识点ID
   * @param forceRegenerate 是否强制重新生成
   * @returns 洞察结果
   */
  async generateOrGetInsight(
    knowledgePointId: string,
    forceRegenerate = false,
  ): Promise<InsightDocument> {
    // 检查知识点是否存在
    const knowledgePoint =
      await this.knowledgePointModel.findById(knowledgePointId);
    if (!knowledgePoint) {
      throw new NotFoundException('知识点不存在');
    }

    // 如果不需要强制重新生成，先查询是否已有洞察
    if (!forceRegenerate) {
      const existingInsight = await this.insightModel.findOne({
        knowledgePointId,
      });
      if (existingInsight) {
        this.logger.log(`返回已有洞察，knowledgePointId: ${knowledgePointId}`);
        return existingInsight;
      }
    }

    // 检查 Moonshot 服务是否可用
    if (!this.moonshotService.isAvailable()) {
      throw new ServiceUnavailableException(
        'Moonshot 服务未配置，无法生成洞察',
      );
    }

    // 获取所有片段数据
    const { allSegmentsText } = await this.getAllSegments(knowledgePoint);

    // 调用 Moonshot 生成洞察
    this.logger.log(
      `开始生成洞察，knowledgePointId: ${knowledgePointId}, forceRegenerate: ${forceRegenerate}`,
    );
    const startTime = Date.now();
    const insightResult = await this.moonshotService.generateInsight(
      knowledgePoint.topic,
      knowledgePoint.excerpt,
      allSegmentsText,
    );
    const generationTimeMs = Date.now() - startTime;

    // 保存或更新洞察
    const insightData: {
      knowledgePointId: string;
      logic: string;
      hiddenInfo: string;
      extensionOptional: string;
      generationTimeMs: number;
      tokensUsed?: number;
    } = {
      knowledgePointId,
      logic: insightResult.logic,
      hiddenInfo: insightResult.hiddenInfo,
      extensionOptional: insightResult.extensionOptional,
      generationTimeMs,
    };
    if (typeof insightResult.tokensUsed === 'number') {
      insightData.tokensUsed = insightResult.tokensUsed;
    }

    let insight: InsightDocument;
    if (forceRegenerate) {
      // 强制重新生成，使用 upsert 覆盖旧数据
      insight = await this.insightModel.findOneAndUpdate(
        { knowledgePointId },
        insightData,
        { upsert: true, new: true },
      );
      this.logger.log(
        `洞察已重新生成并保存，knowledgePointId: ${knowledgePointId}`,
      );
    } else {
      // 创建新洞察
      insight = await this.insightModel.create(insightData);
      this.logger.log(
        `洞察已生成并保存，knowledgePointId: ${knowledgePointId}`,
      );
    }

    return insight;
  }

  /**
   * 获取知识点的所有片段数据
   * @param knowledgePoint 知识点
   * @returns 所有片段文本和知识点对应的segment索引
   */
  private async getAllSegments(
    knowledgePoint: KnowledgePointDocument,
  ): Promise<{ allSegmentsText: string; targetSegmentIndex: number }> {
    // 获取文档的所有片段
    const segments = await this.segmentModel
      .find({ documentId: knowledgePoint.documentId })
      .sort({ segmentIndex: 1 })
      .exec();

    if (segments.length === 0) {
      return { allSegmentsText: '', targetSegmentIndex: -1 };
    }

    // 构建所有片段的文本，格式：segmentId: [时间段] 文本内容
    const allSegmentsText = segments
      .map((seg, index) => {
        const segmentId = seg._id.toString();
        const timeInfo =
          seg.startTime !== undefined && seg.endTime !== undefined
            ? `[${seg.startTime.toFixed(2)}s-${seg.endTime.toFixed(2)}s]`
            : `[片段${index + 1}]`;
        return `segmentId: ${segmentId} ${timeInfo} ${seg.text}`;
      })
      .join('\n');

    // 查找知识点对应的 segment 索引
    let targetSegmentIndex = -1;
    if (knowledgePoint.sourceAnchor.segmentId) {
      const targetSegment = segments.find(
        (seg) =>
          seg._id.toString() ===
          knowledgePoint.sourceAnchor.segmentId?.toString(),
      );
      if (targetSegment) {
        targetSegmentIndex = targetSegment.segmentIndex;
      }
    }

    // 如果找不到对应的 segment，尝试通过时间匹配（视频类型）
    if (targetSegmentIndex === -1 && knowledgePoint.sourceAnchor.startTime) {
      const targetSegment = segments.find(
        (seg) =>
          seg.startTime !== undefined &&
          seg.endTime !== undefined &&
          knowledgePoint.sourceAnchor.startTime! >= seg.startTime &&
          knowledgePoint.sourceAnchor.startTime! <= seg.endTime,
      );
      if (targetSegment) {
        targetSegmentIndex = targetSegment.segmentIndex;
      }
    }

    // 如果还是找不到，使用第一个 segment
    if (targetSegmentIndex === -1) {
      targetSegmentIndex = 0;
    }

    return { allSegmentsText, targetSegmentIndex };
  }

  /**
   * 生成或获取知识点的洞察（流式输出）
   * @param knowledgePointId 知识点ID
   * @param forceRegenerate 是否强制重新生成
   * @param onChunk 接收流式数据的回调函数
   */
  async generateOrGetInsightStream(
    knowledgePointId: string,
    forceRegenerate: boolean,
    onChunk: (chunk: {
      logic?: string;
      hiddenInfo?: string;
      extensionOptional?: string;
      tokensUsed?: number;
      generationTimeMs?: number;
    }) => void,
  ): Promise<void> {
    // 检查知识点是否存在
    const knowledgePoint =
      await this.knowledgePointModel.findById(knowledgePointId);
    if (!knowledgePoint) {
      throw new NotFoundException('知识点不存在');
    }

    // 如果不需要强制重新生成，先查询是否已有洞察
    if (!forceRegenerate) {
      const existingInsight = await this.insightModel.findOne({
        knowledgePointId,
      });
      if (existingInsight) {
        this.logger.log(`返回已有洞察，knowledgePointId: ${knowledgePointId}`);
        // 流式返回已有洞察
        onChunk({ logic: existingInsight.logic });
        onChunk({ hiddenInfo: existingInsight.hiddenInfo });
        onChunk({ extensionOptional: existingInsight.extensionOptional });
        if (existingInsight.tokensUsed) {
          onChunk({ tokensUsed: existingInsight.tokensUsed });
        }
        if (existingInsight.generationTimeMs) {
          onChunk({ generationTimeMs: existingInsight.generationTimeMs });
        }
        return;
      }
    }

    // 检查 Moonshot 服务是否可用
    if (!this.moonshotService.isAvailable()) {
      throw new ServiceUnavailableException(
        'Moonshot 服务未配置，无法生成洞察',
      );
    }

    // 获取所有片段数据
    const { allSegmentsText } = await this.getAllSegments(knowledgePoint);

    // 调用 Moonshot 流式生成洞察
    this.logger.log(
      `开始流式生成洞察，knowledgePointId: ${knowledgePointId}, forceRegenerate: ${forceRegenerate}`,
    );
    const startTime = Date.now();

    const insightResult: {
      logic: string;
      hiddenInfo: string;
      extensionOptional: string;
      tokensUsed?: number;
    } = {
      logic: '',
      hiddenInfo: '',
      extensionOptional: '',
    };

    const streamResult = await this.moonshotService.generateInsightStream(
      knowledgePoint.topic,
      knowledgePoint.excerpt,
      allSegmentsText,
      (chunk: {
        logic?: string;
        hiddenInfo?: string;
        extensionOptional?: string;
        tokensUsed?: number;
      }) => {
        // 更新结果
        if (chunk.logic !== undefined && typeof chunk.logic === 'string') {
          insightResult.logic = chunk.logic;
          onChunk({ logic: chunk.logic });
        }
        if (
          chunk.hiddenInfo !== undefined &&
          typeof chunk.hiddenInfo === 'string'
        ) {
          insightResult.hiddenInfo = chunk.hiddenInfo;
          onChunk({ hiddenInfo: chunk.hiddenInfo });
        }
        if (
          chunk.extensionOptional !== undefined &&
          typeof chunk.extensionOptional === 'string'
        ) {
          insightResult.extensionOptional = chunk.extensionOptional;
          onChunk({ extensionOptional: chunk.extensionOptional });
        }
        if (chunk.tokensUsed !== undefined) {
          insightResult.tokensUsed = chunk.tokensUsed;
          onChunk({ tokensUsed: chunk.tokensUsed });
        }
      },
    );

    const generationTimeMs = Date.now() - startTime;
    // 发送最终耗时
    onChunk({ generationTimeMs });

    // 保存或更新洞察
    const insightData: {
      knowledgePointId: string;
      logic: string;
      hiddenInfo: string;
      extensionOptional: string;
      generationTimeMs: number;
      tokensUsed?: number;
    } = {
      knowledgePointId,
      logic: insightResult.logic,
      hiddenInfo: insightResult.hiddenInfo,
      extensionOptional: insightResult.extensionOptional,
      generationTimeMs,
    };
    if (typeof streamResult.tokensUsed === 'number') {
      insightData.tokensUsed = streamResult.tokensUsed;
    } else if (typeof insightResult.tokensUsed === 'number') {
      const tokensUsedValue: number = insightResult.tokensUsed;
      insightData.tokensUsed = tokensUsedValue;
    }

    if (forceRegenerate) {
      await this.insightModel.findOneAndUpdate(
        { knowledgePointId },
        insightData,
        { upsert: true, new: true },
      );
      this.logger.log(
        `洞察已流式重新生成并保存，knowledgePointId: ${knowledgePointId}`,
      );
    } else {
      await this.insightModel.create(insightData);
      this.logger.log(
        `洞察已流式生成并保存，knowledgePointId: ${knowledgePointId}`,
      );
    }
  }

  /**
   * 获取知识点的洞察
   * @param knowledgePointId 知识点ID
   * @returns 洞察结果或 null
   */
  async getInsightByKnowledgePointId(
    knowledgePointId: string,
  ): Promise<InsightDocument | null> {
    return this.insightModel.findOne({ knowledgePointId }).exec();
  }
}
