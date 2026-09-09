// @vitest-environment node
//
// prepareWorkspace は resolve-design-contract.mjs 経由で `new URL('../x', import.meta.url)`
// による相対解決を行う。jsdom 環境はグローバルの URL を差し替えており、この相対解決が
// file: スキームを外れる（resolve-design-contract.test.mjs の同種のコメントを参照）。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import {
  MIRRORED_SRC_FILES,
  assertNoDesignContract,
  checkStarterMatchesRoot,
  prepareWorkspace,
  resolveCondition,
} from './prepare-workspace.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** @type {string[]} */
const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'prepare-workspace-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(/** @type {string} */ (tempDirs.pop()), { recursive: true, force: true })
  }
})

describe('checkStarterMatchesRoot', () => {
  it('starter がルートと完全に一致するとき、問題を報告しない', () => {
    const root = makeTempDir()
    const starter = makeTempDir()

    for (const relativePath of MIRRORED_SRC_FILES) {
      const content = `content of ${relativePath}\n`
      mkdirSync(join(root, 'src', relativePath, '..'), { recursive: true })
      writeFileSync(join(root, 'src', relativePath), content)
      mkdirSync(join(starter, 'src', relativePath, '..'), { recursive: true })
      writeFileSync(join(starter, 'src', relativePath), content)
    }

    expect(checkStarterMatchesRoot(root, starter)).toEqual([])
  })

  it('starter 側の内容がルートと食い違うとき、そのファイルを報告する', () => {
    const root = makeTempDir()
    const starter = makeTempDir()
    const target = MIRRORED_SRC_FILES[0]

    for (const relativePath of MIRRORED_SRC_FILES) {
      const content = `content of ${relativePath}\n`
      mkdirSync(join(root, 'src', relativePath, '..'), { recursive: true })
      writeFileSync(join(root, 'src', relativePath), content)
      mkdirSync(join(starter, 'src', relativePath, '..'), { recursive: true })
      writeFileSync(join(starter, 'src', relativePath), relativePath === target ? 'stale content\n' : content)
    }

    const problems = checkStarterMatchesRoot(root, starter)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(target)
  })

  it('starter にファイルが無いとき、欠落として報告する', () => {
    const root = makeTempDir()
    const starter = makeTempDir()

    for (const relativePath of MIRRORED_SRC_FILES) {
      mkdirSync(join(root, 'src', relativePath, '..'), { recursive: true })
      writeFileSync(join(root, 'src', relativePath), 'x')
    }

    const problems = checkStarterMatchesRoot(root, starter)
    expect(problems).toHaveLength(MIRRORED_SRC_FILES.length)
  })

  it('実際の experiments/harness-intro/starter がリポジトリ直下と一致する', () => {
    const problems = checkStarterMatchesRoot(REPO_ROOT, join(REPO_ROOT, 'experiments/harness-intro/starter'))
    expect(problems).toEqual([])
  })
})

describe('resolveCondition', () => {
  it('存在する condition を返す', () => {
    const manifest = { conditions: { baseline: { includesDesignContract: false, agentSkills: [] } } }
    expect(resolveCondition(manifest, 'baseline')).toEqual({ includesDesignContract: false, agentSkills: [] })
  })

  it('存在しない condition はエラーにする', () => {
    const manifest = { conditions: { baseline: { includesDesignContract: false, agentSkills: [] } } }
    expect(() => resolveCondition(manifest, 'harness')).toThrow(/harness/)
  })
})

describe('assertNoDesignContract', () => {
  it('何も混入していないワークスペースは問題を報告しない', () => {
    const workspace = makeTempDir()
    writeFileSync(join(workspace, 'package.json'), '{}')
    expect(assertNoDesignContract(workspace)).toEqual([])
  })

  it('DESIGN.md / design/ / skills/ の混入をそれぞれ検出する', () => {
    const workspace = makeTempDir()
    writeFileSync(join(workspace, 'DESIGN.md'), '# x')
    mkdirSync(join(workspace, 'design'))
    mkdirSync(join(workspace, 'skills'))

    const problems = assertNoDesignContract(workspace)
    expect(problems).toHaveLength(3)
  })
})

describe('prepareWorkspace（実データに対する結合確認）', () => {
  it('baseline 条件は starter だけをコピーし、契約を含まない', () => {
    const out = makeTempDir()
    const result = prepareWorkspace('experiments/harness-intro', 'baseline', { out })

    expect(result.targetDir).toBe(out)
    expect(result.resources).toEqual([])
    expect(existsSync(join(out, 'src/App.tsx'))).toBe(true)
    expect(existsSync(join(out, 'src/runtime/Deck.tsx'))).toBe(true)
    expect(assertNoDesignContract(out)).toEqual([])
  })

  it('harness 条件は starter に加えて設計契約と Skill をコピーする', () => {
    const out = makeTempDir()
    const result = prepareWorkspace('experiments/harness-intro', 'harness', { out })

    expect(existsSync(join(out, 'src/App.tsx'))).toBe(true)
    expect(existsSync(join(out, 'DESIGN.md'))).toBe(true)
    expect(existsSync(join(out, 'design/tokens.json'))).toBe(true)
    expect(existsSync(join(out, 'design/decks/harness-intro.md'))).toBe(true)
    expect(existsSync(join(out, 'skills/slide-harness/SKILL.md'))).toBe(true)
    expect(existsSync(join(out, 'HARNESS_RESOLVED.json'))).toBe(true)

    const resolved = JSON.parse(readFileSync(join(out, 'HARNESS_RESOLVED.json'), 'utf8'))
    expect(resolved.resources.length).toBe(result.resources.length)
    expect(result.resources.length).toBeGreaterThan(0)
  })

  it('存在しない condition はエラーで止める', () => {
    const out = makeTempDir()
    expect(() => prepareWorkspace('experiments/harness-intro', 'no-such-condition', { out })).toThrow()
  })
})
