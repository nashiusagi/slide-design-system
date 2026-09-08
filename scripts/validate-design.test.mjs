/**
 * 検査そのものが違反を捕まえられるかを固定する。
 *
 * 正しい入力で ok になることは pnpm design:check が毎回示すので、ここが持つのは
 * 壊れた入力を渡したときに必ず1件返るという側。判定側にこれが無いと、何も検出しない
 * ルールでも緑のまま通る。
 */
import { describe, expect, it } from 'vitest'

import {
  checkCanvasMatchesRuntime,
  checkContrast,
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

  it('component の allowedIn が layout を含んでいないと捕まえる', () => {
    const found = checkLayoutComponentConsistency(layouts, [
      { name: 'slide-title', allowedIn: ['bullets'] },
    ])

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('allowedIn')
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
