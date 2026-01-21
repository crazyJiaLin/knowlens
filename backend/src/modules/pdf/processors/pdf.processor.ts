import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import * as fs from 'fs/promises';
import {
  Document,
  DocumentDocument,
} from '../../document/schemas/document.schema';
import {
  Segment,
  SegmentDocument,
} from '../../document/schemas/segment.schema';

// 使用 require 方式导入 pdf-parse，避免 ESM/CJS 兼容问题
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const pdfParseModule = require('pdf-parse');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
const PDFParse = pdfParseModule.PDFParse;

interface PdfJobData {
  documentId: string;
  userId: string;
  filePath: string;
}

interface PdfParseResult {
  text: string;
  numpages?: number;
  info?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Processor('pdf-queue')
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    @InjectModel(Segment.name)
    private segmentModel: Model<SegmentDocument>,
    @InjectQueue('knowledge-queue')
    private knowledgeQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<PdfJobData>) {
    const { documentId, userId, filePath } = job.data;

    this.logger.log(
      `开始处理PDF任务: jobId=${job.id}, documentId=${documentId}`,
    );

    try {
      await job.updateProgress({ progress: 5, message: '正在读取PDF文件...' });
      const dataBuffer = await fs.readFile(filePath);

      await job.updateProgress({ progress: 15, message: '正在提取PDF文本...' });

      // 创建 PDFParse 实例（使用 data 参数传入 buffer）
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const parser = new PDFParse({ data: dataBuffer });

      // 获取文本内容（包含页面信息）
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result: PdfParseResult = await parser.getText();

      // 按页分割文本
      const pageTexts: string[] = [];
      const lines = result.text.split('\n');
      let currentPage = 1;
      let currentPageText = '';

      for (const line of lines) {
        // pdf-parse 会在页面边界处包含特殊标记或换页符
        // 这里简化处理：按固定行数分页（实际应根据 PDF 的页面信息）
        if (line.includes('\f') || line.includes('\x0C')) {
          // 换页符
          if (currentPageText.trim()) {
            pageTexts[currentPage - 1] = currentPageText.trim();
          }
          currentPage++;
          currentPageText = '';
        } else {
          currentPageText += line + '\n';
        }
      }

      // 保存最后一页
      if (currentPageText.trim()) {
        pageTexts[currentPage - 1] = currentPageText.trim();
      }

      // 如果没有换页符，将整个文本作为单页
      if (pageTexts.length === 0 && result.text.trim()) {
        pageTexts[0] = result.text.trim();
      }

      const pageCount = pageTexts.length;

      // 打印提取结果，用于调试
      this.logger.log(`PDF 文本提取完成: 共 ${pageCount} 页`);
      this.logger.log(
        `第1页文本预览（前200字）: ${pageTexts[0]?.substring(0, 200) || '无内容'}`,
      );
      if (pageCount > 1) {
        this.logger.log(
          `最后一页文本预览（前200字）: ${pageTexts[pageCount - 1]?.substring(0, 200) || '无内容'}`,
        );
      }

      const segments = this.buildSegmentsFromPages(pageTexts, documentId);
      const wordCount = segments.reduce((sum, seg) => sum + seg.text.length, 0);

      // 检查文本内容是否有效
      const minWordCount = 100; // 至少需要100个字符
      if (wordCount < minWordCount) {
        this.logger.error(
          `PDF 文本提取失败: 字数太少（${wordCount}字），可能是扫描版PDF或无文字内容`,
        );
        await this.documentModel.updateOne(
          { _id: documentId },
          {
            status: 'failed',
            errorMessage:
              'PDF 解析失败：无法提取有效文字内容。可能是扫描版PDF或图片PDF，请尝试其他包含文字图层的PDF文件',
            'pdf.pageCount': pageCount,
          },
        );
        return {
          success: false,
          documentId,
          message: 'PDF 无有效文字内容',
        };
      }

      // 检查文本是否只包含页码标记等无意义内容
      const meaningfulText = segments
        .map((seg) => seg.text)
        .join('')
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '') // 移除 "-- 1 of 15 --" 这样的页码标记
        .replace(/\s+/g, '') // 移除所有空白
        .trim();

      if (meaningfulText.length < 50) {
        this.logger.error(
          `PDF 文本提取失败: 只包含页码标记等无意义内容（有效字符${meaningfulText.length}个）`,
        );
        await this.documentModel.updateOne(
          { _id: documentId },
          {
            status: 'failed',
            errorMessage:
              'PDF 解析失败：仅包含页码等标记，无实际文字内容。可能是扫描版PDF，请尝试其他包含文字图层的PDF文件',
            'pdf.pageCount': pageCount,
          },
        );
        return {
          success: false,
          documentId,
          message: 'PDF 无实际文字内容',
        };
      }

      this.logger.log(
        `PDF 文本有效性检查通过: 总字数 ${wordCount}，有效字符 ${meaningfulText.length}`,
      );

      await job.updateProgress({
        progress: 50,
        message: '正在保存片段数据...',
      });

      if (segments.length > 0) {
        await this.segmentModel.insertMany(segments);
      }

      await this.documentModel.updateOne(
        { _id: documentId },
        {
          wordCount,
          'pdf.pageCount': pageCount,
        },
      );

      await job.updateProgress({
        progress: 70,
        message: 'PDF文本提取完成，准备生成知识点...',
      });

      await this.knowledgeQueue.add(
        'generate-knowledge-points',
        {
          documentId,
          userId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      await job.updateProgress({
        progress: 80,
        message: '已进入知识点提炼队列',
      });

      this.logger.log(
        `PDF任务完成: jobId=${job.id}, documentId=${documentId}, segments=${segments.length}`,
      );

      return { success: true, documentId };
    } catch (error) {
      this.logger.error(
        `PDF任务失败: jobId=${job.id}, documentId=${documentId}`,
        error,
      );

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
          `更新文档状态失败: ${
            updateError instanceof Error
              ? updateError.message
              : String(updateError)
          }`,
        );
      }

      throw error;
    }
  }

  private buildSegmentsFromPages(
    pageTexts: string[],
    documentId: string,
  ): Array<{
    documentId: string;
    segmentIndex: number;
    text: string;
    pageNumber: number;
    startOffset: number;
    endOffset: number;
  }> {
    const segments: Array<{
      documentId: string;
      segmentIndex: number;
      text: string;
      pageNumber: number;
      startOffset: number;
      endOffset: number;
    }> = [];

    const maxSegmentLength = 2000;
    let segmentIndex = 0;

    pageTexts.forEach((pageText, pageIndex) => {
      const normalizedText = pageText || '';
      if (!normalizedText.trim()) {
        return;
      }

      let offset = 0;
      while (offset < normalizedText.length) {
        const endOffset = Math.min(
          offset + maxSegmentLength,
          normalizedText.length,
        );
        const text = normalizedText.slice(offset, endOffset);

        segments.push({
          documentId,
          segmentIndex: segmentIndex++,
          text,
          pageNumber: pageIndex + 1,
          startOffset: offset,
          endOffset,
        });

        offset = endOffset;
      }
    });

    return segments;
  }
}
