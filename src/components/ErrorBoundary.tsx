import React, { Component, ErrorInfo, ReactNode, useEffect, useRef } from 'react';
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

// Error UI component with keyboard handling and accessibility
const ErrorDisplay: React.FC<{
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  onRetry: () => void;
  onReload: () => void;
  onGoHome: () => void;
}> = ({ error, errorInfo, errorId, onRetry, onReload, onGoHome }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    // Focus trap and ESC key handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRetry(); // ESC key closes the error modal
      }
      
      // Focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Auto-focus first button
    const firstButton = dialogRef.current?.querySelector('button') as HTMLElement;
    firstButton?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onRetry]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onRetry();
    }
  };

  return (
    <div 
      className="error-boundary" 
      onClick={handleBackdropClick}
      role="dialog" 
      aria-modal="true"
      aria-labelledby="error-title"
      aria-describedby="error-description"
    >
      <div className="error-boundary__container" ref={dialogRef}>
        <div className="error-boundary__icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="#ff6b6b"/>
            <circle cx="12" cy="20" r="2" fill="#ff6b6b"/>
          </svg>
        </div>
        
        <h1 id="error-title" className="error-boundary__title">
          アプリケーションエラーが発生しました
        </h1>
        
        <p id="error-description" className="error-boundary__message">
          申し訳ございません。予期しないエラーが発生しました。
          <br />
          以下のいずれかの方法をお試しください。
          <br />
          <small>ESCキーを押すか、外側をクリックして再試行できます。</small>
        </p>

        {errorId && (
          <div className="error-boundary__error-id">
            <strong>エラーID:</strong> {errorId}
          </div>
        )}

        <div className="error-boundary__actions">
          <button 
            className="error-boundary__button error-boundary__button--primary"
            onClick={onRetry}
            aria-label="エラーを解消して再試行"
          >
            再試行
          </button>
          
          <button 
            className="error-boundary__button error-boundary__button--secondary"
            onClick={onReload}
            aria-label="ページを完全に再読み込み"
          >
            ページを再読み込み
          </button>
          
          <button 
            className="error-boundary__button error-boundary__button--tertiary"
            onClick={onGoHome}
            aria-label="ホームページに戻る"
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
};

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

      return (
        <ErrorDisplay
          error={error}
          errorInfo={errorInfo}
          errorId={errorId}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
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