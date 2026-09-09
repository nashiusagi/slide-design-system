/**
 * 保存 Run から、端末の絶対パスと OS ユーザー名を落とす（DR-0023）。
 *
 *   node scripts/sanitize-run-artifacts.mjs <dir>
 *
 * `<dir>` 配下の全ファイルを対象に、現在のホームディレクトリ（`os.homedir()`）を
 * `<workspace>` へ、現在の OS ユーザー名（`os.userInfo().username`）を `<user>` へ
 * 置換してその場で上書きする。バックアップは取らない（git 管理下にあるため、
 * 必要なら差分を戻せる）。
 *
 * これは既知パターンの機械的な置換であり、公開してよいという承認ではない
 * （`docs/PUBLICATION_POLICY.md`）。置換漏れが無いかは `scripts/audit-public-data.mjs`
 * で確かめる。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { collectFiles } from './lib/fs-walk.mjs'

export const WORKSPACE_PLACEHOLDER = '<workspace>'
export const USER_PLACEHOLDER = '<user>'

/** バイナリとして扱い、テキスト置換の対象にしない拡張子。 */
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'])

/** @param {string} value */
function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * テキスト1件分から、既知の識別子を機械的に置換する。IO を持たない純関数。
 *
 * ホームディレクトリは文字列の単純な置き換え（`/home/ryogo/...` のような接頭辞を
 * まとめて拾える）。ユーザー名は単語境界つきの正規表現にする。単純な置き換えに
 * すると、ユーザー名がたまたま他の単語（英単語の一部やパッケージ名の一部）に
 * 含まれているときに無関係な箇所まで壊す。
 *
 * @param {string} content
 * @param {{ homeDir: string, username: string }} identifiers
 * @returns {string}
 */
export function sanitizeText(content, { homeDir, username }) {
  let result = content

  if (homeDir.length > 0) {
    result = result.split(homeDir).join(WORKSPACE_PLACEHOLDER)
  }

  if (username.length > 0) {
    const boundaryPattern = new RegExp(`(?<![A-Za-z0-9_-])${escapeForRegExp(username)}(?![A-Za-z0-9_-])`, 'g')
    result = result.replace(boundaryPattern, USER_PLACEHOLDER)
  }

  return result
}

/**
 * `dir` 配下の全ファイルを sanitizeText にかけ、変わったものだけ上書きする。
 *
 * @param {string} dir
 * @param {{ homeDir: string, username: string }} [identifiers]
 * @returns {string[]} 書き換えたファイルの、dir からの相対パス一覧
 */
export function sanitizeDirectory(dir, identifiers = { homeDir: homedir(), username: userInfo().username }) {
  return collectFiles(dir).flatMap((relativePath) => {
    if (BINARY_EXTENSIONS.has(extname(relativePath))) {
      return []
    }

    const absolutePath = join(dir, relativePath)
    const original = readFileSync(absolutePath, 'utf8')
    const sanitized = sanitizeText(original, identifiers)

    if (sanitized === original) {
      return []
    }

    writeFileSync(absolutePath, sanitized)
    return [relativePath]
  })
}

function main() {
  const dir = process.argv[2]

  if (dir === undefined) {
    console.error('Usage: node scripts/sanitize-run-artifacts.mjs <dir>')
    process.exitCode = 1
    return
  }

  const changed = sanitizeDirectory(dir)

  if (changed.length === 0) {
    console.log('置換対象は無かった。')
    return
  }

  console.log(`${changed.length}件のファイルを書き換えた:\n${changed.join('\n')}`)
}

// テストから読み込むときは走らせない。process.exit と副作用（ファイル書き出し）を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
