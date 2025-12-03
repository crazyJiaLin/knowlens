import { useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, message, Card, Typography, Empty, Progress, Skeleton } from 'antd';
import { useDocument } from '@/hooks/useDocument';

const { Title, Text } = Typography;

export default function VideoDocument() {
  const { id } = useParams<{ id: string }>();
  const segmentsContainerRef = useRef<HTMLDivElement>(null);

  const {
    document,
    segments,
    status,
    progress,
    isLoading,
    isLoadingSegments,
    error,
  } = useDocument(id || null, {
    enabled: !!id,
    autoPoll: true,
    pollInterval: 2000, // 2秒轮询一次
  });

  // 处理错误
  useEffect(() => {
    if (error) {
      message.error(error.message || '加载文档失败');
    }
  }, [error]);

  // 根据进度和状态控制内容显示（使用 useMemo 避免在 useEffect 中 setState）
  const showVideo = useMemo(() => {
    if (!document) return false;
    // 视频信息在文档创建后即可显示（进度 >= 10%）
    return !!(document.video && (progress >= 10 || status?.status === 'completed'));
  }, [document, progress, status?.status]);

  const showSegments = useMemo(() => {
    // 原文在进度 >= 80% 或已完成时显示
    return progress >= 80 || status?.status === 'completed';
  }, [progress, status?.status]);

  // 如果文档处理失败，显示错误信息
  if (document?.status === 'failed') {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <Card>
          <Empty
            description={
              <div>
                <Text type="danger">文档处理失败</Text>
                <br />
                <Text type="secondary">{document.errorMessage || '未知错误'}</Text>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  // 如果正在加载初始数据，显示骨架屏
  if (isLoading || !document) {
    return (
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  // 获取视频嵌入 URL
  const getEmbedUrl = (): string | null => {
    if (document.sourceType !== 'video' || !document.video) {
      return null;
    }

    const { platform, videoId } = document.video;
    if (!platform || !videoId) {
      return null;
    }

    if (platform === 'youtube') {
      // YouTube: 添加 autoplay=0 参数，防止自动播放
      return `https://www.youtube.com/embed/${videoId}?autoplay=0`;
    } else if (platform === 'bilibili') {
      // B站需要 BV 号，添加 autoplay=0 参数
      const bvid = videoId.startsWith('BV') ? videoId : null;
      if (bvid) {
        return `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0`;
      }
    }

    return null;
  };

  const embedUrl = getEmbedUrl();
  const isProcessing = status?.status === 'processing';
  const progressPercent = progress || 0;
  
  // 获取进度描述（从后端返回的 message 字段获取，如果没有则使用默认值）
  const getProgressText = (): string => {
    if (!isProcessing) {
      return '处理完成';
    }
    // 优先使用后端返回的 message
    if (status?.message) {
      return status.message;
    }
    // 如果没有 message，使用默认值
    return '处理中...';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 标题和进度条 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ marginBottom: '16px' }}>
          {document.title || '视频文档'}
        </Title>
        {isProcessing && (
          <div>
            <Progress
              percent={progressPercent}
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              format={(percent) => `${percent}%`}
            />
            <Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
              {getProgressText()}
            </Text>
          </div>
        )}
        {status?.status === 'completed' && (
          <Text type="success" style={{ fontSize: '14px' }}>
            处理完成
          </Text>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px',
        }}
      >
        {/* 左侧：视频播放器和原文 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 视频播放器 */}
          {showVideo && embedUrl ? (
            <Card title="视频" style={{ height: 'fit-content' }}>
              <div
                style={{
                  position: 'relative',
                  paddingBottom: '56.25%', // 16:9 比例
                  height: 0,
                  overflow: 'hidden',
                }}
              >
                <iframe
                  src={embedUrl}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Card>
          ) : (
            <Card title="视频" style={{ height: 'fit-content' }}>
              <Skeleton.Image
                active
                style={{ width: '100%', height: '315px', borderRadius: '4px' }}
              />
            </Card>
          )}

          {/* 视频原文 */}
          <Card
            title="视频原文"
            style={{ minHeight: '400px', maxHeight: '600px', overflow: 'auto' }}
          >
            {showSegments ? (
              isLoadingSegments ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin tip="加载原文中..." />
                </div>
              ) : segments.length > 0 ? (
                <div ref={segmentsContainerRef}>
                  {segments.map((segment) => (
                    <div
                      key={segment.id}
                      id={`segment-${segment.segmentIndex}`}
                      style={{
                        marginBottom: '16px',
                        padding: '12px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-background-secondary)',
                      }}
                    >
                      {segment.startTime !== undefined && segment.endTime !== undefined && (
                        <Text type="secondary" style={{ fontSize: '12px', marginRight: '8px' }}>
                          [{formatTime(segment.startTime)} - {formatTime(segment.endTime)}]
                        </Text>
                      )}
                      <Text>{segment.text}</Text>
                    </div>
                  ))}
                </div>
              ) : status?.status === 'completed' ? (
                <Empty description="暂无原文内容" />
              ) : (
                <Empty description="原文处理中..." />
              )
            ) : (
              <div>
                <Skeleton active paragraph={{ rows: 8 }} />
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <Text type="secondary">原文处理中，请稍候...</Text>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 右侧：知识点 */}
        <div>
          <Card title="知识点" style={{ minHeight: '400px' }}>
            {status?.status === 'completed' ? (
              <Empty description="知识点生成中..." />
            ) : (
              <div>
                <Skeleton active paragraph={{ rows: 6 }} />
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <Text type="secondary">等待原文处理完成...</Text>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * 格式化时间（秒转 mm:ss）
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
