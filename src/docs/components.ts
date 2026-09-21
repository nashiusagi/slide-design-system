/**
 * カタログが `design/components/` の部品契約を読むための入口（DR-0042 決定2）。
 *
 * 読み方はレイアウト（`src/docs/layouts.ts`）と同じで、ファイル名を列挙せず
 * `import.meta.glob` でディレクトリごと読む。契約を1つ足せばページへ自動で現れる。
 * 一覧を持たない根拠は DR-0042 決定2（契約の文言・一覧をカタログ側へ書き写さない）。この
 * うち**文言**の複製は `src/docs/pages/no-contract-prose.test.ts` が全契約・全ソースについて
 * 見るが、**一覧**（名前の並び）を写した場合は機械では捕まらない。そちらは人が守る。
 */
import type { ComponentType } from 'react'

import { contractsFrom } from './contracts'

/** `design/schemas/component.schema.json` の `props` の値。 */
export type ComponentProp = {
  type: string
  required: boolean
  description: string
}

/**
 * `design/components/*.json` の形。値ではなく構造だけをここへ写している。
 *
 * 正本は `design/schemas/component.schema.json` で、契約が実際にこの形をしていることは
 * `pnpm design:check` が検査する（DR-0009 / DR-0035）。
 */
export type ComponentContract = {
  name: string
  role: string
  /** この部品を使ってよいレイアウトの名前。正本は `design/layouts/`。 */
  allowedIn: string[]
  usage: string[]
  props: Record<string, ComponentProp>
}

/** 部品契約の一覧。 */
export const COMPONENTS: ComponentContract[] = contractsFrom(
  import.meta.glob<ComponentContract>('../../design/components/*.json', { eager: true, import: 'default' }),
  'design/components/',
  'src/docs/components.ts',
)

/**
 * 部品1件を指す節 ID。`#/components/<節ID>` のリンク先になる（DR-0048 決定3）。
 *
 * レイアウトの `layoutSectionId` と同じ役目。いまこの hash を指すリンクは無いが、`id` を
 * 置く側だけが先にあると、後からリンクを張る人が契約名を直接書く形に倣ってしまう。DR-0048 の
 * 帰結が「節を持つページを足すときは対応を読み込み口へ置く」と定めているのはそのためだ。
 */
export function componentSectionId(componentName: string): string {
  return componentName
}

/**
 * 部品のプレビューを描くもの。契約名から引く（DR-0049）。
 *
 * **いまは空である。これが正しい状態。** `design/components/` には4つの契約があるが、実装は
 * まだ無い（#37 が持つ）。カタログは「契約にあるのに実装が無い」を画面上の穴として見せる場所
 * なので、ここが空であることがそのまま「4部品すべて未実装」の表示になる。
 *
 * 実装の在り処ではなく登録の有無で判定するのは、実装をどこへ置くかが #37 の決定事項で、
 * まだ決まっていないからだ。置き場所を先に決め打つと、#37 の判断をカタログが縛る。
 * #37 は部品を実装したら、ここへ契約名で登録する。
 */
export const COMPONENT_PREVIEWS: Record<string, ComponentType> = {}

/**
 * 契約名に対応するプレビューを返す。登録が無ければ `null`——すなわち未実装。
 *
 * 登録表を引数で受け取り、既定値を持たない（DR-0049 決定4）。既定値でも呼び出し側は上書き
 * できるが、省略した呼び出しは何を見ているかがその場で読めず、省略するとモジュールの束縛を
 * そのまま読むので、テストが差し替えた表が反映されない。
 */
export function previewFor(
  componentName: string,
  previews: Record<string, ComponentType>,
): ComponentType | null {
  return previews[componentName] ?? null
}
