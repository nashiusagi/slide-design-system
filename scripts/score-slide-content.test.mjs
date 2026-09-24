// @vitest-environment node
//
// このファイルは score-slide-content.mjs を import する。あちらは REPO_ROOT を
// `new URL('..', import.meta.url)` で解決しており、jsdom 環境はグローバルの URL を
// 差し替えているためこの相対解決が file: スキームを外れる。
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  buildConveyanceRequest,
  buildLayoutCriteria,
  loadLayouts,
  parseArgs,
  summarize,
  buildLayoutRequest,
  callTypeSafe,
  toScorableDeck,
} from './score-slide-content.mjs'

const DECK = {
  title: 'テストデッキ',
  slides: [
    { layout: 'title', keyMessage: '表題を示す' },
    { layout: 'statement', keyMessage: '結論を示す' },
  ],
}

const RENDERED = [
  { slideNumber: 1, lines: ['表題'] },
  { slideNumber: 2, lines: ['結論'] },
]

const THRESHOLDS = { conveyanceMin: 2, conveyanceReviewConfidence: 0.5, layoutReviewConfidence: 0.5 }

const answer = (over = {}) => ({ score: 3, confidence: 0.9, probabilities: { 0: 0, 1: 0, 2: 0, 3: 1 }, ...over })
const choice = (over = {}) => ({ choice: 'title', confidence: 0.9, probabilities: { title: 0.9, statement: 0.1 }, ...over })

describe('loadLayouts', () => {
  it('deck 契約が許す layout をすべて読む（読む対象は正本から取る）', () => {
    const allowed = JSON.parse(readFileSync(new URL('../design/schemas/deck.schema.json', import.meta.url), 'utf8'))
      .properties.slides.items.properties.layout.enum

    expect([...loadLayouts().keys()].sort()).toEqual([...allowed].sort())
  })

  it('各レイアウトの役割と選択基準を、契約そのままの形で持つ', () => {
    const title = loadLayouts().get('title')

    expect(title?.role.length).toBeGreaterThan(0)
    expect(Array.isArray(title?.whenToUse)).toBe(true)
    expect(Array.isArray(title?.whenNotToUse)).toBe(true)
  })
})

describe('buildLayoutCriteria', () => {
  it('役割・選ぶとき・選ばないときを、散文へ畳まず構造のまま渡す', () => {
    const layouts = new Map([['title', { name: 'title', role: '役割', whenToUse: ['A'], whenNotToUse: ['B'] }]])

    expect(buildLayoutCriteria(layouts)).toEqual({ title: { 役割: '役割', 選ぶとき: ['A'], 選ばないとき: ['B'] } })
  })
})

describe('buildConveyanceRequest', () => {
  const layouts = loadLayouts()

  it('スライドごとに、そのレイアウトの役割を state へ入れる', () => {
    const { state } = buildConveyanceRequest(DECK, RENDERED, layouts)

    expect(state.slides[0].role).toBe(layouts.get('title')?.role)
    expect(state.slides[1].role).toBe(layouts.get('statement')?.role)
  })

  it('役割が違えば、同じ表示文字でも判定の前提が変わる（軸がレイアウト依存であること）', () => {
    const { state } = buildConveyanceRequest(DECK, RENDERED, layouts)

    expect(state.slides[0].role).not.toBe(state.slides[1].role)
  })

  it('スライドの枚数だけ質問を立てる', () => {
    expect(Object.keys(buildConveyanceRequest(DECK, RENDERED, layouts).questions)).toEqual(['slide1', 'slide2'])
  })
})

describe('buildLayoutRequest', () => {
  const layouts = loadLayouts()

  it('宣言済みのレイアウトを state へ入れない（入れると宣言をなぞるだけになる）', () => {
    const { state } = buildLayoutRequest(DECK, RENDERED, layouts)

    for (const slide of state.slides) {
      expect(Object.keys(slide)).not.toContain('layout')
      expect(Object.keys(slide)).not.toContain('role')
    }
    expect(JSON.stringify(state)).not.toContain('"title"')
  })

  it('選択肢を deck 契約が許すレイアウトすべてにする', () => {
    const { questions } = buildLayoutRequest(DECK, RENDERED, layouts)

    const slide1 = /** @type {{ criteria: Record<string, unknown> }} */ (questions.slide1)

    expect(Object.keys(slide1.criteria).sort()).toEqual([...layouts.keys()].sort())
  })
})

