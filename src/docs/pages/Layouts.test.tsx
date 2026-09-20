import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LAYOUTS, type LayoutContract } from '../layouts'
import { cssVarName, themeValue } from '../tokens'
import { Layouts } from './Layouts'

/**
 * カタログのページのソース。契約の文言が書き写されていないことを、実体を読んで確かめる。
 *
 * 1ファイルではなくページ全体を glob で取る。ファイル単位で書くと、カードの描画を別ファイルへ
 * 切り出してそちらに文言を直書きするだけで検査の外へ出られる。ページを足したら自動で対象に
 * 入る形にしておけば、#36 / #38 でテストを書き忘れても複製は落ちる。
 */
const PAGE_SOURCES = Object.entries(
  import.meta.glob<string>('./*.tsx', { eager: true, query: '?raw', import: 'default' }),
).filter(([path]) => !path.includes('.test.'))

describe('Layouts', () => {
  it('契約を1件ずつカードにする', () => {
    const { container } = render(<Layouts />)

    expect(container.querySelectorAll('.doc-layout')).toHaveLength(LAYOUTS.length)
  })

  /*
   * カードと契約の対応まで見る。ページ全体のテキストに含まれることだけを見ると、カードごとで
   * はなくページ末尾へまとめて描く実装へ変えても通ってしまう。
   */
  it('契約の文言（役割・使うとき・使わないとき）が、対応するカードの中に出る', () => {
    const { container } = render(<Layouts />)
    const cards = [...container.querySelectorAll('.doc-layout')]

    expect(cards).toHaveLength(LAYOUTS.length)

    cards.forEach((card, index) => {
      const layout = LAYOUTS[index]
      const text = card.textContent ?? ''

      expect(text).toContain(layout.name)
      expect(text).toContain(layout.role)

      for (const sentence of [...layout.whenToUse, ...layout.whenNotToUse]) {
        expect(text).toContain(sentence)
      }
    })
  })

  it('スロットの部品名・必須かどうか・最大数が出る', () => {
    const { container } = render(<Layouts />)

    const rows = [...container.querySelectorAll('.doc-slot-table tbody tr')]

    expect(rows).toHaveLength(LAYOUTS.flatMap((layout) => layout.slots).length)

    const cells = rows.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent))

    expect(cells).toEqual(
      LAYOUTS.flatMap((layout) =>
        layout.slots.map((slot) => [slot.component, slot.required ? '必須' : '任意', String(slot.max)]),
      ),
    )
  })

  /*
   * プレビューが契約の classes を当てていること。ここが外れると、枠は同じ大きさのまま
   * design/layout.css が何も当たらない姿で描かれ、見た目だけが静かに嘘になる。
   */
  it('プレビューの枠に契約の classes が当たっている', () => {
    const { container } = render(<Layouts />)

    const frames = [...container.querySelectorAll('.doc-canvas__frame')]

    expect(frames).toHaveLength(LAYOUTS.length)

    frames.forEach((frame, index) => {
      for (const className of LAYOUTS[index].classes) {
        expect(frame).toHaveClass(className)
      }
    })
  })

  /*
   * 枠の寸法は canvas トークンから引く。数値を書き写すと、キャンバスの寸法を変えたときに
   * プレビューだけが古い比率で残る。
   */
  it('プレビューの枠の寸法が、design/theme.css に実在する var(--dh-canvas-*) 参照になっている', () => {
    const { container } = render(<Layouts />)

    /*
     * 変数名だけを見ると、トークンの位置（canvas.width / canvas.height）が改名されたときに
     * 「どこも指さない var()」を当て続けても通る。枠は幅・高さが auto の潰れた形になるのに、
     * 検査は緑のままになる。当てた変数が theme.css に在ることまで見る。
     */
    for (const path of [['canvas', 'width'], ['canvas', 'height']]) {
      expect(themeValue(path), `${cssVarName(path)} が design/theme.css に無い`).not.toBeNull()
    }

    for (const frame of container.querySelectorAll('.doc-canvas__frame')) {
      const style = frame.getAttribute('style') ?? ''

      expect(style).toContain(`var(${cssVarName(['canvas', 'width'])})`)
      expect(style).toContain(`var(${cssVarName(['canvas', 'height'])})`)
    }
  })

  it('プレビューの中身はスロットごとのプレースホルダ', () => {
    const { container } = render(<Layouts />)

    const placeholders = [...container.querySelectorAll('.doc-slot-placeholder')].map(
      (node) => node.textContent,
    )

    expect(placeholders).toEqual(LAYOUTS.flatMap((layout) => layout.slots.map((slot) => slot.component)))
  })

  /*
   * 契約の文言をページ側へ書き写さない（DR-0042 決定2）。役割・選択基準・クラス名が
   * ソースに現れないことを見る。レイアウト名そのものは見ない。'title' のような語が
   * クラス名や props の名前として正当に現れるためだ。
   */
  it('契約の文言がカタログのどのページにも書かれていない', () => {
    /*
     * 読み込みが空・0件だと、以下の「含まれない」はすべて素通りする（DR-0043 決定1 と同じ形）。
     * 対象が在り、中身が読めていることを先に確かめる。
     */
    expect(PAGE_SOURCES.length).toBeGreaterThan(0)

    for (const [path, source] of PAGE_SOURCES) {
      expect(source.length, `${path} の中身が空`).toBeGreaterThan(0)

      for (const layout of LAYOUTS) {
        for (const text of [layout.role, ...layout.whenToUse, ...layout.whenNotToUse, ...layout.classes]) {
          expect(source, `${path} に ${layout.name} の契約の文言が書かれている`).not.toContain(text)
        }
      }
    }
  })

  /*
   * カタログ側に名前の一覧を持たないので、契約を1つ足せばページを変えずに現れる
   * （DR-0042 決定2）。1つ足した一覧を描いて確かめる。
   */
  it('レイアウトが増えれば、カタログ側を変えずにカードが増える', async () => {
    const added: LayoutContract = {
      name: 'aside',
      role: '差し込みの補足を示す。',
      whenToUse: ['補足を1枚だけ挟みたいとき'],
      whenNotToUse: ['本筋の主張を述べたいとき'],
      classes: ['slide--aside'],
      slots: [{ component: 'slide-title', required: true, max: 1 }],
    }

    vi.resetModules()
    vi.doMock('../layouts', async () => ({
      ...(await vi.importActual<typeof import('../layouts')>('../layouts')),
      LAYOUTS: [...LAYOUTS, added],
    }))

    try {
      const { Layouts: WithExtraLayout } = await import('./Layouts')
      const { container } = render(<WithExtraLayout />)

      expect(container.querySelectorAll('.doc-layout')).toHaveLength(LAYOUTS.length + 1)
      expect(container.textContent).toContain(added.role)
      expect(container.querySelector('.slide--aside')).not.toBeNull()
    } finally {
      vi.doUnmock('../layouts')
      vi.resetModules()
    }
  })
})
