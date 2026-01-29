import { useEffect, useRef, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { message, Card, Typography, Empty, Progress, Skeleton } from 'antd';
import { useDocument } from '@/hooks/useDocument';
import { getKnowledgePoints, type KnowledgePoint } from '@/api/knowledge';
import type { Segment } from '@/api/document';
import KnowledgeCard from './components/KnowledgeCard';
import styles from './VideoDocument.module.css';

const { Title, Text } = Typography;

export default function TextDocument() {
  const { id } = useParams<{ id: string }>();
  const segmentsContainerRef = useRef<HTMLDivElement>(null);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [highlightedCharRange, setHighlightedCharRange] = useState<{
    charStart: number;
    charEnd: number;
  } | null>(null);
  const [highlightedKnowledgePointId, setHighlightedKnowledgePointId] = useState<string | null>(
    null
  );
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);

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

  // 加载知识点列表（用于双向跳转）
  useEffect(() => {
    if (status?.status === 'completed' && id) {
      getKnowledgePoints(id)
        .then((points) => {
          setKnowledgePoints(points);
        })
        .catch((err) => {
          console.error('加载知识点失败:', err);
        });
    }
  }, [status?.status, id, document?.title]); // 当标题更新时也重新加载知识点

  const showSegments = useMemo(() => {
    // 原文在进度 >= 70% 或已完成时显示（片段在70%时已保存到数据库）
    // 或者如果已经有片段数据，直接显示
    return progress >= 70 || status?.status === 'completed' || segments.length > 0;
  }, [progress, status?.status, segments.length]);

  // 将segments按顺序组合（后端按换行符分割，每个segment可能是一行或一行的一部分）
  // 如果一行超过2000字符，会再分割成多个segment
  // 所以前端需要将连续的segment（charStart和charEnd连续）组合成完整的行
  const paragraphs = useMemo(() => {
    if (segments.length === 0) return [];

    const paragraphMap = new Map<number, Segment[]>();

    // 按charStart排序
    const sortedSegments = [...segments].sort((a, b) => (a.charStart || 0) - (b.charStart || 0));

    let currentParagraphIndex = 0;
    let lastCharEnd: number | null = null;
    const gapThreshold = 2; // 如果两个segment之间的间隔超过2个字符，认为是新行

    for (const segment of sortedSegments) {
      const charStart = segment.charStart || 0;
      const charEnd = segment.charEnd || charStart;

      // 如果当前segment的起始位置与上一个segment的结束位置间隔较大，认为是新行
      if (lastCharEnd !== null && charStart - lastCharEnd > gapThreshold) {
        currentParagraphIndex++;
      }

      if (!paragraphMap.has(currentParagraphIndex)) {
        paragraphMap.set(currentParagraphIndex, []);
      }
      paragraphMap.get(currentParagraphIndex)!.push(segment);

      lastCharEnd = charEnd;
    }

    // 转换为数组，每个元素是一行（可能包含多个segment）
    return Array.from(paragraphMap.values());
  }, [segments]);

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

  // 如果正在加载，显示加载状态
  if (isLoading || !document) {
    return (
      <div className={styles.container}>
        <Card>
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      </div>
    );
  }

  /**
   * 跳转到指定字符位置并高亮
   */
  const jumpToChar = (charStart: number, charEnd?: number) => {
    // 找到包含该字符位置的段落
    const targetParagraphIndex = paragraphs.findIndex((paragraphSegments) => {
      return paragraphSegments.some(
        (seg) =>
          seg.charStart !== undefined &&
          seg.charStart <= charStart &&
          seg.charEnd !== undefined &&
          seg.charEnd >= charStart
      );
    });

    if (targetParagraphIndex >= 0 && segmentsContainerRef.current) {
      const paragraphElement = window.document.getElementById(`paragraph-${targetParagraphIndex}`);
      if (paragraphElement && segmentsContainerRef.current) {
        // 计算目标元素相对于容器的位置
        const container = segmentsContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = paragraphElement.getBoundingClientRect();

        // 计算需要滚动的距离，使元素显示在容器中间偏上的位置（约1/3处）
        const scrollTop =
          container.scrollTop + elementRect.top - containerRect.top - containerRect.height / 3;

        container.scrollTo({
          top: scrollTop,
          behavior: 'smooth',
        });

        // 高亮段落中的第一个segment
        const firstSegment = paragraphs[targetParagraphIndex][0];
        highlightSegment(firstSegment.id, charStart, charEnd);
      }
    }
  };

  /**
   * 高亮指定片段
   */
  const highlightSegment = (segmentId: string, charStart?: number, charEnd?: number) => {
    setHighlightedSegmentId(segmentId);
    // 如果提供了字符位置，设置文本范围高亮
    if (charStart !== undefined && charEnd !== undefined) {
      setHighlightedCharRange({ charStart, charEnd });
    } else {
      setHighlightedCharRange(null);
    }
    setTimeout(() => {
      setHighlightedSegmentId(null);
      setHighlightedCharRange(null);
    }, 3000);
  };

  /**
   * 处理段落点击
   */
  const handleParagraphClick = (paragraphSegments: Segment[]) => {
    // 查找段落中所有segment关联的知识点
    const relatedKps = knowledgePoints.filter((kp) => {
      // 检查是否有segment匹配
      const hasMatchingSegment = paragraphSegments.some(
        (seg) => kp.sourceAnchor.segmentId === seg.id
      );
      if (hasMatchingSegment) {
        return true;
      }

      // 检查字符位置是否在知识点范围内（使用第一个segment的charStart）
      const firstSegment = paragraphSegments[0];
      if (
        firstSegment.charStart !== undefined &&
        kp.sourceAnchor.startOffset !== undefined &&
        kp.sourceAnchor.endOffset !== undefined
      ) {
        return (
          firstSegment.charStart >= kp.sourceAnchor.startOffset &&
          firstSegment.charStart <= kp.sourceAnchor.endOffset
        );
      }
      return false;
    });

    // 高亮第一个匹配的知识点
    if (relatedKps.length > 0) {
      setHighlightedKnowledgePointId(relatedKps[0].id);
      setTimeout(() => {
        setHighlightedKnowledgePointId(null);
      }, 3000);
    }
  };

  // 如果文档不是文本类型，显示错误
  if (document.sourceType !== 'text') {
    return (
      <div className={styles.containerError}>
        <Card>
          <Empty description="文档类型不匹配" />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 标题和进度条 */}
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          {document.title === '解析中...' || (status?.status === 'processing' && !document.title)
            ? '解析中...'
            : document.title || '文本文档'}
        </Title>
        {status?.status === 'processing' && (
          <div>
            <Progress
              percent={progress || 0}
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              format={(percent) => `${percent}%`}
            />
            {status?.message && (
              <Text type="secondary" className={styles.progressText}>
                {status.message}
              </Text>
            )}
          </div>
        )}
        {status?.status === 'completed' && (
          <Text type="success" className={styles.statusText}>
            处理完成
          </Text>
        )}
      </div>

      <div className={styles.mainContent}>
        {/* 左侧：原文内容 */}
        <div className={styles.leftContent}>
          <Card title="原文" className={styles.transcriptCard}>
            {isLoadingSegments && segments.length === 0 ? (
              <Skeleton active paragraph={{ rows: 10 }} />
            ) : showSegments && paragraphs.length > 0 ? (
              <div
                ref={segmentsContainerRef}
                className={styles.segmentsContainer}
              >
                {paragraphs.map((paragraphSegments, paragraphIndex) => {
                  // 检查段落中是否有高亮的segment
                  const hasHighlighted = paragraphSegments.some(
                    (seg) => highlightedSegmentId === seg.id
                  );

                  // 合并段落中所有segment的文本（保留换行符）
                  const paragraphText = paragraphSegments.map((seg) => seg.text).join('');

                  // 使用第一个segment的ID作为段落ID
                  const firstSegment = paragraphSegments[0];
                  const paragraphCharStart = firstSegment.charStart || 0;
                  const lastSegment = paragraphSegments[paragraphSegments.length - 1];
                  const paragraphCharEnd = lastSegment.charEnd || paragraphCharStart;

                  // 渲染带高亮的文本
                  const renderHighlightedText = () => {
                    if (!highlightedCharRange || !hasHighlighted) {
                      return paragraphText;
                    }

                    const { charStart, charEnd } = highlightedCharRange;

                    // 检查高亮范围是否在当前段落内
                    if (charStart > paragraphCharEnd || charEnd < paragraphCharStart) {
                      return paragraphText;
                    }

                    // 计算在当前段落中的相对位置
                    const relativeStart = Math.max(0, charStart - paragraphCharStart);
                    const relativeEnd = Math.min(
                      paragraphText.length,
                      charEnd - paragraphCharStart
                    );

                    if (relativeStart >= relativeEnd || relativeStart >= paragraphText.length) {
                      return paragraphText;
                    }

                    // 分割文本并添加高亮标记
                    const beforeText = paragraphText.substring(0, relativeStart);
                    const highlightText = paragraphText.substring(relativeStart, relativeEnd);
                    const afterText = paragraphText.substring(relativeEnd);

                    return (
                      <>
                        {beforeText}
                        <mark
                          style={{
                            backgroundColor: '#fff566',
                            padding: '2px 0',
                            borderRadius: '2px',
                          }}
                        >
                          {highlightText}
                        </mark>
                        {afterText}
                      </>
                    );
                  };

                  return (
                    <div
                      key={`paragraph-${paragraphIndex}-${firstSegment.id}`}
                      id={`paragraph-${paragraphIndex}`}
                      className={`${styles.segmentItem} ${hasHighlighted ? styles.segmentHighlighted : ''}`}
                      onClick={() => handleParagraphClick(paragraphSegments)}
                      style={{
                        padding: '12px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'background-color 0.3s',
                        whiteSpace: 'pre-wrap', // 保留换行符和空格
                        wordBreak: 'break-word', // 长单词自动换行
                      }}
                    >
                      {renderHighlightedText()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty description="原文加载中..." />
            )}
          </Card>
        </div>

        {/* 右侧：知识点和洞察 */}
        <div>
          <KnowledgeCard
            documentId={id || ''}
            documentStatus={status?.status || document?.status}
            segments={segments}
            progress={progress}
            onHighlightSegment={(segmentIndex) => {
              const segment = segments.find((seg) => seg.segmentIndex === segmentIndex);
              if (segment) {
                // 对于文本类型，如果有字符位置信息，使用字符范围高亮
                if (segment.charStart !== undefined && segment.charEnd !== undefined) {
                  highlightSegment(segment.id, segment.charStart, segment.charEnd);
                } else {
                  highlightSegment(segment.id);
                }
              }
            }}
            onJumpToChar={jumpToChar}
            highlightedKnowledgePointId={highlightedKnowledgePointId}
          />
        </div>
      </div>
    </div>
  );
}
