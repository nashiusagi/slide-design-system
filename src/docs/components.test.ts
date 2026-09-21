import type { ComponentType } from 'react'

import { describe, expect, it } from 'vitest'

import { COMPONENTS, COMPONENT_PREVIEWS, previewFor } from './components'
import { LAYOUTS } from './layouts'

/**
 * 契約ファイルの実体。カタログが読んだものと突き合わせる。
 *
 * `src/docs/components.ts` とは別の綴り方（リポジトリルート起点）で書いている。同じ相対パスを
 * 写すと、パスがずれたときに両方が同時に0件になり、突き合わせが `0 === 0` で通る。
 */
const CONTRACT_PATHS = Object.keys(import.meta.glob('/design/components/*.json')).sort()

describe('COMPONENTS', () => {
  it('design/components/ の契約をすべて読む', () => {
    expect(CONTRACT_PATHS.length).toBeGreaterThan(0)
    expect(COMPONENTS).toHaveLength(CONTRACT_PATHS.length)
  })

  it('並びは契約ファイルのパス順（名前の辞書順）', () => {
    expect(COMPONENTS.map((component) => component.name)).toEqual(
      CONTRACT_PATHS.map((path) => path.replace(/^.*\/(.+)\.json$/, '$1')),
    )
  })

  /*
   * 契約の形（ComponentContract）は正本のスキーマの写しなので、読んだ結果が実際にその形を
   * しているかを見る。props の中身まで見るのは、表の列がそこから来ているため。キーが1つ
   * 改名されただけで、表の列が undefined を描く。
   */
  it('各契約が表示に要る項目を持つ', () => {
    for (const component of COMPONENTS) {
      expect(component.name.length).toBeGreaterThan(0)
      expect(component.role.length).toBeGreaterThan(0)
      expect(component.allowedIn.length).toBeGreaterThan(0)
      expect(component.usage.length).toBeGreaterThan(0)

      const props = Object.entries(component.props)
      expect(props.length).toBeGreaterThan(0)

      for (const [, prop] of props) {
        expect(prop.type.length).toBeGreaterThan(0)
        expect(typeof prop.required).toBe('boolean')
        expect(prop.description.length).toBeGreaterThan(0)
      }
    }
  })

  /*
   * allowedIn が指すレイアウトは、ページ側でリンク先と必須・最大数の引き元になる。契約どうしの
   * 対応は pnpm design:check が両方向から検査しているが、カタログが同じ前提で描いていることを
   * こちらでも固定する。ここが崩れると、表は「—」を並べた姿で静かに描かれる。
   */
  it('allowedIn が指すレイアウトが実在し、そのスロットに自分が居る', () => {
    for (const component of COMPONENTS) {
      for (const layoutName of component.allowedIn) {
        const layout = LAYOUTS.find((candidate) => candidate.name === layoutName)

        expect(layout, `${component.name} の allowedIn が指す ${layoutName} が無い`).toBeDefined()
        expect(layout?.slots.map((slot) => slot.component)).toContain(component.name)
      }
    }
  })
})

describe('previewFor', () => {
  /*
   * 4契約すべてに実装（DR-0050）と登録が在る状態を固定する。契約を1つ増やしたときも、
   * 登録を足すまでここが落ちる——カタログが「未実装」を出し続ける状態を、テストが先に知らせる。
   *
   * 実装と登録は別物で、登録を忘れた状態は型検査も lint も通る（DR-0049 の帰結）。この検査が
   * 塞ぐのはそこまでで、「登録された先が本当にその部品を描くか」は見ていない。
   */
  it('どの契約にも登録が在り、未実装として返るものが無い', () => {
    expect(COMPONENTS.length).toBeGreaterThan(0)

    for (const component of COMPONENTS) {
      expect(previewFor(component.name, COMPONENT_PREVIEWS), `${component.name} の登録が無い`).not.toBeNull()
    }
  })

  /*
   * 登録表のキーが契約名と一致していること。キーを綴り誤ると、上の検査は「その契約の登録が
   * 無い」として落ちるが、落ちた理由が綴りなのか登録漏れなのかはここが分ける。綴りを誤った
   * 登録は型検査も lint も通る。
   */
  it('登録表のキーは、どれも契約名である', () => {
    const names = COMPONENTS.map((component) => component.name)

    for (const key of Object.keys(COMPONENT_PREVIEWS)) {
      expect(names, `${key} という契約は無い`).toContain(key)
    }
  })

  it('登録があればそれを返す', () => {
    const Dummy: ComponentType = () => null

    // 架空の名前で見る。実在の契約名を使うと、契約が改名されてもテストは通り続け、
    // 「実在するもの」として書かれた名前が実在しなくなる。
    expect(previewFor('alfa', { alfa: Dummy })).toBe(Dummy)
    expect(previewFor('zulu', { alfa: Dummy })).toBeNull()
  })
})
