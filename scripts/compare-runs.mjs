/**
 * 保存済み Run の採点結果（`scoring.json`）を並べて比較表を作る（DR-0020 の責務5）。
 *
 *   node scripts/compare-runs.mjs <runDir> [<runDir> ...] [--out=<path>]
 *
 * 対象は `scripts/evaluate-run.mjs score` が書き出した `scoring.json`。ここでは
 * lint / measure をやり直さない。AI は起動しない（DR-0020）。`--out` を省略すると
 * 標準出力へ Markdown 表を書く。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { SCORED_LINT_RULE_IDS } from './evaluate-run.mjs'
import { IMPLEMENTED_MEASURE_RULE_IDS } from './lib/measure-rules.mjs'

/**
 * @typedef {{
 *   run: { id: string, condition: string },
 *   scoring: {
 *     lint: { violationsByRule: Record<string, number> },
 *     measure: { status: string, violations?: { rule: string, [extra: string]: unknown }[] },
 *   },
 * }} RunEntry
 */

/**
 * @param {string} runDir
 * @returns {RunEntry}
 */
export function readRun(runDir) {
  const run = /** @type {RunEntry['run']} */ (JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8')))

  /** @type {RunEntry['scoring']} */
  let scoring

  try {
    scoring = JSON.parse(readFileSync(join(runDir, 'scoring.json'), 'utf8'))
  } catch (error) {
    throw new Error(
      `${runDir}/scoring.json を読めない。先に 'node scripts/evaluate-run.mjs score --run=${runDir}' を実行すること: ${
        /** @type {Error} */ (error).message
      }`,
      { cause: error },
    )
  }

  return { run, scoring }
}

/**
 * @param {string} ruleId
 * @param {RunEntry} entry
 * @returns {string}
 */
function lintCell(ruleId, entry) {
  const count = entry.scoring.lint.violationsByRule[ruleId] ?? 0
  return count === 0 ? 'pass' : `fail (${count})`
}

/**
 * @param {string} ruleId
 * @param {RunEntry} entry
 * @returns {string}
 */
function measureCell(ruleId, entry) {
  const { measure } = entry.scoring

  if (measure.status !== 'measured') {
    return 'skipped'
  }

  const count = (measure.violations ?? []).filter((violation) => violation.rule === ruleId).length
  return count === 0 ? 'pass' : `fail (${count})`
}

/**
 * @param {RunEntry[]} entries
 * @returns {string} Markdown の表
 */
export function buildComparisonTable(entries) {
  if (entries.length === 0) {
    throw new Error('比較する Run が無い')
  }

  const header = ['rule', ...entries.map((entry) => `${entry.run.condition} (${entry.run.id})`)]
  const rows = [
    ...SCORED_LINT_RULE_IDS.map((ruleId) => [ruleId, ...entries.map((entry) => lintCell(ruleId, entry))]),
    ...IMPLEMENTED_MEASURE_RULE_IDS.map((ruleId) => [ruleId, ...entries.map((entry) => measureCell(ruleId, entry))]),
  ]

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ]

  return lines.join('\n')
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const outFlag = argv.find((arg) => arg.startsWith('--out='))
  const runDirs = argv.filter((arg) => !arg.startsWith('--'))

  return { runDirs, out: outFlag?.slice('--out='.length) }
}

function main() {
  const { runDirs, out } = parseArgs(process.argv.slice(2))

  if (runDirs.length === 0) {
    console.error('Usage: node scripts/compare-runs.mjs <runDir> [<runDir> ...] [--out=<path>]')
    process.exitCode = 1
    return
  }

  try {
    const entries = runDirs.map((runDir) => readRun(runDir))
    const table = buildComparisonTable(entries)

    if (out !== undefined) {
      writeFileSync(out, `${table}\n`)
      console.log(`比較表を書き出した: ${out}`)
    } else {
      console.log(table)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

// テストから読み込むときは走らせない。process.exit と副作用（ファイル書き出し）を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
