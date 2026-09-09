import { describe, expect, it } from 'vitest'

import {
  compositeBackgroundLayers,
  contrastRatioFromCss,
  evaluateSlideMeasurements,
  isWithinCanvas,
  meetsMinFontSize,
  resolveTextContrastMinimum,
} from './measure-slides.mjs'

const WHITE = /** @type {[number, number, number, number][]} */ ([[255, 255, 255, 1]])

const CANVAS = { width: 1280, height: 720 }

describe('isWithinCanvas', () => {
  it('キャンバスちょうどは収まる', () => {
    expect(isWithinCanvas({ left: 0, top: 0, right: 1280, bottom: 720 }, CANVAS, 0)).toBe(true)
  })

  it('右または下にはみ出すと落ちる', () => {
    expect(isWithinCanvas({ left: 0, top: 0, right: 1280.6, bottom: 720 }, CANVAS, 0)).toBe(false)
    expect(isWithinCanvas({ left: 0, top: 0, right: 1280, bottom: 720.6 }, CANVAS, 0)).toBe(false)
  })

  it('左または上にはみ出すと落ちる', () => {
    expect(isWithinCanvas({ left: -0.6, top: 0, right: 1280, bottom: 720 }, CANVAS, 0)).toBe(false)
    expect(isWithinCanvas({ left: 0, top: -0.6, right: 1280, bottom: 720 }, CANVAS, 0)).toBe(false)
  })

  it('許容誤差の範囲内は収まる', () => {
    expect(isWithinCanvas({ left: -0.5, top: 0, right: 1280.5, bottom: 720 }, CANVAS, 0.5)).toBe(true)
  })
})

describe('meetsMinFontSize', () => {
  it('下限ちょうどは満たす', () => {
    expect(meetsMinFontSize(18, 18)).toBe(true)
  })

  it('下限を割ると満たさない', () => {
    expect(meetsMinFontSize(17.9, 18)).toBe(false)
  })
})

describe('resolveTextContrastMinimum', () => {
  it('役割ごとの最低値のうち最も厳しい値を使う', () => {
    const contrastRules = {
      requirements: [
        { role: '本文', foregrounds: ['text'], minimum: 4.5 },
        { role: 'UI 境界とフォーカス', foregrounds: ['border'], minimum: 3 },
      ],
    }

    expect(resolveTextContrastMinimum(contrastRules)).toBe(4.5)
  })
})

describe('contrastRatioFromCss', () => {
  it('rgb() の前景・合成済み背景（0..255の3成分）から比を求める', () => {
    expect(contrastRatioFromCss('rgb(0, 0, 0)', [255, 255, 255])).toBe(21)
  })
})

describe('compositeBackgroundLayers', () => {
  it('不透明な背景は自身の色をそのまま返す', () => {
    expect(compositeBackgroundLayers([[10, 20, 30, 1]])).toEqual([10, 20, 30])
  })

  it('レイヤーが無いときは白（キャンバスの外側）を返す', () => {
    expect(compositeBackgroundLayers([])).toEqual([255, 255, 255])
  })

  it('半透明な背景は alpha を捨てず、下の層と合成する。不透明として扱うと実測とズレる', () => {
    // rgba(0, 0, 0, 0.5) を白の上に重ねると、半分だけ暗くなった灰色になる。
    // alpha を無視して不透明な黒として扱うと (0,0,0) になってしまう。
    expect(compositeBackgroundLayers([[0, 0, 0, 0.5]])).toEqual([128, 128, 128])
  })

  it('半透明レイヤーを2枚重ねると、白の寄与は (1-alpha) の積になる', () => {
    // 白地に黒50%を重ねると白は50%残る。さらにその上へ黒50%を重ねると、
    // 白の寄与は 0.5 × 0.5 = 25%（255 × 0.25 ≈ 64）まで減る。
    expect(compositeBackgroundLayers([[0, 0, 0, 0.5], [0, 0, 0, 0.5]])).toEqual([64, 64, 64])
  })

  it('祖先を不透明な層で打ち切る。その手前の半透明レイヤーは合成に使う', () => {
    // 黒地の上に白50%を重ねると (128,128,128)。不透明な黒より遠い祖先は無視してよい。
    expect(compositeBackgroundLayers([[255, 255, 255, 0.5], [0, 0, 0, 1]])).toEqual([128, 128, 128])
  })
})

