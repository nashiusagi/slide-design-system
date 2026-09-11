import { describe, expect, it } from 'vitest'

import { formatDocsHash, parseDocsHash } from './hash'

describe('parseDocsHash', () => {
  it('#/<ページID> をページ ID として読む', () => {
    expect(parseDocsHash('#/foundations')).toBe('foundations')
  })

  it('ハイフンと数字を含むページ ID を読む', () => {
    expect(parseDocsHash('#/layout-3')).toBe('layout-3')
  })

  it('空の hash は null', () => {
    expect(parseDocsHash('')).toBeNull()
  })

  it('書式に合わない hash は null', () => {
    expect(parseDocsHash('#foundations')).toBeNull()
    expect(parseDocsHash('#/')).toBeNull()
    expect(parseDocsHash('#/foundations/tokens')).toBeNull()
    expect(parseDocsHash('#/Foundations')).toBeNull()
  })

  it('スライド側の位置 hash は、書式が違うので通らない', () => {
    expect(parseDocsHash('#/3/1')).toBeNull()
  })
})

describe('formatDocsHash', () => {
  it('ページ ID を #/<ページID> にする', () => {
    expect(formatDocsHash('foundations')).toBe('#/foundations')
  })

  it('formatDocsHash の結果は parseDocsHash で元へ戻る', () => {
    expect(parseDocsHash(formatDocsHash('foundations'))).toBe('foundations')
  })
})
