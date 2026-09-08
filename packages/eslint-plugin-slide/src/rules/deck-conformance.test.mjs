import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { RuleTester } from 'eslint'
import { afterAll, describe, it } from 'vitest'

import rule from './deck-conformance.mjs'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

/** テスト用の deck.md をこの1テストファイルの実行だけに使う一時ディレクトリへ書く。 */
const dir = mkdtempSync(join(tmpdir(), 'deck-conformance-'))

const deckSource = `---
title: "サンプル"
---

layout: title
keyMessage: "見出し"

---

layout: bullets
keyMessage: "本文"

---

layout: statement
keyMessage: "結論"
`

const deckPath = join(dir, 'sample.md')
writeFileSync(deckPath, deckSource)

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('deck-conformance', () => {
  it('valid / invalid', () => {
    ruleTester.run('deck-conformance', rule, {
      valid: [
        {
          // 枚数・順序・layout 割当がすべて一致する。
          code: `
            const el = (
              <Deck>
                <Slide layout="title">x</Slide>
                <Slide layout="bullets">x</Slide>
                <Slide layout="statement">x</Slide>
              </Deck>
            )
          `,
          options: [{ deck: deckPath }],
        },
        {
          // deck オプションが無ければ何も見ない（対象外のファイル）。
          code: '<Slide layout="title">x</Slide>',
          options: [],
        },
      ],
      invalid: [
        {
          // 枚数が足りない。
          code: `
            const el = (
              <Deck>
                <Slide layout="title">x</Slide>
                <Slide layout="bullets">x</Slide>
              </Deck>
            )
          `,
          options: [{ deck: deckPath }],
          errors: [{ messageId: 'countMismatch' }],
        },
        {
          // 2枚目の layout が deck 契約（bullets）と食い違う。
          code: `
            const el = (
              <Deck>
                <Slide layout="title">x</Slide>
                <Slide layout="statement">x</Slide>
                <Slide layout="statement">x</Slide>
              </Deck>
            )
          `,
          options: [{ deck: deckPath }],
          errors: [{ messageId: 'layoutMismatch' }],
        },
        {
          // layout が静的に読めないと、その枚は比較できないというエラーになる。
          code: `
            const el = (
              <Deck>
                <Slide layout={dynamicLayout}>x</Slide>
                <Slide layout="bullets">x</Slide>
                <Slide layout="statement">x</Slide>
              </Deck>
            )
          `,
          options: [{ deck: deckPath }],
          errors: [{ messageId: 'unresolvedLayout' }],
        },
        {
          // deck 契約自体が読めない。
          code: '<Slide layout="title">x</Slide>',
          options: [{ deck: join(dir, 'does-not-exist.md') }],
          errors: [{ messageId: 'unreadableDeck' }],
        },
      ],
    })
  })
})
