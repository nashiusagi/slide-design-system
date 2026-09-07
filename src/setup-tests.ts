import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vite.config.ts の test.globals を false にしているため、
// Testing Library の自動 cleanup は登録されない（登録には global の afterEach が要る）。
// 明示的に掛けないと、前のテストで描画した DOM と window のキー入力購読が残り、
// 次のテストの取得が二重にマッチする。
afterEach(cleanup)
