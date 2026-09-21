import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { COMPONENTS, componentSectionId } from '../components'
import { formatDocsHash, parseDocsHash } from '../hash'
import { LAYOUTS, layoutSectionId } from '../layouts'
import { COMPONENTS_PAGE_ID, LAYOUTS_PAGE_ID } from '../page-ids'
import { DOCS_PAGES } from '../pages'
import { RULES, ruleSectionId, rulesByMethod } from '../rules'
import { Components } from './Components'
import { Layouts } from './Layouts'
import { Rules } from './Rules'

/*
 * ページを跨ぐ節リンクを、張る側と着く側で突き合わせる（DR-0048）。
 *
 * ページごとのテストでは、張る側は「href がこの形である」を、着く側は「節 ID が hash として
 * 往復する」を見るだけで、両者が実際に繋がっているかは誰も見ない。実際、`Layouts.tsx` から
 * `id` を丸ごと落としてもページ単位のテストは全部緑のまま通った。リンクは付いたまま、押すと
 * ページの先頭が出る——押すまで壊れたことが分からない、という DR-0048 がまさに避けようとした
 * 壊れ方になる。
 */

/** そのページが実際に描く節 ID。 */
function renderedSectionIds(page: () => ReturnType<typeof Layouts>): string[] {
  const { container } = render(page())

  return [...container.querySelectorAll('section[id]')].map((section) => section.id)
}

describe('ページを跨ぐ節リンク', () => {
  it('レイアウトのページが、全契約の節 ID を id として描く', () => {
    expect(renderedSectionIds(Layouts)).toEqual(LAYOUTS.map((layout) => layoutSectionId(layout.name)))
  })

  it('部品のページが、全契約の節 ID を id として描く', () => {
    expect(renderedSectionIds(Components)).toEqual(
      COMPONENTS.map((component) => componentSectionId(component.name)),
    )
  })

  /*
   * 検証ルールのページへ向かうリンクはまだ無い（部品とルールの対応が契約に無いため。
   * DR-0051 決定3）。それでも節 ID は置いてあるので、着く側だけを見ておく。リンクを張る人が
   * 現れたとき、着き先が在るかどうかをここで確かめられる。
   */
  it('検証ルールのページが、全ルールの節 ID を id として描く', () => {
    expect(renderedSectionIds(Rules)).toEqual(
      rulesByMethod(RULES).flatMap(([, rules]) => rules.map((rule) => ruleSectionId(rule.id))),
    )
  })

  /*
   * ここが本命。部品ページが出した href を hash として解釈し、その指す先（ページと節）が
   * 実在することを確かめる。href の文字列を期待値と突き合わせるだけでは、張る側と期待値が
   * 同じ関数から作られるので行き先の実在は見ていない。
   */
  it('部品ページの allowedIn のリンクが、実在するページの実在する節を指す', () => {
    const { container } = render(<Components />)

    const hrefs = [...container.querySelectorAll('.doc-component a')].map((link) => link.getAttribute('href'))

    expect(hrefs.length).toBeGreaterThan(0)

    const layoutSectionIds = new Set(renderedSectionIds(Layouts))

    for (const href of hrefs) {
      const location = parseDocsHash(href ?? '')

      expect(location, `${href} が hash の書式に合わない`).not.toBeNull()
      expect(DOCS_PAGES.map((page) => page.id), `${href} の指すページが無い`).toContain(location?.pageId)
      expect(layoutSectionIds, `${href} の指す節が無い`).toContain(location?.sectionId)
    }
  })

  /*
   * リンクは allowedIn のすべてについて張られる。件数を見ないと、1件だけ張って残りを落とす
   * 実装でも上の検査は通る。
   */
  it('allowedIn のすべてについてリンクが張られる', () => {
    const { container } = render(<Components />)

    const hrefs = [...container.querySelectorAll('.doc-component a')].map((link) => link.getAttribute('href'))

    expect(hrefs).toEqual(
      COMPONENTS.flatMap((component) =>
        component.allowedIn.map((layoutName) =>
          formatDocsHash(LAYOUTS_PAGE_ID, layoutSectionId(layoutName)),
        ),
      ),
    )
  })

  /*
   * リンク先のページ ID が `DOCS_PAGES` に登録されていること。定数を経由していても、その定数が
   * 登録と食い違えばリンクは先頭ページへ落ちる。
   */
  it('リンクに使うページ ID が、どれもページ一覧に登録されている', () => {
    const registered = DOCS_PAGES.map((page) => page.id)

    expect(registered).toContain(LAYOUTS_PAGE_ID)
    expect(registered).toContain(COMPONENTS_PAGE_ID)
  })
})
