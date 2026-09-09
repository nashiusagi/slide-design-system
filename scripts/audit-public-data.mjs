/**
 * 公開してはいけない情報が残っていないかを検査する（DR-0023）。
 *
 *   node scripts/audit-public-data.mjs [<dir> ...]
 *
 * 引数を省略すると `experiments/*\/runs`（保存 Run。存在するものだけ）を対象にする。
 * 対象ディレクトリ配下の全テキストファイルから、絶対パス（ホーム・一時ディレクトリ）・
 * 実行環境の OS ユーザー名（単独の文字列として）・API キー・token らしき文字列
 * パターンを探す。1件でも見つかれば非ゼロで終了する。`pnpm check` に組み込む。
 * ユーザー名の検出は audit を実行しているマシンのものに限る（`buildLeakPatterns` を参照）。
 *
 * **これは文字列パターンの検査であり、公開してよいという承認ではない。**
 * 画像・差分の中身は人が開いて確認する（`docs/PUBLICATION_POLICY.md`）。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { collectFiles, escapeForRegExp, isBinaryPath } from './lib/fs-walk.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * @typedef {{ id: string, pattern: RegExp, description: string }} LeakPattern
 */

/**
 * どの環境でも意味を持つ、固定の検査パターン。id は結果の集計・テストで安定して
 * 参照するためのキー。`pattern` は必ず `g` フラグを持つ（matchAll を使うため）。
 *
 * @type {LeakPattern[]}
 */
const STATIC_LEAK_PATTERNS = [
  {
    id: 'home-path',
    pattern: /\/home\/[^/\s"'<>)]+/g,
    description: 'Unix のホームディレクトリ配下の絶対パス（sanitize-run-artifacts.mjs の対象）',
  },
  {
    id: 'macos-home-path',
    pattern: /\/Users\/[^/\s"'<>)]+/g,
    description: 'macOS のホームディレクトリ配下の絶対パス',
  },
  {
    id: 'tmp-path',
    // 隔離ワークスペースの既定の出力先（prepare-workspace.mjs）は os.tmpdir() 配下で、
    // Linux では通常 /tmp。ここは実行機に依存せず、常に見る（docs/PUBLICATION_POLICY.md
    // が「一時ディレクトリのパス」を絶対パス漏洩の例として明示している）。
    pattern: /\/tmp\/[^/\s"'<>)]+/g,
    description: '一時ディレクトリ配下の絶対パス',
  },
  {
    id: 'macos-tmp-path',
    // macOS の os.tmpdir() の既定は /var/folders/... 配下。
    pattern: /\/var\/folders\/[^/\s"'<>)]+/g,
    description: 'macOS の一時ディレクトリ配下の絶対パス',
  },
  {
    id: 'openai-api-key',
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/g,
    description: 'OpenAI 形式の API キーに似た文字列',
  },
  {
    id: 'anthropic-api-key',
    pattern: /\bsk-ant-[A-Za-z0-9-]{20,}\b/g,
    description: 'Anthropic 形式の API キーに似た文字列',
  },
  {
    id: 'github-token',
    pattern: /\bgh[opsu]_[A-Za-z0-9]{20,}\b/g,
    description: 'GitHub 形式のトークンに似た文字列',
  },
  {
    id: 'aws-access-key-id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    description: 'AWS のアクセスキーIDに似た文字列',
  },
  {
    id: 'slack-token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    description: 'Slack 形式のトークンに似た文字列',
  },
  {
    id: 'generic-secret-assignment',
    pattern: /(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{16,}["']/gi,
    description: '秘密情報らしき名前の変数に長い文字列が代入されている',
  },
]

/**
 * 検査パターンを組み立てる。`username` を渡すと、OS ユーザー名が単語境界つきの
 * 単独の文字列として残っていないかも検査対象に加える
 * （sanitize-run-artifacts.mjs の置換漏れの検出。DR-0023）。
 *
 * これは実行環境（audit を走らせているマシン）のユーザー名しか知らない。
 * 生成を別マシンで行い、そちらで sanitize せずに保存した Run のユーザー名までは
 * 検出できない（`docs/PUBLICATION_POLICY.md` の限界を参照）。
 *
 * @param {{ username?: string }} [identifiers]
 * @returns {LeakPattern[]}
 */
export function buildLeakPatterns(identifiers = {}) {
  const username = identifiers.username ?? userInfo().username

  if (username.length === 0) {
    return STATIC_LEAK_PATTERNS
  }

  return [
    ...STATIC_LEAK_PATTERNS,
    {
      id: 'current-username',
      pattern: new RegExp(`(?<![A-Za-z0-9_-])${escapeForRegExp(username)}(?![A-Za-z0-9_-])`, 'g'),
      description: '実行環境の OS ユーザー名が単独の文字列として残っている（同一マシンでの生成のみ検出できる）',
    },
  ]
}

/** CLI・既定の呼び出しで使う、現在の環境に基づく検査パターン。 */
export const LEAK_PATTERNS = buildLeakPatterns()

/**
 * 1件のテキストから漏洩候補を探す。IO を持たない純関数。
 *
 * @param {string} content
 * @param {LeakPattern[]} [patterns]
 * @returns {{ id: string, description: string, match: string }[]}
 */
export function findLeaks(content, patterns = LEAK_PATTERNS) {
  return patterns.flatMap(({ id, pattern, description }) =>
    [...content.matchAll(pattern)].map((match) => ({ id, description, match: match[0] })),
  )
}

/**
 * `dir` 配下の全ファイルを検査し、人が読める形の問題一覧を返す。
 *
 * @param {string} dir
 * @param {LeakPattern[]} [patterns]
 * @returns {string[]}
 */
export function auditDirectory(dir, patterns = LEAK_PATTERNS) {
  return collectFiles(dir).flatMap((relativePath) => {
    if (isBinaryPath(relativePath)) {
      return []
    }

    const absolutePath = join(dir, relativePath)
    const content = readFileSync(absolutePath, 'utf8')

    return findLeaks(content, patterns).map(
      (leak) => `${absolutePath}: ${leak.description}（${leak.id}）: ${leak.match}`,
    )
  })
}

/**
 * 既定の対象ディレクトリ。`experiments/*\/runs` のうち実在するものだけを返す。
 * 手で列挙すると新しい experiment を足したときに検査から漏れるため、
 * `experiments/` の実際のサブディレクトリから導く。
 *
 * @returns {string[]}
 */
function defaultTargets() {
  const experimentsDir = join(REPO_ROOT, 'experiments')

  if (!existsSync(experimentsDir)) {
    return []
  }

  return readdirSync(experimentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(experimentsDir, entry.name, 'runs'))
    .filter((runsDir) => existsSync(runsDir))
}

function main() {
  const targets = process.argv.slice(2)
  const dirs = targets.length > 0 ? targets : defaultTargets()

  if (dirs.length === 0) {
    console.log('ok  検査対象の Run が無い（experiments/*/runs が存在しない）')
    return
  }

  const problems = dirs.flatMap((dir) => auditDirectory(dir))

  console.log(
    problems.length === 0
      ? `ok  ${dirs.length}件のディレクトリに既知パターンの漏洩は無い`
      : `NG  ${problems.length}件の疑わしい箇所が見つかった`,
  )
  console.log('この検査は既知の文字列パターンの検査であり、公開の承認ではない。画像・差分は人が確認すること（docs/PUBLICATION_POLICY.md）。')

  if (problems.length > 0) {
    console.error(`\n${problems.join('\n')}`)
    process.exitCode = 1
  }
}

// テストから読み込むときは走らせない。process.exit と標準出力を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
