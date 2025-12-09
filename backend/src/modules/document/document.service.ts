import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Document, DocumentDocument } from './schemas/document.schema';
import { Segment, SegmentDocument } from './schemas/segment.schema';
import { QueryDocumentDto } from './dto/query-document.dto';
import {
  KnowledgePoint,
  KnowledgePointDocument,
} from '../knowledge/schemas/knowledge-point.schema';
import { Insight, InsightDocument } from '../insight/schemas/insight.schema';
import { OssService } from '../aliyun/oss.service';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    @InjectModel(Segment.name)
    private segmentModel: Model<SegmentDocument>,
    @InjectModel(KnowledgePoint.name)
    private knowledgePointModel: Model<KnowledgePointDocument>,
    @InjectModel(Insight.name)
    private insightModel: Model<InsightDocument>,
    private ossService: OssService,
  ) {}

  /**
   * 根据ID获取文档详情
   */
  async findById(documentId: string, userId: string) {
    const doc = await this.documentModel.findOne({
      _id: documentId,
      userId,
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const docObj = doc as any;
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      sourceType: doc.sourceType,
      title: doc.title,
      originalUrl: doc.originalUrl,
      status: doc.status,
      errorMessage: doc.errorMessage,
      video: doc.video,
      pdf: doc.pdf,
      language: doc.language,
      wordCount: doc.wordCount,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      createdAt: docObj.createdAt,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      updatedAt: docObj.updatedAt,
    };
  }

  /**
   * 查询文档列表
   */
  async findList(userId: string, queryDto: QueryDocumentDto) {
    const { page = 1, pageSize = 20, keyword, sourceType, status } = queryDto;

    // 构建查询条件
    const filter: Record<string, unknown> = { userId };

    if (sourceType) {
      filter.sourceType = sourceType;
    }

    if (status) {
      filter.status = status;
    }

    if (keyword) {
      filter.title = { $regex: keyword, $options: 'i' };
    }

    // 计算跳过的文档数
    const skip = (page - 1) * pageSize;

    // 查询文档列表
    const [documents, total] = await Promise.all([
      this.documentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      this.documentModel.countDocuments(filter).exec(),
    ]);

    // 格式化返回数据
    const items = documents.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const docObj = doc as any;
      return {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        sourceType: doc.sourceType,
        title: doc.title,
        originalUrl: doc.originalUrl,
        status: doc.status,
        errorMessage: doc.errorMessage,
        video: doc.video,
        pdf: doc.pdf,
        language: doc.language,
        wordCount: doc.wordCount,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        createdAt: docObj.createdAt,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        updatedAt: docObj.updatedAt,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取文档状态（用于轮询）
   */
  async getStatus(
    documentId: string,
    userId: string,
  ): Promise<{
    id: string;
    status: string;
    errorMessage?: string;
    progress?: number;
  }> {
    const doc = await this.documentModel.findOne({
      _id: documentId,
      userId,
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    return {
      id: doc._id.toString(),
      status: doc.status,
      errorMessage: doc.errorMessage,
      // progress 将在 controller 中通过队列获取
    };
  }

  /**
   * 获取文档的片段列表
   */
  async findSegments(documentId: string, userId: string) {
    // 验证文档是否存在且属于当前用户
    const doc = await this.documentModel.findOne({
      _id: documentId,
      userId,
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 查询片段列表，按 segmentIndex 排序
    const segments = await this.segmentModel
      .find({ documentId })
      .sort({ segmentIndex: 1 })
      .lean()
      .exec();

    return segments.map((segment) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const segObj = segment as any;
      return {
        id: segment._id.toString(),
        documentId: segment.documentId.toString(),
        segmentIndex: segment.segmentIndex,
        text: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        pageNumber: segment.pageNumber,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
        charStart: segment.charStart,
        charEnd: segment.charEnd,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        createdAt: segObj.createdAt,
      };
    });
  }

  /**
   * 删除文档（级联删除相关数据）
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    // 验证文档是否存在且属于当前用户
    const doc = await this.documentModel.findOne({
      _id: documentId,
      userId,
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    try {
      // 1. 如果是PDF，删除OSS文件
      if (doc.sourceType === 'pdf' && doc.originalUrl) {
        try {
          // 从URL中提取文件名
          const filename = this.extractFilenameFromUrl(doc.originalUrl);
          if (filename) {
            await this.ossService.deleteFile(filename);
            this.logger.log(`已删除PDF文件: ${filename}`);
          }
        } catch (error) {
          // 删除文件失败不影响删除文档，只记录日志
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`删除PDF文件失败: ${errorMessage}`);
        }
      }

      // 2. 查询所有相关的知识点
      const knowledgePoints = await this.knowledgePointModel
        .find({ documentId })
        .exec();

      // 3. 删除所有相关的洞察（通过知识点ID）
      if (knowledgePoints.length > 0) {
        const knowledgePointIds = knowledgePoints.map((kp) => kp._id.toString());
        await this.insightModel
          .deleteMany({
            knowledgePointId: { $in: knowledgePointIds },
          })
          .exec();
        this.logger.log(
          `已删除 ${knowledgePointIds.length} 个洞察`,
        );
      }

      // 4. 删除所有知识点
      await this.knowledgePointModel.deleteMany({ documentId }).exec();
      this.logger.log(`已删除 ${knowledgePoints.length} 个知识点`);

      // 5. 删除所有片段
      const segmentResult = await this.segmentModel
        .deleteMany({ documentId })
        .exec();
      this.logger.log(`已删除 ${segmentResult.deletedCount} 个片段`);

      // 6. 删除文档本身
      await this.documentModel.deleteOne({ _id: documentId }).exec();
      this.logger.log(`已删除文档: ${documentId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`删除文档失败: ${errorMessage}`);
      throw new Error(`删除文档失败: ${errorMessage}`);
    }
  }

  /**
   * 从URL中提取文件名
   * 支持OSS URL和本地文件URL两种格式
   */
  private extractFilenameFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    try {
      // 如果是OSS URL，格式为: https://bucket.oss-region.aliyuncs.com/path/to/file.pdf
      // 或者: https://bucket.oss-region.aliyuncs.com/path/to/file.pdf?signature=...
      const urlObj = new URL(url);
      let pathname = urlObj.pathname;

      // 移除开头的斜杠
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
      }

      // 如果是本地文件URL，格式为: http://localhost:3000/uploadFile/path/to/file.pdf
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        // 提取 uploadFile 之后的部分
        const uploadFileIndex = pathname.indexOf('uploadFile/');
        if (uploadFileIndex !== -1) {
          return pathname.substring(uploadFileIndex + 'uploadFile/'.length);
        }
        return pathname;
      }

      // OSS URL，直接返回路径
      return pathname || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`解析URL失败: ${url}, 错误: ${errorMessage}`);
      return null;
    }
  }
}
