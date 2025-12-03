import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';

export interface VideoInfo {
  videoId: string;
  bvid?: string;
  aid?: number;
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
export class BilibiliService {
  private readonly logger = new Logger(BilibiliService.name);

  /**
   * 从 B站 URL 中提取 BV号或 av号
   * 支持格式：
   * - https://www.bilibili.com/video/BVxxxxx
   * - https://www.bilibili.com/video/av123456
   * - https://b23.tv/xxxxx (短链接)
   */
  extractVideoId(url: string): { bvid?: string; aid?: number } | null {
    // 匹配 BV号
    const bvMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
    if (bvMatch && bvMatch[1]) {
      return { bvid: bvMatch[1] };
    }

    // 匹配 av号
    const avMatch = url.match(/\/video\/av(\d+)/i);
    if (avMatch && avMatch[1]) {
      return { aid: parseInt(avMatch[1], 10) };
    }

    // 短链接需要先解析
    if (url.includes('b23.tv')) {
      // 短链接需要实际访问才能获取真实URL，这里先返回null
      // 实际使用时可以通过 axios 访问短链接获取重定向后的URL
      return null;
    }

    return null;
  }

  /**
   * 验证是否为有效的 B站 URL
   */
  isValidUrl(url: string): boolean {
    return (
      url.includes('bilibili.com') ||
      url.includes('b23.tv') ||
      /^BV[a-zA-Z0-9]+$/i.test(url) ||
      /^av\d+$/i.test(url)
    );
  }

  /**
   * BV号转 av号（如果需要）
   * 注意：B站 API 需要登录，这里先实现基础解析
   */
  async bvToAv(bvid: string): Promise<number | null> {
    // B站 BV号转 av号的算法比较复杂，需要调用 API
    // 这里先返回 null，后续可以通过 B站 API 实现
    this.logger.warn('BV号转 av号功能待实现');
    return null;
  }

  /**
   * 获取视频信息（标题、时长等）
   * 注意：B站 API 需要登录和签名，这里先实现基础解析
   */
  async getVideoInfo(url: string): Promise<VideoInfo> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new BadRequestException('无效的 B站视频链接');
    }

