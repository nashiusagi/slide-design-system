/**
 * ディレクトリ配下のファイルを再帰的に列挙する。scripts/evaluate-run.mjs（採点対象の
 * 列挙）と scripts/audit-public-data.mjs・scripts/sanitize-run-artifacts.mjs（保存 Run
 * 配下の走査、DR-0023）が共通で使う。あわせて、この2スクリプトが共有する
 * バイナリ判定と正規表現エスケープもここに置く（片方だけ更新して食い違うことを防ぐ）。
 */
import { readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

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

/**
 * sanitize / audit の対象から外す拡張子（画像・フォント等）。小文字で統一する。
 * `isBinaryPath` は比較前に拡張子を小文字化するため、ここへ追加するときも小文字で書く。
 */
export const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'])

/**
 * `path` がバイナリとして扱うべき拡張子か。大文字の拡張子（`Screenshot.PNG` 等）も
 * 判定できるよう、比較前に小文字化する。ここを大文字小文字を区別する実装にすると、
 * 大文字拡張子のファイルが「テキスト」として扱われ、sanitize が UTF-8 として
 * 読み書きして内容を破壊する。
 *
 * @param {string} path
 * @returns {boolean}
 */
export function isBinaryPath(path) {
  return BINARY_EXTENSIONS.has(extname(path).toLowerCase())
}

/**
 * 正規表現のメタ文字をエスケープする。sanitize-run-artifacts.mjs と
 * audit-public-data.mjs の両方が、任意の文字列（ホームディレクトリ・ユーザー名）を
 * リテラルとして正規表現に埋め込むために使う。
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
