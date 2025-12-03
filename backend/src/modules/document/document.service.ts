import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Document, DocumentDocument } from './schemas/document.schema';
import { Segment, SegmentDocument } from './schemas/segment.schema';
import { QueryDocumentDto } from './dto/query-document.dto';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    @InjectModel(Segment.name)
    private segmentModel: Model<SegmentDocument>,
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
}
