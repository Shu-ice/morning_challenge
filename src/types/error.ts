// エラーハンドリング用型定義

// 基本エラー型
export interface AppError {
  message: string;
  code?: string;
  status?: number;
}

// APIエラー型
export interface ApiError extends AppError {
  response?: {
    status: number;
    data?: {
      error?: string;
      message?: string;
    };
  };
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    data?: unknown;
  };
}

// ネットワークエラー型
export interface NetworkError extends AppError {
  code: 'ERR_NETWORK' | 'TIMEOUT' | 'CONNECTION_FAILED';
}

// 統合エラー型（Union型で型安全性を保証）
export type ApplicationError = AppError | ApiError | NetworkError | Error;

// エラーハンドリングユーティリティ
export const isApiError = (error: ApplicationError): error is ApiError => {
  return 'response' in error && typeof error.response === 'object';
};

export const isNetworkError = (error: ApplicationError): error is NetworkError => {
  return 'code' in error && 
    typeof error.code === 'string' && 
    ['ERR_NETWORK', 'TIMEOUT', 'CONNECTION_FAILED'].includes(error.code);
};

// エラーメッセージ抽出ユーティリティ
export const extractErrorMessage = (error: ApplicationError): string => {
  if (isApiError(error)) {
    return error.response?.data?.error || 
           error.response?.data?.message || 
           error.message || 
           'APIエラーが発生しました';
  }
  
  if (isNetworkError(error)) {
    switch (error.code) {
      case 'ERR_NETWORK':
        return 'ネットワークエラー: サーバーに接続できません';
      case 'TIMEOUT':
        return 'タイムアウトエラー: サーバーからの応答が遅すぎます';
      case 'CONNECTION_FAILED':
        return '接続エラー: サーバーとの接続に失敗しました';
      default:
        return 'ネットワークエラーが発生しました';
    }
  }
  
  return error.message || '予期せぬエラーが発生しました';
}; 