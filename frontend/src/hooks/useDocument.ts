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
      setStatus(docStatus);
      
      // 更新进度
      if (docStatus.progress !== undefined) {
        setProgress(docStatus.progress);
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
  }, [documentId, enabled]);

  // 如果文档已完成，加载片段
  useEffect(() => {
    if (document?.status === 'completed' && segments.length === 0) {
      void loadSegments();
    }
  }, [document?.status]);

  // 自动轮询状态（如果文档正在处理中）
  useEffect(() => {
    if (!documentId || !enabled || !autoPoll || status?.status !== 'processing') {
      return;
    }

    const interval = setInterval(() => {
      void loadStatus();
    }, pollInterval);

    return () => {
      clearInterval(interval);
    };
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
