import { describe, expect, it } from 'vitest'

import {
  contrastRatio,
  contrastRatioFromRgb,
  hueDistance,
  isInSrgbGamut,
  oklchToHex,
  parseCssRgb,
  parseOklch,
  relativeLuminance,
  relativeLuminanceFromRgb,
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

  it('彩度のある色を固定する。無彩色だけだと行列の入れ替えを検出できない', () => {
    // 無彩色では 3 行の係数和が等しいため、R 行と B 行を入れ替えても白・黒・灰は
    // 変わらない。紫が青緑へ転ぶ改変を捕まえるには、彩度のある色の期待値が要る。
    expect(oklchToHex('oklch(0.47 0.22 305)')).toBe('#791fba')
    expect(oklchToHex('oklch(0.53 0.2 27)')).toBe('#c51e21')
    expect(oklchToHex('oklch(0.51 0.13 150)')).toBe('#187a3b')
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

  it('彩度のある色の比を固定する。相対輝度の係数と変換行列の両方を締める', () => {
    expect(contrastRatio('oklch(0.47 0.22 305)', 'oklch(1 0 0)')).toBe(7.72)
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

describe('relativeLuminanceFromRgb', () => {
  it('白は 1、黒は 0', () => {
    expect(relativeLuminanceFromRgb([255, 255, 255])).toBeCloseTo(1, 5)
    expect(relativeLuminanceFromRgb([0, 0, 0])).toBeCloseTo(0, 5)
  })

  it('oklch 経由の relativeLuminance と一致する。8bit 丸め後の値を基準にする点は変わらない', () => {
    const rgb = /** @type {[number, number, number]} */ (
      [1, 3, 5].map((offset) => parseInt(oklchToHex('oklch(0.47 0.22 305)').slice(offset, offset + 2), 16))
    )

    expect(relativeLuminanceFromRgb(rgb)).toBe(relativeLuminance('oklch(0.47 0.22 305)'))
  })
})

describe('contrastRatioFromRgb', () => {
  it('白と黒で 21:1 になる', () => {
    expect(contrastRatioFromRgb([0, 0, 0], [255, 255, 255])).toBe(21)
  })

  it('前景と背景を入れ替えても同じ', () => {
    expect(contrastRatioFromRgb([33, 33, 33], [255, 255, 255])).toBe(
      contrastRatioFromRgb([255, 255, 255], [33, 33, 33]),
    )
  })
})

describe('parseCssRgb', () => {
  it('rgb() を読む。alpha は省略時 1', () => {
    expect(parseCssRgb('rgb(33, 33, 33)')).toEqual({ rgb: [33, 33, 33], alpha: 1 })
  })

  it('rgba() を読む', () => {
    expect(parseCssRgb('rgba(0, 0, 0, 0)')).toEqual({ rgb: [0, 0, 0], alpha: 0 })
  })

  it('oklch() を読む。Chromium が CSS Color 4 の計算値を保持し、rgb() へ変換せず返すことがある', () => {
    const { rgb, alpha } = parseCssRgb('oklch(0.21 0 0)')

    // design/tokens.json の text（oklch(0.21 0 0)）は #181818 相当。
    expect(rgb).toEqual([24, 24, 24])
    expect(alpha).toBe(1)
  })

  it('alpha 付きの oklch() を読む', () => {
    expect(parseCssRgb('oklch(1 0 0 / 0.5)')).toEqual({ rgb: [255, 255, 255], alpha: 0.5 })
  })

  it('別記法は受け付けない', () => {
    expect(() => parseCssRgb('#791fba')).toThrow()
    expect(() => parseCssRgb('hsl(0, 0%, 0%)')).toThrow()
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
