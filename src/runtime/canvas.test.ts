import { describe, expect, it } from 'vitest'

import { CANVAS_HEIGHT, CANVAS_WIDTH, fitScale } from './canvas'

describe('fitScale', () => {
  it('キャンバスと同じ大きさなら等倍', () => {
    expect(fitScale(CANVAS_WIDTH, CANVAS_HEIGHT)).toBe(1)
  })

  it('横に余る表示領域では高さに合わせる', () => {
    expect(fitScale(CANVAS_WIDTH * 2, CANVAS_HEIGHT)).toBe(1)
  })

  it('縦に余る表示領域では幅に合わせる', () => {
    expect(fitScale(CANVAS_WIDTH, CANVAS_HEIGHT * 2)).toBe(1)
  })

  it('小さい表示領域では縮小する', () => {
    expect(fitScale(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)).toBe(0.5)
  })

  it('大きい表示領域では拡大する', () => {
    expect(fitScale(CANVAS_WIDTH * 1.5, CANVAS_HEIGHT * 1.5)).toBe(1.5)
  })

  it.each([
    [320, 200],
    [1920, 1080],
    [800, 1200],
    [2560, 720],
  ])('どの表示領域でもキャンバスがはみ出さない（%i x %i）', (width, height) => {
    const scale = fitScale(width, height)

    expect(CANVAS_WIDTH * scale).toBeLessThanOrEqual(width + 0.001)
    expect(CANVAS_HEIGHT * scale).toBeLessThanOrEqual(height + 0.001)
  })

  it('表示領域が未確定でも 0 を返さない', () => {
    expect(fitScale(0, 0)).toBe(1)
    expect(fitScale(-100, 720)).toBe(1)
  })
})
