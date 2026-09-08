/**
 * 検査そのものが違反を捕まえられるかを固定する。
 *
 * 正しい入力で ok になることは pnpm design:check が毎回示すので、ここが持つのは
 * 壊れた入力を渡したときに必ず1件返るという側。判定側にこれが無いと、何も検出しない
 * ルールでも緑のまま通る。
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  checkCanvasMatchesRuntime,
  checkContrast,
  checkDecks,
  checkGamut,
  checkLayoutClasses,
  checkLayoutComponentConsistency,
} from './validate-design.mjs'

/** 水準を満たす最小の色一式。各テストはここから1つだけ壊す。 */
const validColors = {
  $comment: '説明',
  background: 'oklch(1 0 0)',
  surface: 'oklch(0.97 0 0)',
  text: 'oklch(0.21 0 0)',
  textMuted: 'oklch(0.52 0 0)',
  border: 'oklch(0.62 0 0)',
  accent: 'oklch(0.47 0.22 305)',
  accentSoft: 'oklch(0.95 0.025 305)',
  danger: 'oklch(0.53 0.2 27)',
  warning: 'oklch(0.52 0.1 70)',
  success: 'oklch(0.51 0.13 150)',
}

describe('checkGamut', () => {
  it('色域内なら何も返さない', () => {
    expect(checkGamut(validColors)).toEqual([])
  })

  it('色域を外れた色を捕まえる', () => {
    const found = checkGamut({ ...validColors, accent: 'oklch(0.95 0.3 305)' })

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('color.accent')
  })
})

describe('checkContrast', () => {
  it('水準を満たしていれば何も返さない', () => {
    expect(checkContrast(validColors)).toEqual([])
  })

  it('本文が水準を割ったら捕まえる', () => {
    const found = checkContrast({ ...validColors, text: 'oklch(0.75 0 0)' })

    expect(found.length).toBeGreaterThan(0)
    expect(found.join('\n')).toContain('本文（text on background）')
  })

  it('UI 境界は本文より緩い水準で測る。役割ごとに閾値が分かれている', () => {
    // 3:1 は満たすが 4.5:1 は割る明度。border としては通り、同じ色を text に
    // 置くと落ちる。両方が通る形だと、役割ごとの閾値が 1 つに潰れても気付けない。
    const borderline = 'oklch(0.62 0 0)'

    expect(checkContrast({ ...validColors, border: borderline })).toEqual([])

    const asBodyText = checkContrast({ ...validColors, text: borderline })

    expect(asBodyText.length).toBeGreaterThan(0)
    expect(asBodyText.join('\n')).toContain('本文（text on background）')
  })

  it('役割に割り当てられていない色を捕まえる', () => {
    // 前景の一覧は手書きなので、色を足して役割へ書き忘れると、その色だけ
    // 無検査のまま緑で通る。未分類そのものを検査して塞いでいることを固定する。
    const found = checkContrast({ ...validColors, info: 'oklch(0.9 0.05 305)' })

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('color.info がどの役割にも割り当てられておらず')
  })

  it('面をすべて回る。background だけ通る色は見逃さない', () => {
    // accentSoft の上でだけ 4.5:1 を割る明度。前景ごとに背景を書き並べる形だと
    // 書き忘れた組み合わせが素通りするので、その形へ戻していないことを固定する。
    const found = checkContrast({ ...validColors, success: 'oklch(0.52 0.13 150)' })

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('success on accentSoft')
  })
})

