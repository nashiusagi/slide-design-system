import { describe, expect, it } from 'vitest'

import { COMPONENTS } from '../components'
import { LAYOUTS } from '../layouts'

/*
 * 契約の文言がカタログのソースへ書き写されていないことを見る（DR-0042 決定2）。
 *
 * ページ単位のテストファイルではなく、ここ1箇所に置く。ページごとに同じテストを書く形だと、
 * ページを足した人が書き忘れた時点で守備範囲の外へ出る。対象も契約もここで glob と一覧から
 * 組み立てるので、どちらが増えても自動で入る。
 *
 * これは人が守る規約の補助でしかない。機械検査（scripts/check-canonical-duplication.mjs /
 * DR-0046）が src/docs について見るのは値と名前の一覧で、契約の文章は対象に入っていない。
 */

/*
 * 対象は src/docs 配下の実装すべて。ページのファイルだけに絞らない。
 *
 * 描画を切り出す先はページのファイルとは限らない。`pages/` の外（DocsApp.tsx）にも、
 * `.tsx` ではないファイル（読み込み口やヘルパの .ts）にも置ける。どれか一つを外すと、
 * 置き場所を変えるだけで検査の外へ出られる。
 */
const SOURCES = Object.entries(
  import.meta.glob<string>('../**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }),
).filter(([path]) => !path.includes('.test.'))

/** 契約が持つ文章。ここに挙がったものがページのソースに現れたら、それが複製である。 */
const CONTRACT_PROSE: { label: string; texts: string[] }[] = [
  ...LAYOUTS.map((layout) => ({
    label: `design/layouts/${layout.name}.json`,
    texts: [
      layout.role,
      ...layout.whenToUse,
      ...layout.whenNotToUse,
      ...layout.classes,
      ...commentOf(layout),
    ],
  })),
  ...COMPONENTS.map((component) => ({
    label: `design/components/${component.name}.json`,
    texts: [
      component.role,
      ...component.usage,
      ...Object.values(component.props).map((prop) => prop.description),
      ...commentOf(component),
    ],
  })),
]

/**
 * 契約の `$comment`。設計意図の説明なので、カタログの解説文へ最も写されやすい。
 *
 * 型（`LayoutContract` / `ComponentContract`）は `$comment` を持たない。表示に使わない項目を
 * 型へ入れると、ページ側が読めるようになってしまう。ここでは読み込んだ実体から取る。
 */
function commentOf(contract: object): string[] {
  const comment = (contract as { $comment?: unknown }).$comment

  return typeof comment === 'string' ? [comment] : []
}

/**
 * 突き合わせる前に、書き方の違いで一致しなくなる文字を落とす。
 *
 * 落とすのは空白・改行と、引用符・`+`。ソースをそのまま見ると、契約の文言を2行に折り返して
 * 貼るだけで一致しなくなる。JSX の本文は行長に合わせて折り返すのがこのリポジトリの書き方
 * なので、複製を入れた人が意図せず検査を抜ける。`'A' + 'B'` の連結も同じ形で抜ける。
 *
 * 両側へ同じ変換をかける。契約の文章は長い日本語の文なので、引用符や `+` を落としたことで
 * 無関係なコードと偶然一致する余地は無い。
 *
 * これで塞げない形は残る。文字列を別々の変数へ分けて持つ、文字を実体参照で書く、といった
 * 書き方は一致しない。塞いでいるのは「そのまま貼って整形した」形までである。
 */
function packed(text: string): string {
  return text.replace(/[\s'"`+]+/g, '')
}

describe('カタログの実装', () => {
  it('契約の文言をソースへ書き写していない', () => {
    /*
     * 読み込みが空・0件だと、以下の「含まれない」はすべて素通りする（DR-0043 決定1 と同じ形）。
     * 対象が在り、中身が読めていることを先に確かめる。
     */
    expect(SOURCES.length).toBeGreaterThan(0)
    expect(CONTRACT_PROSE.length).toBeGreaterThan(0)

    for (const [path, source] of SOURCES) {
      expect(source.length, `${path} の中身が空`).toBeGreaterThan(0)

      const packedSource = packed(source)

      for (const { label, texts } of CONTRACT_PROSE) {
        expect(texts.length, `${label} から文章を1つも集めていない`).toBeGreaterThan(0)

        for (const text of texts) {
          expect(packedSource, `${path} に ${label} の文言が書かれている`).not.toContain(packed(text))
        }
      }
    }
  })

  /*
   * 契約が `$comment` を持っていることを固定する。持たなくなれば commentOf は静かに空を返し、
   * 上の検査は `$comment` について何も見ていない状態で通り続ける。
   */
  it('契約の $comment も突き合わせの対象に入っている', () => {
    const withComment = CONTRACT_PROSE.filter(({ label }) =>
      [...LAYOUTS, ...COMPONENTS].some(
        (contract) => commentOf(contract).length > 0 && label.includes(contract.name),
      ),
    )

    expect(withComment.length).toBe(LAYOUTS.length + COMPONENTS.length)
  })
})
