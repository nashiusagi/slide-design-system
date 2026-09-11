import { describe, expect, it } from 'vitest'

import { formatDocsHash, parseDocsHash } from './hash'
import { DOCS_PAGES } from './pages'

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

  it('スライド側の `#/<番号>/<段階>` はセグメントが2つなので通らない', () => {
    expect(parseDocsHash('#/3/1')).toBeNull()
  })

  it('スライド側の段階省略形（#/3）は書式が重なるため通ってしまう', () => {
    // だから数字だけのページ ID は使わない（hash.ts の冒頭コメント）。
    expect(parseDocsHash('#/3')).toBe('3')
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

describe('DOCS_PAGES', () => {
  it('すべてのページ ID が hash の許容書式に収まり、往復しても元へ戻る', () => {
    for (const page of DOCS_PAGES) {
      expect(parseDocsHash(formatDocsHash(page.id))).toBe(page.id)
    }
  })

  it('数字だけのページ ID を持たない（スライド側の位置 hash と同一文字列になる）', () => {
    expect(DOCS_PAGES.filter((page) => /^\d+$/.test(page.id))).toEqual([])
  })
})
