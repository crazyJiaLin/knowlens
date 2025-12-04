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
 * 获取文档的知识点列表
 */
export const getKnowledgePoints = async (
  documentId: string
): Promise<KnowledgePoint[]> => {
  const response = await request.get<KnowledgePointsResponse>(
    '/knowledge-points',
    {
      params: { documentId },
    }
  );
  return response.data;
};

/**
 * 获取知识点详情
 */
export const getKnowledgePointById = async (
  id: string
): Promise<KnowledgePoint> => {
  const response = await request.get<{ success: boolean; data: KnowledgePoint }>(
    `/knowledge-points/${id}`
  );
  return response.data;
};

