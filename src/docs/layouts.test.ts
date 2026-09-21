import { describe, expect, it } from 'vitest'

import { formatDocsHash, parseDocsHash } from './hash'
import { LAYOUTS, layoutSectionId, layoutsFrom, type LayoutContract } from './layouts'

/**
 * 契約ファイルの実体。カタログが読んだものと突き合わせる。
 *
 * `src/docs/layouts.ts` とは別の綴り方（リポジトリルート起点）で書いている。同じ相対パスを
 * 写すと、パスがずれたときに両方が同時に0件になり、突き合わせが `0 === 0` で通る。
 *
 * Node の `fs` は使わない。`tsconfig.app.json` の `types` は `vite/client` だけで、`src` 配下は
 * ブラウザ向けとして型付けされている。
 */
const CONTRACT_PATHS = Object.keys(import.meta.glob('/design/layouts/*.json')).sort()

describe('LAYOUTS', () => {
  /*
   * カタログ側に名前の一覧を持たないので、契約を1つ足せばページへ現れる（DR-0042 決定2）。
   * 0件で素通りしないよう、件数が0でないことも合わせて固定する（DR-0047）。
   */
  it('design/layouts/ の契約をすべて読む', () => {
    expect(CONTRACT_PATHS.length).toBeGreaterThan(0)
    expect(LAYOUTS).toHaveLength(CONTRACT_PATHS.length)
  })

  it('並びは契約ファイルのパス順（名前の辞書順）', () => {
    expect(LAYOUTS.map((layout) => layout.name)).toEqual(
      CONTRACT_PATHS.map((path) => path.replace(/^.*\/(.+)\.json$/, '$1')),
    )
  })

  /*
   * 契約の形（LayoutContract）は正本のスキーマ（design/schemas/layout.schema.json）の写し
   * なので、読んだ結果が実際にその形をしているかを見る。型注釈は実行時には消えており、
   * JSON が別の形へ変わっても TypeScript は何も言わない。
   *
   * slots の中身まで見るのは、表の列がそこから来ているため。トップレベルのキーだけを見ると、
   * component / required / max のどれかが改名されても素通りし、表の列が undefined を描く。
   */
  it('各契約が表示に要る項目を持つ', () => {
    for (const layout of LAYOUTS) {
      expect(layout.name.length).toBeGreaterThan(0)
      expect(layout.role.length).toBeGreaterThan(0)
      expect(layout.whenToUse.length).toBeGreaterThan(0)
      expect(layout.whenNotToUse.length).toBeGreaterThan(0)
      expect(layout.classes.length).toBeGreaterThan(0)
      expect(layout.slots.length).toBeGreaterThan(0)

      for (const slot of layout.slots) {
        expect(slot.component.length).toBeGreaterThan(0)
        expect(typeof slot.required).toBe('boolean')
        expect(typeof slot.max).toBe('number')
      }
    }
  })
})

describe('layoutSectionId', () => {
  /*
   * 節 ID が hash の書式に収まらないと、部品ページから張ったリンクは書式違反として先頭ページ
   * へ落ちる。リンクは付いたままなので、押すまで壊れたことが分からない。往復で固定する。
   */
  it('どの契約の節 ID も hash として往復する', () => {
    for (const layout of LAYOUTS) {
      const sectionId = layoutSectionId(layout.name)

      expect(parseDocsHash(formatDocsHash('layouts', sectionId))).toEqual({
        pageId: 'layouts',
        sectionId,
      })
    }
  })
})

describe('layoutsFrom', () => {
  /*
   * 0件で落とすガードそのものを踏む。ガードが壊れても、正常系のテストは実在する契約を
   * 読んで通り続けるので、ここが唯一の検出経路になる（DR-0047 決定4）。
   */
  it('読み込みが0件なら例外を投げる', () => {
    expect(() => layoutsFrom({})).toThrow(/design\/layouts\//)
  })

  it('モジュールのパス順に並べ替える', () => {
    const contractOf = (name: string): LayoutContract => ({
      name,
      role: `${name} の役割`,
      whenToUse: ['使うとき'],
      whenNotToUse: ['使わないとき'],
      classes: [`slide--${name}`],
      slots: [{ component: 'slide-title', required: true, max: 1 }],
    })

    const sorted = layoutsFrom({
      '../../design/layouts/zulu.json': contractOf('zulu'),
      '../../design/layouts/alfa.json': contractOf('alfa'),
    })

    expect(sorted.map((layout) => layout.name)).toEqual(['alfa', 'zulu'])
  })
})
