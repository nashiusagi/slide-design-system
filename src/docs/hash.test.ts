import { describe, expect, it } from 'vitest'

import { formatDocsHash, parseDocsHash } from './hash'
import { DOCS_PAGES } from './pages'

describe('parseDocsHash', () => {
  it('#/<ページID> をページ ID として読む', () => {
    expect(parseDocsHash('#/foundations')).toEqual({ pageId: 'foundations', sectionId: null })
  })

  it('ハイフンと数字を含むページ ID を読む', () => {
    expect(parseDocsHash('#/layout-3')).toEqual({ pageId: 'layout-3', sectionId: null })
  })

  it('#/<ページID>/<節ID> を節つきの位置として読む', () => {
    expect(parseDocsHash('#/layouts/bullets')).toEqual({ pageId: 'layouts', sectionId: 'bullets' })
  })

  it('空の hash は null', () => {
    expect(parseDocsHash('')).toBeNull()
  })

  it('書式に合わない hash は null', () => {
    expect(parseDocsHash('#foundations')).toBeNull()
    expect(parseDocsHash('#/')).toBeNull()
    expect(parseDocsHash('#/foundations/')).toBeNull()
    expect(parseDocsHash('#/foundations/tokens/extra')).toBeNull()
    expect(parseDocsHash('#/Foundations')).toBeNull()
    expect(parseDocsHash('#/layouts/Bullets')).toBeNull()
  })

  /*
   * 節を書式へ入れたことで、スライド側の `#/<番号>/<段階>` と2セグメントの形が重なった
   * （DR-0048）。書式の側では分けられない。数字だけのページ ID を持たないことだけが両者を
   * 分けており、それは下の DOCS_PAGES の検査が固定している。ここでは重なる事実を書き残す。
   */
  it('スライド側の `#/<番号>/<段階>` は書式としては通り、ページ一覧に無いことで弾かれる', () => {
    expect(parseDocsHash('#/3/1')).toEqual({ pageId: '3', sectionId: '1' })
    expect(DOCS_PAGES.map((page) => page.id)).not.toContain('3')
  })

  it('スライド側の段階省略形（#/3）も書式が重なるため通ってしまう', () => {
    // だから数字だけのページ ID は使わない（hash.ts の冒頭コメント）。
    expect(parseDocsHash('#/3')).toEqual({ pageId: '3', sectionId: null })
  })
})

describe('formatDocsHash', () => {
  it('ページ ID を #/<ページID> にする', () => {
    expect(formatDocsHash('foundations')).toBe('#/foundations')
  })

  it('節 ID を渡すと #/<ページID>/<節ID> にする', () => {
    expect(formatDocsHash('layouts', 'bullets')).toBe('#/layouts/bullets')
  })
})

describe('DOCS_PAGES', () => {
  it('すべてのページ ID が hash の許容書式に収まり、往復しても元へ戻る', () => {
    for (const page of DOCS_PAGES) {
      expect(parseDocsHash(formatDocsHash(page.id))).toEqual({ pageId: page.id, sectionId: null })
    }
  })

  it('数字だけのページ ID を持たない（スライド側の位置 hash と同一文字列になる）', () => {
    expect(DOCS_PAGES.filter((page) => /^\d+$/.test(page.id))).toEqual([])
  })
})
