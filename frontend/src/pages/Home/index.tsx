import { useState } from 'react';
import { Card, Input, Button, message, Upload } from 'antd';
import { PaperClipOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { UploadProps } from 'antd';
import { submitVideo } from '@/api/video';
import { createFromText } from '@/api/document';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const { TextArea } = Input;

// URL 验证正则
const YOUTUBE_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
const BILIBILI_REGEX =
  /^(https?:\/\/)?(www\.)?(bilibili\.com\/video\/|b23\.tv\/)(BV[a-zA-Z0-9]+|av\d+)/i;

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useUIStore();

  // 文本字数统计
  const textCharCount = inputValue.length;
  const maxTextLength = 30000; // 3万字

  /**
   * 判断输入是否为视频链接
   */
  const isVideoUrl = (input: string): boolean => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return false;
    }
    // 检查是否为 YouTube 或 B站 URL
    return YOUTUBE_REGEX.test(trimmedInput) || BILIBILI_REGEX.test(trimmedInput);
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
      message.warning('请输入内容');
      return;
    }

    try {
      setLoading(true);

      // 判断输入类型：如果是视频链接，使用视频方式；否则使用文本方式
      if (isVideoUrl(trimmedValue)) {
        // 视频链接处理
        const result = await submitVideo({ videoUrl: trimmedValue });
        message.success('视频提交成功，正在处理中...');
        // 跳转到文档页面（视频类型）
        navigate(`/document/video/${result.documentId}`);
      } else {
        // 文本内容处理
        if (trimmedValue.length > maxTextLength) {
          message.error(`文本内容不能超过${maxTextLength.toLocaleString()}字`);
          setLoading(false);
          return;
        }
        const result = await createFromText(trimmedValue);
        message.success('文本提交成功，正在处理中...');
        // 跳转到文档页面（文本类型）
        navigate(`/document/text/${result.documentId}`);
      }

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
          KnowLens
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
            placeholder={`粘贴视频链接或文本内容（目前仅支持B站链接或纯文本，最多${(maxTextLength / 10000).toFixed(0)}万字）`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoSize={{ minRows: 4, maxRows: 20 }}
            onPressEnter={(e) => {
              if (e.shiftKey) {
                return;
              }
              e.preventDefault();
              void handleSubmit();
            }}
            disabled={loading}
            maxLength={maxTextLength}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
              {!isVideoUrl(inputValue) && (
                <span
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '12px',
                  }}
                >
                  {textCharCount.toLocaleString()} / {maxTextLength.toLocaleString()} 字
                </span>
              )}
            </div>
            <Button
              type="primary"
              shape="circle"
              icon={<ArrowRightOutlined />}
              onClick={handleSubmit}
              loading={loading}
              disabled={!inputValue.trim()}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
