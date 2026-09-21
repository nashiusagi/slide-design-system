import type { ComponentType } from 'react'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { COMPONENTS, type ComponentContract } from '../components'
import { formatDocsHash } from '../hash'
import { LAYOUTS, layoutSectionId } from '../layouts'
import { Components } from './Components'

describe('Components', () => {
  it('契約を1件ずつカードにする', () => {
    const { container } = render(<Components />)

    expect(container.querySelectorAll('.doc-component')).toHaveLength(COMPONENTS.length)
  })

  it('契約の文言（役割・使い方）が、対応するカードの中に出る', () => {
    const { container } = render(<Components />)
    const cards = [...container.querySelectorAll('.doc-component')]

    expect(cards).toHaveLength(COMPONENTS.length)

    cards.forEach((card, index) => {
      const component = COMPONENTS[index]
      const text = card.textContent ?? ''

      expect(text).toContain(component.name)
      expect(text).toContain(component.role)

      for (const rule of component.usage) {
        expect(text).toContain(rule)
      }
    })
  })

  it('props の名前・型・必須かどうか・説明が表になる', () => {
    const { container } = render(<Components />)

    const rows = [...container.querySelectorAll('.doc-component')].flatMap((card) => {
      const table = card.querySelectorAll('.doc-prop-table')[0]

      return [...table.querySelectorAll('tbody tr')].map((row) =>
        [...row.querySelectorAll('td')].map((cell) => cell.textContent),
      )
    })

    expect(rows).toEqual(
      COMPONENTS.flatMap((component) =>
        Object.entries(component.props).map(([name, prop]) => [
          name,
          prop.type,
          prop.required ? '必須' : '任意',
          prop.description,
        ]),
      ),
    )
  })

  /*
   * allowedIn からレイアウトの該当項目へ移動できること。ページだけを指すリンクだと、どの
   * レイアウトの話かは読み手が探すことになる。節つきの hash（DR-0048）を指していることまで見る。
   */
  it('allowedIn の各レイアウトが、#/layouts の該当節へのリンクになっている', () => {
    const { container } = render(<Components />)

    const links = [...container.querySelectorAll('.doc-component a')].map((link) => [
      link.textContent,
      link.getAttribute('href'),
    ])

    expect(links).toEqual(
      COMPONENTS.flatMap((component) =>
        component.allowedIn.map((layoutName) => [
          layoutName,
          formatDocsHash('layouts', layoutSectionId(layoutName)),
        ]),
      ),
    )
  })

  /*
   * 必須かどうか・最大数は design/layouts/ の slots が正本で、部品契約は持っていない。
   * 部品側の値を描いていないことを、レイアウト側から組み立てた期待値で固定する。
   */
  it('必須かどうかと最大数を、レイアウト契約の slots から引く', () => {
    const { container } = render(<Components />)

    const rows = [...container.querySelectorAll('.doc-component')].flatMap((card) => {
      const table = card.querySelectorAll('.doc-prop-table')[1]

      return [...table.querySelectorAll('tbody tr')].map((row) =>
        [...row.querySelectorAll('td')].map((cell) => cell.textContent),
      )
    })

    expect(rows).toEqual(
      COMPONENTS.flatMap((component) =>
        component.allowedIn.map((layoutName) => {
          const slot = LAYOUTS.find((layout) => layout.name === layoutName)?.slots.find(
            (candidate) => candidate.component === component.name,
          )

          return [layoutName, slot?.required === true ? '必須' : '任意', String(slot?.max)]
        }),
      ),
    )
  })

  /*
   * このページの目的そのもの。契約にあるのに実装が無い部品を、画面上の穴として出す（DR-0049）。
   * 4部品すべてが未実装なのが、いまの正しい状態である。
   */
  it('実装が無い部品は「未実装」と明示され、いまは全部品がその状態になる', () => {
    const { container } = render(<Components />)

    const marks = [...container.querySelectorAll('[data-implemented]')]

    expect(marks).toHaveLength(COMPONENTS.length)
    expect(marks.map((mark) => mark.getAttribute('data-implemented'))).toEqual(
      COMPONENTS.map(() => 'false'),
    )

    for (const mark of marks) {
      expect(mark.textContent).toBe('未実装')
    }
  })

  /*
   * 実装がある側の見え方。登録表が空のままだと、この枝は一度も描かれない。#37 が登録したときに
   * 初めて動く経路を、いま踏んでおく。
   */
  it('登録のある部品は、未実装ではなくそのプレビューを描く', async () => {
    const Marker: ComponentType = () => <span data-testid="preview-marker" />
    const [first] = COMPONENTS

    vi.resetModules()
    vi.doMock('../components', async () => ({
      ...(await vi.importActual<typeof import('../components')>('../components')),
      COMPONENT_PREVIEWS: { [first.name]: Marker },
    }))

    try {
      const { Components: WithPreview } = await import('./Components')
      const { container } = render(<WithPreview />)

      const marks = [...container.querySelectorAll('[data-implemented]')]

      expect(marks.map((mark) => mark.getAttribute('data-implemented'))).toEqual([
        'true',
        ...COMPONENTS.slice(1).map(() => 'false'),
      ])
      expect(container.querySelectorAll('[data-testid="preview-marker"]')).toHaveLength(1)
    } finally {
      vi.doUnmock('../components')
      vi.resetModules()
    }
  })

  it('部品が増えれば、カタログ側を変えずにカードが増える', async () => {
    const added: ComponentContract = {
      name: 'caption',
      role: '図の下に短い説明を添える。',
      allowedIn: ['bullets'],
      usage: ['1 文に収める'],
      props: { text: { type: 'string', required: true, description: '説明の文言。' } },
    }

    vi.resetModules()
    vi.doMock('../components', async () => ({
      ...(await vi.importActual<typeof import('../components')>('../components')),
      COMPONENTS: [...COMPONENTS, added],
    }))

    try {
      const { Components: WithExtra } = await import('./Components')
      const { container } = render(<WithExtra />)

      expect(container.querySelectorAll('.doc-component')).toHaveLength(COMPONENTS.length + 1)
      expect(container.textContent).toContain(added.role)
    } finally {
      vi.doUnmock('../components')
      vi.resetModules()
    }
  })

  /*
   * allowedIn がレイアウト契約と食い違っているときに、行を消さずに「—」を出す。行が消えると、
   * 対応が壊れたことが表から読み取れなくなる。
   */
  it('allowedIn が指すレイアウトに自分のスロットが無ければ、行を消さず「—」を出す', async () => {
    const orphan: ComponentContract = {
      name: 'orphan',
      role: 'どのレイアウトのスロットにも居ない部品。',
      allowedIn: ['title'],
      usage: ['検査用'],
      props: { text: { type: 'string', required: true, description: '文言。' } },
    }

    vi.resetModules()
    vi.doMock('../components', async () => ({
      ...(await vi.importActual<typeof import('../components')>('../components')),
      COMPONENTS: [orphan],
    }))

    try {
      const { Components: WithOrphan } = await import('./Components')
      const { container } = render(<WithOrphan />)

      const cells = [...container.querySelectorAll('.doc-prop-table')[1].querySelectorAll('tbody td')].map(
        (cell) => cell.textContent,
      )

      expect(cells).toEqual(['title', '—', '—'])
    } finally {
      vi.doUnmock('../components')
      vi.resetModules()
    }
  })
})