describe('checkLayoutClasses', () => {
  const layouts = [
    { name: 'title', classes: ['slide--title'] },
    { name: 'bullets', classes: ['slide--bullets'] },
  ]
  const validCss = '.slide--title { display: flex; }\n.slide--bullets { display: flex; }\n'

  it('契約と実装が過不足なく一致していれば何も返さない', () => {
    expect(checkLayoutClasses(layouts, validCss)).toEqual([])
  })

  it('契約にあるクラスを実装していないと捕まえる', () => {
    const found = checkLayoutClasses(layouts, '.slide--title { display: flex; }\n')

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--bullets')
  })

  it('契約に無いクラスを実装していると捕まえる', () => {
    // 使われなくなったレイアウトの実装が残ったままでも、契約側の一致だけを
    // 見ていると気付けない。実装側からも契約に無いものを検査する。
    const found = checkLayoutClasses(layouts, `${validCss}.slide--statement { display: flex; }\n`)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--statement')
  })

  it('コメントの中に書かれただけのクラス名は実装と見なさない', () => {
    // theme.css のようにコメントへ算出値や変数名を書く慣習がある。同じ書き方を
    // layout.css にされたときに「実装済み」と誤判定しないことを固定する。
    const found = checkLayoutClasses(layouts, '/* .slide--bullets は後で書く */\n.slide--title {}\n')

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--bullets')
  })

  it('宣言ブロックの中に書かれた文字列はセレクタと見なさない', () => {
    // カスタムプロパティの値などにクラス名らしき文字列が書かれていても、それは
    // セレクタではない。「{ の直前までの部分」だけを見ることで、実装していない
    // クラスを値としてだけ書いた場合に「実装済み」と誤判定しないことを固定する。
    const found = checkLayoutClasses(
      layouts,
      ':root { --debug-note: ".slide--bullets is not implemented yet"; }\n.slide--title { display: flex; }\n',
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--bullets')
  })

  it('属性セレクタの引用符付き値に書かれた文字列はクラス名と見なさない', () => {
    // セレクタ部分に絞っても、属性セレクタの値というスタイリングを持たない場所に
    // クラス名らしき文字列を書けてしまう。空ルールで「実装済み」を装えないことを固定する。
    const found = checkLayoutClasses(
      layouts,
      '[data-debug=".slide--bullets"] {}\n.slide--title { display: flex; }\n',
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--bullets')
  })
})

describe('checkLayoutComponentConsistency', () => {
  const layouts = [{ name: 'title', slots: [{ component: 'slide-title' }] }]
  const components = [{ name: 'slide-title', allowedIn: ['title'] }]

  it('slots と allowedIn が対応していれば何も返さない', () => {
    expect(checkLayoutComponentConsistency(layouts, components)).toEqual([])
  })

  it('slots が参照する component の契約が無いと捕まえる', () => {
    const found = checkLayoutComponentConsistency(layouts, [])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("component 'slide-title' の契約が無い")
  })

  it('slots にある component の allowedIn にその layout が無いと捕まえる', () => {
    // component 自体は bullets では allowedIn を満たしているので、
    // allowedIn → slots 方向は空になり、slots → allowedIn 方向の1件だけが返る。
    const found = checkLayoutComponentConsistency(
      [
        { name: 'title', slots: [{ component: 'slide-title' }] },
        { name: 'bullets', slots: [{ component: 'slide-title' }] },
      ],
      [{ name: 'slide-title', allowedIn: ['bullets'] }],
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("allowedIn に 'title' が無い")
  })

  it('allowedIn が参照する layout の契約が無いと捕まえる', () => {
    const found = checkLayoutComponentConsistency(layouts, [
      { name: 'slide-title', allowedIn: ['title', 'nonexistent'] },
    ])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("layout 'nonexistent' の契約が無い")
  })

  it('allowedIn にあるが、その layout の slots で使われていない component を捕まえる', () => {
    // slots → allowedIn 方向だけでは、「実際には使われていない layout を
    // allowedIn に書いてしまう」誤りを検出できない。逆方向も見ていることを固定する。
    const found = checkLayoutComponentConsistency(
      [
        { name: 'title', slots: [{ component: 'slide-title' }] },
        { name: 'bullets', slots: [] },
      ],
      [{ name: 'slide-title', allowedIn: ['title', 'bullets'] }],
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("slots に 'slide-title' が無い")
  })
})

describe('checkCanvasMatchesRuntime', () => {
  const canvas = { width: 1280, height: 720 }
  const source = 'export const CANVAS_WIDTH = 1280\nexport const CANVAS_HEIGHT = 720\n'

  it('一致していれば何も返さない', () => {
    expect(checkCanvasMatchesRuntime(source, canvas)).toEqual([])
  })

  it('値が食い違ったら捕まえる', () => {
    const found = checkCanvasMatchesRuntime(source.replace('1280', '1920'), canvas)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('CANVAS_WIDTH')
  })

  it('宣言を読み取れないときは素通りせず落とす', () => {
    const found = checkCanvasMatchesRuntime('export const CANVAS_WIDTH = width\n', canvas)

    expect(found).toHaveLength(2)
    expect(found[0]).toContain('読み取れない')
  })
})

describe('checkDecks', () => {
  // resolve() は import.meta.url からの相対パス解決に URL を使っており、jsdom
  // 環境下ではその解決が壊れる（jsdom がグローバルの URL を差し替えるため）。
  // checkSchemas 側もこの理由でテスト対象に含めていない。ここではファイル読み込みを
  // 挟まず、相対パスのまま fs で読むことでその落とし穴を避ける。
  const deckSchema = JSON.parse(readFileSync('design/schemas/deck.schema.json', 'utf8'))

  /** Schema を満たす最小の deck.md。各テストはここから1箇所だけ壊す。 */
  const validSource = `---
title: サンプル
---

layout: title
keyMessage: "見出し"
`

  it('Schema を満たしていれば何も返さない', () => {
    expect(checkDecks([{ path: 'design/decks/sample.md', source: validSource }], deckSchema)).toEqual([])
  })

  it('frontmatter が無ければ構文エラーとして捕まえる', () => {
    const found = checkDecks(
      [{ path: 'design/decks/sample.md', source: 'layout: title\n' }],
      deckSchema,
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('design/decks/sample.md')
    expect(found[0]).toContain('frontmatter')
  })

  it('keyMessage が無ければ Schema 違反として捕まえる', () => {
    const source = `---
title: サンプル
---

layout: title
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('keyMessage')
  })

  it('layout が契約に無いレイアウト名なら Schema 違反として捕まえる', () => {
    const source = `---
title: サンプル
---

layout: unknown-layout
keyMessage: "見出し"
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('layout')
  })

  it('keyMessage が空白のみなら Schema 違反として捕まえる。minLength だけでは1文字以上の空白を通してしまう', () => {
    const source = `---
title: サンプル
---

layout: title
keyMessage: " "
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('keyMessage')
  })

  it('title が空白のみなら Schema 違反として捕まえる', () => {
    const source = `---
title: " "
---

layout: title
keyMessage: "見出し"
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('title')
  })

  it('契約に無いキーが frontmatter にあれば Schema 違反として捕まえる。パーサが既知キーだけ拾うと additionalProperties が発火しなくなる', () => {
    const source = `---
title: サンプル
author: "誰か"
---

layout: title
keyMessage: "見出し"
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('additional')
  })

  it('契約に無いキーがスライド見出しブロックにあれば Schema 違反として捕まえる', () => {
    const source = `---
title: サンプル
---

layout: title
keyMessage: "見出し"
speakerNotes: "台本"
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('additional')
  })
})
