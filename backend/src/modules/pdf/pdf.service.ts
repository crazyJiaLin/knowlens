import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  DocumentDocument,
} from '../document/schemas/document.schema';
import { UploadPdfDto } from './dto/upload-pdf.dto';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    @InjectQueue('pdf-queue')
    private pdfQueue: Queue,
    private configService: ConfigService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploadFile');
    this.ensureUploadDirExists();
    this.baseUrl = this.getBaseUrl();
  }

  /**
   * 上传 PDF 并创建文档记录
   */
  async uploadPdf(
    userId: string,
    file: Express.Multer.File,
    dto: UploadPdfDto,
  ): Promise<{ documentId: string; status: string; message: string }> {
    const originalname = file.originalname || 'document.pdf';
    const mimetype = file.mimetype;

    if (mimetype !== 'application/pdf') {
      throw new BadRequestException('只支持上传 PDF 文件');
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('文件大小不能超过 50MB');
    }

    // 生成安全的文件名（用于文件系统存储）
    const timestamp = Date.now();
    const ext = path.extname(originalname);
    const safeFilename = `${timestamp}${ext}`;
    const filename = `pdfs/${userId}/${safeFilename}`;
    const filePath = path.join(this.uploadDir, filename);

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, file.buffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`PDF 保存失败: ${errorMessage}`);
    }

    // 生成访问URL
    // 生产环境使用相对路径（通过 Nginx 代理，支持多域名访问）
    // 本地开发使用完整 URL（直连后端）
    let originalUrl: string;
    if (this.baseUrl) {
      // 完整 URL（本地开发）
      // baseUrl 已包含末尾斜杠，直接拼接避免双斜杠
      originalUrl = `${this.baseUrl}uploadFile/${filename}`;
    } else {
      // 相对路径（生产环境）
      originalUrl = `/uploadFile/${filename}`;
    }

    // 标题使用原始文件名（保留中文）
    const titleFromName = originalname
      .replace(/\.pdf$/i, '')
      .replace(/\.PDF$/i, '');
    const title = dto.title?.trim() || titleFromName || 'PDF 文档';

    this.logger.log(`PDF 文件名: ${originalname}, 提取的标题: ${title}`);

    const document = await this.documentModel.create({
      userId,
      sourceType: 'pdf',
      title,
      status: 'processing',
      originalUrl,
      pdf: {
        fileSize: file.size,
      },
      language: 'zh',
    });

    const documentId = document._id.toString();

    await this.pdfQueue.add(
      'process-pdf',
      {
        documentId,
        userId,
        filePath,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(`PDF 上传成功: documentId=${documentId}, path=${filePath}`);

    return {
      documentId,
      status: 'processing',
      message: 'PDF 上传成功，正在解析文本...',
    };
  }

  private ensureUploadDirExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`创建本地上传目录: ${this.uploadDir}`);
    }
  }

  private getBaseUrl(): string {
    const baseUrlFromEnv = this.configService.get<string>('baseUrl');
    if (baseUrlFromEnv) {
      return baseUrlFromEnv;
    }

    // 默认值：生产环境使用 / （相对路径），本地开发使用完整 URL 带末尾斜杠
    if (process.env.NODE_ENV === 'production') {
      return '/'; // 相对路径根目录
    } else {
      const port = this.configService.get<number>('port') || 3000;
      const host = process.env.HOST || 'localhost';
      return `http://${host}:${port}/`; // 末尾带斜杠
    }
  }
}
