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
 * 判定はしない。数えるだけだ。どの PR を母数に入れるか（`済` かどうか）は
 * `issue-workflow/references/self-check.md` の数え方で人が決める。
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
  normalizePerspectiveName,
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
 * 欄が無い記録は `unrecorded`。確かめられないので、欠けた側として扱う。
 *
 * @param {string} firstRound
 * @param {string[]} perspectives 観点表の観点名
 * @returns {{ status: 'full' | 'lacking' | 'unrecorded', missing: string[], noResult: string[] }}
 */
export function readCoverage(firstRound, perspectives) {
  const field = COVERAGE_FIELD.exec(firstRound)

  if (field === null) {
    return { status: 'unrecorded', missing: [], noResult: [] }
  }

  const stood = field[1].split('/').map((part) => part.trim())
  const noResult = stood.filter((name) => name.endsWith(NO_RESULT)).map((name) => name.slice(0, -NO_RESULT.length))
  const stoodKeys = new Set(stood.map((name) => normalizePerspectiveName(name.replace(NO_RESULT, ''))))
  const missing = perspectives.filter((name) => !stoodKeys.has(normalizePerspectiveName(name)))

  return { status: missing.length === 0 && noResult.length === 0 ? 'full' : 'lacking', missing, noResult }
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

function main() {
  const { at, prs } = parseArgs(process.argv.slice(2))
  const baseline = at !== null
  const targets = loadTargetCategories(readAt(null, REVIEW_LOG))
  const perspectives = [...loadPerspectiveMap().keys()]
  const population = baseline ? loadHistoryPrs(readAt(at, REVIEW_LOG)) : prs

  console.log(`対象カテゴリ ${targets.length} 件: ${targets.join(' / ')}`)
  console.log(baseline ? `基準値: ${at} 時点の履歴表 ${population.length} 本\n` : `測定: ${population.length} 本\n`)

  let total = 0
  let counted = 0
  let broken = false

  for (const pr of population) {
    const markdown = readAt(at, `docs/reviews/pr-${pr}.md`)
    const { firstRound, categories, unparsed } = countFirstRound(markdown, targets)
    const coverage = readCoverage(firstRound, perspectives)
    // 観点が欠けた PR は測定の母数から除く。基準値の側には当てはめない（DR-0059 決定4）。
    const excluded = !baseline && coverage.status !== 'full'

    if (unparsed > 0) broken = true
    if (!excluded) {
      total += categories.length
      counted += 1
    }

    const note = [
      coverage.status === 'full' ? '観点: 全' : coverage.status === 'unrecorded' ? '観点: 記録なし' : '観点: 欠け',
      ...coverage.missing.map((name) => `立たず ${name}`),
      ...coverage.noResult.map((name) => `結果なし ${name}`),
      excluded ? '→ 母数から除く' : '',
      unparsed > 0 ? `NG 取りこぼし ${unparsed} 件` : '',
    ]
      .filter((part) => part.length > 0)
      .join(' / ')

    console.log(`  #${pr}  ${categories.length}  ${categories.join(' ') || '-'}  （${note}）`)
  }

  const average = counted === 0 ? 0 : total / counted
  console.log(`\n計上 ${total} 回 / 母数 ${counted} 本 = 1 PR あたり ${average.toFixed(2)} 回`)

  if (broken) {
    console.log('\nNG  カテゴリID形の見出しを指摘として読めなかった記録がある。数は信用できない。書式を確かめること。')
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