describe('summarize', () => {
  it('合格線を割った伝達を所見にする', () => {
    const [slide] = summarize(
      { slides: [DECK.slides[0]] },
      [RENDERED[0]],
      { slide1: answer({ score: 1.2 }) },
      { slide1: choice() },
      THRESHOLDS,
    )

    expect(slide.findings.map((f) => f.rule)).toEqual(['key-message-conveyed'])
  })

  it('合格線ちょうどは所見にしない（境界を下回ったときだけ落とす）', () => {
    const [slide] = summarize(
      { slides: [DECK.slides[0]] },
      [RENDERED[0]],
      { slide1: answer({ score: THRESHOLDS.conveyanceMin }) },
      { slide1: choice() },
      THRESHOLDS,
    )

    expect(slide.findings).toEqual([])
  })

  it('内容に向くレイアウトが宣言と違えば所見にする', () => {
    const [slide] = summarize(
      { slides: [DECK.slides[0]] },
      [RENDERED[0]],
      { slide1: answer() },
      { slide1: choice({ choice: 'statement', probabilities: { title: 0.2, statement: 0.8 } }) },
      THRESHOLDS,
    )

    expect(slide.findings.map((f) => f.rule)).toEqual(['layout-fit'])
  })

  it('確信度が低い判定は、合否によらず人が見る印を付ける', () => {
    const [slide] = summarize(
      { slides: [DECK.slides[0]] },
      [RENDERED[0]],
      { slide1: answer({ confidence: 0.2 }) },
      { slide1: choice() },
      THRESHOLDS,
    )

    expect(slide.findings).toEqual([])
    expect(slide.needsHumanReview).toBe(true)
  })

  it('確信度が高ければ印を付けない', () => {
    const [slide] = summarize(
      { slides: [DECK.slides[0]] },
      [RENDERED[0]],
      { slide1: answer() },
      { slide1: choice() },
      THRESHOLDS,
    )

    expect(slide.needsHumanReview).toBe(false)
  })

  it('所見に、どのレイアウトの役割で測ったかを残す', () => {
    const [slide] = summarize(
      { slides: [DECK.slides[0]] },
      [RENDERED[0]],
      { slide1: answer({ score: 0.5 }) },
      { slide1: choice() },
      THRESHOLDS,
    )

    expect(slide.findings[0].detail).toContain('title')
  })
})

describe('toScorableDeck', () => {
  it('layout か keyMessage を欠く deck を、黙って採点しない', () => {
    expect(() => toScorableDeck({ title: 'x', slides: [{ layout: 'title' }] }, 'deck.md')).toThrow(/keyMessage/)
  })

  it('title を欠く deck を、黙って採点しない', () => {
    expect(() => toScorableDeck({ title: '   ', slides: [] }, 'deck.md')).toThrow(/title/)
  })

  it('揃っていれば、採点に要る形だけを返す', () => {
    const deck = toScorableDeck({ title: 'x', slides: [{ layout: 'title', keyMessage: 'm', body: '余分' }] }, 'deck.md')

    expect(deck).toEqual({ title: 'x', slides: [{ layout: 'title', keyMessage: 'm' }] })
  })
})

describe('parseArgs', () => {
  it('知らない引数を黙って無視しない', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/知らない引数/)
  })

  it('ビルド出力と deck の既定を持ち、どちらも上書きできる', () => {
    expect(parseArgs([])).toMatchObject({ dist: 'dist', deck: 'design/decks/harness-intro.md' })
    expect(parseArgs(['--dist=other/dist', '--deck=design/decks/other.md'])).toMatchObject({
      dist: 'other/dist',
      deck: 'design/decks/other.md',
    })
  })
})

describe('callTypeSafe', () => {
  it('キーが無ければ、外部 API を使う検査であることを言って落ちる', async () => {
    await expect(callTypeSafe({}, undefined)).rejects.toThrow(/TYPESAFE_API_KEY/)
  })

  it('キーが無いときに、黙って判定を飛ばして成功しない', async () => {
    await expect(callTypeSafe({}, '')).rejects.toThrow()
  })
})

describe('design/rules.json との対応', () => {
  const rules = JSON.parse(readFileSync(new URL('../design/rules.json', import.meta.url), 'utf8'))

  it('所見が使うルールIDが、検査ルールの正本に登録されている', () => {
    const declared = new Set(
      rules.rules.filter((/** @type {{ method: string }} */ rule) => rule.method === 'content').map((/** @type {{ id: string }} */ rule) => rule.id),
    )

    expect(declared).toEqual(new Set(['key-message-conveyed', 'layout-fit']))
  })

  it('閾値を正本から読む（実装へ書き写さない）', () => {
    expect(rules.keyMessageConveyed).toEqual({
      $comment: expect.any(String),
      conveyanceMin: expect.any(Number),
      reviewConfidence: expect.any(Number),
    })
    expect(rules.layoutFit).toEqual({ $comment: expect.any(String), reviewConfidence: expect.any(Number) })
  })

  it('確信度の線をルールごとに別に持つ（同じ値でも別の意味だから）', () => {
    const [slide] = summarize(
      { slides: [DECK.slides[0]] },
      [RENDERED[0]],
      { slide1: answer({ confidence: 0.9 }) },
      { slide1: choice({ confidence: 0.1 }) },
      { conveyanceMin: 2, conveyanceReviewConfidence: 0.5, layoutReviewConfidence: 0.05 },
    )

    expect(slide.needsHumanReview).toBe(false)
  })
})
