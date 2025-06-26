import { ApplicationError, ApiError, extractErrorMessage } from '../types/error';
import { logger } from './logger';

/**
 * 統一エラーハンドラー
 * 全てのcatch文で使用する標準エラー処理
 */
export class ErrorHandler {
  
  /**
   * APIエラーの統一処理
   */
  static handleApiError(error: unknown, context: string): ApplicationError {
    const contextPrefix = `[${context}]`;
    
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      const status = axiosError.response?.status || 0;
      const data = axiosError.response?.data;
      
      const apiError: ApiError = {
        message: data?.message || data?.error || axiosError.message || 'APIエラーが発生しました',
        code: axiosError.code || 'API_ERROR',
        status,
        response: {
          status,
          data
        }
      };
      
      // ログ出力（セキュリティ考慮）
      logger.error(`${contextPrefix} API Error ${status}:`, {
        message: apiError.message,
        code: apiError.code,
        url: axiosError.config?.url,
        method: axiosError.config?.method
      });
      
      return apiError;
    }
    
    // ネットワークエラーの処理
    if (error && typeof error === 'object' && 'code' in error) {
      const networkError = error as any;
      
      if (networkError.code === 'ERR_NETWORK') {
        const netError = {
          message: 'サーバーに接続できません。ネットワーク接続を確認してください。',
          code: 'ERR_NETWORK'
        };
        logger.error(`${contextPrefix} Network Error:`, netError);
        return netError;
      }
      
      if (networkError.code === 'ECONNABORTED') {
        const timeoutError = {
          message: 'サーバーからの応答がタイムアウトしました。',
          code: 'TIMEOUT'
        };
        logger.error(`${contextPrefix} Timeout Error:`, timeoutError);
        return timeoutError;
      }
    }
    
    // 一般的なエラーの処理
    const message = error instanceof Error ? error.message : '予期せぬエラーが発生しました';
    const generalError = {
      message,
      code: 'GENERAL_ERROR'
    };
    
    logger.error(`${contextPrefix} General Error:`, {
      message,
      error: error instanceof Error ? error.stack : String(error)
    });
    
    return generalError;
  }
  
  /**
   * ユーザーフレンドリーなエラーメッセージを取得
   */
  static getUserFriendlyMessage(error: ApplicationError): string {
    // サーバーから詳細メッセージが渡されていれば最優先で表示
    if (typeof error === 'object' && 'response' in error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errAny = error as any;
      const serverMessage = errAny.response?.data?.message || errAny.response?.data?.error;
      if (serverMessage && typeof serverMessage === 'string') {
        return serverMessage;
      }
    }

    const message = extractErrorMessage(error);
    
    // 特定のエラーコードに基づくカスタマイズ
    if ('code' in error) {
      switch (error.code) {
        case 'ERR_NETWORK':
          return 'インターネット接続を確認してください。サーバーに接続できません。';
        case 'TIMEOUT':
          return 'サーバーの応答が遅れています。しばらく待ってから再試行してください。';
        case 'ECONNABORTED':
          return 'リクエストがタイムアウトしました。再度お試しください。';
        default:
          break;
      }
    }
    
    // ステータスコード別のメッセージ
    if ('status' in error) {
      switch (error.status) {
        case 400:
          return '入力内容に問題があります。確認してください。';
        case 401:
          return 'ログインが必要です。再度ログインしてください。';
        case 403:
          return 'この操作を実行する権限がありません。';
        case 404:
          return '要求されたデータが見つかりません。';
        case 429:
          return 'リクエストが多すぎます。しばらく待ってから再試行してください。';
        case 500:
          return 'サーバー内部エラーが発生しました。管理者にお問い合わせください。';
        case 502:
        case 503:
        case 504:
          return 'サーバーが一時的に利用できません。しばらく待ってから再試行してください。';
        default:
          break;
      }
    }
    
    return message || '予期せぬエラーが発生しました。';
  }
  
  /**
   * エラーレスポンスの標準化
   */
  static createErrorResponse(error: ApplicationError, defaultMessage: string = 'エラーが発生しました') {
    return {
      success: false,
      message: this.getUserFriendlyMessage(error) || defaultMessage,
      error: error,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Promise拒否の統一処理
   */
  static handlePromiseRejection(error: unknown, context: string): never {
    const handledError = this.handleApiError(error, context);
    throw handledError;
  }
} 