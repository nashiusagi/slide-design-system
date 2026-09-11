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
  checkBypassFixtureCoverage,
  checkCanvasMatchesRuntime,
  checkContrast,
  checkDecks,
  checkGamut,
  checkLayoutClasses,
  checkLayoutComponentConsistency,
  checkLintRuleCoverage,
  checkLintRuleDescriptionsMatch,
  checkMeasureRuleCoverage,
  checkSkillNoDesignDataDuplication,
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

/**
 * design/rules.json の contrast をそのまま使う（複製しない）。ここへ値を書き写すと、
 * 正本が変わってもこのテストが追随せず、常に自分自身の固定値でしか検証しなくなる。
 */
const contrastConfig = JSON.parse(readFileSync('design/rules.json', 'utf8')).contrast

describe('checkContrast', () => {
  it('水準を満たしていれば何も返さない', () => {
    expect(checkContrast(validColors, contrastConfig)).toEqual([])
  })

  it('本文が水準を割ったら捕まえる', () => {
    const found = checkContrast({ ...validColors, text: 'oklch(0.75 0 0)' }, contrastConfig)

    expect(found.length).toBeGreaterThan(0)
    expect(found.join('\n')).toContain('本文（text on background）')
  })

  it('UI 境界は本文より緩い水準で測る。役割ごとに閾値が分かれている', () => {
    // 3:1 は満たすが 4.5:1 は割る明度。border としては通り、同じ色を text に
    // 置くと落ちる。両方が通る形だと、役割ごとの閾値が 1 つに潰れても気付けない。
    const borderline = 'oklch(0.62 0 0)'

    expect(checkContrast({ ...validColors, border: borderline }, contrastConfig)).toEqual([])

    const asBodyText = checkContrast({ ...validColors, text: borderline }, contrastConfig)

    expect(asBodyText.length).toBeGreaterThan(0)
    expect(asBodyText.join('\n')).toContain('本文（text on background）')
  })

  it('役割に割り当てられていない色を捕まえる', () => {
    // 前景の一覧は手書きなので、色を足して役割へ書き忘れると、その色だけ
    // 無検査のまま緑で通る。未分類そのものを検査して塞いでいることを固定する。
    const found = checkContrast({ ...validColors, info: 'oklch(0.9 0.05 305)' }, contrastConfig)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('color.info がどの役割にも割り当てられておらず')
  })

  it('面をすべて回る。background だけ通る色は見逃さない', () => {
    // accentSoft の上でだけ 4.5:1 を割る明度。前景ごとに背景を書き並べる形だと
    // 書き忘れた組み合わせが素通りするので、その形へ戻していないことを固定する。
    const found = checkContrast({ ...validColors, success: 'oklch(0.52 0.13 150)' }, contrastConfig)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('success on accentSoft')
  })
})

describe('checkLintRuleCoverage', () => {
  const rules = [
    { id: 'no-raw-color', method: 'lint' },
    { id: 'no-overflow', method: 'measure' },
  ]

  it('lint ルールと実装が1対1で対応していれば何も返さない', () => {
    expect(checkLintRuleCoverage(rules, ['no-raw-color'])).toEqual([])
  })

  it('measure のルールは対象にしない。実装が無くても捕まえない', () => {
    // no-overflow（method: measure）は implementedRuleIds に含めていない。
    // lint ルールと同じ扱いをすると、実装が無い measure ルールまで誤って報告する。
    expect(checkLintRuleCoverage(rules, ['no-raw-color'])).toEqual([])
    expect(checkLintRuleCoverage(rules, [])).not.toEqual(
      expect.arrayContaining([expect.stringContaining('no-overflow')]),
    )
  })

  it('契約にある lint ルールの実装が無いと捕まえる', () => {
    const found = checkLintRuleCoverage(rules, [])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("'no-raw-color' が実装されていない")
  })

  it('契約に無いルールを実装していると捕まえる', () => {
    // 実装側だけを見ると、正規の検査経路（design/rules.json）から外れた
    // 独自ルールが増えても気付けない。
    const found = checkLintRuleCoverage(rules, ['no-raw-color', 'unknown-rule'])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("'unknown-rule' を実装しているが")
  })
})

