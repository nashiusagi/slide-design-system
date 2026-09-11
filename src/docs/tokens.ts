/**
 * カタログが `design/` の契約ファイルを読むための入口（DR-0042 決定2）。
 *
 * トークン名・値をカタログ側へ書き写さないため、表示に要るものはすべてここで
 * 契約ファイルから引く。ページ側は「どう見せるか」だけを持つ。
 *
 * 表示する値は `design/theme.css` から取る。`design/tokens.json` の生の数値には
 * 単位が付いておらず、px を付けるかどうかの規則は
 * `scripts/generate-theme.mjs` の `UNITLESS_PATHS` が持っている。同じ規則を
 * こちらへ書くと、片方だけ変わったときに表示が静かにずれる。生成された CSS の
 * 値をそのまま読めば、カタログは実際に効いている値を見せることになる。
 * theme.css と tokens.json の一致は `pnpm theme:check` が担保している（DR-0033）。
 */
import themeCss from '../../design/theme.css?raw'
import rulesJson from '../../design/rules.json'
import tokensJson from '../../design/tokens.json'

/** トークンの葉。数値（px / 無次元）か文字列。 */
export type TokenValue = string | number

/** トークンの木。`design/schemas/tokens.schema.json` の構造を、名前を持たずに表す。 */
export type TokenNode = { [key: string]: TokenValue | TokenNode }

/** トークンの正本（DR-0005）。 */
export const TOKENS: TokenNode = tokensJson

/**
 * `$` で始まるキー（`$schema` / `$comment` / `$measured`）を除いた並び。
 *
 * 説明と算出値はトークンではない。`scripts/generate-theme.mjs` の `flatten` が
 * `--dh-*` を作るときに同じ判定をしており、そちらと規則を揃えている。ここが緩むと
 * CSS 変数にならないものがカタログにだけ並ぶ。
 */
export function tokenEntries(node: TokenNode): [string, TokenValue | TokenNode][] {
  return Object.entries(node).filter(([key]) => !key.startsWith('$'))
}

/** 葉か、入れ子のグループかを見分ける。 */
export function isTokenGroup(value: TokenValue | TokenNode): value is TokenNode {
  return typeof value === 'object' && value !== null
}

/** `slideTitle` → `slide-title`。`generate-theme.mjs` の `toKebab` と同じ規則。 */
function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** トークンの位置（`['color', 'accent']`）を CSS 変数名へ変換する。 */
export function cssVarName(path: string[]): string {
  return `--dh-${path.map(toKebab).join('-')}`
}

/** トークンの位置を `var(--dh-*)` 参照へ変換する。見本はこれを使って描く。 */
export function cssVar(path: string[]): string {
  return `var(${cssVarName(path)})`
}

/**
 * `design/theme.css` の宣言（`--dh-*: <値>;`）を名前から値へ引ける形にする。
 *
 * theme.css は1宣言1行で生成される（`generate-theme.mjs` の `renderTheme`）ので、
 * 行単位の走査で足りる。CSS のパーサを持ち込むほどの構造ではない。
 */
/*
 * 読み込みが空なら、そこで落とす。vitest は CSS の読み込みを空文字へ差し替えるので、
 * vite.config.ts の test.css.include への列挙が漏れると、表示も期待値も空になったまま
 * 値を突き合わせるテストが通る（DR-0043 決定3）。空を許さなければ、列挙漏れは実行した
 * 瞬間に落ちる。
 */
if (themeCss.length === 0) {
  throw new Error(
    'design/theme.css を読み込めなかった（中身が空）。vite.config.ts の test.css.include へ入っているか確認すること（DR-0043）。',
  )
}

const THEME_VALUES: Record<string, string> = Object.fromEntries(
  [...themeCss.matchAll(/^\s*(--dh-[\w-]+):\s*(.+);$/gm)].map(([, name, value]) => [name, value]),
)

/**
 * トークンの位置に対応する、theme.css に書き出された値（単位込み）。
 *
 * 対応する変数が無ければ `null`。呼び出し側は tokens.json の生の値へ落とす。
 * トークンが CSS 変数になっていない状態を、空欄ではなく素の値として見せる。
 */
export function themeValue(path: string[]): string | null {
  return THEME_VALUES[cssVarName(path)] ?? null
}

/**
 * コントラスト比を併記する相手の面。`design/rules.json` の `contrast.surfaces` が正本
 * （DR-0008）。面として使える色が増えれば、カタログの列も自動で増える。
 */
export const CONTRAST_SURFACES: string[] = rulesJson.contrast.surfaces

/**
 * 記録済みのコントラスト比（DR-0033 / DR-0034）。ここでは算出しない。
 *
 * `$measured.contrast` のキーは宣言順の組み合わせ（`background|accent`）で、逆順は
 * 持たない。コントラスト比は前景と背景を入れ替えても同じなので、両方の並びで引く。
 * 同じ色どうしの組は記録が無く、`null` を返す。
 */
const MEASURED_CONTRAST = tokensJson.$measured.contrast as Record<string, number>

export function measuredContrast(a: string, b: string): number | null {
  return MEASURED_CONTRAST[`${a}|${b}`] ?? MEASURED_CONTRAST[`${b}|${a}`] ?? null
}
