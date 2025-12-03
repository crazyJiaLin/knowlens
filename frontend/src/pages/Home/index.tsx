import { useState } from 'react';
import { Card, Input, Button, message, Upload } from 'antd';
import { PaperClipOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { UploadProps } from 'antd';
import { submitVideo } from '@/api/video';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const { TextArea } = Input;

// URL 验证正则
const YOUTUBE_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
const BILIBILI_REGEX =
  /^(https?:\/\/)?(www\.)?(bilibili\.com\/video\/|b23\.tv\/)(BV[a-zA-Z0-9]+|av\d+)/i;

export default function Home() {
  const [inputValue, setInputValue] = useState('https://www.bilibili.com/video/BV1MApqzxEFD/?spm_id_from=333.337.search-card.all.click&vd_source=00040ae605a8b6f8a8cf53d5fb9f525a');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useUIStore();

  /**
   * 验证 URL 格式
   */
  const validateUrl = (url: string): boolean => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return false;
    }

    // 检查是否为 YouTube 或 B站 URL
    return YOUTUBE_REGEX.test(trimmedUrl) || BILIBILI_REGEX.test(trimmedUrl);
  };

  /**
   * 处理提交
   */
  const handleSubmit = async () => {
    // 检查登录状态
    if (!isAuthenticated) {
      message.warning('请先登录');
      openLoginModal();
      return;
    }

    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      message.warning('请输入视频链接');
      return;
    }

    // 验证 URL 格式
    if (!validateUrl(trimmedValue)) {
      message.error('请输入有效的 YouTube 或 B站视频链接');
      return;
    }

    try {
      setLoading(true);
      const result = await submitVideo({ videoUrl: trimmedValue });
      message.success('视频提交成功，正在处理中...');

      // 跳转到结果页
      navigate(`/document/${result.documentId}`);

      // 清空输入框
      setInputValue('');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload: UploadProps['customRequest'] = (options) => {
    // TODO: 后续阶段实现PDF上传功能
    message.info('PDF上传功能待实现');
    if (options.onSuccess) {
      options.onSuccess({});
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        padding: '40px 24px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1
          style={{
            fontSize: '36px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: 'var(--color-text-primary)',
          }}
        >
          KNOWLENS
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6',
          }}
        >
          把长内容变成知识，帮助你深刻洞察知识
        </p>
      </div>
      <Card
        className="input-card"
        style={{
          width: '100%',
          maxWidth: '750px',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          border: 'none',
          background: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
        bodyStyle={{
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '150px',
        }}
      >
        <div className="border-animation" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TextArea
            placeholder="复制视频链接或者上传 PDF"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 6 }}
            onPressEnter={(e) => {
              if (e.shiftKey) {
                return;
              }
              e.preventDefault();
              void handleSubmit();
            }}
            disabled={loading}
            style={{
              flex: 1,
              fontSize: '16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-primary)',
              padding: '16px 20px',
              resize: 'none',
            }}
            className="custom-textarea"
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px',
            }}
          >
            <Upload
              customRequest={handleUpload}
              showUploadList={false}
              accept=".pdf,.mp4,.mov,.avi"
            >
              <Button
                type="text"
                icon={<PaperClipOutlined />}
                style={{
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                上传附件
              </Button>
            </Upload>
            <Button
              type="primary"
              shape="circle"
              icon={<ArrowRightOutlined />}
              onClick={handleSubmit}
              loading={loading}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
