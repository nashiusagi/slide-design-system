/**
 * カタログが `design/layouts/` のレイアウト契約を読むための入口（DR-0042 決定2）。
 *
 * ファイル名を列挙せず、`import.meta.glob` でディレクトリごと読む。契約を1つ足せば
 * ページへ自動で現れ、カタログ側にレイアウト名の一覧を持たない。一覧を持たない根拠は
 * DR-0042 決定2（契約の文言・一覧をカタログ側へ書き写さない）。このうち**文言**の複製は
 * `src/docs/pages/no-contract-prose.test.ts` が見るが、**一覧**（名前の並び）を写した場合は
 * 機械では捕まらない。`scripts/check-canonical-duplication.mjs`（DR-0046）が捕まえるのは
 * 箇条書き・表の形と、1行に全項目が並ぶ形だけで、コード中の複数行の配列は素通りする。
 *
 * 並びは契約ファイルのパス順（＝名前の辞書順）。契約は順序を持たないので、カタログが
 * 独自の並びを決めると、契約に無い情報をカタログが定義することになる。
 *
 * 読み込みの手順そのもの（並べ替えと0件のガード）は `src/docs/contracts.ts` が持つ。
 */
import { contractsFrom } from './contracts'

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
 * レイアウト1件を指す節 ID。`#/layouts/<節ID>` のリンク先になる（DR-0048）。
 *
 * 値は契約の名前そのものだが、リンクを張る側（部品ページの `allowedIn`）と、`id` を置く側
 * （レイアウトのページ）が別のファイルにある。両方が「名前をそのまま使う」と書くと、片方だけ
 * 変えたときにリンクが黙って外れる。対応をここ1箇所に持つ。
 *
 * 名前が hash の節 ID の書式（英小文字・数字・ハイフン）に収まることは `layouts.test.ts` が
 * 全契約について固定している。収まらない名前が入ると、リンクは書式違反で先頭ページへ落ちる。
 */
export function layoutSectionId(layoutName: string): string {
  return layoutName
}

/** レイアウト契約の一覧（DR-0010 が3種と決めた対象そのもの）。 */
export const LAYOUTS: LayoutContract[] = contractsFrom(
  import.meta.glob<LayoutContract>('../../design/layouts/*.json', { eager: true, import: 'default' }),
  'design/layouts/',
  'src/docs/layouts.ts',
)
