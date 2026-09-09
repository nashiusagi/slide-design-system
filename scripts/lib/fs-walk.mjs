/**
 * ディレクトリ配下のファイルを再帰的に列挙する。scripts/evaluate-run.mjs（採点対象の
 * 列挙）と scripts/audit-public-data.mjs・scripts/sanitize-run-artifacts.mjs（保存 Run
 * 配下の走査、DR-0023）が共通で使う。
 */
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * `dir` 配下のファイルを再帰的に列挙し、`dir` からの相対パス（`/` 区切り）で返す。
 *
 * @param {string} dir
 * @returns {string[]}
 */
export function collectFiles(dir) {
  /**
   * @param {string} current
   * @returns {string[]}
   */
  function walk(current) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = join(current, entry.name)

      if (entry.isDirectory()) {
        return walk(entryPath)
      }

      return [relative(dir, entryPath).split('\\').join('/')]
    })
  }

  return walk(dir)
}
