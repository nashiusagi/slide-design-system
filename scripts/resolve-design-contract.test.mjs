/**
 * resolveManifest が「manifest から必要な契約だけを解決できる」こと（#9 の完了条件）と、
 * 「存在しないID・component参照はエラーになる」こと（同完了条件）の両方を固定する。
 *
 * fixture の deck 名・文言は、正本の design/decks/harness-intro.md とは意図的に
 * 変えてある。同名・同文にすると、正本側を変更したときにこの fixture も追随させる
 * べきかどうかが紛らわしくなる。
 */
import { describe, expect, it } from 'vitest'

import { resolveManifest } from './resolve-design-contract.mjs'

const deckSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['title', 'slides'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1 },
    slides: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['layout', 'keyMessage'],
        additionalProperties: false,
        properties: {
          layout: { type: 'string', enum: ['title', 'bullets', 'statement'] },
          keyMessage: { type: 'string', minLength: 1 },
          body: { type: 'string' },
        },
      },
    },
  },
}

const layoutsByName = {
  title: { slots: [{ component: 'slide-title', required: true, max: 1 }] },
  bullets: {
    slots: [
      { component: 'slide-title', required: true, max: 1 },
      { component: 'bullet-list', required: true, max: 1 },
    ],
  },
  statement: {
    slots: [
      { component: 'statement', required: true, max: 1 },
      { component: 'emphasis', required: false, max: 1 },
    ],
  },
}

const validDeckSource = `---
title: "fixture-deck: テスト用の架空のデッキ"
---

layout: title
keyMessage: "テスト用の見出し"

---

layout: bullets
keyMessage: "テスト用の箇条書き"

- a
- b

---

layout: statement
keyMessage: "テスト用の結論"
`

function catalog(overrides = {}) {
  return {
    deckSources: { 'fixture-deck': validDeckSource },
    deckSchema,
    layoutNames: ['title', 'bullets', 'statement'],
    componentNames: ['slide-title', 'bullet-list', 'statement', 'emphasis'],
    layoutsByName,
    ...overrides,
  }
}

const baseResourceIds = ['design.md', 'tokens', 'rules', 'theme.css', 'layout.css']

describe('resolveManifest', () => {
  it('layout を要求すると、その layout と slots の component を解決する', () => {
    const result = resolveManifest({ layouts: ['statement'] }, catalog())
    const ids = result.resources.map((r) => r.id)

    expect(ids).toEqual(
      expect.arrayContaining([...baseResourceIds, 'layout.statement', 'component.statement', 'component.emphasis']),
    )
    expect(ids).not.toContain('layout.title')
  })

  it('component だけを要求すると、その component だけを解決する（layout は連れてこない）', () => {
    const result = resolveManifest({ components: ['bullet-list'] }, catalog())
    const ids = result.resources.map((r) => r.id)

    expect(ids).toEqual(expect.arrayContaining([...baseResourceIds, 'component.bullet-list']))
    expect(ids).not.toContain('layout.bullets')
  })

  it('deck を要求すると、そのdeckが使う layout と component をすべて解決する', () => {
    const result = resolveManifest({ decks: ['fixture-deck'] }, catalog())
    const ids = result.resources.map((r) => r.id)

    expect(ids).toEqual(
      expect.arrayContaining([
        ...baseResourceIds,
        'deck.fixture-deck',
        'layout.title',
        'layout.bullets',
        'layout.statement',
        'component.slide-title',
        'component.bullet-list',
        'component.statement',
        'component.emphasis',
      ]),
    )
  })

  it('同じ component を要求する layout が複数あっても重複しない', () => {
    const result = resolveManifest({ layouts: ['title', 'bullets'] }, catalog())
    const ids = result.resources.map((r) => r.id)

    expect(ids.filter((id) => id === 'component.slide-title')).toHaveLength(1)
  })

  it('存在しない deck 参照はエラーになる', () => {
    expect(() => resolveManifest({ decks: ['nope'] }, catalog())).toThrow('Unknown deck reference: nope')
  })

  it('存在しない layout 参照はエラーになる', () => {
    expect(() => resolveManifest({ layouts: ['nope'] }, catalog())).toThrow('Unknown layout reference: nope')
  })

  it('存在しない component 参照はエラーになる', () => {
    expect(() => resolveManifest({ components: ['nope'] }, catalog())).toThrow('Unknown component reference: nope')
  })

  it('deck / layout / component のいずれも要求しないとエラーになる', () => {
    expect(() => resolveManifest({}, catalog())).toThrow('少なくとも1つ')
  })

  it('layouts に配列でない値（文字列）を渡すとエラーになる', () => {
    // 実行時の型検証そのものを試すテストなので、静的な型は意図的に無視する。
    const manifest = /** @type {any} */ ({ layouts: 'statement' })

    expect(() => resolveManifest(manifest, catalog())).toThrow(
      "manifest の 'layouts' は文字列の配列である必要があります",
    )
  })

  it('decks に文字列以外を含む配列を渡すとエラーになる', () => {
    const manifest = /** @type {any} */ ({ decks: [123] })

    expect(() => resolveManifest(manifest, catalog())).toThrow(
      "manifest の 'decks' は文字列の配列である必要があります",
    )
  })

  it('frontmatter を欠いた deck は構文エラーとして止まる', () => {
    expect(() =>
      resolveManifest({ decks: ['broken'] }, catalog({ deckSources: { broken: 'layout: title\n' } })),
    ).toThrow('design/decks/broken.md')
  })

  it('スキーマ違反（keyMessage 欠落）の deck はエラーとして止まる', () => {
    const invalid = `---\ntitle: "x"\n---\n\nlayout: title\n`

    expect(() =>
      resolveManifest({ decks: ['invalid'] }, catalog({ deckSources: { invalid } })),
    ).toThrow('deck契約を満たさない')
  })

  it('未知の layout を使う deck はスキーマの enum 違反として止まる', () => {
    const invalid = `---\ntitle: "x"\n---\n\nlayout: nope\nkeyMessage: "m"\n`

    expect(() =>
      resolveManifest({ decks: ['invalid'] }, catalog({ deckSources: { invalid } })),
    ).toThrow('deck契約を満たさない')
  })
})

// resolveManifestFile（実ファイルを読む側）は import.meta.url からの相対パス解決に
// URL を使っており、このプロジェクトの vitest 環境（jsdom）ではその解決が壊れる
// （jsdom がグローバルの URL を差し替えるため）。scripts/validate-design.mjs の
// checkSchemas 側も同じ理由でここではテストしない（validate-design.test.mjs の
// checkDecks 側コメントを参照）。resolveManifestFile が実データに対して動くことは、
// scripts/validate-design.mjs の checkResolveDesignContractSmoke が
// `node scripts/validate-design.mjs`（pnpm check の design:check 段）経由で
// 固定する。
