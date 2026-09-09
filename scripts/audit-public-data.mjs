/**
 * 公開してはいけない情報が残っていないかを検査する（DR-0023）。
 *
 *   node scripts/audit-public-data.mjs [<dir> ...]
 *
 * 引数を省略すると `experiments/*\/runs`（保存 Run。存在するものだけ）を対象にする。
 * 対象ディレクトリ配下の全テキストファイルから、絶対パス・API キー・token らしき
 * 文字列パターンを探す。1件でも見つかれば非ゼロで終了する。`pnpm check` に組み込む。
 *
 * **これは文字列パターンの検査であり、公開してよいという承認ではない。**
 * 画像・差分の中身は人が開いて確認する（`docs/PUBLICATION_POLICY.md`）。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { collectFiles } from './lib/fs-walk.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** sanitize 済みなら残らないはずの拡張子は対象外にする（画像・フォント等）。 */
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'])

/**
 * @typedef {{ id: string, pattern: RegExp, description: string }} LeakPattern
 */

/**
 * 検査対象のパターン。id は結果の集計・テストで安定して参照するためのキー。
 * `pattern` は必ず `g` フラグを持つ（matchAll を使うため）。
 *
 * @type {LeakPattern[]}
 */
export const LEAK_PATTERNS = [
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
 * 1件のテキストから漏洩候補を探す。IO を持たない純関数。
 *
 * @param {string} content
 * @returns {{ id: string, description: string, match: string }[]}
 */
export function findLeaks(content) {
  return LEAK_PATTERNS.flatMap(({ id, pattern, description }) =>
    [...content.matchAll(pattern)].map((match) => ({ id, description, match: match[0] })),
  )
}

/**
 * `dir` 配下の全ファイルを検査し、人が読める形の問題一覧を返す。
 *
 * @param {string} dir
 * @returns {string[]}
 */
export function auditDirectory(dir) {
  return collectFiles(dir).flatMap((relativePath) => {
    if (BINARY_EXTENSIONS.has(extname(relativePath))) {
      return []
    }

    const absolutePath = join(dir, relativePath)
    const content = readFileSync(absolutePath, 'utf8')

    return findLeaks(content).map(
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
