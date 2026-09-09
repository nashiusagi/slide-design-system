// @vitest-environment node
//
// このファイルは evaluate-run.mjs を import する。evaluate-run.mjs は REPO_ROOT を
// `new URL('..', import.meta.url)` で解決しており、jsdom 環境はグローバルの URL を
// 差し替えているためこの相対解決が file: スキームを外れる（scripts/resolve-design-contract.test.mjs
// の同種のコメントを参照）。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildComparisonTable, readRun } from './compare-runs.mjs'

/** @type {string[]} */
const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'compare-runs-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(/** @type {string} */ (tempDirs.pop()), { recursive: true, force: true })
  }
})

describe('readRun', () => {
  it('run.json と scoring.json を読む', () => {
    const runDir = makeTempDir()
    writeFileSync(join(runDir, 'run.json'), JSON.stringify({ id: 'baseline-1', condition: 'baseline' }))
    writeFileSync(join(runDir, 'scoring.json'), JSON.stringify({ lint: { violationsByRule: {} }, measure: { status: 'skipped' } }))

    const { run, scoring } = readRun(runDir)
    expect(run.id).toBe('baseline-1')
    expect(scoring.measure.status).toBe('skipped')
  })

  it('scoring.json が無ければ、評価コマンドの実行を促すエラーにする', () => {
    const runDir = makeTempDir()
    writeFileSync(join(runDir, 'run.json'), JSON.stringify({ id: 'baseline-1', condition: 'baseline' }))

    expect(() => readRun(runDir)).toThrow(/evaluate-run\.mjs score/)
  })
})

describe('buildComparisonTable', () => {
  it('lint は違反0件を pass、1件以上を fail (件数) として表にする', () => {
    /** @type {import('./compare-runs.mjs').RunEntry[]} */
    const entries = [
      {
        run: { id: 'baseline-1', condition: 'baseline' },
        scoring: {
          lint: { violationsByRule: { 'no-raw-color': 3 } },
          measure: { status: 'skipped' },
        },
      },
      {
        run: { id: 'harness-1', condition: 'harness' },
        scoring: {
          lint: { violationsByRule: {} },
          measure: { status: 'measured', violations: [] },
        },
      },
    ]

    const table = buildComparisonTable(entries)

    expect(table).toContain('baseline (baseline-1)')
    expect(table).toContain('harness (harness-1)')
    expect(table).toContain('| no-raw-color | fail (3) | pass |')
    expect(table).toContain('| no-overflow |')
  })

  it('measure が測定済みなら、該当ルールの違反件数を数える', () => {
    /** @type {import('./compare-runs.mjs').RunEntry[]} */
    const entries = [
      {
        run: { id: 'harness-1', condition: 'harness' },
        scoring: {
          lint: { violationsByRule: {} },
          measure: {
            status: 'measured',
            violations: [
              { rule: 'no-overflow', slideNumber: 1, step: 0, selector: 'x', detail: 'x' },
              { rule: 'no-overflow', slideNumber: 2, step: 0, selector: 'x', detail: 'x' },
            ],
          },
        },
      },
    ]

    const table = buildComparisonTable(entries)
    expect(table).toContain('| no-overflow | fail (2) |')
    expect(table).toContain('| min-font-size | pass |')
  })

  it('Run が1件も無いとエラーにする', () => {
    expect(() => buildComparisonTable([])).toThrow()
  })
})
