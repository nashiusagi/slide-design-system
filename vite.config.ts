/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/setup-tests.ts'],
    include: ['{src,packages,scripts}/**/*.test.{ts,tsx,mjs}'],
  },
})
