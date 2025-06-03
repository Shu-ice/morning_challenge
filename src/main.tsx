import React from 'react'
import ReactDOM, { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.tsx'
import './styles/index.css'

// React Query クライアントの設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5分間キャッシュ
      staleTime: 5 * 60 * 1000,
      // 24時間はガベージコレクションされない
      gcTime: 24 * 60 * 60 * 1000,
      // エラー時の自動リトライ（3回まで）
      retry: 3,
      // バックグラウンドでの自動再取得を無効化（明示的に制御）
      refetchOnWindowFocus: false,
      // ネットワーク再接続時の自動再取得
      refetchOnReconnect: true,
    },
    mutations: {
      // ミューテーション失敗時のリトライ
      retry: 1,
    },
  },
})

// メインアプリのレンダリング
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* 開発環境でのみReact Query DevToolsを表示 */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>,
)

// 開発モードでのみStagewise Toolbarを初期化
if (process.env.NODE_ENV === 'development') {
  const initStagewise = async () => {
    try {
      const { StagewiseToolbar } = await import('@stagewise/toolbar-react');
      
      // Stagewise用の設定
      const stagewiseConfig = {
        plugins: []
      };

      // Stagewise用の専用DOM要素を作成
      const stagewiseContainer = document.createElement('div');
      stagewiseContainer.id = 'stagewise-toolbar';
      document.body.appendChild(stagewiseContainer);

      // 別のReactルートでToolbarをレンダリング
      const stagewiseRoot = createRoot(stagewiseContainer);
      stagewiseRoot.render(<StagewiseToolbar config={stagewiseConfig} />);
      
    } catch (error) {
      console.warn('Stagewise toolbar could not be loaded:', error);
    }
  };

  initStagewise();
} 