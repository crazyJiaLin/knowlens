import request from './request';

// ==================== 类型定义 ====================

export type Insight = {
  logic: string;
  hiddenInfo: string;
  extensionOptional: string;
  tokensUsed?: number;
  generationTimeMs?: number;
};

export type GenerateInsightResponse = {
  success: boolean;
  data: Insight;
};

// ==================== API 请求 ====================

/**
 * 生成或获取知识点的洞察（流式输出）
 * @param kpId 知识点ID
 * @param forceRegenerate 是否强制重新生成，默认 false
 * @param onChunk 接收流式数据的回调函数
 */
export const generateInsightStream = async (
  kpId: string,
  forceRegenerate: boolean,
  onChunk: (chunk: Partial<Insight>) => void
): Promise<Insight> => {
  // 确保 kpId 是字符串类型
  if (!kpId || typeof kpId !== 'string') {
    console.error('generateInsightStream: 无效的知识点ID', { kpId, type: typeof kpId });
    throw new Error('知识点ID无效');
  }

  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  const url = `${baseURL}/insight/generate-stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 重要：携带 cookie
    body: JSON.stringify({
      kp_id: String(kpId),
      force_regenerate: Boolean(forceRegenerate),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('无法读取响应流');
  }

  let buffer = '';
  const result: Partial<Insight> = {
    logic: '',
    hiddenInfo: '',
    extensionOptional: '',
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一个不完整的行

      for (const line of lines) {
        if (line.trim() === '') continue;

        if (line.startsWith('data: ')) {
          const data = line.slice(6); // 移除 'data: ' 前缀

          if (data === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(data);

            // 检查是否有错误
            if (parsed.error) {
              throw new Error(parsed.error);
            }

            // 更新结果
            if (parsed.logic !== undefined) {
              result.logic = parsed.logic;
            }
            if (parsed.hiddenInfo !== undefined) {
              result.hiddenInfo = parsed.hiddenInfo;
            }
            if (parsed.extensionOptional !== undefined) {
              result.extensionOptional = parsed.extensionOptional;
            }

            // 调用回调函数
            onChunk({ ...result });
          } catch (e) {
            if (e instanceof Error) {
              throw e; // 重新抛出错误，让上层处理
            }
            console.warn('解析流式数据失败:', e, data);
          }
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer.trim()) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);

            // 检查是否有错误
            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.logic !== undefined) result.logic = parsed.logic;
            if (parsed.hiddenInfo !== undefined) result.hiddenInfo = parsed.hiddenInfo;
            if (parsed.extensionOptional !== undefined)
              result.extensionOptional = parsed.extensionOptional;
            onChunk({ ...result });
          } catch (e) {
            if (e instanceof Error) {
              throw e; // 重新抛出错误，让上层处理
            }
            console.warn('解析流式数据失败:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result as Insight;
};

/**
 * 生成或获取知识点的洞察（非流式，兼容旧代码）
 * @param kpId 知识点ID
 * @param forceRegenerate 是否强制重新生成，默认 false
 */
export const generateInsight = async (kpId: string, forceRegenerate = false): Promise<Insight> => {
  // 确保 kpId 是字符串类型
  if (!kpId || typeof kpId !== 'string') {
    console.error('generateInsight: 无效的知识点ID', { kpId, type: typeof kpId });
    throw new Error('知识点ID无效');
  }

  // 构建请求体
  const requestBody = {
    kp_id: String(kpId), // 确保是字符串
    force_regenerate: Boolean(forceRegenerate),
  };

  console.log('generateInsight: 发送请求', { requestBody });

  // 响应拦截器会处理 response.data
  // 后端返回: { success: true, data: { logic, hiddenInfo, extensionOptional } }
  // 全局拦截器会再包装一层: { success: true, data: { success: true, data: {...} } }
  // 响应拦截器会返回: { success: true, data: {...} }
  // 所以需要再取一次 data
  const response = await request.post<{ success: boolean; data: Insight } | Insight>(
    '/insight/generate',
    requestBody
  );

  console.log('generateInsight: 收到响应', { response });

  // 处理双重包装的情况
  if (response && typeof response === 'object' && 'data' in response && 'success' in response) {
    return (response as { data: Insight }).data;
  }

  return response as Insight;
};

/**
 * 获取知识点的洞察（不生成，仅获取已存在的）
 * @param kpId 知识点ID
 */
export const getInsight = async (kpId: string): Promise<Insight | null> => {
  if (!kpId || typeof kpId !== 'string') {
    throw new Error('知识点ID无效');
  }

  try {
    const response = await request.get<{ success: boolean; data: Insight }>(`/insight/${kpId}`);

    if (response && typeof response === 'object' && 'data' in response && 'success' in response) {
      return (response as { data: Insight }).data;
    }

    return response as Insight;
  } catch (error) {
    // 如果洞察不存在，返回 null
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
};
