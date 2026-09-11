import type { ComponentType } from 'react'

import { Foundations } from './pages/Foundations'

/** カタログの1ページ。`id` がそのまま hash（`#/<id>`）になる。 */
export type DocsPage = {
  id: string
  /** ナビゲーションとページ見出しに出す名前。 */
  title: string
  /** 本文。design/ の契約ファイルを読み込んで描画する（DR-0042）。 */
  Body: ComponentType
}

/**
 * ページ一覧。ナビゲーションの並びはこの配列の順。
 *
 * 先頭のページが、hash が無いとき・書式に合わないとき・未知の id のときの表示先になる。
 * 後続の Issue（#34 / #35 / #36 / #38）はここへページを足す。
 */
export const DOCS_PAGES: DocsPage[] = [
  { id: 'foundations', title: '基礎', Body: Foundations },
]
