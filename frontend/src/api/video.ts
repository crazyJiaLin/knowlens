import request from './request';

// ==================== 类型定义 ====================

export interface SubmitVideoRequest {
  videoUrl: string;
}

export interface SubmitVideoResponse {
  documentId: string;
  status: string;
  message: string;
}

export interface VideoInfo {
  platform: 'youtube' | 'bilibili';
  videoId: string;
  title: string;
  duration?: number;
  thumbnail?: string;
  embedUrl: string;
}

// ==================== API 请求 ====================

/**
 * 提交视频链接
 */
export const submitVideo = async (data: SubmitVideoRequest): Promise<SubmitVideoResponse> => {
  return request.post('/video/submit', data);
};

/**
 * 获取视频信息（不创建文档）
 */
export const getVideoInfo = async (url: string): Promise<VideoInfo> => {
  return request.get('/video/info', { params: { url } });
};
