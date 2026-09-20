import type { ComponentType } from 'react'

import { Foundations } from './pages/Foundations'
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
 * 後続の Issue（#36 / #38）はここへページを足す。id は hash の許容書式
 * （英小文字・数字・ハイフン）に収め、数字だけの名前は使わない（src/docs/hash.ts）。
 *
 * 並びは契約の層をなぞる。トークン → レイアウト → 部品 → ルールの順で、外側から
 * 内側へ辿れるようにする（DR-0009 の5層）。
 */
export const DOCS_PAGES: [DocsPage, ...DocsPage[]] = [
  { id: 'foundations', title: '基礎', Body: Foundations },
  { id: 'layouts', title: 'レイアウト', Body: Layouts },
]
