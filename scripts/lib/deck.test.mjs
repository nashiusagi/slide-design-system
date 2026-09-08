/**
 * parseDeck が deck.md の構文をどう JSON へ正規化するかを固定する。
 *
 * 契約としての妥当性（keyMessage 必須など）はここでは見ない。それは
 * design/schemas/deck.schema.json 側の責務であり、validate-design.test.mjs が持つ。
 */
import { describe, expect, it } from 'vitest'

import { parseDeck } from './deck.mjs'

describe('parseDeck', () => {
  it('frontmatter とスライドを JSON へ正規化する', () => {
    const source = `---
title: サンプル
---

layout: title
keyMessage: "最初の一枚"

---

layout: statement
keyMessage: "最後の一言"
`

    expect(parseDeck(source)).toEqual({
      title: 'サンプル',
      slides: [
        { layout: 'title', keyMessage: '最初の一枚' },
        { layout: 'statement', keyMessage: '最後の一言' },
      ],
    })
  })

  it('見出しブロックの後に空行があれば、それ以降を body として拾う', () => {
    const source = `---
title: サンプル
---

layout: bullets
keyMessage: "並列項目"

- 項目1
- 項目2
`

    expect(parseDeck(source).slides).toEqual([
      { layout: 'bullets', keyMessage: '並列項目', body: '- 項目1\n- 項目2' },
    ])
  })

  it('body が無ければ body キー自体を持たない。空文字を body として持つと「本文が空である」と「本文が無い」を区別できない', () => {
    const source = `---
title: サンプル
---

layout: title
keyMessage: "見出しのみ"
`

    expect(parseDeck(source).slides[0]).not.toHaveProperty('body')
  })

  it('keyMessage がコロンを含んでいても、引用符で囲めば1つの文字列として読める', () => {
    const source = `---
title: サンプル
---

layout: bullets
keyMessage: "契約は5層: tokens, layouts, components, rules, decks"
`

    expect(parseDeck(source).slides[0].keyMessage).toBe(
      '契約は5層: tokens, layouts, components, rules, decks',
    )
  })

  it('契約に無いキーも捨てずにそのまま残す。妥当性判定は deck.schema.json 側の責務であり、パーサが既知キーだけを拾うと additionalProperties が検証対象を受け取る前に無力化される', () => {
    const source = `---
title: サンプル
author: "誰か"
---

layout: title
keyMessage: "見出し"
speakerNotes: "台本"
`

    const deck = parseDeck(source)

    expect(deck.author).toBe('誰か')
    expect(deck.slides[0].speakerNotes).toBe('台本')
  })

  it('先頭に frontmatter が無ければ例外を投げる', () => {
    expect(() => parseDeck('layout: title\nkeyMessage: "見出し"\n')).toThrow('frontmatter')
  })

  it('スライド区切りが一度も現れなくても slides は空にならず、layout/keyMessage が undefined の1件を持つ（schema の必須項目違反として検出させるため）', () => {
    const source = `---
title: サンプル
---
`

    expect(parseDeck(source).slides).toEqual([{ layout: undefined, keyMessage: undefined }])
  })

  it('連続した --- で作られた空スライドを黙って消さない。schema 側の必須項目違反として表面化させる', () => {
    const source = `---
title: サンプル
---

layout: title
keyMessage: "1枚目"

---
---

layout: statement
keyMessage: "3枚目"
`

    expect(parseDeck(source).slides).toEqual([
      { layout: 'title', keyMessage: '1枚目' },
      { layout: undefined, keyMessage: undefined },
      { layout: 'statement', keyMessage: '3枚目' },
    ])
  })
})
