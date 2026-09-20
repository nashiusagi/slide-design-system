import { describe, expect, it } from 'vitest'

import { LAYOUTS } from './layouts'

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
   * 契約の形（LayoutContract）は正本のスキーマの写しなので、読んだ結果が実際にその形を
   * しているかを見る。型注釈は実行時には消えており、JSON が別の形へ変わっても TypeScript は
   * 何も言わない。
   */
  it('各契約が表示に要る項目を持つ', () => {
    for (const layout of LAYOUTS) {
      expect(layout.name.length).toBeGreaterThan(0)
      expect(layout.role.length).toBeGreaterThan(0)
      expect(layout.whenToUse.length).toBeGreaterThan(0)
      expect(layout.whenNotToUse.length).toBeGreaterThan(0)
      expect(layout.classes.length).toBeGreaterThan(0)
      expect(layout.slots.length).toBeGreaterThan(0)
    }
  })
})
