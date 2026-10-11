/**
 * レビュー記録の1周目から、セルフチェックが扱うカテゴリの計上回数を数える（#77）。
 *
 *   node scripts/count-first-round-findings.mjs --at=<commit>     基準値（その時点の履歴表の全 PR）
 *   node scripts/count-first-round-findings.mjs <PR番号>...       測定（いまの記録）
 *
 * DR-0057 決定7 の計上回数と基準値は、**1周目のレビューで出た指摘だけ**を数える
 * （DR-0059 決定3・決定4）。全周の累計を持つ `docs/review_log.md` からは出せないので、
 * レビュー記録（`docs/reviews/pr-<N>.md`）を読む。
 *
 * **`済` かどうかは判定しない。** 渡す PR を選ぶのは人で、`issue-workflow/references/self-check.md`
 * の数え方に従う。判定するのは、1周目に観点が欠けたかどうかだけだ（DR-0060 決定4）。
 *
 * - **1周目**は、記録の先頭から最初の `## <N>周目` 見出しまで（`review-file-format.md`）
 * - **数え方**は `docs/review_log.md` と同じ。1つのカテゴリは1つの PR につき1回
 * - **対象カテゴリ**は、いまの `docs/review_log.md` の候補表で状態が `セルフチェックで扱う`
 *   のもの。`--at` の時点の表ではない——その時点ではまだ状態が付いていない
 * - **観点が欠けた PR**（DR-0059 決定3）は測定の母数から除く。基準値の側には当てはめない
 *   （同 決定4）
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  countUnparsedHeadings,
  loadPerspectiveMap,
  parseFindings,
} from './select-review-findings.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW_LOG = 'docs/review_log.md'

/** 対象カテゴリを示す状態欄の値。`review-log-format.md` の「状態の値」の表記。 */
const TARGET_STATE = 'セルフチェックで扱う'
/** 再レビューの節。これより前が1周目。 */
const LATER_ROUND = /^## \d+周目/m
/** `- **立った観点**: A / B / C（結果なし）` */
const COVERAGE_FIELD = /^- \*\*立った観点\*\*:\s*(.+)$/m
/** 結果を返さなかった観点に添える注記（`review-file-format.md`）。 */
const NO_RESULT = '（結果なし）'

/**
 * レビュー記録から1周目だけを切り出す。
 *
 * @param {string} markdown
 */
export function extractFirstRound(markdown) {
  const later = LATER_ROUND.exec(markdown)
  return later === null ? markdown : markdown.slice(0, later.index)
}

/**
 * 候補表から、状態が `セルフチェックで扱う` のカテゴリIDを読む。
 *
 * @param {string} reviewLog `docs/review_log.md` の中身
 * @returns {string[]}
 */
export function loadTargetCategories(reviewLog) {
  const section = /\n## ルール化候補[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(reviewLog)

  if (section === null) {
    throw new Error(`${REVIEW_LOG} に「## ルール化候補」の節が無い。書式が変わった可能性がある。`)
  }

  const targets = [...section[1].matchAll(/^\|\s*`([a-z][a-z0-9-]*\/[a-z0-9-]+)`\s*\|.*\|\s*([^|]*?)\s*\|\s*$/gm)]
    .filter((row) => row[2].startsWith(TARGET_STATE))
    .map((row) => row[1])

  if (targets.length === 0) {
    throw new Error(`${REVIEW_LOG} の候補表に状態が「${TARGET_STATE}」のカテゴリが無い。`)
  }

  return targets
}

/**
 * レビュー履歴表の PR 番号を読む。
 *
 * @param {string} reviewLog
 * @returns {number[]}
 */
