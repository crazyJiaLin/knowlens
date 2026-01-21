import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import OSS from 'ali-oss';

const pipelineAsync = promisify(pipeline);

@Injectable()
export class OssService {
  private readonly logger = new Logger(OssService.name);
  private client: any = null;
  private readonly localUploadDir: string;
  private readonly useLocalStorage: boolean;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // 初始化本地存储目录（无论是否使用OSS都初始化，作为降级方案）
    this.localUploadDir = path.join(process.cwd(), 'uploadFile');

    // 获取基础URL（用于本地文件访问）
    const baseUrlFromEnv = this.configService.get<string>('baseUrl');
    if (baseUrlFromEnv) {
      this.baseUrl = baseUrlFromEnv;
    } else {
      // 默认使用相对路径（生产环境）或 localhost（开发环境）
      if (process.env.NODE_ENV === 'production') {
        this.baseUrl = '/'; // 相对路径根目录
      } else {
        const port = this.configService.get<number>('port') || 3000;
        const host = process.env.HOST || 'localhost';
        this.baseUrl = `http://${host}:${port}/`; // 末尾带斜杠
      }
    }

    const accessKeyId = this.configService.get<string>(
      'aliyun.oss.accessKeyId',
    );
    const accessKeySecret = this.configService.get<string>(
      'aliyun.oss.accessKeySecret',
    );
    const region = this.configService.get<string>('aliyun.oss.region');
    const bucket = this.configService.get<string>('aliyun.oss.bucket');

    // 判断是否使用本地存储
    this.useLocalStorage = !(
      accessKeyId &&
      accessKeySecret &&
      region &&
      bucket
    );

