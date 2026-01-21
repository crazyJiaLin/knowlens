import request from './request';

// ==================== 类型定义 ====================

export type SourceAnchor = {
  type: 'video' | 'pdf' | 'text';
  startTime?: number;
  endTime?: number;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  segmentId?: string;
};

export type KnowledgePoint = {
  id: string;
  documentId: string;
  topic: string;
  excerpt: string;
  confidenceScore?: number;
  sourceAnchor: SourceAnchor;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgePointsResponse = {
  success: boolean;
  data: KnowledgePoint[];
  count: number;
};

// ==================== API 请求 ====================

/**
 * 转换 Mongoose 文档的 _id 为 id
 */
function transformMongooseDoc<T>(doc: T): T {
  if (!doc) return doc;

  // 如果是数组，递归处理每个元素
  if (Array.isArray(doc)) {
    return doc.map(transformMongooseDoc) as T;
  }

  // 如果是对象，转换 _id 为 id
  if (typeof doc === 'object') {
    const transformed = { ...doc } as Record<string, unknown>;
    if ('_id' in transformed) {
      transformed.id = String(transformed._id);
      delete transformed._id;
    }

    // 递归处理嵌套对象
    for (const key in transformed) {
      if (transformed[key] && typeof transformed[key] === 'object') {
        transformed[key] = transformMongooseDoc(transformed[key]);
      }
    }

    return transformed as T;
  }

  return doc;
}

/**
 * 获取文档的知识点列表
 */
export const getKnowledgePoints = async (documentId: string): Promise<KnowledgePoint[]> => {
  const response = await request.get<KnowledgePointsResponse>('/knowledge-points', {
    params: { documentId },
  });

  // response 已被 interceptor 解包，实际类型是 KnowledgePointsResponse
  const data = (response as unknown as KnowledgePointsResponse).data;

  // 转换 _id 为 id
  const transformedData = transformMongooseDoc(data);
  return transformedData;
};

/**
 * 获取知识点详情
 */
export const getKnowledgePointById = async (id: string): Promise<KnowledgePoint> => {
  const response = await request.get<{ success: boolean; data: KnowledgePoint }>(
    `/knowledge-points/${id}`
  );
  // 如果响应已经是 KnowledgePoint 类型（被 interceptor 解包了），直接返回
  if ('topic' in (response as object)) {
    return response as unknown as KnowledgePoint;
  }
  // 否则从 data 字段中提取
  return (response as unknown as { data: KnowledgePoint }).data;
};

/**
 * 重新生成文档的知识点
 */
export const regenerateKnowledgePoints = async (
  documentId: string
): Promise<{ success: boolean; message: string; data: { jobId: string } }> => {
  const response = await request.post<{
    success: boolean;
    message: string;
    data: { jobId: string };
  }>('/knowledge-points/regenerate', {
    documentId,
  });
  // response 已被 interceptor 解包
  return response as unknown as { success: boolean; message: string; data: { jobId: string } };
};
