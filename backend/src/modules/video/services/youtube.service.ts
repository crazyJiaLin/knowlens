import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { YoutubeTranscript } from 'youtube-transcript';

export interface VideoInfo {
  videoId: string;
  title: string;
  duration?: number;
  thumbnail?: string;
}

export interface TranscriptItem {
  text: string;
  start: number;
  end: number;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  /**
   * 从 YouTube URL 中提取 video ID
   * 支持格式：
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - https://www.youtube.com/embed/VIDEO_ID
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 验证是否为有效的 YouTube URL
   */
  isValidUrl(url: string): boolean {
    return (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      /^[a-zA-Z0-9_-]{11}$/.test(url)
    );
  }

  /**
   * 获取视频信息（标题、时长等）
   * 注意：YouTube API 需要 API Key，这里先实现基础解析
   * 后续可以通过 oEmbed API 或 YouTube Data API 获取详细信息
   */
  async getVideoInfo(url: string): Promise<VideoInfo> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new BadRequestException('无效的 YouTube 视频链接');
    }

    try {
      // 使用 oEmbed API 获取视频信息（无需 API Key）
      const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}&format=json`;

      // 添加超时设置（5秒），避免阻塞
      const response = await axios.get(oEmbedUrl, {
        timeout: 5000,
      });
      const data = response.data as {
        title: string;
        thumbnail_url?: string;
        html?: string;
      };

      return {
        videoId,
        title: data.title || '未知标题',
        thumbnail: data.thumbnail_url,
        // oEmbed API 不提供时长，需要 YouTube Data API
        duration: undefined,
      };
    } catch (error) {
      this.logger.warn(`获取 YouTube 视频信息失败: ${error}`);
      // 如果获取失败，至少返回 videoId
      return {
        videoId,
        title: '未知标题',
      };
    }
  }

  /**
   * 获取视频嵌入 URL
   */
  getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  /**
   * 获取视频字幕
   * 优先获取中文字幕，如果没有则获取英文或其他语言
   * @param url 视频URL或videoId
   * @returns 字幕数组，包含文本和时间戳
   * @throws 如果无法获取字幕，抛出错误以便降级到语音识别
   */
  async getTranscript(
    url: string,
  ): Promise<Array<{ text: string; start: number; end: number }>> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new BadRequestException('无效的 YouTube 视频链接');
    }

    // 优先尝试获取中文字幕
    const languages = ['zh', 'zh-CN', 'zh-TW', 'en', 'en-US'];
    let transcript: Array<{
      text: string;
      offset: number;
      duration: number;
    }> | null = null;
    let usedLanguage = '';

    for (const lang of languages) {
      try {
        // 设置超时，避免长时间等待
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('字幕获取超时')), 10000);
        });

        console.log('获取字幕', videoId, lang);
        const result = (await Promise.race([
          YoutubeTranscript.fetchTranscript(videoId, { lang }),
          timeoutPromise,
        ])) as Array<{
          text: string;
          offset: number;
          duration: number;
        }>;

        transcript = result;
        usedLanguage = lang;
        this.logger.log(`成功获取 ${lang} 字幕`);
        break;
      } catch (error) {
        this.logger.debug(`获取 ${lang} 字幕失败: ${error}`);
        continue;
      }
    }

    // 如果所有指定语言都失败，尝试获取自动生成的字幕
    if (!transcript) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('字幕获取超时')), 10000);
        });

        const result = (await Promise.race([
          YoutubeTranscript.fetchTranscript(videoId),
          timeoutPromise,
        ])) as Array<{
          text: string;
          offset: number;
          duration: number;
        }>;

        transcript = result;
        usedLanguage = 'auto';
        this.logger.log('使用自动生成的字幕');
      } catch (error) {
        this.logger.warn(`获取 YouTube 字幕失败: ${error}`);
        // 抛出错误，让调用方可以降级到语音识别
        throw new Error(
          `无法获取 YouTube 字幕: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 转换为标准格式
    const segments: Array<{ text: string; start: number; end: number }> =
      transcript.map((item) => {
        const start = item.offset / 1000; // 毫秒转秒
        const end = start + item.duration / 1000;
        return {
          text: item.text,
          start,
          end,
        };
      });

    this.logger.log(
      `字幕获取成功: 语言=${usedLanguage}, 片段数=${segments.length}`,
    );
    return segments;
  }
}
