// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  countFirstRound,
  extractFirstRound,
  loadHistoryPrs,
  loadTargetCategories,
  readCoverage,
  tally,
} from './count-first-round-findings.mjs'

const SEVERITIES = ['blocker', 'should', 'consider']
const PERSPECTIVES = ['設計契約との整合', '決定記録（DR）との整合', '日本語ドキュメント']

/** @param {string} body */
function review(body) {
  return `# PR #1 レビュー\n\n- **立った観点**: 設計契約との整合 / 決定記録（DR）との整合 / 日本語ドキュメント\n\n## 要約\n\n所感。\n\n${body}\n`
}

describe('extractFirstRound', () => {
  it('最初の「## N周目」より後を1周目に含めない', () => {
    const markdown = review(
      '## should\n\n### `writing/a` — 1周目\n\n## 落とした指摘\n\nなし\n\n## 2周目（2026-10-11）\n\n### should\n\n#### `writing/b` — 2周目',
    )

    const firstRound = extractFirstRound(markdown)

    expect(firstRound).toContain('writing/a')
    expect(firstRound).toContain('## 落とした指摘')
    expect(firstRound).not.toContain('writing/b')
  })

  it('再レビューの節が無い記録は、全体が1周目になる', () => {
    const markdown = review('## should\n\n### `writing/a` — 指摘')
    expect(extractFirstRound(markdown)).toBe(markdown)
  })
})

describe('countFirstRound', () => {
  const targets = ['writing/a', 'writing/b']

  it('1周目に同じカテゴリが何件出ても1回と数え、対象外のカテゴリと2周目の指摘は数えない', () => {
    const markdown = review(
      [
        '## blocker',
        '### `writing/a` — 1件目',
        '## should',
        '### writing/a — 2件目（backtick なしの古い書き方）',
        '### `code/x` — 対象外',
        '## 2周目（2026-10-11）',
        '### should',
        '#### `writing/b` — 2周目でだけ出た',
      ].join('\n\n'),
    )

    const result = countFirstRound(markdown, targets, SEVERITIES)

    expect(result.categories).toEqual(['writing/a'])
    expect(result.unparsed).toBe(0)
  })

  it('重要度の節の外にあるカテゴリID形の見出しは、取りこぼしとして返す', () => {
    const markdown = review('## 落とした指摘\n\n### `writing/a` — 見出しで書いてしまった')

    const result = countFirstRound(markdown, targets, SEVERITIES)

    expect(result.categories).toEqual([])
    expect(result.unparsed).toBe(1)
  })
})

describe('readCoverage', () => {
  it('観点表のすべてが立ち、どれも結果を返していれば全とする（括弧を含む観点名も照合する）', () => {
    expect(readCoverage(review(''), PERSPECTIVES)).toEqual({ status: 'full', missing: [], noResult: [], unreadable: [] })
  })

  it('立たなかった観点があれば欠けとする', () => {
    const markdown = '- **立った観点**: 設計契約との整合 / 日本語ドキュメント\n'
    expect(readCoverage(markdown, PERSPECTIVES)).toEqual({
      status: 'lacking',
      missing: ['決定記録（DR）との整合'],
      noResult: [],
      unreadable: [],
    })
  })

  it('立っても結果を返さなかった観点があれば欠けとする', () => {
    const markdown = '- **立った観点**: 設計契約との整合 / 決定記録（DR）との整合（結果なし） / 日本語ドキュメント\n'
    expect(readCoverage(markdown, PERSPECTIVES)).toEqual({
      status: 'lacking',
      missing: [],
      noResult: ['決定記録（DR）との整合'],
      unreadable: [],
    })
  })

  it.each([
    ['半角括弧の注記', '決定記録（DR）との整合(結果なし)'],
    ['理由を書き足した注記', '決定記録（DR）との整合（結果なし：タイムアウト）'],
    ['別の言葉の注記', '決定記録（DR）との整合（途中で失敗）'],
  ])('書式外の注記（%s）は剥がして照合せず、読めないものとして欠けに倒す', (_label, element) => {
    const markdown = `- **立った観点**: 設計契約との整合 / ${element} / 日本語ドキュメント\n`
    const coverage = readCoverage(markdown, PERSPECTIVES)

    expect(coverage.status).toBe('lacking')
    expect(coverage.unreadable).toEqual([element])
  })

  it('観点表の全観点が並んでいても、表に無い要素が混ざれば欠けに倒す', () => {
    const markdown = '- **立った観点**: 設計契約との整合 / 決定記録（DR）との整合 / 日本語ドキュメント / 全観点\n'
    expect(readCoverage(markdown, PERSPECTIVES)).toMatchObject({ status: 'lacking', missing: [], unreadable: ['全観点'] })
  })

  it('欄が無い記録は、確かめられないので全とはしない', () => {
    expect(readCoverage('# PR #1 レビュー\n', PERSPECTIVES).status).toBe('unrecorded')
  })
})

