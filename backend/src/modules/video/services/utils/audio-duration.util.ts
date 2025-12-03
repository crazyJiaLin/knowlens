import { Logger } from '@nestjs/common';
import loadAudio from 'audio-loader';

/**
 * 音频时长获取工具
 */
export class AudioDurationUtil {
  private static readonly logger = new Logger(AudioDurationUtil.name);

  /**
   * 获取音频时长（毫秒）
   * 优先使用 audio-loader，失败则使用 music-metadata
   */
  static async getDuration(audioPath: string): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const audioBuffer = await loadAudio(audioPath);
      // audio-loader 返回 AudioBuffer，duration 属性为秒数
      const durationSeconds = (audioBuffer as { duration?: number })?.duration;
      if (durationSeconds && durationSeconds > 0) {
        // 转换为毫秒
        const duration = Math.round(durationSeconds * 1000).toString();
        this.logger.log(
          `通过 audio-loader 检测到音频时长: ${duration} 毫秒 (${durationSeconds.toFixed(2)} 秒)`,
        );
        return duration;
      } else {
        this.logger.warn(
          `无法从 audio-loader 获取有效的音频时长，使用默认值 0`,
        );
        return '0';
      }
    } catch (audioLoaderError) {
      // audio-loader 失败，尝试使用 music-metadata 作为备选
      this.logger.warn(
        `audio-loader 获取时长失败，尝试使用 music-metadata: ${audioLoaderError instanceof Error ? audioLoaderError.message : String(audioLoaderError)}`,
      );
      try {
        // 动态导入 music-metadata（ES Module）
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { parseFile } = await import('music-metadata');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const metadata = await parseFile(audioPath);
        const durationSeconds = (metadata as { format?: { duration?: number } })
          ?.format?.duration;
        if (durationSeconds && durationSeconds > 0) {
          // 转换为毫秒
          const duration = Math.round(durationSeconds * 1000).toString();
          this.logger.log(
            `通过 music-metadata 检测到音频时长: ${duration} 毫秒 (${durationSeconds.toFixed(2)} 秒)`,
          );
          return duration;
        } else {
          this.logger.warn(`无法从音频文件元数据中获取时长，使用默认值 0`);
          return '0';
        }
      } catch (metadataError) {
        this.logger.warn(
          `所有方法都失败，使用默认值 0: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`,
        );
        return '0';
      }
    }
  }
}