describe('evaluateSlideMeasurements', () => {
  const context = {
    slideNumber: 2,
    step: 1,
    canvas: CANVAS,
    overflowToleranceInPx: 0.5,
    minFontSizePx: 18,
    contrastMinimum: 4.5,
  }

  it('収まっていて・下限を満たし・コントラストも十分なら違反0件', () => {
    const records = [
      {
        selector: 'section[0] > p[0]',
        rect: { left: 100, top: 100, right: 400, bottom: 150 },
        hasDirectText: true,
        fontSizePx: 24,
        color: 'rgb(0, 0, 0)',
        backgroundLayers: WHITE,
      },
    ]

    expect(evaluateSlideMeasurements(records, context)).toEqual([])
  })

  it('意図的にはみ出させた要素で no-overflow が落ちる（#8 完了条件）', () => {
    const records = [
      {
        selector: 'section[0] > ul[0] > li[9]',
        rect: { left: 100, top: 100, right: 400, bottom: 760 },
        hasDirectText: true,
        fontSizePx: 24,
        color: 'rgb(0, 0, 0)',
        backgroundLayers: WHITE,
      },
    ]

    const violations = evaluateSlideMeasurements(records, context)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      rule: 'no-overflow',
      slideNumber: 2,
      step: 1,
      selector: 'section[0] > ul[0] > li[9]',
    })
  })

  it('下限未満の fontSize で min-font-size が落ちる', () => {
    const records = [
      {
        selector: 'section[0] > p[0]',
        rect: { left: 0, top: 0, right: 100, bottom: 20 },
        hasDirectText: true,
        fontSizePx: 16,
        color: 'rgb(0, 0, 0)',
        backgroundLayers: WHITE,
      },
    ]

    const violations = evaluateSlideMeasurements(records, context)

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'min-font-size', detail: expect.stringContaining('16px') }),
    ])
  })

  it('基準を満たさないコントラストで contrast が落ちる', () => {
    const records = [
      {
        selector: 'section[0] > p[0]',
        rect: { left: 0, top: 0, right: 100, bottom: 20 },
        hasDirectText: true,
        fontSizePx: 24,
        color: 'rgb(200, 200, 200)',
        backgroundLayers: WHITE,
      },
    ]

    const violations = evaluateSlideMeasurements(records, context)

    expect(violations).toEqual([expect.objectContaining({ rule: 'contrast' })])
  })

  it('テキストを持たない要素は fontSize・contrast の対象にしない。はみ出しだけ見る', () => {
    const records = [
      {
        selector: 'section[0] > div[0]',
        rect: { left: 100, top: 100, right: 1400, bottom: 150 },
        hasDirectText: false,
        fontSizePx: 10,
        color: 'rgb(255, 255, 255)',
        backgroundLayers: WHITE,
      },
    ]

    const violations = evaluateSlideMeasurements(records, context)

    expect(violations).toEqual([expect.objectContaining({ rule: 'no-overflow' })])
  })

  it('半透明な背景を不透明として扱わず合成する。alpha を捨てると誤って pass する', () => {
    // 白地に黒92%の半透明を重ねると、実際に描画される背景は暗い灰色（≈20,20,20）に
    // 近く、白文字とのコントラストは基準を割る。alpha を無視して「不透明な黒」として
    // 扱っても同じ結論（違反）にはなるが、逆方向（薄い黒を不透明と誤認して過剰に
    // 落とす）と対になる正しさの検証として、実際に合成した値で判定できることを見る。
    const records = [
      {
        selector: 'section[0] > p[0]',
        rect: { left: 0, top: 0, right: 100, bottom: 20 },
        hasDirectText: true,
        fontSizePx: 24,
        color: 'rgb(255, 255, 255)',
        backgroundLayers: /** @type {[number, number, number, number][]} */ ([[0, 0, 0, 0.08]]),
      },
    ]

    // rgba(0,0,0,0.08) を白地へ合成すると (235,235,235) に近い明るい背景になり、
    // 白文字はほぼ見えない（コントラスト比が低い）。alpha を捨てて不透明な黒
    // (0,0,0) として扱うと逆に 21:1 の最大コントラストとなり、この違反を見逃す。
    const violations = evaluateSlideMeasurements(records, context)

    expect(violations).toEqual([expect.objectContaining({ rule: 'contrast' })])
  })

  it('1要素が複数ルールに同時に違反しても、それぞれ個別に記録する', () => {
    const records = [
      {
        selector: 'section[0] > li[9]',
        rect: { left: 100, top: 100, right: 400, bottom: 760 },
        hasDirectText: true,
        fontSizePx: 12,
        color: 'rgb(200, 200, 200)',
        backgroundLayers: WHITE,
      },
    ]

    const violations = evaluateSlideMeasurements(records, context)

    expect(violations.map((v) => v.rule).sort()).toEqual(['contrast', 'min-font-size', 'no-overflow'])
  })
})