describe('tally', () => {
  /** @param {number} pr @param {'full' | 'lacking' | 'unrecorded'} status @param {number} count */
  const record = (pr, status, count) => ({
    pr,
    categories: Array.from({ length: count }, (_, i) => `writing/c${i}`),
    unparsed: 0,
    coverage: { status, missing: [], noResult: [], unreadable: [] },
  })
  const records = [record(1, 'full', 3), record(2, 'lacking', 1), record(3, 'unrecorded', 2)]

  it('測定では、観点が欠けた PR と欄の無い PR を母数からも計上回数からも除く', () => {
    const result = tally(records, { baseline: false })
    expect({ total: result.total, counted: result.counted }).toEqual({ total: 3, counted: 1 })
  })

  it('基準値では、観点の欠けで母数を除かない', () => {
    const result = tally(records, { baseline: true })
    expect({ total: result.total, counted: result.counted }).toEqual({ total: 6, counted: 3 })
  })

  it('母数が 0 本なら平均を出さない（0 回と区別する）', () => {
    expect(tally([record(1, 'lacking', 2)], { baseline: false }).average).toBeNull()
  })
})

describe('docs/review_log.md の読み取り', () => {
  const log = [
    '# 指摘ログ',
    '## ルール化候補（累計3回以上）',
    '| カテゴリID | 要約 | 累計 | 最終指摘 | 状態 |',
    '|---|---|---|---|---|',
    '| `writing/a` | 要約 | 3 | PR #2 | セルフチェックで扱う（[DR-0057](./decisions/0057-self-check-before-ready.md)） |',
    '| `writing/b` | 要約 | 3 | PR #2 | 未着手 |',
    '## 全カテゴリ',
    '| `writing/c` | 日本語 | 要約 | 1 | PR #2 | セルフチェックで扱う |',
    '## レビュー履歴',
    '| PR | 日付 | blocker | should | consider | レビュー | セルフチェック |',
    '|---|---|---|---|---|---|---|',
    '| #2 | 2026-10-11 | 0 | 1 | 0 | [pr-2.md](./reviews/pr-2.md) | 済 |',
    '| #1 | 2026-10-10 | 0 | 1 | 0 | [pr-1.md](./reviews/pr-1.md) | — |',
  ].join('\n')

  it('対象カテゴリは、候補表で状態が「セルフチェックで扱う」の行だけから取る', () => {
    expect(loadTargetCategories(log)).toEqual(['writing/a'])
  })

  it('履歴表の PR 番号を、行の順に取る', () => {
    expect(loadHistoryPrs(log)).toEqual([2, 1])
  })
})

describe('実在のレビュー記録', () => {
  it('すべての記録の1周目を、カテゴリID形の見出しの取りこぼしなく読める', () => {
    const files = readdirSync('docs/reviews').filter((name) => /^pr-\d+\.md$/.test(name))
    expect(files.length).toBeGreaterThan(0)

    const broken = files.filter(
      (name) => countFirstRound(readFileSync(`docs/reviews/${name}`, 'utf8'), [], SEVERITIES).unparsed > 0,
    )

    expect(broken).toEqual([])
  })

  it('いまの候補表から対象カテゴリを読める', () => {
    expect(loadTargetCategories(readFileSync('docs/review_log.md', 'utf8')).length).toBeGreaterThan(0)
  })
})
