import { Card, Typography, Empty, Spin, Skeleton } from 'antd';
import { useEffect, useState } from 'react';
import { getKnowledgePoints, type KnowledgePoint } from '@/api/knowledge';
import styles from './KnowledgeCard.module.css';

const { Text, Title } = Typography;

interface KnowledgeCardProps {
  documentId: string;
  documentStatus?: 'processing' | 'completed' | 'failed';
}

export default function KnowledgeCard({
  documentId,
  documentStatus,
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

  // 显示知识点列表
  return (
    <Card title="知识点" className={styles.knowledgeCard}>
      <div className={styles.knowledgePointsContainer}>
        {knowledgePoints.map((point, index) => (
          <div key={point.id} className={styles.knowledgePointCard}>
            <div className={styles.knowledgePointHeader}>
              <Title level={5} className={styles.knowledgePointTopic}>
                {point.topic}
              </Title>
              <span className={styles.knowledgePointBadge}>
                [{index + 1}]
              </span>
            </div>
            <Text className={styles.knowledgePointExcerpt}>
              {point.excerpt}
            </Text>
            {point.confidenceScore !== undefined && (
              <div className={styles.knowledgePointMeta}>
                <Text type="secondary" className={styles.confidenceScore}>
                  置信度: {(point.confidenceScore * 100).toFixed(0)}%
                </Text>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

