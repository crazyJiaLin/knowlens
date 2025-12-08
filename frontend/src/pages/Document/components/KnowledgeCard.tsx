import { Card, Typography, Empty, Spin, Skeleton, Button } from 'antd';
import { useEffect, useState } from 'react';
import { getKnowledgePoints, type KnowledgePoint } from '@/api/knowledge';
import type { Segment } from '@/api/document';
import styles from './KnowledgeCard.module.css';

const { Text, Title } = Typography;

interface KnowledgeCardProps {
  documentId: string;
  documentStatus?: 'processing' | 'completed' | 'failed';
  segments?: Segment[];
  onJumpToTime?: (seconds: number) => void;
  onHighlightSegment?: (segmentIndex: number) => void;
  highlightedKnowledgePointId?: string | null;
}

export default function KnowledgeCard({
  documentId,
  documentStatus,
  segments = [],
  onJumpToTime,
  onHighlightSegment,
  highlightedKnowledgePointId,
}: KnowledgeCardProps) {
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 只有在文档处理完成后才加载知识点
    if (documentStatus !== 'completed' || !documentId) {
      return;
    }

    const loadKnowledgePoints = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const points = await getKnowledgePoints(documentId);
        setKnowledgePoints(points);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('加载知识点失败'));
        console.error('加载知识点失败:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadKnowledgePoints();
  }, [documentId, documentStatus]);

  // 如果文档还在处理中，显示等待状态
  if (documentStatus !== 'completed') {
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <div>
          <Skeleton active paragraph={{ rows: 6 }} />
          <div className={styles.knowledgeLoadingContainer}>
            <Text type="secondary">等待原文处理完成...</Text>
          </div>
        </div>
      </Card>
    );
  }

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <div className={styles.loadingContainer}>
          <Spin tip="加载知识点中..." />
        </div>
      </Card>
    );
  }

  // 如果加载失败，显示错误信息
  if (error) {
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <Empty description={error.message || '加载知识点失败'} />
      </Card>
    );
  }

  // 如果没有知识点，显示空状态
  if (knowledgePoints.length === 0) {
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <Empty description="知识点生成中，请稍候..." />
      </Card>
    );
  }

  /**
   * 获取知识点的上下文文本（前后1-2个segment）
   */
  const getContextText = (point: KnowledgePoint): string => {
    if (!point.sourceAnchor.segmentId || segments.length === 0) {
      return point.excerpt;
    }

    // 查找对应的segment
    const targetSegment = segments.find((seg) => seg.id === point.sourceAnchor.segmentId);

    if (!targetSegment) {
      return point.excerpt;
    }

    const segmentIndex = targetSegment.segmentIndex;
    const contextSegments: Segment[] = [];

    // 获取前1-2个segment
    for (let i = Math.max(0, segmentIndex - 2); i < segmentIndex; i++) {
      if (segments[i]) {
        contextSegments.push(segments[i]);
      }
    }

    // 添加当前segment
    contextSegments.push(targetSegment);

    // 获取后1-2个segment
    for (let i = segmentIndex + 1; i <= Math.min(segments.length - 1, segmentIndex + 2); i++) {
      if (segments[i]) {
        contextSegments.push(segments[i]);
      }
    }

    return contextSegments.map((seg) => seg.text).join(' ');
  };

  /**
   * 处理角标点击
   */
  const handleBadgeClick = (point: KnowledgePoint) => {
    console.log('handleBadgeClick', point);
    const { sourceAnchor } = point;

    // 跳转到视频时间
    if (sourceAnchor.startTime !== undefined && onJumpToTime) {
      onJumpToTime(sourceAnchor.startTime);
    }

    // 高亮对应的segment
    if (sourceAnchor.segmentId && onHighlightSegment) {
      const targetSegment = segments.find((seg) => seg.id === sourceAnchor.segmentId);
      if (targetSegment) {
        onHighlightSegment(targetSegment.segmentIndex);
      }
    }
  };

  /**
   * 处理原文点击
   */
  const handleExcerptClick = (point: KnowledgePoint) => {
    handleBadgeClick(point);
  };

  /**
   * 处理洞察按钮点击 - 打印所有信息
   */
  const handleInsightClick = (point: KnowledgePoint, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('知识点完整信息:', {
      id: point.id,
      topic: point.topic,
      excerpt: point.excerpt,
      confidenceScore: point.confidenceScore,
      sourceAnchor: point.sourceAnchor,
      contextText: getContextText(point),
      fullPoint: point,
    });
  };

  // 显示知识点列表
  return (
    <Card title="知识点" className={styles.knowledgeCard}>
      <div className={styles.knowledgePointsContainer}>
        {knowledgePoints.map((point, index) => {
          const isHighlighted = highlightedKnowledgePointId === point.id;

          return (
            <div
              key={point.id}
              className={`${styles.knowledgePointCard} ${
                isHighlighted ? styles.knowledgePointCardHighlighted : ''
              }`}
            >
              <div className={styles.knowledgePointHeader}>
                <Title level={5} className={styles.knowledgePointTopic}>
                  {point.topic}
                </Title>
              </div>
              <div className={styles.knowledgePointExcerptWrapper}>
                <Text
                  className={styles.knowledgePointExcerpt}
                  onClick={() => handleExcerptClick(point)}
                >
                  {point.excerpt} <span className={styles.knowledgePointBadge}>[{index + 1}]</span>
                </Text>
                <div className={styles.insightButtonWrapper}>
                  <Button
                    type="link"
                    size="small"
                    className={styles.insightButton}
                    onClick={(e) => handleInsightClick(point, e)}
                  >
                    洞察
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
