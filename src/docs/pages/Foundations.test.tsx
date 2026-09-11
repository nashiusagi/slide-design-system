import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CONTRAST_SURFACES, TOKENS, cssVarName, isTokenGroup, themeValue, tokenEntries, type TokenNode } from '../tokens'
import { Foundations } from './Foundations'

/** トークンの葉を、その位置とともに列挙する。 */
function leaves(node: TokenNode, path: string[] = []): { path: string[]; name: string }[] {
  return tokenEntries(node).flatMap(([name, value]) =>
    isTokenGroup(value) ? leaves(value, [...path, name]) : [{ path: [...path, name], name }],
  )
}

describe('Foundations', () => {
  it('tokens.json の葉をすべて1行ずつ描く', () => {
    const { container } = render(<Foundations />)

    expect(container.querySelectorAll('.doc-token')).toHaveLength(leaves(TOKENS).length)
  })

  /*
   * カタログ側へトークン名・値を列挙しないので、トークンが増えればページも増える
   * （DR-0042 決定2）。これを固定するために、tokens.json へ1つ足した木を描いて確かめる。
   */
  it('トークンが増えれば、カタログ側を変えずに行が増える', async () => {
    const before = render(<Foundations />).container.querySelectorAll('.doc-token').length

    // theme.css に対応する変数を持たない値なので、表示は tokens.json の生の値へ落ちる。
    const extended: TokenNode = { ...TOKENS, radius: { ...(TOKENS.radius as TokenNode), lg: 16 } }

    vi.resetModules()
    vi.doMock('../tokens', async () => ({
      ...(await vi.importActual<typeof import('../tokens')>('../tokens')),
      TOKENS: extended,
    }))

    try {
      const { Foundations: WithExtraToken } = await import('./Foundations')
      const { container } = render(<WithExtraToken />)

      expect(container.querySelectorAll('.doc-token')).toHaveLength(before + 1)
      expect(container.textContent).toContain('lg')
    } finally {
      vi.doUnmock('../tokens')
      vi.resetModules()
    }
  })

  it('$ で始まるキー（説明・算出値）を描かない', () => {
    render(<Foundations />)

    expect(screen.queryByText('$comment')).not.toBeInTheDocument()
    expect(screen.queryByText('$measured')).not.toBeInTheDocument()
    expect(screen.queryByText('$schema')).not.toBeInTheDocument()
  })

  it('値は theme.css に生成された表記（単位込み）で出る', () => {
    const { container } = render(<Foundations />)

    const values = [...container.querySelectorAll('.doc-token__value')].map((node) => node.textContent)

    expect(values).toEqual(leaves(TOKENS).map(({ path }) => themeValue(path)))
  })

  /*
   * 見本の種類ごとに当てるプロパティが違う（背景色・幅・角丸・影・字）ので、1種類だけを
   * 見ると他の枝が生の値を渡す書き方へ変わっても落ちない。全種類を1件ずつ通す。
   */
  it('どの種類の見本も、style の値が var(--dh-*) 参照になっている', () => {
    const { container } = render(<Foundations />)

    const sampleClasses = ['.doc-swatch', '.doc-space-bar', '.doc-radius-box', '.doc-shadow-box', '.doc-sample']

    for (const selector of sampleClasses) {
      const samples = [...container.querySelectorAll(selector)]

      expect(samples.length).toBeGreaterThan(0)

      for (const sample of samples) {
        expect(sample.getAttribute('style')).toMatch(/var\(--dh-[\w-]+\)/)
      }
    }
  })

  it('色の見本には、その色のトークンの var(--dh-*) を当てる', () => {
    const { container } = render(<Foundations />)

    const swatch = container.querySelector('.doc-swatch')

    expect(swatch?.getAttribute('style')).toContain(`var(${cssVarName(['color', 'background'])})`)
  })

  it('キャンバスの枠は、幅に canvas.width、高さに canvas.height を当てる', () => {
    const { container } = render(<Foundations />)

    const frame = container.querySelector('.doc-canvas__frame')

    expect(frame).toHaveStyle({
      width: `var(${cssVarName(['canvas', 'width'])})`,
      height: `var(${cssVarName(['canvas', 'height'])})`,
    })
  })

  /*
   * 上のテストは、tokens.json の canvas がたまたま width, height の順で書かれているため、
   * 宣言順の先頭2つを幅・高さに当てる実装でも通ってしまう。キーの並びを入れ替えた木を
   * 描かせて、名前で引いていること自体を固定する。
   */
  it('canvas のキーの並びが入れ替わっても、幅と高さを取り違えない', async () => {
    const canvas = TOKENS.canvas as TokenNode
    const reversed: TokenNode = {
      ...TOKENS,
      canvas: Object.fromEntries([...Object.entries(canvas)].reverse()),
    }

    vi.resetModules()
    vi.doMock('../tokens', async () => ({
      ...(await vi.importActual<typeof import('../tokens')>('../tokens')),
      TOKENS: reversed,
    }))

    try {
      const { Foundations: WithReversedCanvas } = await import('./Foundations')
      const { container } = render(<WithReversedCanvas />)

      expect(container.querySelector('.doc-canvas__frame')).toHaveStyle({
        width: `var(${cssVarName(['canvas', 'width'])})`,
        height: `var(${cssVarName(['canvas', 'height'])})`,
      })
    } finally {
      vi.doUnmock('../tokens')
      vi.resetModules()
    }
  })

  it('色には rules.json の面ごとのコントラスト比を併記する', () => {
    const { container } = render(<Foundations />)

    const colorRows = [...container.querySelectorAll('.doc-token')].filter((row) => row.querySelector('.doc-swatch'))

    expect(colorRows.length).toBeGreaterThan(0)

    for (const row of colorRows) {
      const surfaces = [...row.querySelectorAll('.doc-contrast__surface')].map((node) => node.textContent)

      expect(surfaces).toEqual(CONTRAST_SURFACES)
    }
  })

  it('コントラスト比は 比:1 の形で出す。記録の無い組（同じ色どうし）は — にする', () => {
    const { container } = render(<Foundations />)

    const ratios = [...container.querySelectorAll('.doc-contrast__ratio')].map((node) => node.textContent ?? '')

    expect(ratios.some((text) => /^\d+\.\d{2}:1$/.test(text))).toBe(true)
    expect(ratios).toContain('—')
  })
})
