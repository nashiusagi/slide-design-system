import { describe, expect, it } from 'vitest'

import themeCss from '../../design/theme.css?raw'
import rulesJson from '../../design/rules.json'
import tokensJson from '../../design/tokens.json'
import {
  CONTRAST_SURFACES,
  TOKENS,
  cssVar,
  cssVarName,
  isTokenGroup,
  measuredContrast,
  themeValue,
  tokenEntries,
  type TokenNode,
} from './tokens'

/** トークンの葉を、その位置とともに列挙する。 */
function leaves(node: TokenNode, path: string[] = []): { path: string[]; value: string | number }[] {
  return tokenEntries(node).flatMap(([name, value]) =>
    isTokenGroup(value) ? leaves(value, [...path, name]) : [{ path: [...path, name], value }],
  )
}

describe('tokenEntries', () => {
  it('$ で始まるキー（説明・算出値）を除く', () => {
    const names = tokenEntries(TOKENS).map(([name]) => name)

    expect(names).not.toContain('$schema')
    expect(names).not.toContain('$comment')
    expect(names).not.toContain('$measured')
    expect(names.length).toBeGreaterThan(0)
  })
})

describe('cssVarName', () => {
  /*
   * 命名（キャメルケースをハイフン区切りへ落とす）は scripts/generate-theme.mjs と
   * 同じ規則を持っている。規則がずれると、見本に当てる var(--dh-*) がどこも指さず、
   * ページは壊れずに何も反映されない形で嘘をつく。全トークンで実在を確かめる。
   */
  it('すべてのトークンについて、design/theme.css に実在する変数名を作る', () => {
    for (const { path } of leaves(TOKENS)) {
      expect(themeCss).toContain(`${cssVarName(path)}:`)
    }
  })

  it('var() 参照を組み立てる', () => {
    expect(cssVar(['type', 'lineHeight'])).toBe('var(--dh-type-line-height)')
  })
})

describe('themeValue', () => {
  it('生成された表記（単位込み）を返す', () => {
    for (const { path } of leaves(TOKENS)) {
      const value = themeValue(path)

      expect(value).not.toBeNull()
      expect(themeCss).toContain(`${cssVarName(path)}: ${value};`)
    }
  })

  it('theme.css に無い名前は null', () => {
    expect(themeValue(['color', 'not-a-token'])).toBeNull()
  })
})

describe('measuredContrast', () => {
  const pair = Object.keys(tokensJson.$measured.contrast)[0].split('|')

  it('$measured に記録された比を読む', () => {
    expect(measuredContrast(pair[0], pair[1])).toBe(
      (tokensJson.$measured.contrast as Record<string, number>)[pair.join('|')],
    )
  })

  it('前景と背景を入れ替えても同じ値を返す', () => {
    expect(measuredContrast(pair[1], pair[0])).toBe(measuredContrast(pair[0], pair[1]))
  })

  it('記録の無い組（同じ色どうし）は null', () => {
    expect(measuredContrast(pair[0], pair[0])).toBeNull()
  })
})

describe('CONTRAST_SURFACES', () => {
  it('design/rules.json の contrast.surfaces をそのまま持つ', () => {
    expect(CONTRAST_SURFACES).toEqual(rulesJson.contrast.surfaces)
  })
})
