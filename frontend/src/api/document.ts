import request from './request';

// ==================== 类型定义 ====================

export interface Document {
  id: string;
  userId: string;
  sourceType: 'video' | 'pdf' | 'text';
  title?: string;
  originalUrl?: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  video?: {
    platform?: 'youtube' | 'bilibili';
    videoId?: string;
    duration?: number;
    transcriptSource?: 'native' | 'asr';
  };
  pdf?: {
    pageCount?: number;
    fileSize?: number;
  };
  language?: string;
  wordCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentStatus {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  progress?: number; // 0-100
  message?: string; // 进度描述信息
}

export interface Segment {
  id: string;
  documentId: string;
  segmentIndex: number;
  text: string;
  startTime?: number;
  endTime?: number;
  pageNumber?: number;
  startOffset?: number;
  endOffset?: number;
  charStart?: number;
  charEnd?: number;
  createdAt: string;
}

export interface QueryDocumentParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  sourceType?: 'video' | 'pdf' | 'text';
  status?: 'processing' | 'completed' | 'failed';
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== API 请求 ====================

/**
 * 获取文档列表
 */
export const getDocumentList = async (
  params?: QueryDocumentParams
): Promise<DocumentListResponse> => {
  return request.get('/document/list', { params });
};

/**
 * 获取文档详情
 */
export const getDocumentById = async (documentId: string): Promise<Document> => {
  return request.get(`/document/${documentId}`);
};

/**
 * 获取文档状态（用于轮询）
 */
export const getDocumentStatus = async (documentId: string): Promise<DocumentStatus> => {
  return request.get(`/document/${documentId}/status`);
};

/**
 * 获取文档片段列表
 */
export const getDocumentSegments = async (documentId: string): Promise<Segment[]> => {
  return request.get(`/document/${documentId}/segments`);
};

/**
 * 删除文档
 */
export const deleteDocument = async (
  documentId: string
): Promise<{ success: boolean; message: string }> => {
  return request.delete(`/document/${documentId}`);
};

/**
 * 从文本创建文档
 */
export const createFromText = async (
  text: string,
  title?: string
): Promise<{ success: boolean; documentId: string; status: string; message: string }> => {
  const payload: { text: string; title?: string } = { text };
  if (title && title.trim()) {
    payload.title = title.trim();
  }
  return request.post('/document/create-from-text', payload);
};
