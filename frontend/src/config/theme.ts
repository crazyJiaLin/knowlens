import type { ConfigProviderProps } from 'antd';

type ThemeConfig = NonNullable<ConfigProviderProps['theme']>;

export const themeConfig: ThemeConfig = {
  token: {
    // 主色
    colorPrimary: '#3BAF9F',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorInfo: '#3BAF9F',

    // 文本色
    colorText: '#1A1A1A',
    colorTextSecondary: '#666666',
    colorTextTertiary: '#999999',
    colorTextDisabled: '#CCCCCC',

    // 背景色
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#F5F5F5',
    colorBgLayout: '#FAFAFA',

    // 边框色
    colorBorder: '#E0E0E0',
    colorBorderSecondary: '#F0F0F0',

    // 链接色
    colorLink: '#3BAF9F',
    colorLinkHover: '#2A8F82',

    // 圆角
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // 字体
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,

    // 阴影
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    boxShadowSecondary: '0 1px 4px rgba(0, 0, 0, 0.08)',
  },
  components: {
    Button: {
      primaryColor: '#FFFFFF',
      borderRadius: 6,
    },
    Card: {
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    },
    Input: {
      borderRadius: 6,
    },
    Tag: {
      borderRadius: 4,
    },
  },
};
