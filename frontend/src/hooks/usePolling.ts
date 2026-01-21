import { useEffect, useRef, useState } from 'react';

interface UsePollingOptions {
  enabled?: boolean;
  interval?: number;
  onError?: (error: Error) => void;
}

/**
 * 轮询 Hook
 * @param callback 轮询回调函数，返回 Promise
 * @param options 配置选项
 * @returns 轮询状态和控制函数
 */
export function usePolling<T>(callback: () => Promise<T>, options: UsePollingOptions = {}) {
  const { enabled = true, interval = 3000, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(callback);

  // 更新 callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 执行轮询
  const poll = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await callbackRef.current();
      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 启动/停止轮询
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 立即执行一次
    void poll();

    // 设置定时器
    intervalRef.current = window.setInterval(() => {
      void poll();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval]);

  // 手动触发轮询
  const refetch = () => {
    void poll();
  };

  // 停止轮询
  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return {
    data,
    isLoading,
    error,
    refetch,
    stop,
  };
}
