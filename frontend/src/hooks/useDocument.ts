import { useState, useEffect } from 'react';
import {
  getDocumentById,
  getDocumentSegments,
  getDocumentStatus,
  type Document,
  type Segment,
  type DocumentStatus,
} from '@/api/document';

interface UseDocumentOptions {
  enabled?: boolean;
  autoPoll?: boolean;
  pollInterval?: number;
}

/**
 * 文档 Hook
 * @param documentId 文档ID
 * @param options 配置选项
 */
export function useDocument(documentId: string | null, options: UseDocumentOptions = {}) {
  const { enabled = true, autoPoll = true, pollInterval = 3000 } = options;
  const [document, setDocument] = useState<Document | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState<DocumentStatus | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 加载文档详情
  const loadDocument = async () => {
    if (!documentId || !enabled) return;

    try {
      setIsLoading(true);
      setError(null);
      const doc = await getDocumentById(documentId);
      setDocument(doc);
      setStatus({
        id: doc.id,
        status: doc.status,
        errorMessage: doc.errorMessage,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载文档片段
  const loadSegments = async () => {
    if (!documentId || !enabled) return;

    try {
      setIsLoadingSegments(true);
      const segs = await getDocumentSegments(documentId);
      setSegments(segs);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsLoadingSegments(false);
    }
  };

  // 加载文档状态
  const loadStatus = async () => {
    if (!documentId || !enabled) return;

    try {
      const docStatus = await getDocumentStatus(documentId);
      const previousStatus = status?.status;
      setStatus(docStatus);

      // 更新进度
      if (docStatus.progress !== undefined) {
        setProgress(docStatus.progress);
      }

      // 如果状态变为completed，停止轮询，重新加载文档和片段
      if (docStatus.status === 'completed' && previousStatus !== 'completed') {
        await loadDocument();
        await loadSegments();
        return; // 停止轮询
      }

      // 如果状态更新了，重新加载文档
      if (document && document.status !== docStatus.status) {
        await loadDocument();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    }
  };

  // 初始加载
  useEffect(() => {
    if (documentId && enabled) {
      void loadDocument();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, enabled]);

  // 当进度 >= 70% 或文档已完成时，加载片段（片段在70%时已保存到数据库）
  useEffect(() => {
    if (
      documentId &&
      enabled &&
      segments.length === 0 &&
      (progress >= 70 || document?.status === 'completed')
    ) {
      void loadSegments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, enabled, progress, document?.status]);

  // 自动轮询状态（只在文档正在处理中时轮询）
  useEffect(() => {
    if (!documentId || !enabled || !autoPoll) {
      return;
    }

    // 如果文档已完成或失败，停止轮询
    if (status?.status === 'completed' || status?.status === 'failed') {
      return;
    }

    const interval = setInterval(() => {
      void loadStatus();
    }, pollInterval);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, enabled, autoPoll, status?.status, pollInterval]);

  return {
    document,
    segments,
    status,
    progress,
    isLoading,
    isLoadingSegments,
    error,
    refetch: loadDocument,
    refetchSegments: loadSegments,
    refetchStatus: loadStatus,
  };
}
