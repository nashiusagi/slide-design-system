import type { ComponentType } from 'react'

import { describe, expect, it } from 'vitest'

import { COMPONENTS, COMPONENT_PREVIEWS, componentsFrom, previewFor, type ComponentContract } from './components'
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

describe('componentsFrom', () => {
  it('読み込みが0件なら例外を投げる', () => {
    expect(() => componentsFrom({})).toThrow(/design\/components\//)
  })

  it('モジュールのパス順に並べ替える', () => {
    const contractOf = (name: string): ComponentContract => ({
      name,
      role: `${name} の役割`,
      allowedIn: ['title'],
      usage: ['使い方'],
      props: { text: { type: 'string', required: true, description: '文言' } },
    })

    const sorted = componentsFrom({
      '../../design/components/zulu.json': contractOf('zulu'),
      '../../design/components/alfa.json': contractOf('alfa'),
    })

    expect(sorted.map((component) => component.name)).toEqual(['alfa', 'zulu'])
  })
})

describe('previewFor', () => {
  /*
   * いまはこれが正しい状態（DR-0049）。実装が入ったらこのテストは落ちる——落ちたときに、
   * 「#37 が実装した」のか「登録表が壊れた」のかを人が判断する。黙って通り続けるより、
   * 状態が変わったことを検査が知らせる方がよい。
   */
  it('いまは登録が空で、どの契約も未実装として返る', () => {
    expect(COMPONENT_PREVIEWS).toEqual({})

    for (const component of COMPONENTS) {
      expect(previewFor(component.name, COMPONENT_PREVIEWS)).toBeNull()
    }
  })

  /*
   * 登録がある側の枝を踏む。登録表が空のままだと、この枝は一度も実行されないまま
   * 「未実装と出る」ことだけが確かめられた状態になる。
   */
  it('登録があればそれを返す', () => {
    const Dummy: ComponentType = () => null

    expect(previewFor('slide-title', { 'slide-title': Dummy })).toBe(Dummy)
    expect(previewFor('bullet-list', { 'slide-title': Dummy })).toBeNull()
  })
})
