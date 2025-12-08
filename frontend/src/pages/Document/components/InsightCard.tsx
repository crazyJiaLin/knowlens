import { Typography, Button, Skeleton, message } from 'antd';
import { useState, useEffect, useRef } from 'react';
import { generateInsightStream, type Insight } from '@/api/insight';
import styles from './InsightCard.module.css';

const { Title, Text } = Typography;

interface InsightCardProps {
  knowledgePointId: string;
}

export default function InsightCard({
  knowledgePointId,
}: InsightCardProps) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKnowledgePointIdRef = useRef<string | null>(null);

  /**
   * 生成洞察（流式输出）
   */
  const handleGenerate = async (forceRegenerate = false) => {
    // 验证 knowledgePointId
    if (!knowledgePointId || typeof knowledgePointId !== 'string') {
      console.error('无效的知识点ID:', knowledgePointId);
      const errorMsg = '知识点ID无效';
      message.error(errorMsg);
      setError(errorMsg);
      return;
    }

    // 清除之前的错误
    setError(null);

    if (forceRegenerate) {
      setIsRegenerating(true);
    } else {
      setIsLoading(true);
    }

    // 初始化洞察状态（先设置为 null，让骨架屏显示）
    setInsight(null);

    try {
      await generateInsightStream(
        knowledgePointId,
        forceRegenerate,
        (chunk) => {
          // 实时更新洞察内容
          setInsight((prev) => {
            // 如果 prev 为 null，初始化一个空对象
            const current = prev || {
              logic: '',
              hiddenInfo: '',
              extensionOptional: '',
            };
            
            return {
              logic: chunk.logic !== undefined ? chunk.logic : current.logic,
              hiddenInfo:
                chunk.hiddenInfo !== undefined
                  ? chunk.hiddenInfo
                  : current.hiddenInfo,
              extensionOptional:
                chunk.extensionOptional !== undefined
                  ? chunk.extensionOptional
                  : current.extensionOptional,
            };
          });
        }
      );

      if (forceRegenerate) {
        message.success('洞察已重新生成');
      }
    } catch (error) {
      console.error('生成洞察失败:', error);
      const errorMsg =
        error instanceof Error ? error.message : '生成洞察失败，请稍后重试';
      message.error(errorMsg);
      setError(errorMsg);
      setInsight(null);
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  };

  // 组件挂载或 knowledgePointId 变化时自动加载洞察（如果已存在则直接返回，否则生成）
  useEffect(() => {
    // 如果 knowledgePointId 变化，重置状态并重新加载
    if (lastKnowledgePointIdRef.current !== knowledgePointId) {
      lastKnowledgePointIdRef.current = knowledgePointId;
      setInsight(null);
      setIsLoading(false);
      setIsRegenerating(false);
      setError(null);
      void handleGenerate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgePointId]);

  return (
    <div className={styles.insightCardWrapper}>
      <div className={styles.insightCard}>
        {error && !insight ? (
          // 生成失败时显示错误状态
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>⚠️</div>
            <Text type="danger" className={styles.errorTitle}>
              生成失败
            </Text>
            <Text type="secondary" className={styles.errorMessage}>
              {error}
            </Text>
            <Button
              type="primary"
              onClick={() => handleGenerate(false)}
              className={styles.retryButton}
            >
              重试
            </Button>
          </div>
        ) : (isLoading || isRegenerating) && !insight ? (
          // 初始加载时显示完整骨架屏
          <div className={styles.insightContent}>
            <div className={styles.insightSection}>
              <Skeleton.Input
                active
                size="small"
                style={{ width: 80, height: 20, marginBottom: 8 }}
              />
              <Skeleton
                active
                paragraph={{ rows: 3, width: ['100%', '100%', '90%'] }}
              />
            </div>
            <div className={styles.insightSection}>
              <Skeleton.Input
                active
                size="small"
                style={{ width: 80, height: 20, marginBottom: 8 }}
              />
              <Skeleton
                active
                paragraph={{ rows: 2, width: ['100%', '95%'] }}
              />
            </div>
            <div className={styles.insightSection}>
              <Skeleton.Input
                active
                size="small"
                style={{ width: 80, height: 20, marginBottom: 8 }}
              />
              <Skeleton
                active
                paragraph={{ rows: 2, width: ['100%', '90%'] }}
              />
            </div>
          </div>
        ) : insight ? (
          // 显示洞察内容，流式生成过程中未完成的部分显示完整骨架屏（包括标题）
          <div className={styles.insightContent}>
            {/* 逻辑演绎 */}
            {insight.logic ? (
              <div className={styles.insightSection}>
                <Title level={5} className={styles.sectionTitle}>
                  逻辑演绎
                </Title>
                <Text className={styles.sectionContent}>{insight.logic}</Text>
              </div>
            ) : (isLoading || isRegenerating) ? (
              <div className={styles.insightSection}>
                <Skeleton.Input
                  active
                  size="small"
                  style={{ width: 80, height: 20, marginBottom: 8 }}
                />
                <Skeleton
                  active
                  paragraph={{ rows: 3, width: ['100%', '100%', '90%'] }}
                />
              </div>
            ) : null}

            {/* 隐含信息 */}
            {insight.hiddenInfo ? (
              <div className={styles.insightSection}>
                <Title level={5} className={styles.sectionTitle}>
                  隐含信息
                </Title>
                <Text className={styles.sectionContent}>
                  {insight.hiddenInfo}
                </Text>
              </div>
            ) : (isLoading || isRegenerating) ? (
              <div className={styles.insightSection}>
                <Skeleton.Input
                  active
                  size="small"
                  style={{ width: 80, height: 20, marginBottom: 8 }}
                />
                <Skeleton
                  active
                  paragraph={{ rows: 2, width: ['100%', '95%'] }}
                />
              </div>
            ) : null}

            {/* 延伸思考 */}
            {insight.extensionOptional ? (
              <div className={styles.insightSection}>
                <Title level={5} className={styles.sectionTitle}>
                  延伸思考
                </Title>
                <Text className={styles.sectionContent}>
                  {insight.extensionOptional}
                </Text>
              </div>
            ) : (isLoading || isRegenerating) ? (
              <div className={styles.insightSection}>
                <Skeleton.Input
                  active
                  size="small"
                  style={{ width: 80, height: 20, marginBottom: 8 }}
                />
                <Skeleton
                  active
                  paragraph={{ rows: 2, width: ['100%', '90%'] }}
                />
              </div>
            ) : null}

            {!isLoading && !isRegenerating && (
              <div className={styles.insightActions}>
                <Button
                  type="default"
                  onClick={() => handleGenerate(true)}
                  loading={isRegenerating}
                >
                  {isRegenerating ? '重新生成中...' : '重新生成'}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

