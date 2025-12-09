import { Card, Typography, Empty, Spin, Skeleton, Button } from 'antd';
import { useEffect, useState } from 'react';
import { getKnowledgePoints, type KnowledgePoint } from '@/api/knowledge';
import type { Segment } from '@/api/document';
import InsightCard from './InsightCard';
import styles from './KnowledgeCard.module.css';

const { Text, Title } = Typography;

interface KnowledgeCardProps {
  documentId: string;
  documentStatus?: 'processing' | 'completed' | 'failed';
  segments?: Segment[];
  progress?: number;
  onJumpToTime?: (seconds: number) => void;
  onHighlightSegment?: (segmentIndex: number) => void;
  highlightedKnowledgePointId?: string | null;
}

export default function KnowledgeCard({
  documentId,
  documentStatus,
  segments = [],
  progress = 0,
  onJumpToTime,
  onHighlightSegment,
  highlightedKnowledgePointId,
}: KnowledgeCardProps) {
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // 使用 Set 来跟踪多个知识点的展开状态，每个知识点独立
  const [expandedInsightIds, setExpandedInsightIds] = useState<Set<string>>(
    new Set()
  );

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
        console.log('加载的知识点数据:', points);
        // 确保每个知识点都有 id 字段
        const transformedPoints = points.map((point) => ({
          ...point,
          id: point.id || (point as { _id?: { toString: () => string } })._id?.toString() || '',
        }));
        console.log('转换后的知识点数据:', transformedPoints);
        setKnowledgePoints(transformedPoints);
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
    // 如果进度 >= 70%，说明原文已处理完成，正在生成知识点
    const waitingText =
      progress >= 70 ? '正在生成知识点...' : '等待原文处理完成...';
    
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <div>
          <Skeleton active paragraph={{ rows: 6 }} />
          <div className={styles.knowledgeLoadingContainer}>
            <Text type="secondary">{waitingText}</Text>
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

  // 如果没有知识点，显示空状态或错误提示
  if (knowledgePoints.length === 0) {
    // 检查是否是生成失败（文档已完成但无知识点）
    const isGenerationFailed =
      documentStatus === 'completed' && !isLoading && !error;
    
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <Empty
          description={
            isGenerationFailed
              ? '知识点生成失败，可能是内容过长导致。请尝试重新生成或联系管理员。'
              : '知识点生成中，请稍候...'
          }
        />
      </Card>
    );
  }

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
   * 处理洞察按钮点击
   */
  const handleInsightClick = (point: KnowledgePoint, e: React.MouseEvent) => {
    e.stopPropagation();
    // 切换当前知识点的展开状态，不影响其他知识点
    setExpandedInsightIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(point.id)) {
        newSet.delete(point.id);
      } else {
        newSet.add(point.id);
      }
      return newSet;
    });
  };


  // 显示知识点列表（保持原始顺序）
  return (
    <Card title="知识点" className={styles.knowledgeCard}>
      <div className={styles.knowledgePointsContainer}>
        {knowledgePoints.map((point, index) => {
          const isHighlighted = highlightedKnowledgePointId === point.id;
          const isExpanded = expandedInsightIds.has(point.id);

          return (
            <div key={point.id} className={styles.knowledgePointItem}>
              <div
                className={`${styles.knowledgePointCard} ${
                  isHighlighted ? styles.knowledgePointCardHighlighted : ''
                } ${isExpanded ? styles.knowledgePointCardExpanded : ''}`}
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
                    {point.excerpt}{' '}
                    <span className={styles.knowledgePointBadge}>
                      [{index + 1}]
                    </span>
                  </Text>
                  <div className={styles.insightButtonWrapper}>
                    <Button
                      type={isExpanded ? 'default' : 'link'}
                      size="small"
                      className={styles.insightButton}
                      onClick={(e) => handleInsightClick(point, e)}
                    >
                      {isExpanded ? '收起' : '洞察'}
                    </Button>
                  </div>
                </div>

                {/* 嵌入的洞察内容 */}
                {isExpanded && (
                  <div className={styles.insightContentWrapper}>
                    <InsightCard knowledgePointId={point.id} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
