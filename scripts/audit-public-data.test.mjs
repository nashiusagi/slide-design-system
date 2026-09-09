// @vitest-environment node
//
// このファイルは audit-public-data.mjs を import する。同ファイルは REPO_ROOT を
// `new URL('..', import.meta.url)` で解決しており、jsdom 環境はグローバルの URL を
// 差し替えているためこの相対解決が file: スキームを外れる
// （scripts/resolve-design-contract.test.mjs の同種のコメントを参照）。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { auditDirectory, buildLeakPatterns, findLeaks } from './audit-public-data.mjs'
import { sanitizeDirectory } from './sanitize-run-artifacts.mjs'

/** @type {string[]} */
const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'audit-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(/** @type {string} */ (tempDirs.pop()), { recursive: true, force: true })
  }
})

describe('findLeaks', () => {
  it('Unix のホームディレクトリ配下の絶対パスを検出する', () => {
    const leaks = findLeaks('measurements written to /home/ryogo/tmp/dist/index.html')
    expect(leaks.map((leak) => leak.id)).toContain('home-path')
  })

  it('macOS のホームディレクトリ配下の絶対パスを検出する', () => {
    const leaks = findLeaks('/Users/ryogo/project/dist')
    expect(leaks.map((leak) => leak.id)).toContain('macos-home-path')
  })

  it('一時ディレクトリ配下の絶対パスを検出する（prepare-workspace.mjs の既定の出力先）', () => {
    const leaks = findLeaks('workspace at /tmp/slide-harness-experiments/harness-intro/baseline-123/src/App.tsx')
    expect(leaks.map((leak) => leak.id)).toContain('tmp-path')
  })

  it('macOS の一時ディレクトリ配下の絶対パスを検出する', () => {
    const leaks = findLeaks('dist served from /var/folders/ab/xyz1234/T/slide-harness/dist')
    expect(leaks.map((leak) => leak.id)).toContain('macos-tmp-path')
  })

  it.each([
    ['OpenAI 形式', 'sk-abcdefghijklmnopqrstuvwx', 'openai-api-key'],
    ['Anthropic 形式', 'sk-ant-abcdefghijklmnopqrstuvwx', 'anthropic-api-key'],
    ['GitHub 形式', 'ghp_abcdefghijklmnopqrstuvwxyz012345', 'github-token'],
    ['AWS アクセスキーID', 'AKIAABCDEFGHIJKLMNOP', 'aws-access-key-id'],
    ['Slack 形式', 'xoxb-1234567890-abcdefghij', 'slack-token'],
  ])('%s の API キー・トークンらしき文字列を検出する', (_label, secret, expectedId) => {
    const leaks = findLeaks(`token: ${secret}`)
    expect(leaks.map((leak) => leak.id)).toContain(expectedId)
  })

  it('秘密情報らしき名前への代入を検出する', () => {
    const leaks = findLeaks('const apiKey = "abcdefghijklmnopqrstuvwxyz123456"')
    expect(leaks.map((leak) => leak.id)).toContain('generic-secret-assignment')
  })

  it('通常の文章やコードには何も検出しない', () => {
    const content = [
      'export function App() {',
      '  return <div>設計契約 → AI 生成 → 機械検査 → 修正</div>',
      '}',
      'ハッシュ値の例: a1b2c3d4（8文字、8桁のvite出力ハッシュ）',
    ].join('\n')

    // 実行環境の OS ユーザー名（既定の LEAK_PATTERNS が含む）に依存しないよう、
    // ここではユーザー名パターンを持たない静的パターンだけで確認する。
    expect(findLeaks(content, buildLeakPatterns({ username: '' }))).toEqual([])
  })
})

describe('buildLeakPatterns', () => {
  it('username を渡すと、単語境界つきで単独の文字列としての出現を検出する', () => {
    const patterns = buildLeakPatterns({ username: 'ryogo-test-user' })
    const leaks = findLeaks('note left by ryogo-test-user while debugging', patterns)

    expect(leaks.map((leak) => leak.id)).toContain('current-username')
  })

  it('username が別の単語の一部のときは検出しない', () => {
    const patterns = buildLeakPatterns({ username: 'ryogo-test-user' })
    const leaks = findLeaks('ryogo-test-user-extended is unrelated', patterns)

    expect(leaks.map((leak) => leak.id)).not.toContain('current-username')
  })

  it('username を空文字列にすると current-username パターンを持たない', () => {
    const patterns = buildLeakPatterns({ username: '' })
    expect(patterns.some((pattern) => pattern.id === 'current-username')).toBe(false)
  })
})

describe('auditDirectory', () => {
  it('ホームディレクトリを含む成果物を検出する（完了条件）', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'measurements.json'), JSON.stringify({ dist: '/home/ryogo/workspace/slide-harness/dist' }))

    const problems = auditDirectory(dir)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.some((line) => line.includes('/home/ryogo'))).toBe(true)
  })

  it('sanitize 後は検出されない（完了条件）', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'measurements.json'), JSON.stringify({ dist: '/home/ryogo/workspace/slide-harness/dist' }))

    sanitizeDirectory(dir, { homeDir: '/home/ryogo', username: 'ryogo' })

    expect(auditDirectory(dir)).toEqual([])
  })

  it('API キー・token らしき文字列も検査対象に含む（完了条件）', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'notes.txt'), 'debug: used key sk-abcdefghijklmnopqrstuvwx during generation')

    const problems = auditDirectory(dir)
    expect(problems.some((line) => line.includes('openai-api-key'))).toBe(true)
  })

  it('問題が無いディレクトリは空配列を返す', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'App.tsx'), 'export function App() { return null }\n')

    expect(auditDirectory(dir)).toEqual([])
  })
})
