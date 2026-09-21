/**
 * カタログのページ ID の正本。
 *
 * `DOCS_PAGES`（`src/docs/pages.ts`）がここから id を取り、他のページからリンクを張る側も
 * ここから取る。リンク側がリテラルで書くと、`DOCS_PAGES` の id を変えたときにリンクだけが
 * 取り残される。`resolvePage` は未知の id を先頭ページへ落とすので、リンクは付いたまま別の
 * ページへ飛ぶ。節 ID について DR-0048 決定3 が定めた一元化を、ページ ID にも当てる。
 *
 * `pages.ts` ではなくここに置くのは、`pages.ts` がページの実装（`Components` など）を import
 * するためだ。リンクを張るページがそこから定数を取ると、循環参照になる。ここは何も import
 * しない葉にしておく。
 *
 * 値は hash の許容書式（英小文字・数字・ハイフン）に収め、数字だけの名前は使わない
 * （`src/docs/hash.ts`）。`DOCS_PAGES` を通した往復は `src/docs/hash.test.ts` が固定している。
 */

export const FOUNDATIONS_PAGE_ID = 'foundations'

/** レイアウトのページ。部品ページの `allowedIn` がここへリンクする。 */
export const LAYOUTS_PAGE_ID = 'layouts'

export const COMPONENTS_PAGE_ID = 'components'

/** 検証ルールのページ。 */
export const RULES_PAGE_ID = 'rules'
