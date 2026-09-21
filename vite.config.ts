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
     * カタログが `?raw` で読む CSS（DR-0043 決定3）。vitest は既定で CSS の読み込みを
     * 空文字へ差し替えるため、ここへ挙げないと `?raw` も空になる。テストでだけ中身が
     * 消えると、それを突き合わせる検査が素通りする。
     *
     * - design/theme.css: 生成された --dh-* の値を表示する（src/docs/tokens.ts）
     * - src/docs/docs.css: プレビューが読み込む契約 CSS と、越えてはいけない
     *   ビルドエントリの境界を検査する（src/docs/docs.css.test.ts / DR-0047）
     *
     * 対象はこの2つだけに絞る。CSS 全体の処理を有効にすると、jsdom が組版しない
     * スタイルの読み込みを毎回払うことになる。部品の CSS（src/components/components.css）は
     * ここに要らない。契約名との対応は pnpm design:check がファイルを直に読んで検査する
     * （DR-0050）。
     */
    css: { include: [/design\/theme\.css/, /src\/docs\/docs\.css/] },
    globals: false,
    setupFiles: ['./src/setup-tests.ts'],
    include: ['{src,packages,scripts}/**/*.test.{ts,tsx,mjs}'],
  },
})
