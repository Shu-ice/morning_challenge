import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import '../styles/ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // エラーが発生したときの状態更新
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラーログの記録
    const errorId = this.state.errorId || 'unknown';
    
    logger.error(`[ErrorBoundary] React Error Caught (ID: ${errorId})`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    });

    // 追加の詳細情報をログに記録
    logger.error(`[ErrorBoundary] Error Details`, {
      name: error.name,
      message: error.message,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    this.setState({
      errorInfo
    });

    // 外部のエラーハンドラーを呼び出し
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // エラー報告サービス（将来的な拡張）
    this.reportError(error, errorInfo, errorId);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    // 本番環境でのエラー報告サービスとの統合ポイント
    // 例: Sentry, LogRocket, Bugsnag など
    
    if (process.env.NODE_ENV === 'production') {
      // 本番環境でのエラー報告
      try {
        // 仮想的なエラー報告APIへの送信
        fetch('/api/errors/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            errorId,
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          })
        }).catch(reportErr => {
          logger.error('[ErrorBoundary] Failed to report error:', reportErr);
        });
      } catch (reportError) {
        logger.error('[ErrorBoundary] Error in error reporting:', reportError instanceof Error ? reportError : String(reportError));
      }
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // カスタムのfallback UIが提供されている場合はそれを使用
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorId } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="#ff6b6b"/>
                <circle cx="12" cy="20" r="2" fill="#ff6b6b"/>
              </svg>
            </div>
            
            <h1 className="error-boundary__title">
              アプリケーションエラーが発生しました
            </h1>
            
            <p className="error-boundary__message">
              申し訳ございません。予期しないエラーが発生しました。
              <br />
              以下のいずれかの方法をお試しください。
            </p>

            {errorId && (
              <div className="error-boundary__error-id">
                <strong>エラーID:</strong> {errorId}
              </div>
            )}

            <div className="error-boundary__actions">
              <button 
                className="error-boundary__button error-boundary__button--primary"
                onClick={this.handleRetry}
              >
                再試行
              </button>
              
              <button 
                className="error-boundary__button error-boundary__button--secondary"
                onClick={this.handleReload}
              >
                ページを再読み込み
              </button>
              
              <button 
                className="error-boundary__button error-boundary__button--tertiary"
                onClick={this.handleGoHome}
              >
                ホームに戻る
              </button>
            </div>

            {isDevelopment && error && (
              <details className="error-boundary__details">
                <summary className="error-boundary__details-summary">
                  開発者向け詳細情報
                </summary>
                
                <div className="error-boundary__error-details">
                  <h3>エラーメッセージ</h3>
                  <pre className="error-boundary__code">{error.message}</pre>
                  
                  {error.stack && (
                    <>
                      <h3>スタックトレース</h3>
                      <pre className="error-boundary__code">{error.stack}</pre>
                    </>
                  )}
                  
                  {errorInfo?.componentStack && (
                    <>
                      <h3>コンポーネントスタック</h3>
                      <pre className="error-boundary__code">{errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="error-boundary__help">
              <p>
                問題が継続する場合は、
                <a href="mailto:support@example.com" className="error-boundary__link">
                  サポートにお問い合わせ
                </a>
                ください。
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-Order Component版
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
};

// Hook版（関数コンポーネント用）
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: ErrorInfo) => {
    logger.error('[useErrorHandler] Manual error handling:', {
      error: error.message,
      stack: error.stack,
      ...errorInfo
    });

    // React の Error Boundary にエラーを伝播
    throw error;
  }, []);

  return handleError;
};

export default ErrorBoundary;