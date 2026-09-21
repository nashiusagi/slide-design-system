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

          return slot === undefined
            ? [layoutName, '—', '—']
            : [layoutName, slot.required ? '必須' : '任意', String(slot.max)]
        }),
      ),
    )
  })

  /*
   * 契約と実装の差を画面に出す場所（DR-0049）。いまは差が無く、4部品すべてが実描画になる
   * ——それが Issue #37 の受け入れ基準そのものである。
   */
  it('全部品が実描画になり、「未実装」の枠が1つも残らない', () => {
    const { container } = render(<Components />)

    const marks = [...container.querySelectorAll('[data-implemented]')]

    expect(marks).toHaveLength(COMPONENTS.length)
    expect(marks.map((mark) => mark.getAttribute('data-implemented'))).toEqual(
      COMPONENTS.map(() => 'true'),
    )

    expect(container.querySelectorAll('.doc-component__unimplemented')).toHaveLength(0)
  })

  /*
   * 登録が無い部品は、空欄ではなく「未実装」と書いた枠になる（DR-0049 決定2）。実データでは
   * もう踏まない枝なので、表を差し替えて踏む。ここが消えると、契約を足して実装が追いつかない
   * ときの見え方を誰も確かめていない状態になる。
   */
  it('登録が無い部品は「未実装」と明示される', async () => {
    vi.resetModules()
    vi.doMock('../components', async () => ({
      ...(await vi.importActual<typeof import('../components')>('../components')),
      COMPONENT_PREVIEWS: {},
    }))

    try {
      const { Components: WithoutPreviews } = await import('./Components')
      const { container } = render(<WithoutPreviews />)

      const marks = [...container.querySelectorAll('[data-implemented]')]

      expect(marks).toHaveLength(COMPONENTS.length)
      expect(marks.map((mark) => mark.getAttribute('data-implemented'))).toEqual(
        COMPONENTS.map(() => 'false'),
      )

      for (const mark of marks) {
        expect(mark.textContent).toBe('未実装')
      }
    } finally {
      vi.doUnmock('../components')
      vi.resetModules()
    }
  })

  /*
   * 実データの偏りで、実装を定数へ固定しても落ちない列がある。いま design/components/ の props は
   * 4件すべて required: true、design/layouts/ の slots は5件すべて max: 1 で、値の種類が1つしか
   * 無い。テストの期待値も実装と同じ式で組み立てているため、実装が契約を見なくなっても一致する。
   * 種類のある契約を差し替えて、その2列だけを踏む。
   */
  it('props の必須欄と、スロットの最大数を、契約の値から引く', async () => {
    const varied: ComponentContract = {
      name: 'varied',
      role: '値の種類を持つ契約。',
      allowedIn: ['bullets'],
      usage: ['検査用'],
      props: {
        required: { type: 'string', required: true, description: '必須の prop。' },
        optional: { type: 'string', required: false, description: '任意の prop。' },
      },
    }

    vi.resetModules()
    vi.doMock('../components', async () => ({
      ...(await vi.importActual<typeof import('../components')>('../components')),
      COMPONENTS: [varied],
    }))
    vi.doMock('../layouts', async () => ({
      ...(await vi.importActual<typeof import('../layouts')>('../layouts')),
      LAYOUTS: [
        {
          name: 'bullets',
          role: '検査用',
          whenToUse: ['検査用'],
          whenNotToUse: ['検査用'],
          classes: ['slide--bullets'],
          slots: [{ component: 'varied', required: false, max: 3 }],
        },
      ],
    }))

    try {
      const { Components: WithVaried } = await import('./Components')
      const { container } = render(<WithVaried />)

      const propCells = [...container.querySelectorAll('.doc-prop-table')[0].querySelectorAll('tbody tr')].map(
        (row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent),
      )

      expect(propCells).toEqual([
        ['required', 'string', '必須', '必須の prop。'],
        ['optional', 'string', '任意', '任意の prop。'],
      ])

      const slotCells = [...container.querySelectorAll('.doc-prop-table')[1].querySelectorAll('tbody td')].map(
        (cell) => cell.textContent,
      )

      expect(slotCells).toEqual(['bullets', '任意', '3'])
    } finally {
      vi.doUnmock('../components')
      vi.doUnmock('../layouts')
      vi.resetModules()
    }
  })

  /*
   * 登録された相手がそのまま描かれること。実データの登録は4件とも本物の部品なので、
   * 「登録を引いて描いている」のか「たまたま別の経路で描けている」のかがここでしか分かれない。
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
      // 実在するレイアウト名を使う。実在しない名前だと、slotOf が undefined を返す理由が
      // 「レイアウトが無い」に変わり、見たい枝（レイアウトは在るがスロットに居ない）を踏まない。
      allowedIn: [LAYOUTS[0].name],
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

      expect(cells).toEqual([LAYOUTS[0].name, '—', '—'])
    } finally {
      vi.doUnmock('../components')
      vi.resetModules()
    }
  })
})
