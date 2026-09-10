// @vitest-environment node
//
// このファイルは REPO_ROOT を `new URL('..', import.meta.url)` で解決するモジュールを
// import する。jsdom 環境はグローバルの URL を差し替えており、この相対解決が file:
// スキームを外れる（scripts/resolve-design-contract.test.mjs の同種のコメントを参照）。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { buildRunRecord, saveRun, scoreLint, scoreMeasure, scoreRun, validateRunRecord } from './evaluate-run.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const RUN_SCHEMA = JSON.parse(readFileSync(join(REPO_ROOT, 'experiments/harness-intro/schemas/run.schema.json'), 'utf8'))

/** @type {string[]} */
const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'evaluate-run-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(/** @type {string} */ (tempDirs.pop()), { recursive: true, force: true })
  }
})

describe('buildRunRecord', () => {
  it('必須フィールドだけの入力から、任意フィールドを含まないオブジェクトを作る', () => {
    const record = buildRunRecord({
      id: 'baseline-1',
      experiment: 'harness-intro',
      condition: 'baseline',
      createdAt: '2026-09-09T00:00:00.000Z',
      prompt: 'experiments/harness-intro/prompt.md',
      files: ['App.tsx'],
    })

    expect(record).toEqual({
      id: 'baseline-1',
      experiment: 'harness-intro',
      condition: 'baseline',
      createdAt: '2026-09-09T00:00:00.000Z',
      prompt: 'experiments/harness-intro/prompt.md',
      source: { files: ['App.tsx'] },
    })
  })

  it('任意フィールドを渡すと含む', () => {
    const record = buildRunRecord({
      id: 'harness-corrected-1',
      experiment: 'harness-intro',
      condition: 'harness-corrected',
      createdAt: '2026-09-09T00:00:00.000Z',
      prompt: 'experiments/harness-intro/prompt.md',
      files: ['App.tsx'],
      model: 'claude-sonnet-5',
      correctedFrom: 'harness-1',
      notes: '修正済み',
    })

    expect(record.model).toBe('claude-sonnet-5')
    expect(record.correctedFrom).toBe('harness-1')
    expect(record.notes).toBe('修正済み')
  })
})

describe('validateRunRecord', () => {
  it('スキーマを満たすと問題を報告しない', () => {
    const record = buildRunRecord({
      id: 'baseline-1',
      experiment: 'harness-intro',
      condition: 'baseline',
      createdAt: '2026-09-09T00:00:00.000Z',
      prompt: 'experiments/harness-intro/prompt.md',
      files: ['App.tsx'],
    })

    expect(validateRunRecord(record, RUN_SCHEMA)).toEqual([])
  })

  it('必須フィールドが無いと報告する', () => {
    const problems = validateRunRecord({ id: 'x' }, RUN_SCHEMA)
    expect(problems.length).toBeGreaterThan(0)
  })

  it('condition が enum の外だと報告する', () => {
    const record = buildRunRecord({
      id: 'x',
      experiment: 'harness-intro',
      condition: 'not-a-condition',
      createdAt: '2026-09-09T00:00:00.000Z',
      prompt: 'p.md',
      files: ['App.tsx'],
    })

    expect(validateRunRecord(record, RUN_SCHEMA).length).toBeGreaterThan(0)
  })
})

describe('saveRun', () => {
  /** @returns {string} experimentDir 用の schemas/run.schema.json を持つ repoRoot */
  function makeFixtureRepoRoot() {
    const repoRoot = makeTempDir()
    mkdirSync(join(repoRoot, 'exp/schemas'), { recursive: true })
    writeFileSync(join(repoRoot, 'exp/schemas/run.schema.json'), JSON.stringify(RUN_SCHEMA))
    return repoRoot
  }

  it('workspace の src を取り込み、run.json を書き出す', () => {
    const repoRoot = makeFixtureRepoRoot()
    const workspace = makeTempDir()
    mkdirSync(join(workspace, 'src'))
    writeFileSync(join(workspace, 'src/App.tsx'), 'export const x = 1\n')

    const { runDir, run } = saveRun({
      experimentDir: 'exp',
      condition: 'baseline',
      workspaceDir: workspace,
      prompt: 'exp/prompt.md',
      repoRoot,
    })

    expect(existsSync(join(runDir, 'run.json'))).toBe(true)
    expect(existsSync(join(runDir, 'source/App.tsx'))).toBe(true)
    expect(run.source.files).toEqual(['App.tsx'])
    expect(existsSync(join(runDir, 'dist'))).toBe(false)
  })

  it('workspace に dist があれば併せて取り込む', () => {
    const repoRoot = makeFixtureRepoRoot()
    const workspace = makeTempDir()
    mkdirSync(join(workspace, 'src'))
    writeFileSync(join(workspace, 'src/App.tsx'), 'x')
    mkdirSync(join(workspace, 'dist'))
    writeFileSync(join(workspace, 'dist/index.html'), '<html></html>')

    const { runDir } = saveRun({
      experimentDir: 'exp',
      condition: 'harness',
      workspaceDir: workspace,
      prompt: 'exp/prompt.md',
      id: 'harness-fixed-id',
      repoRoot,
    })

    expect(existsSync(join(runDir, 'dist/index.html'))).toBe(true)
  })

  it('同じ id の Run が既にあるとエラーにする', () => {
    const repoRoot = makeFixtureRepoRoot()
    const workspace = makeTempDir()
    mkdirSync(join(workspace, 'src'))
    writeFileSync(join(workspace, 'src/App.tsx'), 'x')

    const opts = {
      experimentDir: 'exp',
      condition: 'baseline',
      workspaceDir: workspace,
      prompt: 'exp/prompt.md',
      id: 'dup',
      repoRoot,
    }

    saveRun(opts)
    expect(() => saveRun(opts)).toThrow(/既に存在/)
  })
})

