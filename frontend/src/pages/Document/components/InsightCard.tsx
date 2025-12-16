import { Typography, Button, Skeleton, message, Modal, Space } from 'antd';
import { useState, useEffect, useRef } from 'react';
import { generateInsightStream, getInsight, type Insight } from '@/api/insight';
import type { SourceAnchor } from '@/api/knowledge';
import styles from './InsightCard.module.css';

const { Title, Text } = Typography;

interface InsightCardProps {
  knowledgePointId: string;
  onJumpToChar?: (charStart: number, charEnd?: number) => void;
  sourceAnchor?: SourceAnchor;
}

export default function InsightCard({
  knowledgePointId,
  onJumpToChar,
  sourceAnchor,
}: InsightCardProps) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [isBackgroundMode, setIsBackgroundMode] = useState(false);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const lastKnowledgePointIdRef = useRef<string | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * 格式化时间（毫秒转秒）
   */
  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  /**
   * 检查洞察是否生成完成（轮询）
   */
  const checkInsightStatus = async () => {
    if (!knowledgePointId) return;

    try {
      const existingInsight = await getInsight(knowledgePointId);
      
      if (existingInsight && (existingInsight.logic || existingInsight.hiddenInfo || existingInsight.extensionOptional)) {
        // 如果获取到洞察，停止轮询
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
        setIsBackgroundMode(false);
        setInsight(existingInsight);
        message.success('洞察生成完成！');
      }
    } catch (error) {
      console.error('检查洞察状态失败:', error);
    }
  };

  /**
   * 生成洞察（流式输出）
   */
  const handleGenerate = async (forceRegenerate = false, continueWaiting = false) => {
    // 验证 knowledgePointId
    if (!knowledgePointId || typeof knowledgePointId !== 'string') {
      console.error('无效的知识点ID:', knowledgePointId);
      const errorMsg = '知识点ID无效';
      message.error(errorMsg);
      setError(errorMsg);
      return;
    }

    // 清除之前的错误和定时器
    setError(null);
    setShowTimeoutModal(false);
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    // 如果选择继续等待，关闭模态框
    if (continueWaiting) {
      setShowTimeoutModal(false);
    }

    // 如果选择后台生成，设置后台模式
    if (!continueWaiting && showTimeoutModal) {
      setIsBackgroundMode(true);
      setShowTimeoutModal(false);
      // 不取消请求，让它在后台继续执行
      // 开始轮询检查
      pollingTimerRef.current = setInterval(checkInsightStatus, 2000);
      message.info('已切换到后台生成，完成后会通知您');
      // 继续等待请求完成，但不显示加载状态
      setIsLoading(false);
      setIsRegenerating(false);
      return;
    }

    if (forceRegenerate) {
      setIsRegenerating(true);
    } else {
      setIsLoading(true);
    }

    setIsBackgroundMode(false);
    setGenerationStartTime(Date.now());

    // 初始化洞察状态（先设置为 null，让骨架屏显示）
    setInsight(null);

    // 设置3秒超时提示
    timeoutTimerRef.current = setTimeout(() => {
      if (isLoading || isRegenerating) {
        setShowTimeoutModal(true);
      }
    }, 3000);

    try {
      await generateInsightStream(
        knowledgePointId,
        forceRegenerate,
        (chunk) => {
          // 清除超时提示（如果已经开始接收数据）
          if (timeoutTimerRef.current) {
            clearTimeout(timeoutTimerRef.current);
            timeoutTimerRef.current = null;
            setShowTimeoutModal(false);
          }

          // 实时更新洞察内容
          setInsight((prev) => {
            const current = prev || {
              logic: '',
              hiddenInfo: '',
              extensionOptional: '',
            };

            const updated: Insight = {
              logic: chunk.logic !== undefined ? chunk.logic : current.logic,
              hiddenInfo:
                chunk.hiddenInfo !== undefined
                  ? chunk.hiddenInfo
                  : current.hiddenInfo,
              extensionOptional:
                chunk.extensionOptional !== undefined
                  ? chunk.extensionOptional
                  : current.extensionOptional,
              tokensUsed: chunk.tokensUsed !== undefined ? chunk.tokensUsed : current.tokensUsed,
              generationTimeMs: chunk.generationTimeMs !== undefined 
                ? chunk.generationTimeMs 
                : current.generationTimeMs,
            };

            return updated;
          });
        }
      );

      // 更新最终耗时
      if (generationStartTime) {
        const finalTime = Date.now() - generationStartTime;
        setInsight((prev) => {
          if (prev) {
            return { ...prev, generationTimeMs: finalTime };
          }
          return prev;
        });
      }

      if (forceRegenerate) {
        message.success('洞察已重新生成');
      }
    } catch (error) {
      // 如果是后台模式，不显示错误（继续轮询）
      if (isBackgroundMode) {
        return;
      }

      console.error('生成洞察失败:', error);
      const errorMsg =
        error instanceof Error ? error.message : '生成洞察失败，请稍后重试';
      message.error(errorMsg);
      setError(errorMsg);
      setInsight(null);
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
      setGenerationStartTime(null);
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
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
      setIsBackgroundMode(false);
      setShowTimeoutModal(false);
      void handleGenerate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgePointId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  return (
    <>
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
          ) : isBackgroundMode ? (
            // 后台生成模式
            <div className={styles.insightContent}>
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">正在后台生成洞察，请稍候...</Text>
                <div style={{ marginTop: 12 }}>
                  <Button
                    type="link"
                    onClick={() => {
                      setIsBackgroundMode(false);
                      if (pollingTimerRef.current) {
                        clearInterval(pollingTimerRef.current);
                        pollingTimerRef.current = null;
                      }
                      void handleGenerate(false);
                    }}
                  >
                    取消后台生成
                  </Button>
                </div>
              </div>
            </div>
          ) : insight ? (
            // 显示洞察内容，流式生成过程中未完成的部分显示完整骨架屏（包括标题）
            <div className={styles.insightContent}>
              {/* 生成统计信息 */}
              {(insight.generationTimeMs !== undefined || insight.tokensUsed !== undefined) && (
                <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                  <Space size="middle" style={{ fontSize: 12 }}>
                    {insight.generationTimeMs !== undefined && (
                      <Text type="secondary">
                        耗时: {formatTime(insight.generationTimeMs)}
                      </Text>
                    )}
                    {insight.tokensUsed !== undefined && (
                      <Text type="secondary">
                        Token: {insight.tokensUsed.toLocaleString()}
                      </Text>
                    )}
                  </Space>
                </div>
              )}

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
                  <Text 
                    className={styles.sectionContent}
                    style={onJumpToChar && sourceAnchor?.type === 'text' ? { cursor: 'pointer' } : {}}
                    onClick={() => {
                      if (onJumpToChar && sourceAnchor?.type === 'text' && sourceAnchor.startOffset !== undefined) {
                        onJumpToChar(sourceAnchor.startOffset, sourceAnchor.endOffset);
                      }
                    }}
                  >
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
                  <Text 
                    className={styles.sectionContent}
                    style={onJumpToChar && sourceAnchor?.type === 'text' ? { cursor: 'pointer' } : {}}
                    onClick={() => {
                      if (onJumpToChar && sourceAnchor?.type === 'text' && sourceAnchor.startOffset !== undefined) {
                        onJumpToChar(sourceAnchor.startOffset, sourceAnchor.endOffset);
                      }
                    }}
                  >
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

      {/* 3秒超时提示模态框 */}
      <Modal
        open={showTimeoutModal}
        title="生成时间较长"
        footer={null}
        closable={false}
        maskClosable={false}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>洞察生成已超过3秒，可能需要更长时间。</Text>
        </div>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button
            onClick={() => {
              setShowTimeoutModal(false);
              setIsBackgroundMode(true);
              // 不取消请求，让它在后台继续执行
              // 开始轮询检查
              pollingTimerRef.current = setInterval(checkInsightStatus, 2000);
              message.info('已切换到后台生成，完成后会通知您');
              // 继续等待请求完成，但不显示加载状态
              setIsLoading(false);
              setIsRegenerating(false);
            }}
          >
            后台生成
          </Button>
          <Button
            type="primary"
            onClick={() => handleGenerate(false, true)}
          >
            继续等待
          </Button>
        </Space>
      </Modal>
    </>
  );
}
