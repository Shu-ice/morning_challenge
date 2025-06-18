import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production)
  // const env = loadEnv(mode, process.cwd(), '') // 一旦envの使用をコメントアウト

  return {
    plugins: [react(), tsconfigPaths()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // port: Number(env.FRONTEND_PORT) || 3004, // 環境変数ではなく固定で指定
      port: 3004,
      host: true, // Allow access from network
      proxy: {
        // /api へのリクエストをバックエンドサーバーにプロキシ
        '/api': {
          target: 'http://127.0.0.1:5003',
          changeOrigin: true,
          secure: false,
          // rewrite: (path) => path.replace(/^\/api/, ''), // 通常は不要なことが多い
          configure: (proxy, options) => {
            // 🔧 本番対応: プロキシログを削除し、エラーのみ記録
            proxy.on('error', (err, req, res) => {
              if (process.env.NODE_ENV !== 'production') {
                console.error('[Proxy Error]:', err.message);
              }
              if (res && typeof res.writeHead === 'function') {
                res.writeHead(500, {
                  'Content-Type': 'text/plain',
                });
                res.end('Proxy error occurred');
              } else if (res && typeof res.end === 'function') {
                res.end('Proxy error occurred');
              }
            });
          }
        },
      },
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
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return;
          }
          warn(warning);
        },
      },
    },
    define: {
      // グローバル定数を定義 (例: __APP_VERSION__)
      // 'process.env': JSON.stringify(env) // 環境変数をフロントエンドに公開する場合は注意が必要
    },
  }
}) 