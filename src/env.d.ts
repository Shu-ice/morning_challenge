/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // その他の環境変数をここに追加
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 