describe('checkMeasureRuleCoverage', () => {
  const rules = [
    { id: 'no-overflow', method: 'measure' },
    { id: 'deck-body-fidelity', method: 'measure' },
    { id: 'no-raw-color', method: 'lint' },
  ]

  it('measure ルールと実装が1対1で対応していれば何も返さない', () => {
    expect(checkMeasureRuleCoverage(rules, ['no-overflow'], ['deck-body-fidelity'])).toEqual([])
  })

  it('lint のルールは対象にしない', () => {
    expect(
      checkMeasureRuleCoverage(rules, ['no-overflow'], ['deck-body-fidelity']),
    ).not.toEqual(expect.arrayContaining([expect.stringContaining('no-raw-color')]))
  })

  it('未実装リストに無い measure ルールの実装が無いと捕まえる', () => {
    const found = checkMeasureRuleCoverage(rules, [], ['deck-body-fidelity'])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("'no-overflow' が実装されていない")
  })

  it('未実装リストにあるルールは、実装が無くても捕まえない', () => {
    // deck-body-fidelity は既知の未実装として許容している。missing 扱いにすると、
    // 実装済みの他ルールの対応状況までこの検査から読めなくなる（design/rules.json 参照）。
    const found = checkMeasureRuleCoverage(rules, ['no-overflow'], ['deck-body-fidelity'])

    expect(found).not.toEqual(expect.arrayContaining([expect.stringContaining('deck-body-fidelity')]))
  })

  it('契約に無いルールを実装していると捕まえる', () => {
    const found = checkMeasureRuleCoverage(rules, ['no-overflow', 'unknown-rule'], ['deck-body-fidelity'])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("'unknown-rule' を実装しているが")
  })

  it('既に実装されたルールが未実装リストへ残っていると捕まえる', () => {
    // 実装され次第、許容リストから外す運用（design/rules.json 参照）が崩れていないか。
    const found = checkMeasureRuleCoverage(rules, ['no-overflow'], ['no-overflow', 'deck-body-fidelity'])

    expect(found).toEqual([expect.stringContaining("'no-overflow' は knownUnimplementedRuleIds にあるが")])
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
    // 構文木の上ではセレクタの外（宣言）に置かれる。セレクタのノードだけを見る
    // ことで、実装していないクラスを値としてだけ書いた場合に「実装済み」と
    // 誤判定しないことを固定する。
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

  it(':not() の引数に書かれたクラス名は実装と見なさない', () => {
    // :not(.x) は「.x を持つ要素を除外する」条件であり、引数の .x そのものへ
    // スタイルを与えているわけではない。:not(.slide--bullets) {} のような
    // 実際には何もスタイリングしないルールで「実装済み」を装えないことを
    // 固定する（PR #21 レビュー3周目）。
    const found = checkLayoutClasses(
      layouts,
      ':not(.slide--bullets) {}\n.slide--title { display: flex; }\n',
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--bullets')
  })

  it(':has() の引数に書かれたクラス名は実装と見なさない', () => {
    // .foo:has(.bar) で実際に選択・スタイリングされるのは .foo（.bar を子孫等に
    // 持つ要素）であって .bar 自身ではない。:not() と同じ理由で、.slide--bullets
    // が :has() の引数にしか現れないルールを「実装済み」と装えないことを固定する。
    const found = checkLayoutClasses(
      layouts,
      '.slide--title:has(.slide--bullets) { display: flex; }\n',
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--bullets')
  })

  it(':where() / :is() の引数に書かれたクラス名は、その引数自身への実装として認める', () => {
    // :where(.x) / :is(.x) は :not() と違い、引数の要素そのものを選択して
    // スタイルを与える（詳細度が変わるだけ）。:not() と同じ理由で一律に
    // 除外すると、:where() / :is() で書いた実装を「実装していない」と
    // 誤判定してしまう（DR-0041 レビューで判明）。
    const found = checkLayoutClasses(
      layouts,
      ':where(.slide--title) { display: flex; }\n:is(.slide--bullets) { display: flex; }\n',
    )

    expect(found).toEqual([])
  })

  it('契約に無いクラスを :is() の引数だけで実装していても extra として捕まえる', () => {
    // :not() 用に一律除外すると、:is() / :where() の引数越しに書かれた
    // 契約に無いクラスの実装が extra 検査をすり抜けてしまう（DR-0041 レビューで判明）。
    const found = checkLayoutClasses(
      layouts,
      `${validCss}:is(.slide--statement) { display: flex; }\n`,
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--statement')
  })

  it('属性値内に ] を含む属性セレクタでも、値の中の文字列をクラス名と見なさない', () => {
    // 引用符付きの属性値は ] を含んでいても有効な CSS であり、そこで属性セレクタが
    // 終わるわけではない。構文を正しく読まずに最初の ] で区切ると、区切られた
    // 残りの文字列がセレクタの外へ漏れ出て誤判定を起こす（PR #21 レビュー3周目）。
    const found = checkLayoutClasses(
      layouts,
      '[data-x="].slide--bullets"] {}\n.slide--title { display: flex; }\n',
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('.slide--bullets')
  })

  it('CSS として解析できない入力は、例外にせず問題として返す', () => {
    // postcss.parse は不正な CSS で例外を投げる。ここで捕まえずに投げっぱなしに
    // すると、main() の他の検査（checks の残り）が一度も走らないまま
    // スタックトレースで落ちる。問題文字列として返し、他の検査を続けられる
    // ことを固定する。
    const found = checkLayoutClasses(layouts, '.slide--title { display: flex; \n')

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('design/layout.css')
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

describe('checkSkillNoDesignDataDuplication', () => {
  const contract = {
    tokens: { color: { accent: 'oklch(0.47 0.22 305)' } },
    layouts: [
      {
        name: 'title',
        role: 'デッキ全体の主題、または章の区切りを宣言する。',
        whenToUse: ['発表全体の主題を示すとき'],
        whenNotToUse: ['複数の論点を並べて伝えたいとき'],
      },
    ],
    components: [
      {
        name: 'slide-title',
        role: 'スライドの主題を一行で示す見出し。',
        usage: ['1 行に収める。'],
      },
    ],
    rules: { rules: [{ id: 'no-overflow', description: 'キャンバスから要素がはみ出していない。' }] },
    designMd: '# DESIGN.md\n\n白い紙面と黒い文字。強調は赤紫の一色だけ。\n\n装飾で語らず、余白と文字の階層だけで構造を示す。\n',
  }

  it('契約を参照するだけなら何も返さない', () => {
    const skillSource = '契約を読み、design/layouts/*.json の whenToUse で layout を選ぶ。'

    expect(checkSkillNoDesignDataDuplication(skillSource, contract)).toEqual([])
  })

  it('layout の role がそのまま書かれていると捕まえる', () => {
    const found = checkSkillNoDesignDataDuplication(
      'title はデッキ全体の主題、または章の区切りを宣言する。ために使う。',
      contract,
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('design/layouts/title.json')
  })

  it('layout の whenNotToUse がそのまま書かれていると捕まえる', () => {
    const found = checkSkillNoDesignDataDuplication('複数の論点を並べて伝えたいときは title を使わない。', contract)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('design/layouts/title.json')
  })

  it('color の値がそのまま書かれていると捕まえる', () => {
    const found = checkSkillNoDesignDataDuplication('強調は oklch(0.47 0.22 305) を使う。', contract)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('color.accent')
  })

  it('layout の whenToUse がそのまま書かれていると捕まえる', () => {
    const found = checkSkillNoDesignDataDuplication('title は発表全体の主題を示すときに使う。', contract)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('design/layouts/title.json')
  })

  it('component の usage がそのまま書かれていると捕まえる', () => {
    const found = checkSkillNoDesignDataDuplication('見出しは1 行に収める。を守る。', contract)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('design/components/slide-title.json')
  })

  it('rule の description がそのまま書かれていると捕まえる', () => {
    const found = checkSkillNoDesignDataDuplication('no-overflow はキャンバスから要素がはみ出していない。を見る。', contract)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain("ルール 'no-overflow'")
  })

  it('DESIGN.md の記述がそのまま書かれていると捕まえる', () => {
    const found = checkSkillNoDesignDataDuplication(
      '北極星は、白い紙面と黒い文字。強調は赤紫の一色だけ。である。',
      contract,
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('DESIGN.md')
  })

  it('複製の途中に改行を挟んでも検出する（折り返しによる回避を防ぐ）', () => {
    const found = checkSkillNoDesignDataDuplication('強調は oklch(0.47 0.22\n305) を使う。', contract)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('color.accent')
  })

  it('複製の途中にゼロ幅スペースを挟んでも検出する（不可視文字による回避を防ぐ）', () => {
    // ソースコードへ不可視文字を直接埋めると no-irregular-whitespace に
    // 引っかかるため、JS のエスケープシーケンスとして埋め込む（checkDecks 節と同じ理由）。
    const zeroWidthSpace = '\u200B'
    const found = checkSkillNoDesignDataDuplication(
      `強調は oklch(0.47${zeroWidthSpace} 0.22 305) を使う。`,
      contract,
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('color.accent')
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

  // ソースコードへ不可視文字を直接埋めると no-irregular-whitespace に
  // 引っかかるため、JS のエスケープシーケンスとして埋め込む。
  const zeroWidthSpace = '\u200B'

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

  it('keyMessage がゼロ幅スペースのみなら Schema 違反として捕まえる。\\S は ECMAScript の空白定義にしか反応せず、見た目上空の不可視文字を見逃す', () => {
    const source = `---
title: サンプル
---

layout: title
keyMessage: "${zeroWidthSpace}"
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

  it('title がゼロ幅スペースのみなら Schema 違反として捕まえる。title/keyMessage/body は同じ pattern を個別に持つため、1キーだけのテストでは残り2つの改変・改悪を検出できない', () => {
    const source = `---
title: "${zeroWidthSpace}"
---

layout: title
keyMessage: "見出し"
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('title')
  })

  it('body がゼロ幅スペースのみなら Schema 違反として捕まえる', () => {
    const source = `---
title: サンプル
---

layout: bullets
keyMessage: "見出し"

${zeroWidthSpace}
`
    const found = checkDecks([{ path: 'design/decks/sample.md', source }], deckSchema)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('body')
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

describe('checkBypassFixtureCoverage', () => {
  /** 軸1つ・除外1つを宣言した lint ルール。各テストはこれに対する事例側だけを壊す。 */
  const rule = {
    id: 'no-raw-color',
    method: 'lint',
    bypassAxes: ['alternate-notation'],
    scopeExclusions: [{ id: 'keyword-color' }],
  }

  /** 宣言をすべて埋めた事例一式。 */
  const completeCases = [
    { axis: 'alternate-notation', name: '別記法', code: 'x', expect: 'violation', messageId: 'rawColor' },
    { exclusion: 'keyword-color', name: '除外', code: 'y', expect: 'ok' },
  ]

  /** @param {any[]} cases */
  const loadedWith = (cases) => new Map([['no-raw-color', { fixture: { cases }, error: null }]])

  it('宣言をすべて埋めていれば問題を返さない', () => {
    expect(checkBypassFixtureCoverage([rule], loadedWith(completeCases), [])).toEqual([])
  })

  it('フィクスチャ自体が無いルールを捕まえる', () => {
    const found = checkBypassFixtureCoverage(
      [rule],
      new Map([['no-raw-color', { fixture: null, error: null }]]),
      [],
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('no-raw-color.bypass.mjs')
  })

  it('宣言した軸に、違反として捕まる事例が無いことを捕まえる', () => {
    const found = checkBypassFixtureCoverage(
      [rule],
      loadedWith([
        { axis: 'alternate-notation', name: '通るだけの事例', code: 'x', expect: 'ok' },
        completeCases[1],
      ]),
      [],
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('alternate-notation')
  })

  it('宣言した除外に、通ることを固定する事例が無いことを捕まえる', () => {
    const found = checkBypassFixtureCoverage([rule], loadedWith([completeCases[0]]), [])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('keyword-color')
  })

  it('境界の軸で片側（通る側）が欠けていることを捕まえる', () => {
    const boundaryRule = { ...rule, bypassAxes: ['boundary'], scopeExclusions: [] }
    const found = checkBypassFixtureCoverage(
      [boundaryRule],
      loadedWith([
        { axis: 'boundary', name: '割ると落ちる', code: 'x', expect: 'violation', messageId: 'rawScale' },
      ]),
      [],
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('expect: \'ok\'')
  })

  it('契約に宣言の無い軸を事例が使っていることを捕まえる', () => {
    const found = checkBypassFixtureCoverage(
      [rule],
      loadedWith([
        ...completeCases,
        { axis: 'boundary', name: '宣言の無い軸', code: 'z', expect: 'violation', messageId: 'rawColor' },
      ]),
      [],
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('bypassAxes に無い')
  })

  it('違反を期待する事例が、どの報告になるかを書いていないことを捕まえる', () => {
    const found = checkBypassFixtureCoverage(
      [rule],
      loadedWith([
        { axis: 'alternate-notation', name: '落ちさえすればよい事例', code: 'x', expect: 'violation' },
        completeCases[1],
      ]),
      [],
    )

    // messageId が無いこと自体と、その結果として軸が埋まらないことの2件。
    expect(found).toHaveLength(2)
    expect(found[0]).toContain('messageId')
  })

  it('除外の事例が落ちる側になっていることを捕まえる', () => {
    const found = checkBypassFixtureCoverage(
      [rule],
      loadedWith([
        completeCases[0],
        { exclusion: 'keyword-color', name: '落ちる除外', code: 'y', expect: 'violation', messageId: 'rawColor' },
      ]),
      [],
    )

    expect(found).toHaveLength(2)
    expect(found[0]).toContain("expect: 'ok'")
  })

  it('同じ名前の事例が2つあることを捕まえる', () => {
    const found = checkBypassFixtureCoverage(
      [rule],
      loadedWith([completeCases[0], { ...completeCases[0] }, completeCases[1]]),
      [],
    )

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('同じ名前')
  })

  it('免除したルールにフィクスチャが現れたら、陳腐化した免除として捕まえる', () => {
    const found = checkBypassFixtureCoverage([rule], loadedWith(completeCases), ['no-raw-color'])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('免除')
  })

  it('免除したルールにフィクスチャが無いのは問題にしない', () => {
    const loaded = new Map([['no-raw-color', { fixture: null, error: null }]])

    expect(checkBypassFixtureCoverage([rule], loaded, ['no-raw-color'])).toEqual([])
  })

  it('フィクスチャが読み込めないとき、例外ではなく問題として返す', () => {
    const loaded = new Map([['no-raw-color', { fixture: null, error: '読み込めない: 構文エラー' }]])
    const found = checkBypassFixtureCoverage([rule], loaded, [])

    expect(found).toEqual(['読み込めない: 構文エラー'])
  })
})

describe('checkLintRuleDescriptionsMatch', () => {
  const rules = [{ id: 'no-raw-color', method: 'lint', description: '契約が述べる守備範囲' }]

  it('正本から引いた説明は一致する', () => {
    const implementations = { 'no-raw-color': { meta: { docs: { description: '契約が述べる守備範囲' } } } }

    expect(checkLintRuleDescriptionsMatch(rules, implementations)).toEqual([])
  })

  it('実装側に書き下ろされた説明が正本とずれていることを捕まえる', () => {
    const implementations = { 'no-raw-color': { meta: { docs: { description: '実装だけが述べる別の範囲' } } } }
    const found = checkLintRuleDescriptionsMatch(rules, implementations)

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('no-raw-color')
  })

  it('説明そのものが無い実装を捕まえる', () => {
    const implementations = { 'no-raw-color': { meta: { docs: {} } } }

    expect(checkLintRuleDescriptionsMatch(rules, implementations)).toHaveLength(1)
  })
})