export function loadHistoryPrs(reviewLog) {
  const section = /\n## レビュー履歴\n([\s\S]*?)(?=\n## |$)/.exec(reviewLog)

  if (section === null) {
    throw new Error(`${REVIEW_LOG} に「## レビュー履歴」の節が無い。`)
  }

  return [...section[1].matchAll(/^\|\s*#(\d+)\s*\|/gm)].map((row) => Number(row[1]))
}

/**
 * 1周目に観点が欠けたかを、`立った観点` 欄から読む（DR-0053 / DR-0059 決定3）。
 *
 * **各要素は、観点表の名前そのものか、名前 + `（結果なし）` のどちらかに完全一致しなければ
 * 読めないものとして扱う。** 括弧を剥がして照合すると、`（結果なし：タイムアウト）` のような
 * 書式外の注記が剥がれて「立った」と数えられ、欠けた PR が黙って母数に入る。書式を外れた
 * 記録ほど安全側（欠け）に倒す。
 *
 * 欄が無い記録は `unrecorded`。確かめられないので、これも欠けた側として扱う。
 *
 * @param {string} firstRound
 * @param {string[]} perspectives 観点表の観点名
 * @returns {{ status: 'full' | 'lacking' | 'unrecorded', missing: string[], noResult: string[], unreadable: string[] }}
 */
export function readCoverage(firstRound, perspectives) {
  const field = COVERAGE_FIELD.exec(firstRound)

  if (field === null) {
    return { status: 'unrecorded', missing: [], noResult: [], unreadable: [] }
  }

  const stood = field[1].split('/').map((part) => part.trim())
  /** @type {string[]} */
  const returned = []
  /** @type {string[]} */
  const noResult = []
  /** @type {string[]} */
  const unreadable = []

  for (const element of stood) {
    if (perspectives.includes(element)) returned.push(element)
    else if (element.endsWith(NO_RESULT) && perspectives.includes(element.slice(0, -NO_RESULT.length)))
      noResult.push(element.slice(0, -NO_RESULT.length))
    else unreadable.push(element)
  }

  const missing = perspectives.filter((name) => !returned.includes(name) && !noResult.includes(name))
  const full = missing.length === 0 && noResult.length === 0 && unreadable.length === 0

  return { status: full ? 'full' : 'lacking', missing, noResult, unreadable }
}

/**
 * 1周目で出た対象カテゴリを数える。1つのカテゴリは1回。
 *
 * カテゴリID形の見出しを指摘として読めなかったなら、数は信用できない。`unparsed` で返す。
 *
 * @param {string} markdown レビュー記録の全文
 * @param {string[]} targets
 * @param {string[]} [severities]
 */
export function countFirstRound(markdown, targets, severities) {
  const firstRound = extractFirstRound(markdown)
  const findings = parseFindings(firstRound, severities)
  const categories = [...new Set(findings.map((finding) => finding.categoryId))].filter((id) =>
    targets.includes(id),
  )

  return { firstRound, categories, unparsed: countUnparsedHeadings(firstRound, findings) }
}

/**
 * @param {string | null} commit
 * @param {string} path リポジトリ直下からの相対パス
 */
function readAt(commit, path) {
  if (commit === null) {
    return readFileSync(join(REPO_ROOT, path), 'utf8')
  }
  return execFileSync('git', ['show', `${commit}:${path}`], { cwd: REPO_ROOT, encoding: 'utf8' })
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {string | null} */
  let at = null
  /** @type {number[]} */
  const prs = []

  for (const arg of argv) {
    if (arg.startsWith('--at=')) at = arg.slice('--at='.length)
    else if (/^#?\d+$/.test(arg)) prs.push(Number(arg.replace('#', '')))
    else throw new Error(`知らない引数: ${arg}`)
  }

  if ((at === null) === (prs.length === 0)) {
    throw new Error('--at=<commit>（基準値）か <PR番号>...（測定）のどちらか一方を渡す')
  }

  return { at, prs }
}

/**
 * @typedef {{
 *   pr: number,
 *   categories: string[],
 *   coverage: ReturnType<typeof readCoverage>,
 *   unparsed: number,
 * }} PrRecord
 */

/**
 * PR ごとの結果を母数と計上回数へまとめる。
 *
 * **観点が欠けた PR を除くのは測定のときだけ。** 基準値の側には当てはめない（DR-0059 決定4）。
 * 基準値の母集団は `立った観点` 欄が入る前の記録で、当てはめると全部が除かれる。
 *
 * @param {PrRecord[]} records
 * @param {{ baseline: boolean }} options
 */
export function tally(records, { baseline }) {
  const rows = records.map((record) => ({ ...record, excluded: !baseline && record.coverage.status !== 'full' }))
  const counted = rows.filter((row) => !row.excluded)
  const total = counted.reduce((sum, row) => sum + row.categories.length, 0)

  return {
    rows,
    total,
    counted: counted.length,
    average: counted.length === 0 ? null : total / counted.length,
    broken: rows.some((row) => row.unparsed > 0),
  }
}

/** @param {ReturnType<typeof tally>['rows'][number]} row */
function describeRow(row) {
  const { coverage } = row
  return [
    coverage.status === 'full' ? '観点: 全' : coverage.status === 'unrecorded' ? '観点: 記録なし' : '観点: 欠け',
    ...coverage.missing.map((name) => `立たず ${name}`),
    ...coverage.noResult.map((name) => `結果なし ${name}`),
    ...coverage.unreadable.map((name) => `読めない「${name}」`),
    row.excluded ? '→ 母数から除く' : '',
    row.unparsed > 0 ? `NG 取りこぼし ${row.unparsed} 件` : '',
  ]
    .filter((part) => part.length > 0)
    .join(' / ')
}

function main() {
  const { at, prs } = parseArgs(process.argv.slice(2))
  const baseline = at !== null
  const targets = loadTargetCategories(readAt(null, REVIEW_LOG))
  const perspectives = [...loadPerspectiveMap().keys()]
  const population = baseline ? loadHistoryPrs(readAt(at, REVIEW_LOG)) : prs

  console.log(`対象カテゴリ ${targets.length} 件: ${targets.join(' / ')}`)
  console.log(baseline ? `基準値: ${at} 時点の履歴表 ${population.length} 本\n` : `測定: ${population.length} 本\n`)

  const result = tally(
    population.map((pr) => {
      const { firstRound, categories, unparsed } = countFirstRound(readAt(at, `docs/reviews/pr-${pr}.md`), targets)
      return { pr, categories, unparsed, coverage: readCoverage(firstRound, perspectives) }
    }),
    { baseline },
  )

  for (const row of result.rows) {
    console.log(`  #${row.pr}  ${row.categories.length}  ${row.categories.join(' ') || '-'}  （${describeRow(row)}）`)
  }

  if (result.average === null) {
    console.log('\nNG  母数が 0 本。比べる値が無い。')
    process.exitCode = 1
    return
  }

  console.log(`\n計上 ${result.total} 回 / 母数 ${result.counted} 本 = 1 PR あたり ${result.average.toFixed(2)} 回`)

  if (result.broken) {
    console.log('\nNG  カテゴリID形の見出しを指摘として読めなかった記録がある。数は信用できない。書式を確かめること。')
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
