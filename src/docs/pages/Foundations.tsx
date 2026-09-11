/**
 * 基礎（トークン）のページ。`design/tokens.json` を実寸で見せる。
 *
 * トークン名・値をここへ書き写さない（DR-0042 決定2）。並べる対象は
 * `tokenEntries` が返すものだけで、見本は `var(--dh-*)` を当てて描く。
 * トークンを足せば、このファイルを変えずにページへ現れる。
 *
 * グループ名（color / space / ...）だけは、見せ方を選ぶために書いている。値でも
 * トークン名でもなく、「どの図形で描くか」の対応表だ。知らないグループが増えても
 * 名前と値の一覧として描かれるので、表示から落ちることはない。
 */
import type { ReactNode } from 'react'

import {
  CONTRAST_SURFACES,
  TOKENS,
  cssVar,
  isTokenGroup,
  measuredContrast,
  themeValue,
  tokenEntries,
  type TokenNode,
  type TokenValue,
} from '../tokens'

/** グループの見出し。トークンの中身ではなく、日本語の呼び名。 */
const GROUP_TITLES: Record<string, string> = {
  color: '色',
  space: '余白',
  type: '文字',
  radius: '角丸',
  shadow: '影',
  canvas: 'キャンバス',
}

/** 書体・大きさ・行送り・太さの見本に使う文字列。 */
const SAMPLE_TEXT = 'ハーネスがスライドを作る Harness 0123'

/** 文字のトークンは種類ごとに当てる CSS プロパティが違う。 */
function TypeSample({ path }: { path: string[] }): ReactNode {
  const variable = cssVar(path)
  const kind = path[1]

  if (kind === 'family') {
    return <p className="doc-sample" style={{ fontFamily: variable }}>{SAMPLE_TEXT}</p>
  }

  if (kind === 'size') {
    return <p className="doc-sample" style={{ fontSize: variable }}>{SAMPLE_TEXT}</p>
  }

  if (kind === 'lineHeight') {
    // 行送りは1行では見えない。折り返す幅の中へ入れて、行と行の間隔を見せる。
    return (
      <p className="doc-sample doc-sample--wrapped" style={{ lineHeight: variable }}>
        {SAMPLE_TEXT}
        {SAMPLE_TEXT}
      </p>
    )
  }

  if (kind === 'weight') {
    return <p className="doc-sample" style={{ fontWeight: variable }}>{SAMPLE_TEXT}</p>
  }

  return null
}

/**
 * トークン1つの見本。グループごとに図形を変える。
 *
 * キャンバスは寸法そのものが見本なので図形を持たない（グループの先頭に実寸の枠を
 * 置いている）。対応表に無いグループも同じで、名前と値だけを見せる。
 */
function TokenSample({ path }: { path: string[] }): ReactNode {
  switch (path[0]) {
    case 'color':
      return <span className="doc-swatch" style={{ backgroundColor: cssVar(path) }} />
    case 'space':
      return <span className="doc-space-bar" style={{ width: cssVar(path) }} />
    case 'radius':
      return <span className="doc-radius-box" style={{ borderRadius: cssVar(path) }} />
    case 'shadow':
      return <span className="doc-shadow-box" style={{ boxShadow: cssVar(path) }} />
    case 'type':
      return <TypeSample path={path} />
    default:
      return null
  }
}

/**
 * 色に併記するコントラスト比（DR-0034）。算出はせず `$measured` を読むだけ（DR-0033）。
 *
 * 相手は `design/rules.json` の `contrast.surfaces`。同じ色どうしの組は記録が無いので
 * `—` を出す。
 */
function ContrastNote({ colorName }: { colorName: string }): ReactNode {
  return (
    <ul className="doc-contrast">
      {CONTRAST_SURFACES.map((surface) => {
        const ratio = measuredContrast(colorName, surface)

        return (
          <li key={surface} className="doc-contrast__item">
            <span className="doc-contrast__surface">{surface}</span>
            <span className="doc-contrast__ratio">{ratio === null ? '—' : `${ratio.toFixed(2)}:1`}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * トークン1つの行。見本・名前・値を並べる。
 *
 * 値は theme.css に書き出された表記（単位込み）を出す。読めなければ tokens.json の
 * 生の値へ落とす。
 */
function TokenRow({ name, path, value }: { name: string; path: string[]; value: TokenValue }): ReactNode {
  return (
    <li className="doc-token">
      <div className="doc-token__sample">
        <TokenSample path={path} />
      </div>
      <div className="doc-token__meta">
        <span className="doc-token__name">{name}</span>
        <span className="doc-token__value">{themeValue(path) ?? String(value)}</span>
        {path[0] === 'color' && <ContrastNote colorName={name} />}
      </div>
    </li>
  )
}

/** グループの中身。入れ子（`type.size` など）は見出しを付けて掘り下げる。 */
function TokenList({ node, path }: { node: TokenNode; path: string[] }): ReactNode {
  return (
    <ul className="doc-token-list">
      {tokenEntries(node).map(([name, value]) =>
        isTokenGroup(value) ? (
          <li key={name} className="doc-token-group">
            <h3 className="doc-token-group__title">{name}</h3>
            <TokenList node={value} path={[...path, name]} />
          </li>
        ) : (
          <TokenRow key={name} name={name} path={[...path, name]} value={value} />
        ),
      )}
    </ul>
  )
}

/** キャンバスの幅・高さのトークン名。`design/schemas/tokens.schema.json` が required で要求している。 */
const CANVAS_WIDTH = 'width'
const CANVAS_HEIGHT = 'height'

/**
 * キャンバスの枠（DR-0004）。実寸の箱を CSS で縮めて見せる。
 *
 * 幅と高さは名前で引く。スキーマがこの2つの名前の存在を約束しているので、名前を頼るのは
 * 契約への依存であって値の書き写しではない。宣言順の先頭2つを取る書き方にすると、スキーマ
 * が何も約束していない性質（キーの並び）へ「どちらが幅か」を負わせることになり、順序が
 * 入れ替わっても検査は落ちないまま縦横だけが入れ替わる。
 */
function CanvasFigure({ node, path }: { node: TokenNode; path: string[] }): ReactNode {
  const width = node[CANVAS_WIDTH]
  const height = node[CANVAS_HEIGHT]

  if (width === undefined || height === undefined || isTokenGroup(width) || isTokenGroup(height)) {
    return null
  }

  return (
    <div className="doc-canvas">
      <div
        className="doc-canvas__frame"
        style={{ width: cssVar([...path, CANVAS_WIDTH]), height: cssVar([...path, CANVAS_HEIGHT]) }}
      />
    </div>
  )
}

export function Foundations() {
  return (
    <>
      <p className="doc-page__lead">
        design/tokens.json のトークンを実寸で並べている。値は design/theme.css
        へ生成された表記で、コントラスト比は tokens.json の $measured を読んでいる。
      </p>

      {tokenEntries(TOKENS).map(([groupName, group]) => (
        <section key={groupName} className="doc-card">
          <h2 className="doc-card__title">{GROUP_TITLES[groupName] ?? groupName}</h2>

          {isTokenGroup(group) ? (
            <>
              {groupName === 'canvas' && <CanvasFigure node={group} path={[groupName]} />}
              <TokenList node={group} path={[groupName]} />
            </>
          ) : (
            <ul className="doc-token-list">
              <TokenRow name={groupName} path={[groupName]} value={group} />
            </ul>
          )}
        </section>
      ))}
    </>
  )
}
