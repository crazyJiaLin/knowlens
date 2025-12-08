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

    // 获取上下文段落
    const { contextBefore, contextAfter } =
      await this.getContextSegments(knowledgePoint);

    // 调用 Moonshot 生成洞察
    this.logger.log(
      `开始生成洞察，knowledgePointId: ${knowledgePointId}, forceRegenerate: ${forceRegenerate}`,
    );
    const startTime = Date.now();
    const insightResult = await this.moonshotService.generateInsight(
      knowledgePoint.topic,
      knowledgePoint.excerpt,
      contextBefore,
      contextAfter,
    );
    const generationTimeMs = Date.now() - startTime;

    // 保存或更新洞察
    const insightData = {
      knowledgePointId,
      logic: insightResult.logic,
      hiddenInfo: insightResult.hiddenInfo,
      extensionOptional: insightResult.extensionOptional,
      generationTimeMs,
    };

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
   * 获取知识点的上下文段落
   * @param knowledgePoint 知识点
   * @returns 前后文上下文
   */
  private async getContextSegments(
    knowledgePoint: KnowledgePointDocument,
  ): Promise<{ contextBefore: string; contextAfter: string }> {
    // 获取文档的所有片段
    const segments = await this.segmentModel
      .find({ documentId: knowledgePoint.documentId })
      .sort({ segmentIndex: 1 })
      .exec();

    if (segments.length === 0) {
      return { contextBefore: '', contextAfter: '' };
    }

    // 查找知识点对应的 segment
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

    // 获取前1-2个 segment 作为前文
    const contextBeforeSegments: SegmentDocument[] = [];
    for (
      let i = Math.max(0, targetSegmentIndex - 2);
      i < targetSegmentIndex;
      i++
    ) {
      if (segments[i]) {
        contextBeforeSegments.push(segments[i]);
      }
    }

    // 获取后1-2个 segment 作为后文
    const contextAfterSegments: SegmentDocument[] = [];
    for (
      let i = targetSegmentIndex + 1;
      i <= Math.min(segments.length - 1, targetSegmentIndex + 2);
      i++
    ) {
      if (segments[i]) {
        contextAfterSegments.push(segments[i]);
      }
    }

    const contextBefore = contextBeforeSegments
      .map((seg) => seg.text)
      .join(' ');
    const contextAfter = contextAfterSegments.map((seg) => seg.text).join(' ');

    return { contextBefore, contextAfter };
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
