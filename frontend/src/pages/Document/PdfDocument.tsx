import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Empty, Progress, Skeleton, Typography, message, Button, InputNumber } from 'antd';
import { Document as PdfViewer, Page, pdfjs } from 'react-pdf';
import { useDocument } from '@/hooks/useDocument';
import KnowledgeCard from './components/KnowledgeCard';
import styles from './PdfDocument.module.css';
import 'react-pdf/src/Page/AnnotationLayer.css';
import 'react-pdf/src/Page/TextLayer.css';

// 配置 pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const { Title, Text } = Typography;

export default function PdfDocument() {
  const { id } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number | undefined>(undefined);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [anchorInfo, setAnchorInfo] = useState<{
    page: number;
    startOffset?: number;
    endOffset?: number;
  } | null>(null);

  const { document, segments, status, progress, isLoading, error } = useDocument(id || null, {
    enabled: !!id,
    autoPoll: true,
    pollInterval: 2000,
  });

  useEffect(() => {
    if (error) {
      message.error(error.message || '加载文档失败');
    }
  }, [error]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setPageWidth(Math.min(entry.contentRect.width - 24, 900));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const showPdf = useMemo(() => {
    if (!document) return false;
    return !!document.originalUrl;
  }, [document]);

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

  if (isLoading || !document) {
    return (
      <div className={styles.container}>
        <Card>
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      </div>
    );
  }

  if (document.sourceType !== 'pdf') {
    return (
      <div className={styles.containerError}>
        <Card>
          <Empty description="文档类型不匹配" />
        </Card>
      </div>
    );
  }

  const isProcessing = status?.status === 'processing';
  const progressPercent = progress || 0;

  const getProgressText = (): string => {
    if (!isProcessing) {
      return '处理完成';
    }
    if (status?.message) {
      return status.message;
    }
    return '处理中...';
  };

  const handleDocumentLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    console.log('PDF 加载成功，总页数:', total);
    setNumPages(total);
    if (pageNumber > total) {
      setPageNumber(1);
    }
  };

  const handleDocumentLoadError = (error: Error) => {
    console.error('PDF 加载失败:', error);
    console.error('PDF URL:', document?.originalUrl);
    message.error('PDF 加载失败，请检查文件是否存在');
  };

  const jumpToPdfAnchor = (page: number, startOffset?: number, endOffset?: number) => {
    if (!page) return;
    setPageNumber(page);
    setAnchorInfo({ page, startOffset, endOffset });
    setTimeout(() => {
      setAnchorInfo(null);
    }, 3000);
  };

  const handlePageInputChange = (value: number | null) => {
    if (!value) return;
    const next = Math.min(Math.max(1, value), numPages || 1);
    setPageNumber(next);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          {document.title || 'PDF 文档'}
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
      </div>

      <div className={styles.mainContent}>
        <div className={styles.leftContent} ref={containerRef}>
          <Card title="PDF 原文" className={styles.pdfCard}>
            <div className={styles.pdfControls}>
              <div>
                <Button
                  size="small"
                  onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                  disabled={pageNumber <= 1}
                >
                  上一页
                </Button>
                <Button
                  size="small"
                  style={{ marginLeft: 8 }}
                  onClick={() => setPageNumber((prev) => Math.min(numPages || 1, prev + 1))}
                  disabled={pageNumber >= (numPages || 1)}
                >
                  下一页
                </Button>
              </div>
              <div>
                <Text>
                  第{' '}
                  <InputNumber
                    min={1}
                    max={numPages || 1}
                    size="small"
                    value={pageNumber}
                    onChange={handlePageInputChange}
                    style={{ width: 80 }}
                  />{' '}
                  / {numPages || '-'} 页
                </Text>
              </div>
            </div>

            <div className={styles.pdfViewer}>
              {!showPdf ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <PdfViewer
                  file={{
                    url: document.originalUrl,
                    httpHeaders: {
                      Accept: 'application/pdf',
                    },
                    withCredentials: false,
                  }}
                  onLoadSuccess={handleDocumentLoadSuccess}
                  onLoadError={handleDocumentLoadError}
                  loading={<Skeleton active paragraph={{ rows: 6 }} />}
                  options={{
                    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                    cMapPacked: true,
                    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
                  }}
                >
                  <div className={styles.pdfPageWrapper}>
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      className={
                        anchorInfo?.page === pageNumber ? styles.pdfPageHighlight : undefined
                      }
                    />
                  </div>
                </PdfViewer>
              )}
            </div>
            {anchorInfo && (
              <div className={styles.anchorHint}>
                已定位到第 {anchorInfo.page} 页
                {anchorInfo.startOffset !== undefined && <>（偏移 {anchorInfo.startOffset}）</>}
              </div>
            )}
          </Card>
        </div>

        <KnowledgeCard
          documentId={document.id}
          documentStatus={status?.status}
          segments={segments}
          progress={progress}
          onJumpToPdf={jumpToPdfAnchor}
          highlightedKnowledgePointId={null}
        />
      </div>
    </div>
  );
}
