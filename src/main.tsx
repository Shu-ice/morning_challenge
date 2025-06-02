import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

// メインアプリのレンダリング
const root = createRoot(document.getElementById('root')!)
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
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