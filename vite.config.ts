/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      /*
       * スライド本体（index.html）とデザインカタログ（docs.html）を別エントリで
       * ビルドする（DR-0042）。カタログのコードをスライドのバンドルへ混ぜると、
       * measure が実測する対象が本番と同一の物でなくなる（DR-0011 / DR-0022）。
       */
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        docs: fileURLToPath(new URL('./docs.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    /*
     * カタログは design/theme.css を `?raw` で読み、生成された --dh-* の値を表示する
     * （src/docs/tokens.ts）。vitest は既定で CSS の読み込みを空文字へ差し替えるため、
     * `?raw` も空になる。テストでだけ値が消えると、表示と突き合わせる検査が素通りする。
     * 対象はこのファイルだけに絞る。CSS 全体の処理を有効にすると、jsdom が組版しない
     * スタイルの読み込みを毎回払うことになる。
     */
    css: { include: [/design\/theme\.css/] },
    globals: false,
    setupFiles: ['./src/setup-tests.ts'],
    include: ['{src,packages,scripts}/**/*.test.{ts,tsx,mjs}'],
  },
})
