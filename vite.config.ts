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
    globals: false,
    setupFiles: ['./src/setup-tests.ts'],
    include: ['{src,packages,scripts}/**/*.test.{ts,tsx,mjs}'],
  },
})
