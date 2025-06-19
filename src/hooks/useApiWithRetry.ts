import { useState, useCallback, useRef } from 'react';
import { ApplicationError, isNetworkError } from '../types/error';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  retryCondition?: (error: ApplicationError) => boolean;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApplicationError | null;
  retryCount: number;
}

const useApiWithRetry = <T>(
  apiFunction: () => Promise<T>,
  options: RetryOptions = {}
) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    retryCondition = (error) => isNetworkError(error)
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const executeWithRetry = useCallback(async (currentRetry = 0): Promise<T | null> => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      retryCount: currentRetry
    }));

    try {
      const result = await apiFunction();
      setState(prev => ({ 
        ...prev, 
        data: result, 
        loading: false, 
        error: null,
        retryCount: currentRetry
      }));
      clearRetryTimeout();
      return result;
    } catch (error) {
      // Axiosエラーの詳細なメッセージを取得
      let appError: ApplicationError;
      
      if (error && typeof error === 'object' && 'response' in error) {
        // Axiosエラーレスポンスからメッセージを取得
        const axiosError = error as any;
        const responseData = axiosError.response?.data;
        
        appError = {
          message: responseData?.message || axiosError.message || 'API エラーが発生しました',
          code: axiosError.code,
          status: axiosError.response?.status,
          response: {
            status: axiosError.response?.status || 0,
            data: responseData
          }
        };
        
        console.log(`[API Error] Status: ${axiosError.response?.status}, Message: ${responseData?.message || axiosError.message}`, responseData);
      } else {
        appError = error as ApplicationError;
      }
      
      // リトライ条件をチェック
      const shouldRetry = currentRetry < maxRetries && retryCondition(appError);
      
      if (shouldRetry) {
        // 指数バックオフまたは固定遅延
        const delay = exponentialBackoff 
          ? retryDelay * Math.pow(2, currentRetry)
          : retryDelay;
        
        console.log(`[API Retry] Attempt ${currentRetry + 1}/${maxRetries + 1} failed. Retrying in ${delay}ms...`);
        
        retryTimeoutRef.current = setTimeout(() => {
          executeWithRetry(currentRetry + 1);
        }, delay);
        
        setState(prev => ({ 
          ...prev, 
          loading: true,
          retryCount: currentRetry + 1,
          error: appError
        }));
      } else {
        console.error(`[API Retry] All attempts failed. Final error:`, appError);
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: appError,
          retryCount: currentRetry
        }));
        clearRetryTimeout();
      }
      
      return null;
    }
  }, [apiFunction, maxRetries, retryDelay, exponentialBackoff, retryCondition, clearRetryTimeout]);

  const manualRetry = useCallback(() => {
    clearRetryTimeout();
    return executeWithRetry(0);
  }, [executeWithRetry, clearRetryTimeout]);

  const reset = useCallback(() => {
    clearRetryTimeout();
    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0
    });
  }, [clearRetryTimeout]);

  // コンポーネントアンマウント時のクリーンアップ
  const cleanup = useCallback(() => {
    clearRetryTimeout();
  }, [clearRetryTimeout]);

  return {
    ...state,
    execute: executeWithRetry,
    retry: manualRetry,
    reset,
    cleanup,
    isRetrying: state.loading && state.retryCount > 0
  };
};

export default useApiWithRetry; 