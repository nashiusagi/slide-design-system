import { describe, expect, it } from 'vitest'

import { flatten, measure } from './generate-theme.mjs'

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

  it('$ で始まるキーは変数にしない。説明と実測値であって契約の値ではない', () => {
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
