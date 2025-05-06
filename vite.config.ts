import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tsconfigPaths()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: Number(env.FRONTEND_PORT) || 3004, // デフォルトを3004に変更
      host: true, // Allow access from network
      proxy: {
        // /api へのリクエストをバックエンドサーバーにプロキシ
        '/api': {
          target: 'http://localhost:5003', // ターゲットをハードコード
          changeOrigin: true,
          secure: false,
          // rewrite: (path) => path.replace(/^\\/api/, '') // バックエンドが/apiプレフィックスを期待しているため、削除しない
        },
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
    define: {
      // グローバル定数を定義 (例: __APP_VERSION__)
      // 'process.env': JSON.stringify(env) // 環境変数をフロントエンドに公開する場合は注意が必要
    },
  }
}) 