    if (!this.useLocalStorage) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      this.client = new (OSS as any)({
        accessKeyId,
        accessKeySecret,
        region,
        bucket,
      });
      this.logger.log('阿里云OSS客户端初始化成功');
    } else {
      this.logger.warn(
        '阿里云OSS配置不完整，将使用本地文件存储（uploadFile目录）',
      );
    }

    // 确保本地存储目录存在（无论是否使用OSS都创建，作为降级方案）
    this.ensureUploadDirExists();
  }

  /**
   * 确保上传目录存在
   */
  private ensureUploadDirExists(): void {
    if (!fs.existsSync(this.localUploadDir)) {
      fs.mkdirSync(this.localUploadDir, { recursive: true });
      this.logger.log(`创建本地上传目录: ${this.localUploadDir}`);
    }
  }

  /**
   * 上传文件到OSS或本地存储
   * @param file 文件Buffer或Stream
   * @param filename 文件名（包含路径）
   * @returns 文件URL
   */
  async uploadFile(
    file: Buffer | NodeJS.ReadableStream,
    filename: string,
  ): Promise<string> {
    // 如果配置为使用本地存储，直接使用本地存储
    if (this.useLocalStorage) {
      return this.uploadToLocal(file, filename);
    }

    // 如果 OSS 客户端不存在，使用本地存储
    if (!this.client) {
      this.logger.warn('OSS客户端不存在，降级到本地存储');
      return this.uploadToLocal(file, filename);
    }

    // 尝试上传到 OSS，如果失败则降级到本地存储
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await this.client.put(filename, file);
      const url = (result as { url: string }).url;
      this.logger.log(`文件上传到OSS成功: ${url}`);
      return url;
    } catch (error) {
      // OSS 上传失败，降级到本地存储
      this.logger.warn(`OSS上传失败（${error}），降级到本地存储`);
      return this.uploadToLocal(file, filename);
    }
  }

  /**
   * 上传文件到本地存储
   * @param file 文件Buffer或Stream
   * @param filename 文件名（包含路径）
   * @returns 文件URL（相对路径，用于静态文件服务）
   */
  private async uploadToLocal(
    file: Buffer | NodeJS.ReadableStream,
    filename: string,
  ): Promise<string> {
    try {
      const filePath = path.join(this.localUploadDir, filename);
      const dir = path.dirname(filePath);

      // 确保目录存在
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 处理 Buffer 或 Stream
      if (Buffer.isBuffer(file)) {
        fs.writeFileSync(filePath, file);
      } else {
        // Stream 处理
        const writeStream = fs.createWriteStream(filePath);
        await pipelineAsync(file, writeStream);
      }

      // 生成访问URL
      // 生产环境使用相对路径（通过 Nginx 代理，支持多域名访问）
      // 本地开发使用完整 URL（直连后端）
      let url: string;
      if (this.baseUrl && this.baseUrl.startsWith('http')) {
        // 完整 URL（本地开发）
        url = `${this.baseUrl}uploadFile/${filename}`;
      } else {
        // 相对路径（生产环境）
        url = `/uploadFile/${filename}`;
      }
      this.logger.log(`文件保存到本地成功: ${filePath}，访问URL: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`本地文件保存失败: ${error}`);
      throw new Error(`本地文件保存失败: ${error}`);
    }
  }

  /**
   * 删除OSS文件或本地文件
   * @param filename 文件名（包含路径）
   */
  async deleteFile(filename: string): Promise<void> {
    if (this.useLocalStorage) {
      return this.deleteLocalFile(filename);
    }

    if (!this.client) {
      throw new Error('阿里云OSS未配置，无法删除文件');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.client.delete(filename);
      this.logger.log(`文件删除成功: ${filename}`);
    } catch (error) {
      this.logger.error(`文件删除失败: ${error}`);
      throw new Error(`文件删除失败: ${error}`);
    }
  }

  /**
   * 删除本地文件
   * @param filename 文件名（包含路径）或完整URL
   */
  private deleteLocalFile(filename: string): Promise<void> {
    try {
      let relativePath: string;

      // 处理完整URL格式: http://localhost:3000/uploadFile/...
      if (filename.startsWith('http://') || filename.startsWith('https://')) {
        const urlObj = new URL(filename);
        relativePath = urlObj.pathname.replace('/uploadFile/', '');
      }
      // 处理相对路径格式: /uploadFile/...
      else if (filename.startsWith('/uploadFile/')) {
        relativePath = filename.replace('/uploadFile/', '');
      }
      // 直接是文件名
      else {
        relativePath = filename;
      }

      const filePath = path.join(this.localUploadDir, relativePath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`本地文件删除成功: ${filePath}`);
      } else {
        this.logger.warn(`文件不存在: ${filePath}`);
      }
      return Promise.resolve();
    } catch (error) {
      this.logger.error(`本地文件删除失败: ${error}`);
      return Promise.reject(new Error(`本地文件删除失败: ${error}`));
    }
  }

  /**
   * 生成文件访问URL（带签名，用于私有文件）
   * @param filename 文件名（包含路径）
   * @param expires 过期时间（秒），默认1小时（本地存储时忽略此参数）
   * @returns 签名URL或本地文件URL
   */
  getSignedUrl(filename: string, expires: number = 3600): Promise<string> {
    if (this.useLocalStorage) {
      // 生成访问URL
      // 生产环境使用相对路径，本地开发使用完整 URL
      // baseUrl 已包含末尾斜杠，直接拼接避免双斜杠
      const url =
        this.baseUrl && this.baseUrl.startsWith('http')
          ? `${this.baseUrl}uploadFile/${filename}`
          : `/uploadFile/${filename}`;
      return Promise.resolve(url);
    }

    if (!this.client) {
      throw new Error('阿里云OSS未配置，无法生成签名URL');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const url = this.client.signatureUrl(filename, {
        expires,
      }) as string;
      return Promise.resolve(url);
    } catch (error) {
      this.logger.error(`生成签名URL失败: ${error}`);
      return Promise.reject(new Error(`生成签名URL失败: ${error}`));
    }
  }
}
