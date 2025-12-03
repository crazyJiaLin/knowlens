import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { BilibiliCookieService } from './bilibili-cookie.service';
import { CookieConverter } from './utils/cookie-converter.util';

const execAsync = promisify(exec);

// 设置 ffmpeg 路径（使用打包的 ffmpeg 二进制文件）
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * 音频提取服务
 * 负责从视频链接提取音频并转换为 MP3 格式
 */
@Injectable()
export class XfyunAudioExtractorService {
  private readonly logger = new Logger(XfyunAudioExtractorService.name);
  private readonly tempDir: string;

  constructor(private bilibiliCookieService: BilibiliCookieService) {
    // 确保临时目录存在
    this.tempDir = path.join(process.cwd(), 'temp', 'audio');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      this.logger.log(`创建临时目录: ${this.tempDir}`);
    }
  }

  /**
   * 从视频链接提取音频
   * 使用 yt-dlp 直接提取音频（无需下载完整视频）
   *
   * ⚠️ B站特别说明：
   * - B站有严格的反爬虫机制，直接访问会返回 412 错误
   * - 从数据库获取启用的 cookies，按顺序尝试使用
   * - 如果 cookie 不可用，标记为过期并尝试下一个
   */
  async extractAudio(videoUrl: string): Promise<string> {
    this.logger.log(`开始提取音频: ${videoUrl}`);

    const timestamp = Date.now();
    const outputPath = path.join(this.tempDir, `${timestamp}`);
    const outputMp3Path = `${outputPath}.mp3`;

    try {
      // 检测是否为 B 站视频
      const isBilibili = videoUrl.includes('bilibili.com');

      // 构建 yt-dlp 命令
      let command = 'yt-dlp';

      if (isBilibili) {
        await this.extractBilibiliAudio(videoUrl, command, outputPath);
      } else {
        // 非 B站视频，直接提取音频（不转换）
        command += ` -f bestaudio "${videoUrl}" -o "${outputPath}.%(ext)s"`;
        this.logger.log(`执行命令: ${command}`);
        await execAsync(command, { timeout: 600000 }); // 10分钟超时
      }

      // 查找生成的文件（可能是 .m4a 或 .webm 等）
      const files = fs
        .readdirSync(this.tempDir)
        .filter((f) => f.startsWith(timestamp.toString()));

      if (files.length === 0) {
        throw new Error('音频文件未生成');
      }

      const extractedAudioPath = path.join(this.tempDir, files[0]);
      this.logger.log(`音频提取完成: ${extractedAudioPath}`);

      // 如果已经是 MP3 格式，直接返回
      if (extractedAudioPath.toLowerCase().endsWith('.mp3')) {
        this.logger.log(`音频已经是 MP3 格式，无需转换`);
        return extractedAudioPath;
      }

      // 使用 fluent-ffmpeg 转换为 MP3
      return await this.convertToMp3(extractedAudioPath, outputMp3Path);
    } catch (error) {
      this.logger.error(`音频提取失败: ${error}`);
      throw new Error(
        `音频提取失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 提取 B站视频音频
   */
  private async extractBilibiliAudio(
    videoUrl: string,
    command: string,
    outputPath: string,
  ): Promise<void> {
    const cookies = await this.bilibiliCookieService.findEnabledCookies();

    if (cookies.length === 0) {
      throw new Error('没有可用的 B站 cookies。请在管理页面添加 cookies。');
    }

    this.logger.log(
      `找到 ${cookies.length} 个启用的 B站 cookies，开始尝试...`,
    );

    let lastError: Error | null = null;
    const timestamp = Date.now();

    // 按顺序尝试每个 cookie
    for (const cookie of cookies) {
      try {
        // 将 cookie 内容转换为 Netscape 格式（如果需要）
        const netscapeContent = CookieConverter.convertToNetscapeFormat(
          cookie.content,
        );

        // 将 cookie 内容保存到临时文件
        const cookieFilePath = path.join(
          this.tempDir,
          `cookie_${cookie._id.toString()}_${timestamp}.txt`,
        );
        fs.writeFileSync(cookieFilePath, netscapeContent, {
          encoding: 'utf-8',
        });

        const cookieCommand = ` --cookies "${cookieFilePath}"`;
        const fullCommand = `${command}${cookieCommand} -f bestaudio "${videoUrl}" -o "${outputPath}.%(ext)s"`;

        this.logger.log(
          `尝试使用 Cookie: ${cookie.name} (ID: ${cookie._id.toString()})`,
        );
        this.logger.log(`执行命令: ${fullCommand}`);

        await execAsync(fullCommand, { timeout: 600000 }); // 10分钟超时

        // 成功！更新 cookie 使用信息
        await this.bilibiliCookieService.updateUsage(cookie._id.toString());
        this.logger.log(
          `成功使用 Cookie: ${cookie.name} (ID: ${cookie._id.toString()})`,
        );

        // 清理临时 cookie 文件
        try {
          fs.unlinkSync(cookieFilePath);
        } catch {
          // 忽略清理错误
        }

        // 跳出循环
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message;

        this.logger.warn(
          `Cookie ${cookie.name} (ID: ${cookie._id.toString()}) 使用失败: ${errorMsg}`,
        );

        // 检查是否是格式错误
        if (
          errorMsg.includes('does not look like a Netscape format') ||
          errorMsg.includes('invalid length')
        ) {
          await this.bilibiliCookieService.markAsExpired(
            cookie._id.toString(),
            'Cookie 格式错误，请使用 Netscape 格式或浏览器 cookie 字符串格式',
          );
          this.logger.warn(
            `Cookie ${cookie.name} 格式错误，已标记为过期，尝试下一个...`,
          );
        }
        // 检查是否是 412 错误或其他认证错误
        else if (
          errorMsg.includes('412') ||
          errorMsg.includes('Precondition Failed') ||
          errorMsg.includes('Unable to download webpage')
        ) {
          await this.bilibiliCookieService.markAsExpired(
            cookie._id.toString(),
            errorMsg,
          );
          this.logger.warn(
            `Cookie ${cookie.name} 已标记为过期，尝试下一个...`,
          );
        }

        // 继续尝试下一个 cookie
        continue;
      }
    }

    // 如果所有 cookie 都失败了
    if (lastError) {
      throw new Error(
        `所有 B站 cookies 都不可用。请检查并更新 cookies。\n最后错误: ${lastError.message}`,
      );
    }
  }

  /**
   * 将音频转换为 MP3 格式
   */
  private async convertToMp3(
    inputPath: string,
    outputPath: string,
  ): Promise<string> {
    this.logger.log(
      `开始将音频转换为 MP3 格式: ${inputPath} -> ${outputPath}`,
    );

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioQuality(0) // 最佳质量
        .output(outputPath)
        .on('end', () => {
          this.logger.log(`音频转换为 MP3 完成: ${outputPath}`);
          // 删除原始文件
          try {
            fs.unlinkSync(inputPath);
            this.logger.log(`已删除原始音频文件: ${inputPath}`);
          } catch (error) {
            this.logger.warn(`删除原始音频文件失败: ${error}`);
          }
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`音频转换失败: ${err.message}`);
          reject(
            new Error(
              `音频转换为 MP3 失败: ${err.message}。请确保已安装 ffmpeg-static 包。`,
            ),
          );
        })
        .run();
    });

    // 检查生成的 MP3 文件是否存在
    if (!fs.existsSync(outputPath)) {
      throw new Error('MP3 音频文件未生成');
    }

    this.logger.log(`音频提取并转换为 MP3 完成: ${outputPath}`);
    return outputPath;
  }
}

