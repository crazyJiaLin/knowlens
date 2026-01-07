import axios from 'axios';
import { message } from 'antd';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

console.log('环境变量', import.meta.env);
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
  withCredentials: true, // 重要：允许携带 cookie
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // Cookie 会自动携带，无需手动设置 Authorization header
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 如果响应有 data 字段，返回 data；否则返回整个 response
    return response?.data?.data !== undefined ? response.data.data : response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 登录失效，清空用户信息并打开登录弹窗
      const { logout } = useAuthStore.getState();
      const { openLoginModal } = useUIStore.getState();

      // 清空 store 和 localStorage 中的用户信息
      logout();

      // 打开登录弹窗
      openLoginModal();
      message.warning('登录已失效，请重新登录');
    } else {
      message.error(error.response?.data?.message || '请求失败');
    }
    return Promise.reject(error);
  }
);

export default request;
