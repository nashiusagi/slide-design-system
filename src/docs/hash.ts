/**
 * カタログの現在ページを URL hash で表す（DR-0042）。
 *
 * 書式は `#/<ページID>`。静的ホスティングでサーバ側の rewrite を前提にしないため、
 * パスルーティングは使わない。
 *
 * スライドの現在位置を扱う src/runtime/hash.ts とは、書式（`#/<番号>/<段階>`）も
 * 対象も違うので流用しない。カタログはスライドのバンドルから独立している（DR-0042）。
 */

/** hash として認めるページ ID の形。英小文字・数字・ハイフンのみ。 */
const PAGE_ID_PATTERN = /^#\/([a-z0-9-]+)$/

/**
 * hash をページ ID へ変換する。書式に合わないものは `null` を返す。
 *
 * 実在するページかどうかはここでは見ない。呼び出し側がページ一覧と突き合わせる。
 */
export function parseDocsHash(hash: string): string | null {
  const matched = PAGE_ID_PATTERN.exec(hash)

  return matched ? matched[1] : null
}

/** ページ ID を hash へ変換する。 */
export function formatDocsHash(pageId: string): string {
  return `#/${pageId}`
}
