import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Input,
  Button,
  Tag,
  Space,
  Typography,
  Empty,
  Popconfirm,
  message,
  Select,
  Spin,
  Progress,
} from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  FilePdfOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getDocumentList, deleteDocument, getDocumentStatus, type Document, type QueryDocumentParams, type DocumentStatus } from '@/api/document';
import dayjs from 'dayjs';
import styles from './index.module.css';

const { Text, Title } = Typography;
const { Search } = Input;
const { Option } = Select;

interface DocumentWithProgress extends Document {
  progress?: number;
  progressMessage?: string;
}

export default function Records() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [keyword, setKeyword] = useState('');
  const [sourceType, setSourceType] = useState<'video' | 'pdf' | 'text' | undefined>(undefined);
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed' | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const pollingIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // 加载文档列表（追加模式）
  const loadDocuments = useCallback(async (pageNum: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const params: QueryDocumentParams = {
        page: pageNum,
        pageSize,
        keyword: keyword || undefined,
        sourceType,
        status,
      };
      const response = await getDocumentList(params);
      
      if (append) {
        setDocuments((prev) => [...prev, ...response.items]);
      } else {
        setDocuments(response.items);
      }
      
      // 判断是否还有更多数据
      setHasMore(response.items.length === pageSize && response.items.length > 0);
    } catch (error) {
      console.error('加载文档列表失败:', error);
      message.error('加载文档列表失败，请稍后重试');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [keyword, sourceType, status, pageSize]);

  // 初始加载和筛选条件变化时重新加载
  useEffect(() => {
    setPage(1);
    setDocuments([]);
    setHasMore(true);
    void loadDocuments(1, false);
  }, [keyword, sourceType, status, loadDocuments]);

  // 无限滚动：监听滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          void loadDocuments(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadingMore, page, loadDocuments]);

  // 轮询处理中文档的状态
  useEffect(() => {
    const processingDocs = documents.filter((doc) => doc.status === 'processing');
    const intervalsMap = pollingIntervalsRef.current;
    
    // 清理不再需要轮询的文档
    intervalsMap.forEach((interval, docId) => {
      if (!processingDocs.find((doc) => doc.id === docId)) {
        clearInterval(interval);
        intervalsMap.delete(docId);
      }
    });

    // 为处理中的文档启动轮询
    processingDocs.forEach((doc) => {
      if (!intervalsMap.has(doc.id)) {
        const interval = setInterval(async () => {
          try {
            const status: DocumentStatus = await getDocumentStatus(doc.id);
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === doc.id
                  ? {
                      ...d,
                      status: status.status,
                      progress: status.progress,
                      progressMessage: status.message,
                      errorMessage: status.errorMessage,
                    }
                  : d
              )
            );

            // 如果状态不再是processing，停止轮询
            if (status.status !== 'processing') {
              clearInterval(interval);
              intervalsMap.delete(doc.id);
            }
          } catch (error) {
            console.error(`轮询文档 ${doc.id} 状态失败:`, error);
          }
        }, 2000); // 每2秒轮询一次

        intervalsMap.set(doc.id, interval);
      }
    });

    // 清理函数
    return () => {
      intervalsMap.forEach((interval) => {
        clearInterval(interval);
      });
      intervalsMap.clear();
    };
  }, [documents]);

  // 删除文档
  const handleDelete = async (documentId: string) => {
    try {
      await deleteDocument(documentId);
      message.success('删除成功');
      // 从列表中移除已删除的文档
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (error) {
      console.error('删除文档失败:', error);
      message.error('删除失败，请稍后重试');
    }
  };

  // 跳转到文档详情页
  const handleClickDocument = (documentId: string) => {
    navigate(`/document/${documentId}`);
  };

  // 获取文档类型图标
  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <VideoCameraOutlined />;
      case 'pdf':
        return <FilePdfOutlined />;
      case 'text':
        return <FileTextOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  // 获取文档类型标签颜色
  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'blue';
      case 'pdf':
        return 'red';
      case 'text':
        return 'green';
      default:
        return 'default';
    }
  };

  // 获取状态标签
  const getStatusTag = (docStatus: string) => {
    switch (docStatus) {
      case 'processing':
        return (
          <Tag icon={<ClockCircleOutlined />} color="processing">
            生成中
          </Tag>
        );
      case 'completed':
        return <Tag color="success">已完成</Tag>;
      case 'failed':
        return <Tag color="error">失败</Tag>;
      default:
        return <Tag>{docStatus}</Tag>;
    }
  };

  // 格式化时间
  const formatTime = (time: string) => {
    return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
  };

  // 搜索处理
  const handleSearch = (value: string) => {
    setKeyword(value);
  };

  // 筛选处理
  const handleSourceTypeChange = (value: string) => {
    setSourceType(value === 'all' ? undefined : (value as 'video' | 'pdf' | 'text'));
  };

  const handleStatusChange = (value: string) => {
    setStatus(value === 'all' ? undefined : (value as 'processing' | 'completed' | 'failed'));
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <Card>
        <div className={styles.header}>
          <Title level={3}>我的记录</Title>
          <div className={styles.filters}>
            <Search
              placeholder="搜索文档标题"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              style={{ width: 300 }}
              onSearch={handleSearch}
            />
            <Select
              placeholder="文档类型"
              allowClear
              style={{ width: 120 }}
              value={sourceType || 'all'}
              onChange={handleSourceTypeChange}
            >
              <Option value="all">全部类型</Option>
              <Option value="video">视频</Option>
              <Option value="pdf">PDF</Option>
              <Option value="text">文本</Option>
            </Select>
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 120 }}
              value={status || 'all'}
              onChange={handleStatusChange}
            >
              <Option value="all">全部状态</Option>
              <Option value="processing">生成中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
            </Select>
          </div>
        </div>

        <Spin spinning={loading}>
          {documents.length === 0 && !loading ? (
            <Empty description="暂无记录" />
          ) : (
            <div className={styles.cardsContainer}>
              {documents.map((doc) => (
                <Card
                  key={doc.id}
                  className={styles.documentCard}
                  hoverable
                  onClick={() => handleClickDocument(doc.id)}
                >
                  <div className={styles.cardWrapper}>
                    {/* 右上角删除按钮（hover显示） */}
                    <div className={styles.deleteButtonWrapper}>
                      <Popconfirm
                        title="确定要删除这条记录吗？"
                        description="删除后将无法恢复，相关知识点和洞察也会被删除"
                        onConfirm={(e?: React.MouseEvent) => {
                          if (e) {
                            e.stopPropagation();
                          }
                          handleDelete(doc.id);
                        }}
                        onCancel={(e?: React.MouseEvent) => {
                          if (e) {
                            e.stopPropagation();
                          }
                        }}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          className={styles.deleteButton}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </div>

                    <div className={styles.cardHeader}>
                      <div className={styles.cardIcon}>
                        {getSourceTypeIcon(doc.sourceType)}
                      </div>
                      <div className={styles.cardTitle}>
                        <Text 
                          strong 
                          ellipsis 
                          style={{ 
                            width: '100%', 
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={doc.title || '未命名文档'}
                        >
                          {doc.title || '未命名文档'}
                        </Text>
                        <Space style={{ marginTop: 8 }} wrap>
                          <Tag color={getSourceTypeColor(doc.sourceType)}>
                            {doc.sourceType === 'video' ? '视频' : doc.sourceType === 'pdf' ? 'PDF' : '文本'}
                          </Tag>
                          {getStatusTag(doc.status)}
                        </Space>
                      </div>
                    </div>
                    <div className={styles.cardContent}>
                      {doc.originalUrl && (
                        <Text 
                          type="secondary" 
                          ellipsis 
                          style={{ 
                            display: 'block', 
                            marginBottom: 12,
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={doc.originalUrl}
                        >
                          {doc.originalUrl}
                        </Text>
                      )}
                      {/* 进度条（仅处理中时显示） */}
                      {doc.status === 'processing' && doc.progress !== undefined && (
                        <div style={{ marginBottom: 12 }}>
                          <Progress
                            percent={doc.progress}
                            size="small"
                            status="active"
                            showInfo
                          />
                          {doc.progressMessage && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                              {doc.progressMessage}
                            </Text>
                          )}
                        </div>
                      )}
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          创建时间: {formatTime(doc.createdAt)}
                        </Text>
                        <Space wrap style={{ width: '100%' }}>
                          {doc.wordCount && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              字数: {doc.wordCount.toLocaleString()}
                            </Text>
                          )}
                          {doc.video?.duration && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              时长: {Math.floor(doc.video.duration / 60)}分{Math.floor(doc.video.duration % 60)}秒
                            </Text>
                          )}
                          {doc.pdf?.pageCount && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              页数: {doc.pdf.pageCount}页
                            </Text>
                          )}
                        </Space>
                      </Space>
                    </div>
                  </div>
                </Card>
              ))}
              
              {/* 无限滚动观察目标 */}
              <div ref={observerTarget} className={styles.observerTarget}>
                {loadingMore && (
                  <div className={styles.loadingMore}>
                    <Spin size="small" />
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      加载更多...
                    </Text>
                  </div>
                )}
                {!hasMore && documents.length > 0 && (
                  <div className={styles.noMore}>
                    <Text type="secondary">没有更多记录了</Text>
                  </div>
                )}
              </div>
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
}

