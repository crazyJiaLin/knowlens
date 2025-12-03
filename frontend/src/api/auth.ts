import request from './request';

// ==================== 类型定义 ====================

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  success: boolean;
  user: User;
}

export interface SendSmsCodeResponse {
  success: boolean;
  message: string;
}

// ==================== API 请求 ====================

/**
 * 发送短信验证码
 */
export const sendSmsCode = async (phone: string): Promise<SendSmsCodeResponse> => {
  return request.post('/auth/send-code', { phone });
};

/**
 * 验证码登录
 */
export const verifyCode = async (phone: string, code: string): Promise<LoginResponse> => {
  return request.post('/auth/verify', { phone, code });
};

/**
 * 退出登录
 */
export const logout = async (): Promise<{ success: boolean; message: string }> => {
  return request.post('/auth/logout');
};
