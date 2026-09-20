/**
 * カタログが `design/layouts/` のレイアウト契約を読むための入口（DR-0042 決定2）。
 *
 * ファイル名を列挙せず、`import.meta.glob` でディレクトリごと読む。契約を1つ足せば
 * ページへ自動で現れ、カタログ側にレイアウト名の一覧を持たない。名前の一覧を写せば、
 * それ自体が `scripts/check-canonical-duplication.mjs` の禁じる複製になる（DR-0046）。
 *
 * 並びは契約ファイルのパス順（＝名前の辞書順）。契約は順序を持たないので、カタログが
 * 独自の並びを決めると、契約に無い情報をカタログが定義することになる。
 */

/** `design/schemas/layout.schema.json` の `slots[]`。 */
export type LayoutSlot = {
  /** 差し込める部品の名前。正本は `design/components/`。 */
  component: string
  required: boolean
  max: number
}

/**
 * `design/layouts/*.json` の形。値ではなく構造だけをここへ写している。
 *
 * 正本は `design/schemas/layout.schema.json` で、契約が実際にこの形をしていることは
 * `pnpm design:check` が検査する（DR-0009 / DR-0035）。
 */
export type LayoutContract = {
  name: string
  role: string
  whenToUse: string[]
  whenNotToUse: string[]
  /** `design/layout.css` が実装するクラス名（DR-0030）。プレビューはこれを当てて描く。 */
  classes: string[]
  slots: LayoutSlot[]
}

const LAYOUT_MODULES = import.meta.glob<LayoutContract>('../../design/layouts/*.json', {
  eager: true,
  import: 'default',
})

/*
 * 読み込みが空なら、そこで落とす。glob のパスがずれても、ページは「契約が0件」の姿で
 * 何事もなく描かれ、件数を突き合わせるテストも 0 === 0 で通る（DR-0043 決定3 と同じ形の
 * 素通り）。空を許さなければ、ずれは実行した瞬間に落ちる。
 */
if (Object.keys(LAYOUT_MODULES).length === 0) {
  throw new Error(
    'design/layouts/ の契約を読み込めなかった（0件）。src/docs/layouts.ts の import.meta.glob のパスを確認すること。',
  )
}

/** レイアウト契約の一覧（DR-0010 が3種と決めた対象そのもの）。 */
export const LAYOUTS: LayoutContract[] = Object.entries(LAYOUT_MODULES)
  .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  .map(([, contract]) => contract)
