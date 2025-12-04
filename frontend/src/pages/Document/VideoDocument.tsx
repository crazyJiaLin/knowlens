import { useEffect, useRef, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, message, Card, Typography, Empty, Progress, Skeleton } from 'antd';
import { useDocument } from '@/hooks/useDocument';
import KnowledgeCard from './components/KnowledgeCard';
import styles from './VideoDocument.module.css';

const { Title, Text } = Typography;

export default function VideoDocument() {
  const { id } = useParams<{ id: string }>();
  const segmentsContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const { document, segments, status, progress, isLoading, isLoadingSegments, error } = useDocument(
    id || null,
    {
      enabled: !!id,
      autoPoll: true,
      pollInterval: 2000, // 2秒轮询一次
    }
  );

  // 处理错误
  useEffect(() => {
    if (error) {
      message.error(error.message || '加载文档失败');
    }
  }, [error]);

  // 生成初始 embedUrl（当 document 加载时）
  useEffect(() => {
    if (!document || document.sourceType !== 'video' || !document.video) {
      return;
    }

    const { platform, videoId } = document.video;
    if (!platform || !videoId) {
      return;
    }

    if (platform === 'youtube') {
      // YouTube: 添加 autoplay=0 和 enablejsapi=1 参数
      const url = `https://www.youtube.com/embed/${videoId}?autoplay=0&enablejsapi=1`;
      console.log('初始化 YouTube URL:', url);
      setEmbedUrl(url);
    } else if (platform === 'bilibili') {
      // B站播放器 URL 格式
      const bvid = videoId.startsWith('BV') ? videoId : null;
      if (bvid) {
        const url = `https://player.bilibili.com/player.html?isOutside=true&bvid=${bvid}&autoplay=0`;
        console.log('初始化 B站 URL:', url);
        setEmbedUrl(url);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.video?.platform, document?.video?.videoId]);

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
      <div className={styles.containerError}>
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
      <div className={styles.containerLoading}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

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

  /**
   * 跳转到视频指定时间
   * @param seconds 目标时间（秒）
   */
  const jumpToTime = (seconds: number) => {
    if (!iframeRef.current || !document?.video) {
      return;
    }

    const { platform } = document.video;

    try {
      if (platform === 'youtube') {
        // 暂不实现
      } else if (platform === 'bilibili') {
        // B站: 直接修改 iframe 的 src URL，通过 t 参数精确跳转
        // 参考: https://www.bilibili.com/video/BV1MApqzxEFD?t=17.8
        // 提前 2 秒开始播放，给用户一些上下文
        const seekTime = Math.max(0, seconds - 2);
        const { videoId } = document.video;
        
        if (!videoId) {
          console.error('videoId 不存在，无法跳转');
          return;
        }
        
        const bvid = videoId.startsWith('BV') ? videoId : null;

        if (bvid) {
          // 直接更新 URL，包含 t 参数
          const newUrl = `https://player.bilibili.com/player.html?isOutside=true&bvid=${bvid}&t=${seekTime.toFixed(1)}&autoplay=1&muted=0`;
          console.log('跳转 B站视频 - 原始时间:', seconds, '计算后的 seekTime:', seekTime);
          console.log('更新 URL:', newUrl);
          setEmbedUrl(newUrl);
        }
      }
    } catch (error) {
      console.error('跳转视频失败:', error);
      message.warning('视频跳转失败，请手动跳转');
    }
  };

  /**
   * 处理段落点击事件
   * @param segment 段落数据
   */
  const handleSegmentClick = (segment: {
    segmentIndex: number;
    startTime?: number;
    endTime?: number;
  }) => {
    console.log('handleSegmentClick', segment);
    const { startTime, endTime, segmentIndex } = segment;
    if (startTime === undefined) {
      return;
    }

    // 跳转到对应时间
    jumpToTime(startTime);

    // 高亮当前段落
    const segmentId = `segment-${segmentIndex}`;
    setHighlightedSegmentId(segmentId);

    // 段落持续时间后移除高亮
    const duration = Math.max((endTime || 0) - (startTime || 0), 3) * 1000;
    setTimeout(() => {
      setHighlightedSegmentId(null);
    }, duration);
  };

  return (
    <div className={styles.container}>
      {/* 标题和进度条 */}
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
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
            <Text type="secondary" className={styles.progressText}>
              {getProgressText()}
            </Text>
          </div>
        )}
        {status?.status === 'completed' && (
          <Text type="success" className={styles.statusText}>
            处理完成
          </Text>
        )}
      </div>

      <div className={styles.mainContent}>
        {/* 左侧：视频播放器和原文 */}
        <div className={styles.leftContent}>
          {/* 视频播放器 */}
          {showVideo && embedUrl ? (
            <Card title="视频" className={styles.videoCard}>
              <div className={styles.videoContainer}>
                <iframe
                  ref={iframeRef}
                  key={embedUrl} // 使用 key 强制重新加载 iframe（B站需要）
                  src={embedUrl || undefined}
                  className={styles.videoIframe}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Card>
          ) : (
            <Card title="视频" className={styles.videoCard}>
              <Skeleton.Image active className={styles.videoSkeleton} />
            </Card>
          )}

          {/* 视频原文 */}
          <Card title="视频原文" className={styles.transcriptCard}>
            {showSegments ? (
              isLoadingSegments ? (
                <div className={styles.loadingContainer}>
                  <Spin tip="加载原文中..." />
                </div>
              ) : segments.length > 0 ? (
                <div ref={segmentsContainerRef} className={styles.segmentsContainer}>
                  {segments.map((segment) => {
                    const segmentId = `segment-${segment.segmentIndex}`;
                    const isHighlighted = highlightedSegmentId === segmentId;
                    const segmentClasses = [
                      styles.segmentItem,
                      isHighlighted ? styles.segmentItemHighlighted : styles.segmentItemDefault,
                      segment.startTime === undefined ? styles.segmentItemNotClickable : '',
                    ].join(' ');
                    return (
                      <div
                        key={segment.id}
                        id={segmentId}
                        onClick={() => handleSegmentClick(segment)}
                        className={segmentClasses}
                      >
                        {segment.startTime !== undefined && segment.endTime !== undefined && (
                          <Text type="secondary" className={styles.segmentTime}>
                            [{formatTime(segment.startTime)} - {formatTime(segment.endTime)}]
                          </Text>
                        )}
                        <Text>{segment.text}</Text>
                      </div>
                    );
                  })}
                </div>
              ) : status?.status === 'completed' ? (
                <Empty description="暂无原文内容" />
              ) : (
                <Empty description="原文处理中..." />
              )
            ) : (
              <div className={styles.skeletonContainer}>
                <Skeleton active paragraph={{ rows: 8 }} />
                <div className={styles.skeletonText}>
                  <Text type="secondary">原文处理中，请稍候...</Text>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 右侧：知识点 */}
        <div>
          <KnowledgeCard
            documentId={id || ''}
            documentStatus={status?.status || document?.status}
          />
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
