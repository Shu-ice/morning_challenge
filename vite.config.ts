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
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`Sending Request to the Target: ${req.method} ${req.url}`);
              console.log('  Headers:', JSON.stringify(proxyReq.getHeaders(), null, 2));
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log(`Received Response from the Target: ${proxyRes.statusCode} ${req.url}`);
            });
            proxy.on('error', (err, req, res) => {
              console.error('Proxy Error:', err);
              if (res && typeof res.writeHead === 'function') {
                res.writeHead(500, {
                  'Content-Type': 'text/plain',
                });
                res.end('Something went wrong with the proxy. ' + err.message);
              } else if (res && typeof res.end === 'function') {
                // If res.writeHead is not a function, try to send a minimal response.
                res.end('Proxy error: ' + err.message);
              } else {
                console.error('Response object is not available or writeHead/end is not a function.');
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