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
function transformMongooseDoc(doc: any): any {
  if (!doc) return doc;
  
  // 如果是数组，递归处理每个元素
  if (Array.isArray(doc)) {
    return doc.map(transformMongooseDoc);
  }
  
  // 如果是对象，转换 _id 为 id
  if (typeof doc === 'object') {
    const transformed = { ...doc };
    if (transformed._id) {
      transformed.id = transformed._id.toString();
      delete transformed._id;
    }
    
    // 递归处理嵌套对象
    for (const key in transformed) {
      if (transformed[key] && typeof transformed[key] === 'object') {
        transformed[key] = transformMongooseDoc(transformed[key]);
      }
    }
    
    return transformed;
  }
  
  return doc;
}

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
  
  // 转换 _id 为 id
  const transformedData = transformMongooseDoc(response.data);
  return transformedData;
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

