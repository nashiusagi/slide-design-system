/**
 * カタログの現在位置を URL hash で表す（DR-0042 / DR-0048）。
 *
 * 書式は `#/<ページID>` と `#/<ページID>/<節ID>`。静的ホスティングでサーバ側の rewrite を
 * 前提にしないため、パスルーティングは使わない。節 ID は、ページの中の1項目（レイアウト1つ、
 * 部品1つ）を指す。ページ間のリンクが項目まで届かないと、契約どうしの繋がり（部品の
 * `allowedIn` がどのレイアウトを指すか）を画面上で辿れない。
 *
 * 通常の `#section` 形式のアンカーは使えない。hash がページの指定そのものに使われているので、
 * `#/layouts#title` のように2つ重ねると書式に合わなくなる。節をこの書式の中へ入れる。
 *
 * スライドの現在位置を扱う src/runtime/hash.ts は流用しない。あちらは位置（番号と段階）を、
 * こちらはページと節を指すもので、対象が違うからだ。書式は重なる点に注意する。スライド側は
 * `#/<番号>/<段階>`（段階 0 は省略）なので、2セグメントの形は両者で同じ形になった。数字だけの
 * ページ ID を使わないことが、両者を分ける唯一の根拠である（DOCS_PAGES の検査が固定している）。
 */

/** hash として認めるページ ID・節 ID の形。英小文字・数字・ハイフンのみ。 */
const SEGMENT = '[a-z0-9-]+'
const LOCATION_PATTERN = new RegExp(`^#/(${SEGMENT})(?:/(${SEGMENT}))?$`)

/** カタログの現在位置。節を指していなければ `sectionId` は `null`。 */
export type DocsLocation = {
  pageId: string
  sectionId: string | null
}

/**
 * hash を現在位置へ変換する。書式に合わないものは `null` を返す。
 *
 * 実在するページ・節かどうかはここでは見ない。呼び出し側がページ一覧と突き合わせる。
 */
export function parseDocsHash(hash: string): DocsLocation | null {
  const matched = LOCATION_PATTERN.exec(hash)

  return matched ? { pageId: matched[1], sectionId: matched[2] ?? null } : null
}

/** 現在位置を hash へ変換する。節を省くとページだけを指す。 */
export function formatDocsHash(pageId: string, sectionId?: string): string {
  return sectionId === undefined ? `#/${pageId}` : `#/${pageId}/${sectionId}`
}
