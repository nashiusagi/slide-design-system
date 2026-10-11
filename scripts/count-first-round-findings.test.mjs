// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  countFirstRound,
  extractFirstRound,
  loadHistoryPrs,
  loadTargetCategories,
  readCoverage,
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
    expect(readCoverage(review(''), PERSPECTIVES)).toEqual({ status: 'full', missing: [], noResult: [] })
  })

  it('立たなかった観点があれば欠けとする', () => {
    const markdown = '- **立った観点**: 設計契約との整合 / 日本語ドキュメント\n'
    expect(readCoverage(markdown, PERSPECTIVES)).toEqual({
      status: 'lacking',
      missing: ['決定記録（DR）との整合'],
      noResult: [],
    })
  })

  it('立っても結果を返さなかった観点があれば欠けとする', () => {
    const markdown = '- **立った観点**: 設計契約との整合 / 決定記録（DR）との整合（結果なし） / 日本語ドキュメント\n'
    expect(readCoverage(markdown, PERSPECTIVES)).toEqual({
      status: 'lacking',
      missing: [],
      noResult: ['決定記録（DR）との整合'],
    })
  })

  it('欄が無い記録は、確かめられないので全とはしない', () => {
    expect(readCoverage('# PR #1 レビュー\n', PERSPECTIVES).status).toBe('unrecorded')
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
