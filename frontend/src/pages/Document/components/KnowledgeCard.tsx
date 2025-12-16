import { Card, Typography, Empty, Spin, Skeleton, Button, message } from 'antd';
import { useEffect, useState, useRef } from 'react';
import {
  getKnowledgePoints,
  regenerateKnowledgePoints,
  type KnowledgePoint,
} from '@/api/knowledge';
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
  onJumpToChar?: (charStart: number, charEnd?: number) => void;
  highlightedKnowledgePointId?: string | null;
}

export default function KnowledgeCard({
  documentId,
  documentStatus,
  segments = [],
  progress = 0,
  onJumpToTime,
  onHighlightSegment,
  onJumpToChar,
  highlightedKnowledgePointId,
}: KnowledgeCardProps) {
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // 使用 Set 来跟踪多个知识点的展开状态，每个知识点独立
  const [expandedInsightIds, setExpandedInsightIds] = useState<Set<string>>(
    new Set()
  );
  // 用于存储轮询定时器，以便清理
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 只有在文档处理完成后才加载知识点
    if (documentStatus !== 'completed' || !documentId) {
      return;
    }

    void loadKnowledgePoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, documentStatus]);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * 重新生成知识点
   */
  const handleRegenerate = async () => {
    if (!documentId) {
      message.error('文档ID无效');
      return;
    }

    setIsRegenerating(true);
    setError(null);
    setKnowledgePoints([]);

    try {
      await regenerateKnowledgePoints(documentId);
      message.success('知识点重新生成任务已提交，请稍候...');
      
      // 等待一段时间后重新加载知识点
      // 由于是异步任务，需要轮询检查
      // 先清理之前的轮询
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      let checkCount = 0;
      const maxChecks = 30; // 最多检查30次（60秒）
      pollingIntervalRef.current = setInterval(async () => {
        checkCount++;
        try {
          const points = await getKnowledgePoints(documentId);
          if (points && points.length > 0) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            const transformedPoints = points.map((point) => ({
              ...point,
              id:
                point.id ||
                (point as { _id?: { toString: () => string } })._id?.toString() ||
                '',
            }));
            setKnowledgePoints(transformedPoints);
            setIsRegenerating(false);
            message.success('知识点生成完成！');
            return;
          }
        } catch {
          // 继续等待
        }

        // 达到最大检查次数，停止轮询
        if (checkCount >= maxChecks) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIsRegenerating(false);
          // 重新加载一次
          void loadKnowledgePoints();
        }
      }, 2000); // 每2秒检查一次
    } catch (err) {
      console.error('重新生成知识点失败:', err);
      const errorMsg =
        err instanceof Error ? err.message : '重新生成知识点失败，请稍后重试';
      message.error(errorMsg);
      setError(err instanceof Error ? err : new Error(errorMsg));
      setIsRegenerating(false);
    }
  };

  /**
   * 加载知识点
   */
  const loadKnowledgePoints = async () => {
    if (documentStatus !== 'completed' || !documentId) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const points = await getKnowledgePoints(documentId);
      console.log('加载的知识点数据:', points);
      // 确保每个知识点都有 id 字段
      const transformedPoints = points.map((point) => ({
        ...point,
        id:
          point.id ||
          (point as { _id?: { toString: () => string } })._id?.toString() ||
          '',
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

  // 如果正在加载或重新生成，显示加载状态
  if (isLoading || isRegenerating) {
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <div className={styles.loadingContainer}>
          <Spin tip={isRegenerating ? '正在重新生成知识点...' : '加载知识点中...'} />
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
      documentStatus === 'completed' && !isLoading && !isRegenerating && !error;
    
    return (
      <Card title="知识点" className={styles.knowledgeCard}>
        <Empty
          description={
            isGenerationFailed
              ? '知识点生成失败，请重试'
              : '知识点生成中，请稍候...'
          }
        >
          {isGenerationFailed && (
            <Button type="primary" onClick={handleRegenerate}>
              重新生成
            </Button>
          )}
        </Empty>
      </Card>
    );
  }

  /**
   * 处理角标点击
   */
  const handleBadgeClick = (point: KnowledgePoint) => {
    console.log('handleBadgeClick', point);
    const { sourceAnchor } = point;

    // 文本类型：跳转到字符位置
    if (sourceAnchor.type === 'text' && sourceAnchor.startOffset !== undefined && onJumpToChar) {
      onJumpToChar(sourceAnchor.startOffset, sourceAnchor.endOffset);
      return;
    }

    // 视频类型：跳转到视频时间
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
                    <InsightCard
                      knowledgePointId={point.id}
                      onJumpToChar={onJumpToChar}
                      sourceAnchor={point.sourceAnchor}
                    />
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
