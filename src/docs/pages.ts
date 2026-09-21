import type { ComponentType } from 'react'

import { Foundations } from './pages/Foundations'
import { COMPONENTS_PAGE_ID, FOUNDATIONS_PAGE_ID, LAYOUTS_PAGE_ID } from './page-ids'
import { Components } from './pages/Components'
import { Layouts } from './pages/Layouts'

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
 * 先頭のページが、hash が無いとき・書式に合わないとき・未知の id のときの表示先になる
 * （DR-0042）。型を非空タプルにしているのは、その「先頭」が必ず在ることを型で固定する
 * ため。空にできると、解決側に到達しない分岐を持つことになる。
 *
 * 後続の Issue（#38）はここへページを足す。id は hash の許容書式
 * （英小文字・数字・ハイフン）に収め、数字だけの名前は使わない（src/docs/hash.ts）。
 *
 * 並びは tokens → layouts → components → rules とする。契約を読む人が、値 → 箱 →
 * 中身 → 検査の順に辿れるようにするためで、この並び自体は DR-0047 の帰結が持つ。
 * DR-0009 が定めたのは5層の写像であって並び順ではないので、根拠をあちらへ求めない。
 * deck 契約（`design/decks/`）は発表ごとの構成であり、Phase 1 のカタログは持たない。
 */
export const DOCS_PAGES: [DocsPage, ...DocsPage[]] = [
  { id: FOUNDATIONS_PAGE_ID, title: '基礎', Body: Foundations },
  { id: LAYOUTS_PAGE_ID, title: 'レイアウト', Body: Layouts },
  { id: COMPONENTS_PAGE_ID, title: '部品', Body: Components },
]
