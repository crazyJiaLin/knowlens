import request from './request';
import type { User } from './auth';

// ==================== 类型定义 ====================

export interface UserProfile extends User {
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateUserProfileRequest {
  nickname?: string;
  avatarUrl?: string;
}

export interface UpdateUserProfileResponse {
  id: string;
  phone: string;
  nickname?: string;
  avatarUrl?: string;
  updatedAt: string;
}

export interface UploadAvatarResponse {
  avatarUrl: string;
}

// ==================== API 请求 ====================

/**
 * 获取用户资料
 */
export const getUserProfile = async (): Promise<UserProfile> => {
  return request.get('/user/profile');
};

/**
 * 更新用户资料
 */
export const updateUserProfile = async (
  data: UpdateUserProfileRequest
): Promise<UpdateUserProfileResponse> => {
  return request.patch('/user/profile', data);
};

/**
 * 上传头像
 */
export const uploadAvatar = async (file: File): Promise<UploadAvatarResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return request.post('/user/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
