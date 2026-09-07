import { describe, expect, it } from 'vitest'

import { findDrifts, flatten, measure, renderTheme } from './generate-theme.mjs'

describe('flatten', () => {
  it('入れ子を --dh-* の名前へ潰し、camelCase を kebab-case にする', () => {
    expect(flatten({ color: { textMuted: 'oklch(0.52 0 0)' } })).toEqual([
      { name: '--dh-color-text-muted', value: 'oklch(0.52 0 0)' },
    ])
  })

  it('数値には px を付ける', () => {
    expect(flatten({ space: { lg: 24 } })).toEqual([{ name: '--dh-space-lg', value: '24px' }])
  })

  it('比率と字の太さには単位を付けない', () => {
    expect(flatten({ type: { lineHeight: { tight: 1.2 }, weight: { bold: 700 } } })).toEqual([
      { name: '--dh-type-line-height-tight', value: '1.2' },
      { name: '--dh-type-weight-bold', value: '700' },
    ])
  })

  it('$ で始まるキーは変数にしない。説明と算出値であって契約の値ではない', () => {
    expect(flatten({ color: { $comment: '説明', text: 'oklch(0.21 0 0)' } })).toEqual([
      { name: '--dh-color-text', value: 'oklch(0.21 0 0)' },
    ])
  })
})

describe('measure', () => {
  const colors = {
    $comment: '説明',
    background: 'oklch(1 0 0)',
    text: 'oklch(0 0 0)',
    accent: 'oklch(0.47 0.22 305)',
    danger: 'oklch(0.53 0.2 27)',
  }

  it('全色ペアを 1 組ずつ測る。順序違いは同じ組なので重複させない', () => {
    expect(Object.keys(measure(colors).contrast)).toEqual([
      'background|text',
      'background|accent',
      'background|danger',
      'text|accent',
      'text|danger',
      'accent|danger',
    ])
  })

  it('色相差は彩度を持つ色どうしだけを測る', () => {
    expect(measure(colors).hueDistance).toEqual({ 'accent|danger': 82 })
  })
})

describe('findDrifts', () => {
  /** 突き合わせが通る最小のトークン。各テストはここから1つだけ壊す。 */
  const tokens = {
    color: { background: 'oklch(1 0 0)', accent: 'oklch(0.47 0.22 305)' },
    space: { lg: 24 },
    $measured: {
      contrast: { 'background|accent': 7.72 },
      hueDistance: {},
    },
  }

  /** 上のトークンから生成される theme.css そのもの。 */
  const theme = renderTheme(tokens, measure(tokens.color))

  it('一致していれば何も返さない', () => {
    expect(findDrifts(tokens, theme)).toEqual([])
  })

  it('theme.css が空ファイルでも乖離として捕まえる', () => {
    // 空文字を「読めなかった」の番兵に使うと、ここが素通りして --dh-* が
    // 1 つも無い CSS のまま pnpm check 全体が緑になる。
    const found = findDrifts(tokens, '')

    expect(found).toContain('design/theme.css が design/tokens.json と食い違っている。')
  })

  it('theme.css が 1 行違うだけでも捕まえる', () => {
    const found = findDrifts(tokens, theme.replace('24px', '25px'))

    expect(found).toContain('design/theme.css が design/tokens.json と食い違っている。')
  })

  it('theme.css が無いことと、空であることを別のこととして出す', () => {
    expect(findDrifts(tokens, null)).toContain('design/theme.css が無い。')
    expect(findDrifts(tokens, '')).not.toContain('design/theme.css が無い。')
  })

  it('$measured が消えていたら、例外ではなく乖離として出す', () => {
    const withoutMeasured = { ...tokens, $measured: undefined }

    expect(findDrifts(withoutMeasured, theme)).toEqual(['design/tokens.json に $measured が無い。'])
  })

  it('記録された算出値が再計算とずれていたら捕まえる', () => {
    const stale = { ...tokens, $measured: { contrast: { 'background|accent': 9.99 }, hueDistance: {} } }

    expect(findDrifts(stale, theme)).toEqual([
      'design/tokens.json の $measured.contrast が算出値と食い違っている。',
    ])
  })
})