    try {
      // B站公开 API（无需登录，但信息有限）
      let apiUrl = '';
      if (videoId.bvid) {
        apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${videoId.bvid}`;
      } else if (videoId.aid) {
        apiUrl = `https://api.bilibili.com/x/web-interface/view?aid=${videoId.aid}`;
      } else {
        throw new BadRequestException('无法解析 B站视频ID');
      }

      // 添加超时设置（5秒），避免阻塞
      const response = await axios.get(apiUrl, {
        timeout: 5000,
      });
      const data = response.data as {
        code: number;
        data?: {
          title: string;
          pic?: string;
          duration?: number;
          bvid?: string;
          aid?: number;
        };
        message?: string;
      };

      if (data.code === 0 && data.data) {
        return {
          videoId: videoId.bvid || `av${videoId.aid}`,
          bvid: data.data.bvid,
          aid: data.data.aid,
          title: data.data.title || '未知标题',
          duration: data.data.duration,
          thumbnail: data.data.pic,
        };
      } else {
        throw new BadRequestException(data.message || '获取 B站视频信息失败');
      }
    } catch (error) {
      this.logger.warn(`获取 B站视频信息失败: ${error}`);
      // 如果获取失败，至少返回 videoId
      return {
        videoId: videoId.bvid || `av${videoId.aid}`,
        bvid: videoId.bvid,
        aid: videoId.aid,
        title: '未知标题',
      };
    }
  }

  /**
   * 获取视频嵌入 URL
   */
  getEmbedUrl(bvid: string): string {
    return `https://player.bilibili.com/player.html?bvid=${bvid}`;
  }

  /**
   * 获取 B站视频字幕
   * 使用 B站 API 获取字幕文件
   * @param url 视频URL
   * @param cid 分P的cid（可选，如果不提供会从视频信息中获取）
   * @returns 字幕数组，包含文本和时间戳
   */
  async getTranscript(
    url: string,
    cid?: number,
  ): Promise<Array<{ text: string; start: number; end: number }>> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new BadRequestException('无效的 B站视频链接');
    }

    try {
      // 1. 获取视频信息（包含分P信息）
      const videoInfo = await this.getVideoInfo(url);
      let targetCid = cid;

      // 如果没有提供cid，使用第一个分P的cid
      if (!targetCid) {
        try {
          const viewApiUrl = videoId.bvid
            ? `https://api.bilibili.com/x/web-interface/view?bvid=${videoId.bvid}`
            : `https://api.bilibili.com/x/web-interface/view?aid=${videoId.aid}`;

          const viewResponse = await axios.get(viewApiUrl, {
            timeout: 5000,
          });
          const viewData = viewResponse.data as {
            code: number;
            data?: {
              pages?: Array<{ cid: number }>;
            };
          };

          if (viewData.code === 0 && viewData.data?.pages?.[0]?.cid) {
            targetCid = viewData.data.pages[0].cid;
          } else {
            throw new BadRequestException('无法获取视频分P信息');
          }
        } catch (error) {
          this.logger.warn(`获取分P信息失败: ${error}`);
          throw new BadRequestException('无法获取视频分P信息');
        }
      }

      // 2. 获取字幕列表
      const subtitleApiUrl = `https://api.bilibili.com/x/player/v2?cid=${targetCid}&bvid=${videoId.bvid || ''}&aid=${videoId.aid || ''}`;
      const subtitleResponse = await axios.get(subtitleApiUrl, {
        timeout: 5000,
      });
      const subtitleData = subtitleResponse.data as {
        code: number;
        data?: {
          subtitle?: {
            subtitles?: Array<{
              lan: string;
              lan_doc: string;
              subtitle_url: string;
            }>;
          };
        };
      };

      if (
        subtitleData.code !== 0 ||
        !subtitleData.data?.subtitle?.subtitles ||
        subtitleData.data.subtitle.subtitles.length === 0
      ) {
        throw new BadRequestException('该视频没有字幕');
      }

      // 3. 优先选择中文字幕
      const subtitles = subtitleData.data.subtitle.subtitles;
      const preferredLanguages = ['zh-CN', 'zh', 'zh-Hans', 'zh-Hant', 'en'];
      let selectedSubtitle = subtitles.find((s) =>
        preferredLanguages.includes(s.lan),
      );

      // 如果没有找到首选语言，使用第一个字幕
      if (!selectedSubtitle) {
        selectedSubtitle = subtitles[0];
      }

      this.logger.log(
        `选择字幕: ${selectedSubtitle.lan_doc} (${selectedSubtitle.lan})`,
      );

      // 4. 下载字幕文件
      const subtitleUrl = selectedSubtitle.subtitle_url.startsWith('http')
        ? selectedSubtitle.subtitle_url
        : `https:${selectedSubtitle.subtitle_url}`;

      const subtitleFileResponse = await axios.get(subtitleUrl, {
        timeout: 10000, // 字幕文件可能较大，设置10秒超时
      });
      const subtitleContent = subtitleFileResponse.data as {
        body?: Array<{
          from: number;
          to: number;
          content: string;
        }>;
      };

      if (!subtitleContent.body || subtitleContent.body.length === 0) {
        throw new BadRequestException('字幕文件格式错误');
      }

      // 5. 转换为标准格式
      const segments: Array<{ text: string; start: number; end: number }> =
        subtitleContent.body.map((item) => ({
          text: item.content,
          start: item.from / 1000, // 毫秒转秒
          end: item.to / 1000,
        }));

      this.logger.log(`字幕获取成功: 片段数=${segments.length}`);
      return segments;
    } catch (error) {
      this.logger.error(`获取 B站字幕失败: ${error}`);
      throw new BadRequestException(
        `获取字幕失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
