/**
 * カタログが `design/layouts/` のレイアウト契約を読むための入口（DR-0042 決定2）。
 *
 * ファイル名を列挙せず、`import.meta.glob` でディレクトリごと読む。契約を1つ足せば
 * ページへ自動で現れ、カタログ側にレイアウト名の一覧を持たない。一覧を持たない根拠は
 * DR-0042 決定2（契約の文言・一覧をカタログ側へ書き写さない）で、守るのは人である。
 * 機械検査（`scripts/check-canonical-duplication.mjs` / DR-0046）が捕まえるのは箇条書き・
 * 表の形と、1行に全項目が並ぶ形だけで、コード中の複数行の配列は素通りする。
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

/**
 * 読み込んだモジュールを、パス順に並べた契約の配列にする。
 *
 * 読み込みが空なら、そこで落とす。glob のパスがずれても、ページは「契約が0件」の姿で
 * 何事もなく描かれ、件数を突き合わせるテストも 0 === 0 で通る（DR-0043 決定1 の
 * 「読み込んだ CSS が空のときは例外を投げる」と同じ形の素通り）。空を許さなければ、
 * ずれは実行した瞬間に落ちる。
 *
 * glob の結果を引数で受けるのは、この「0件なら落とす」自体をテストで踏むため。
 * モジュールの副作用として書くと、空の入力を与える手段が無く、ガードが壊れても
 * 気づけない。
 */
export function layoutsFrom(modules: Record<string, LayoutContract>): LayoutContract[] {
  const entries = Object.entries(modules)

  if (entries.length === 0) {
    throw new Error(
      'design/layouts/ の契約を読み込めなかった（0件）。src/docs/layouts.ts の import.meta.glob のパスを確認すること。',
    )
  }

  return entries.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)).map(([, contract]) => contract)
}

/** レイアウト契約の一覧（DR-0010 が3種と決めた対象そのもの）。 */
export const LAYOUTS: LayoutContract[] = layoutsFrom(
  import.meta.glob<LayoutContract>('../../design/layouts/*.json', { eager: true, import: 'default' }),
)
