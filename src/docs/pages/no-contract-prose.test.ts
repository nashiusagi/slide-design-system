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
 * `*` はディレクトリを跨がないので `**` で書く。直下だけを見ると、切り出し先を1段深い
 * ディレクトリへ置くだけで同じ抜け道が開く。
 */
const PAGE_SOURCES = Object.entries(
  import.meta.glob<string>('./**/*.tsx', { eager: true, query: '?raw', import: 'default' }),
).filter(([path]) => !path.includes('.test.'))

/** 契約が持つ文章。ここに挙がったものがページのソースに現れたら、それが複製である。 */
const CONTRACT_PROSE: { label: string; texts: string[] }[] = [
  ...LAYOUTS.map((layout) => ({
    label: `design/layouts/${layout.name}.json`,
    texts: [layout.role, ...layout.whenToUse, ...layout.whenNotToUse, ...layout.classes],
  })),
  ...COMPONENTS.map((component) => ({
    label: `design/components/${component.name}.json`,
    texts: [
      component.role,
      ...component.usage,
      ...Object.values(component.props).map((prop) => prop.description),
    ],
  })),
]

describe('カタログのページ', () => {
  it('契約の文言をソースへ書き写していない', () => {
    /*
     * 読み込みが空・0件だと、以下の「含まれない」はすべて素通りする（DR-0043 決定1 と同じ形）。
     * 対象が在り、中身が読めていることを先に確かめる。
     */
    expect(PAGE_SOURCES.length).toBeGreaterThan(0)
    expect(CONTRACT_PROSE.length).toBeGreaterThan(0)

    for (const [path, source] of PAGE_SOURCES) {
      expect(source.length, `${path} の中身が空`).toBeGreaterThan(0)

      for (const { label, texts } of CONTRACT_PROSE) {
        expect(texts.length, `${label} から文章を1つも集めていない`).toBeGreaterThan(0)

        for (const text of texts) {
          expect(source, `${path} に ${label} の文言が書かれている`).not.toContain(text)
        }
      }
    }
  })
})
