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
    
    // 特定のエラーコードに基づくカスタマイズ（より親しみやすく）
    if ('code' in error) {
      switch (error.code) {
        case 'ERR_NETWORK':
          return '📡 インターネット接続に問題があるようです。Wi-Fiまたはモバイルデータ接続を確認してください。';
        case 'TIMEOUT':
          return '⏰ サーバーからの応答に時間がかかっています。少し待ってから「再試行」ボタンを押してみてください。';
        case 'ECONNABORTED':
          return '⌛ リクエストがタイムアウトしました。ネットワーク状況が改善してから再度お試しください。';
        default:
          break;
      }
    }
    
    // ステータスコード別のメッセージ（より親しみやすく）
    if ('status' in error) {
      switch (error.status) {
        case 400:
          return '📝 入力内容に不備があります。各項目をもう一度確認してください。';
        case 401:
          return '🔑 ログインの有効期限が切れました。もう一度ログインしてください。';
        case 403:
          return '🚫 申し訳ございませんが、この操作を実行する権限がありません。';
        case 404:
          return '🔍 お探しのデータが見つかりませんでした。URLやリンクをご確認ください。';
        case 429:
          return '🚦 一時的にアクセスが集中しています。少し時間をおいてから再度お試しください。';
        case 500:
          return '🛠️ システム内部でエラーが発生しました。しばらく待ってから再度お試しいただくか、管理者までお問い合わせください。';
        case 502:
        case 503:
        case 504:
          return '⚡ サーバーが一時的にご利用いただけません。数分後に再度アクセスしてください。';
        default:
          break;
      }
    }
    
    return message || '😅 申し訳ございません。予期せぬエラーが発生しました。';
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