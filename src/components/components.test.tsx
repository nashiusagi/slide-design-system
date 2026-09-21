import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BulletList, Emphasis, SlideTitle, Statement } from '.'

/*
 * 部品の実装（DR-0050）。見た目の値は components.css が持ち、トークンからしか取らない
 * ので、ここで確かめるのは DOM の形だけにする。jsdom は組版しないため、実際の余白や
 * 文字サイズは measure（DR-0011）が実測で見る。
 */

describe('SlideTitle', () => {
  it('見出しとして描かれる', () => {
    render(<SlideTitle text="設計契約からスライドを書く" />)

    const heading = screen.getByRole('heading', { name: '設計契約からスライドを書く' })

    expect(heading).toHaveClass('slide-title')
  })
})

describe('BulletList', () => {
  it('順序を持たない一覧として、項目をそのまま並べる', () => {
    const { container } = render(<BulletList items={['ひとつめ', 'ふたつめ']} />)

    const list = container.querySelector('.bullet-list')

    // ol だと番号が項目のあいだに順序の意味を与える。契約が禁じている読み方になる。
    expect(list?.tagName).toBe('UL')
    expect([...screen.getAllByRole('listitem')].map((item) => item.textContent)).toEqual([
      'ひとつめ',
      'ふたつめ',
    ])
  })
})

describe('Statement', () => {
  it('結論を1つの段落として描く', () => {
    const { container } = render(<Statement text="はみ出しは実測で判定できる" />)

    const statement = container.querySelector('.statement')

    expect(statement?.tagName).toBe('P')
    expect(statement?.textContent).toBe('はみ出しは実測で判定できる')
  })

  /*
   * statement レイアウトの slots は emphasis を任意で1つ許している（DR-0035）。埋め込める
   * 先はこの部品しかないので、ここが受け取れないと契約上ありえる組み合わせを作れない。
   */
  it('Emphasis を埋め込める', () => {
    const { container } = render(
      <Statement
        text={
          <>
            決めるのは<Emphasis text="契約" />
          </>
        }
      />,
    )

    expect(container.querySelector('.statement .emphasis')?.textContent).toBe('契約')
  })
})

describe('Emphasis', () => {
  it('強調として描かれる', () => {
    const { container } = render(<Emphasis text="一語" />)

    const emphasis = container.querySelector('.emphasis')

    expect(emphasis?.tagName).toBe('STRONG')
    expect(emphasis?.textContent).toBe('一語')
  })
})