describe('scoreLint', () => {
  it('生の色値があると no-raw-color 違反として数える', async () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'App.tsx'),
      "export function App() { return <div style={{ color: '#ff0000' }}>x</div> }\n",
    )

    const result = await scoreLint(dir)
    expect(result.fileCount).toBe(1)
    expect(result.violationsByRule['no-raw-color']).toBe(1)
    expect(result.total).toBe(1)
  })

  it('契約違反が無ければ違反0件', async () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'App.tsx'), "export function App() { return <div>x</div> }\n")

    const result = await scoreLint(dir)
    expect(result.total).toBe(0)
  })

  it('対象ファイルが無ければ実行せずに空を返す', async () => {
    const dir = makeTempDir()
    const result = await scoreLint(dir)
    expect(result).toEqual({ fileCount: 0, violationsByRule: {}, total: 0, messages: [] })
  })

  it('eslint-disable コメントでは違反が消えない（noInlineConfig）', async () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'App.tsx'),
      "/* eslint-disable slide/no-raw-color */\nexport function App() { return <div style={{ color: '#ff0000' }}>x</div> }\n",
    )

    const result = await scoreLint(dir)
    // noInlineConfig 自体が「無効なdisableコメントがある」という別メッセージ
    // （ruleId 無し）も生むため、no-raw-color 以外の合計は問わない。
    expect(result.violationsByRule['no-raw-color']).toBe(1)
  })
})

describe('scoreMeasure', () => {
  it('dist が無ければ skipped を返す', () => {
    const runDir = makeTempDir()
    expect(scoreMeasure(runDir, REPO_ROOT)).toEqual({
      status: 'skipped',
      reason: 'runs/<id>/dist が無い。ビルド済みの workspace から保存すると測定できる。',
    })
  })

  it(
    'dist が健全なビルド出力なら measure-slides.mjs を実行して measured を返す',
    () => {
      const runDir = makeTempDir()
      mkdirSync(join(runDir, 'dist'))
      writeFileSync(
        join(runDir, 'dist/index.html'),
        [
          '<!doctype html><html><body>',
          '<div class="slide-deck" data-slide-count="1" data-slide-index="0" data-step="0" data-step-count="0">',
          '<div class="slide-canvas"><p style="font-size:20px;color:#000000">hello</p></div>',
          '</div>',
          '</body></html>',
        ].join('\n'),
      )

      const result = scoreMeasure(runDir, REPO_ROOT)
      expect(result.status).toBe('measured')
      expect(result.pass).toBe(true)
      expect(result.violations).toEqual([])
      expect(existsSync(join(runDir, 'measurements.json'))).toBe(true)
    },
    20000,
  )

  it(
    'measurements.json を書き出す前に measure-slides.mjs が失敗すると、無関係な ENOENT ではなく本来のエラーを伝える',
    () => {
      const runDir = makeTempDir()
      mkdirSync(join(runDir, 'dist'))
      // .slide-canvas を欠いたビルド出力。measure-slides.mjs はここで例外を投げ、
      // measurements.json を書き出す前に終了する。
      writeFileSync(
        join(runDir, 'dist/index.html'),
        '<!doctype html><html><body><div class="slide-deck" data-slide-count="1" data-slide-index="0" data-step="0" data-step-count="0"></div></body></html>',
      )

      expect(() => scoreMeasure(runDir, REPO_ROOT)).toThrow(/slide-canvas/)
      expect(existsSync(join(runDir, 'measurements.json'))).toBe(false)
    },
    20000,
  )

  it(
    '同じ runDir を再スコアしたとき、直前の measurements.json を新しい失敗の隠れ蓑にしない',
    () => {
      const runDir = makeTempDir()
      mkdirSync(join(runDir, 'dist'))
      const healthyHtml = [
        '<!doctype html><html><body>',
        '<div class="slide-deck" data-slide-count="1" data-slide-index="0" data-step="0" data-step-count="0">',
        '<div class="slide-canvas"><p style="font-size:20px;color:#000000">hello</p></div>',
        '</div>',
        '</body></html>',
      ].join('\n')
      writeFileSync(join(runDir, 'dist/index.html'), healthyHtml)

      const first = scoreMeasure(runDir, REPO_ROOT)
      expect(first.status).toBe('measured')

      // dist を壊してから同じ runDir で再スコアする。measurements.json は
      // 1回目の成功時のものがまだ残っている状態。
      writeFileSync(
        join(runDir, 'dist/index.html'),
        '<!doctype html><html><body><div class="slide-deck" data-slide-count="1" data-slide-index="0" data-step="0" data-step-count="0"></div></body></html>',
      )

      expect(() => scoreMeasure(runDir, REPO_ROOT)).toThrow(/slide-canvas/)
    },
    30000,
  )
})

describe('scoreRun', () => {
  it('lint と measure(skipped) を集計して scoring.json を書き出す', async () => {
    const runDir = makeTempDir()
    writeFileSync(
      join(runDir, 'run.json'),
      JSON.stringify({ id: 'x', experiment: 'exp', condition: 'baseline', createdAt: 'now', prompt: 'p', source: { files: ['App.tsx'] } }),
    )
    mkdirSync(join(runDir, 'source'))
    writeFileSync(join(runDir, 'source/App.tsx'), "export function App() { return <div>x</div> }\n")

    const scoring = await scoreRun(runDir, { repoRoot: REPO_ROOT })

    expect(scoring.lint.total).toBe(0)
    expect(scoring.measure.status).toBe('skipped')
    expect(existsSync(join(runDir, 'scoring.json'))).toBe(true)
  })
})
