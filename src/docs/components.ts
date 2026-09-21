/**
 * カタログが `design/components/` の部品契約を読むための入口（DR-0042 決定2）。
 *
 * 読み方はレイアウト（`src/docs/layouts.ts`）と同じで、ファイル名を列挙せず
 * `import.meta.glob` でディレクトリごと読む。契約を1つ足せばページへ自動で現れる。
 * 一覧を持たない根拠は DR-0042 決定2（契約の文言・一覧をカタログ側へ書き写さない）で、
 * 守るのは人である。
 */
import type { ComponentType } from 'react'

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

/**
 * 読み込んだモジュールを、パス順に並べた契約の配列にする。
 *
 * 0件なら落とす理由は `layoutsFrom`（`src/docs/layouts.ts`）と同じ。glob のパスがずれても
 * ページは「契約が0件」の姿で描かれ、件数を突き合わせるテストも `0 === 0` で通る。
 */
export function componentsFrom(modules: Record<string, ComponentContract>): ComponentContract[] {
  const entries = Object.entries(modules)

  if (entries.length === 0) {
    throw new Error(
      'design/components/ の契約を読み込めなかった（0件）。src/docs/components.ts の import.meta.glob のパスを確認すること。',
    )
  }

  return entries.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)).map(([, contract]) => contract)
}

/** 部品契約の一覧。 */
export const COMPONENTS: ComponentContract[] = componentsFrom(
  import.meta.glob<ComponentContract>('../../design/components/*.json', { eager: true, import: 'default' }),
)

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
 * 登録表を引数で受け取り、既定値を持たない。既定値にすると、この関数の中で束縛された
 * `COMPONENT_PREVIEWS` を見ることになり、呼び出し側が別の登録表を渡す道が塞がる。登録が
 * 空のままでは、実装がある側の枝が一度も実行されないまま「未実装と出る」ことだけが
 * 確かめられた状態になる。
 */
export function previewFor(
  componentName: string,
  previews: Record<string, ComponentType>,
): ComponentType | null {
  return previews[componentName] ?? null
}
