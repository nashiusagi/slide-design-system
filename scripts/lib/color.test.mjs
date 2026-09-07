import { describe, expect, it } from 'vitest'

import {
  contrastRatio,
  hueDistance,
  isInSrgbGamut,
  oklchToHex,
  parseOklch,
  relativeLuminance,
} from './color.mjs'

describe('parseOklch', () => {
  it('L C H を読む', () => {
    expect(parseOklch('oklch(0.47 0.22 305)')).toEqual({ l: 0.47, c: 0.22, h: 305 })
  })

  it('別記法は受け付けない。実測とブラウザの描画がずれる余地を作らないため', () => {
    expect(() => parseOklch('#791fba')).toThrow()
    expect(() => parseOklch('oklch(0.47 0.22 305 / 0.5)')).toThrow()
  })
})

describe('oklchToHex', () => {
  it('白と黒が端に落ちる', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff')
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000')
  })

  it('無彩色は 3 成分が揃う', () => {
    const hex = oklchToHex('oklch(0.52 0 0)')

    expect(hex.slice(1, 3)).toBe(hex.slice(3, 5))
    expect(hex.slice(3, 5)).toBe(hex.slice(5, 7))
  })
})

describe('relativeLuminance', () => {
  it('白は 1、黒は 0', () => {
    expect(relativeLuminance('oklch(1 0 0)')).toBeCloseTo(1, 5)
    expect(relativeLuminance('oklch(0 0 0)')).toBeCloseTo(0, 5)
  })
})

describe('contrastRatio', () => {
  it('白と黒で 21:1 になる', () => {
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBe(21)
  })

  it('前景と背景を入れ替えても同じ', () => {
    const a = 'oklch(0.47 0.22 305)'
    const b = 'oklch(1 0 0)'

    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a))
  })

  it('小数第3位を切り上げない。四捨五入だと基準を割った値が基準ちょうどとして通る', () => {
    // 実測は 13.5798...。四捨五入なら 13.58 になる。
    const ratio = contrastRatio('oklch(0.3 0 0)', 'oklch(1 0 0)')

    expect(ratio).toBe(13.57)
  })
})

describe('isInSrgbGamut', () => {
  it('色域の内と外を分ける', () => {
    expect(isInSrgbGamut('oklch(0.47 0.22 305)')).toBe(true)
    expect(isInSrgbGamut('oklch(0.95 0.03 305)')).toBe(false)
  })
})

describe('hueDistance', () => {
  it('円環として測る', () => {
    expect(hueDistance('oklch(0.5 0.2 350)', 'oklch(0.5 0.2 10)')).toBe(20)
  })

  it('180 度を超えない', () => {
    expect(hueDistance('oklch(0.5 0.2 0)', 'oklch(0.5 0.2 200)')).toBe(160)
  })
})
