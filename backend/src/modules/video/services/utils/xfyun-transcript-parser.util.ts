import { Logger } from '@nestjs/common';

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

/**
 * 科大讯飞转写结果解析工具
 */
export class XfyunTranscriptParser {
  private readonly logger = new Logger(XfyunTranscriptParser.name);

  /**
   * 解析科大讯飞返回的转写结果（大模型 API）
   * 根据新 API 的响应格式解析
   */
  parse(result: unknown): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];

    const data = result as {
      orderResult?: string; // 转写结果（JSON字符串）
      result?: string; // 转写结果文本
      segments?: Array<{
        text?: string;
        start?: number;
        end?: number;
        bg?: number; // 开始时间（毫秒）
        ed?: number; // 结束时间（毫秒）
      }>;
      data?: string; // 兼容旧格式
    };

    // 优先解析 orderResult（讯飞大模型 API 返回格式）
    if (data.orderResult) {
      try {
        const orderResult = JSON.parse(data.orderResult) as {
          lattice?: unknown[];
          lattice2?: Array<{
            begin?: string | number;
            end?: string | number;
            json_1best?: string | object;
          }>;
        };

        // 使用 lattice2（更结构化的数据）
        if (orderResult.lattice2 && Array.isArray(orderResult.lattice2)) {
          for (const item of orderResult.lattice2) {
            if (!item.json_1best) continue;

            try {
              const segment = this.parseJson1Best(
                item.json_1best,
                item.begin,
                item.end,
              );
              if (segment) {
                segments.push(segment);
              }
            } catch (parseError) {
              this.logger.warn(
                `解析 json_1best 失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              );
              this.logger.debug(
                `json_1best 内容: ${JSON.stringify(item.json_1best).substring(0, 200)}`,
              );
            }
          }
        }

        // 如果 lattice2 解析失败，尝试使用 lattice
        if (segments.length === 0 && orderResult.lattice) {
          this.logger.warn('lattice2 解析失败，尝试使用 lattice');
          this.parseLattice(orderResult.lattice, segments);
        }
      } catch (parseError) {
        this.logger.warn(
          `解析 orderResult 失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }
    }

    // 如果 orderResult 解析成功，直接返回
    if (segments.length > 0) {
      this.logger.log(`成功解析 ${segments.length} 个转写片段`);
      return segments;
    }

    // 以下为兼容旧格式的解析逻辑
    this.parseLegacyFormat(data, segments);

    if (segments.length === 0) {
      this.logger.warn('未能解析出任何转写片段');
    }

    return segments;
  }

  /**
   * 解析 json_1best 对象或字符串
   */
  private parseJson1Best(
    json1best: string | object,
    begin?: string | number,
    end?: string | number,
  ): TranscriptSegment | null {
    let parsed: {
      st?: {
        rt?: Array<{
          ws?: Array<{
            cw?: Array<{
              w?: string;
            }>;
          }>;
        }>;
      };
    };

    if (typeof json1best === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      parsed = JSON.parse(json1best);
    } else if (typeof json1best === 'object') {
      parsed = json1best as typeof parsed;
    } else {
      this.logger.warn(`json_1best 格式不正确: ${typeof json1best}`);
      return null;
    }

    // 提取文字：遍历 rt -> ws -> cw -> w
    const words: string[] = [];
    if (parsed.st?.rt) {
      for (const rtItem of parsed.st.rt) {
        if (rtItem.ws) {
          for (const wsItem of rtItem.ws) {
            if (wsItem.cw) {
              for (const cwItem of wsItem.cw) {
                if (cwItem.w) {
                  words.push(cwItem.w);
                }
              }
            }
          }
        }
      }
    }

    if (words.length === 0) {
      return null;
    }

    const text = words.join('');
    const beginMs =
      typeof begin === 'string' ? parseInt(begin, 10) : begin || 0;
    const endMs = typeof end === 'string' ? parseInt(end, 10) : end || beginMs;

    // 时间单位是毫秒，转换为秒
    return {
      text,
      start: beginMs / 1000,
      end: endMs / 1000,
    };
  }

  /**
   * 解析 lattice 格式
   */
  private parseLattice(
    lattice: unknown[],
    segments: TranscriptSegment[],
  ): void {
    try {
      if (Array.isArray(lattice)) {
        for (const latticeItem of lattice) {
          if (
            typeof latticeItem === 'object' &&
            latticeItem !== null &&
            'json_1best' in latticeItem
          ) {
            const json1bestStr = (latticeItem as { json_1best?: string })
              .json_1best;
            if (json1bestStr && typeof json1bestStr === 'string') {
              try {
                const segment = this.parseJson1Best(json1bestStr);
                if (segment) {
                  // lattice 格式可能没有明确的时间戳，使用索引估算
                  const index = segments.length;
                  segment.start = index * 5; // 假设每段5秒
                  segment.end = (index + 1) * 5;
                  segments.push(segment);
                }
              } catch (e) {
                this.logger.warn(`解析 lattice json_1best 失败: ${e}`);
              }
            }
          }
        }
      }
    } catch (latticeError) {
      this.logger.warn(
        `解析 lattice 失败: ${latticeError instanceof Error ? latticeError.message : String(latticeError)}`,
      );
    }
  }

  /**
   * 解析旧格式数据
   */
  private parseLegacyFormat(
    data: {
      segments?: Array<{
        text?: string;
        start?: number;
        end?: number;
        bg?: number;
        ed?: number;
      }>;
      result?: string;
      data?: string;
    },
    segments: TranscriptSegment[],
  ): void {
    // 优先使用新格式的 segments
    if (data.segments && Array.isArray(data.segments)) {
      for (const segment of data.segments) {
        if (segment.text) {
          const startTime =
            segment.start !== undefined
              ? segment.start
              : segment.bg !== undefined
                ? segment.bg / 1000
                : 0;
          const endTime =
            segment.end !== undefined
              ? segment.end
              : segment.ed !== undefined
                ? segment.ed / 1000
                : startTime;

          segments.push({
            text: segment.text,
            start: startTime,
            end: endTime,
          });
        }
      }
    }
    // 如果有 result 字段，尝试解析
    else if (data.result) {
      try {
        const parsed = JSON.parse(data.result) as Array<{
          text?: string;
          start?: number;
          end?: number;
          bg?: number;
          ed?: number;
        }>;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.text) {
              segments.push({
                text: item.text,
                start:
                  item.start !== undefined
                    ? item.start
                    : item.bg !== undefined
                      ? item.bg / 1000
                      : 0,
                end:
                  item.end !== undefined
                    ? item.end
                    : item.ed !== undefined
                      ? item.ed / 1000
                      : 0,
              });
            }
          }
        }
      } catch {
        // 如果不是 JSON，可能是纯文本，按行分割
        const lines = data.result.split('\n');
        let currentTime = 0;
        for (const line of lines) {
          if (line.trim()) {
            segments.push({
              text: line.trim(),
              start: currentTime,
              end: currentTime + 1, // 假设每行1秒
            });
            currentTime += 1;
          }
        }
      }
    }
    // 兼容旧格式（data 字段）
    else if (data.data) {
      const lines = data.data.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line) as {
            onebest?: string;
            bg?: number;
            ed?: number;
          };

          // 解析每个句子
          if (json.onebest && json.bg !== undefined && json.ed !== undefined) {
            const startTime = json.bg / 1000; // 毫秒转秒
            const endTime = json.ed / 1000;
            const text = json.onebest;

            segments.push({
              text,
              start: startTime,
              end: endTime,
            });
          }
        } catch {
          this.logger.warn(`解析行失败: ${line}`);
        }
      }
    }
  }
}
