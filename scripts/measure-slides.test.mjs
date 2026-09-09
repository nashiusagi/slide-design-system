import { describe, expect, it } from 'vitest'

import {
  contrastRatioFromCss,
  evaluateSlideMeasurements,
  isWithinCanvas,
  meetsMinFontSize,
  resolveTextContrastMinimum,
} from './measure-slides.mjs'

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
  it('rgb() の前景・背景から比を求める', () => {
    expect(contrastRatioFromCss('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBe(21)
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
        backgroundColor: 'rgb(255, 255, 255)',
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
        backgroundColor: 'rgb(255, 255, 255)',
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
        backgroundColor: 'rgb(255, 255, 255)',
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
        backgroundColor: 'rgb(255, 255, 255)',
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
        backgroundColor: 'rgb(255, 255, 255)',
      },
    ]

    const violations = evaluateSlideMeasurements(records, context)

    expect(violations).toEqual([expect.objectContaining({ rule: 'no-overflow' })])
  })

  it('1要素が複数ルールに同時に違反しても、それぞれ個別に記録する', () => {
    const records = [
      {
        selector: 'section[0] > li[9]',
        rect: { left: 100, top: 100, right: 400, bottom: 760 },
        hasDirectText: true,
        fontSizePx: 12,
        color: 'rgb(200, 200, 200)',
        backgroundColor: 'rgb(255, 255, 255)',
      },
    ]

    const violations = evaluateSlideMeasurements(records, context)

    expect(violations.map((v) => v.rule).sort()).toEqual(['contrast', 'min-font-size', 'no-overflow'])
  })
})
