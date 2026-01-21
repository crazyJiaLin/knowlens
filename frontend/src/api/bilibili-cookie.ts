import request from './request';

export interface BilibiliCookie {
  _id: string;
  name: string;
  content: string;
  status: 'enabled' | 'disabled' | 'expired';
  lastUsedAt?: string;
  lastError?: string;
  usageCount: number;
  createdBy?: string; // 创建者手机号
  updatedBy?: string; // 最后编辑者手机号
  createdAt: string;
  updatedAt: string;
}

export interface CreateBilibiliCookieDto {
  name: string;
  content: string;
}

export interface UpdateBilibiliCookieDto {
  name?: string;
  status?: 'enabled' | 'disabled' | 'expired';
}

/**
 * 获取所有 B站 cookies
 */
export async function getBilibiliCookies(): Promise<BilibiliCookie[]> {
  return request.get('/bilibili-cookies');
}

/**
 * 获取单个 B站 cookie
 */
export async function getBilibiliCookie(id: string): Promise<BilibiliCookie> {
  return request.get(`/bilibili-cookies/${id}`);
}

/**
 * 创建 B站 cookie
 */
export async function createBilibiliCookie(data: CreateBilibiliCookieDto): Promise<BilibiliCookie> {
  return request.post('/bilibili-cookies', data);
}

/**
 * 更新 B站 cookie
 */
export async function updateBilibiliCookie(
  id: string,
  data: UpdateBilibiliCookieDto
): Promise<BilibiliCookie> {
  return request.put(`/bilibili-cookies/${id}`, data);
}

/**
 * 启用 B站 cookie
 */
export async function enableBilibiliCookie(id: string): Promise<BilibiliCookie> {
  return request.put(`/bilibili-cookies/${id}/enable`);
}

/**
 * 禁用 B站 cookie
 */
export async function disableBilibiliCookie(id: string): Promise<BilibiliCookie> {
  return request.put(`/bilibili-cookies/${id}/disable`);
}

/**
 * 删除 B站 cookie
 */
export async function deleteBilibiliCookie(id: string): Promise<void> {
  return request.delete(`/bilibili-cookies/${id}`);
}
