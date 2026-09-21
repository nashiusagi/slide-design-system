import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

import boundary from '../../scripts/cross-entry-boundary.json'
import docsCss from './docs.css?raw'

/*
 * カタログの CSS が読み込む相手を検査する。
 *
 * `docs.css` はどのテストからも読まれないので、読み込み宣言の行はここへ来るまで機械の目に
 * 一度も触れていなかった。プレビューが「`design/layout.css` の実装そのもの」であること
 * （DR-0047 決定1）を支えているのはこの1行だけで、消しても他の検査はすべて緑のまま通る。
 */

/*
 * 読み込みが空なら、そこで落とす。vitest は CSS の読み込みを空文字へ差し替えるので、
 * vite.config.ts の test.css.include への列挙が漏れると、以下の検査はすべて
 * 「宣言が0件」の状態で素通りする（DR-0043 決定1 と同じ形）。
 */
if (docsCss.length === 0) {
  throw new Error(
    'src/docs/docs.css を読み込めなかった（中身が空）。vite.config.ts の test.css.include へ入っているか確認すること（DR-0043）。',
  )
}

/**
 * 読み込み宣言のパラメータから、相手のパスだけを取り出す。
 *
 * CSS は同じ宣言を複数の記法で書ける。`'x.css'` / `url('x.css')` / `url(x.css)` は等価で、
 * 後ろにメディアクエリや `layer()` が続くこともある。引用符で囲まれた形だけを見る書き方に
 * すると、`url()` で書くだけでこの検査を素通りできる——塞いだはずの抜け道が記法の違いで
 * 開いたままになる。
 *
 * @param params 例: `url('../../design/layout.css') screen`
 */
function importTarget(params: string): string {
  const matched = /^\s*(?:url\(\s*)?(?:'([^']*)'|"([^"]*)"|([^'")\s]+))/.exec(params)

  return matched ? (matched[1] ?? matched[2] ?? matched[3] ?? '') : ''
}

/**
 * `docs.css` が読み込む相手の一覧。
 *
 * 記法の違いで取りこぼさないよう、構文木から `@import` を列挙する。正規表現で行を拾う形は
 * コメントアウトされた宣言も拾ってしまう（[DR-0041](../../docs/decisions/0041-postcss-for-layout-class-check.md)
 * が `checkLayoutClasses` で PostCSS を選んだのと同じ理由）。
 *
 * at-rule の名前は大文字小文字を無視して拾う。CSS のキーワードは ASCII の大文字小文字を
 * 区別しないので `@IMPORT` も同じ宣言だが、PostCSS の `walkAtRules` に文字列を渡すと完全
 * 一致になる。パラメータ側の記法だけを網羅しても、名前側でまた素通りできる。
 */
const IMPORTED: string[] = []

postcss.parse(docsCss, { from: 'src/docs/docs.css' }).walkAtRules(/^import$/i, (rule) => {
  IMPORTED.push(importTarget(rule.params))
})

describe('importTarget', () => {
  /*
   * 抽出そのものを固定する。ここが記法を取りこぼすと、下の2つの検査は「宣言が無い」という
   * 理由で通ってしまい、通ったこと自体が嘘になる。
   */
  it('引用符・url()・素のパスのどの記法でも、相手のパスを返す', () => {
    expect(importTarget("'../../design/layout.css'")).toBe('../../design/layout.css')
    expect(importTarget('"../../design/layout.css"')).toBe('../../design/layout.css')
    expect(importTarget("url('../../design/layout.css')")).toBe('../../design/layout.css')
    expect(importTarget('url("../../design/layout.css")')).toBe('../../design/layout.css')
    expect(importTarget('url(../../design/layout.css)')).toBe('../../design/layout.css')
    expect(importTarget("url('../../design/layout.css') screen")).toBe('../../design/layout.css')
  })
})

describe('docs.css', () => {
  /*
   * 列挙の側を固定する。抽出（importTarget）が正しくても、at-rule を拾う条件が狭ければ
   * 宣言そのものが `IMPORTED` に現れず、下の2つの検査は「宣言が無い」という理由で通る。
   */
  it('@import は大文字小文字を問わず列挙される', () => {
    const collect = (css: string): string[] => {
      const targets: string[] = []

      postcss.parse(css, { from: 'test.css' }).walkAtRules(/^import$/i, (rule) => {
        targets.push(importTarget(rule.params))
      })

      return targets
    }

    expect(collect("@IMPORT '../../src/runtime/runtime.css';")).toEqual(['../../src/runtime/runtime.css'])
    expect(collect("@Import url(../../src/runtime/runtime.css);")).toEqual(['../../src/runtime/runtime.css'])
    expect(collect("/* @import 'commented-out.css'; */")).toEqual([])
  })

  it('プレビューの根拠になる契約 CSS と部品の実装を読み込んでいる', () => {
    expect(IMPORTED).toContain('../../design/theme.css')
    expect(IMPORTED).toContain('../../design/layout.css')
    expect(IMPORTED).toContain('../components/components.css')
  })

  /*
   * カタログはスライド本体（src/App.tsx / src/runtime/）を参照しない（DR-0042）。この禁止は
   * ESLint の no-restricted-imports で効いているが、対象は .ts / .tsx だけで CSS の読み込みは
   * 素通りする。DR-0047 が却下した「runtime.css だけを読み込む」案が、機械では止まらない
   * 状態になるので、ここで塞ぐ。
   *
   * 禁止する相手の名前は scripts/cross-entry-boundary.json が持つ。eslint.config.js と同じ
   * 一覧から組み立て、対象が増えたときに片方だけ更新される状態を作らない。
   */
  it('スライド本体（src/App / src/runtime）を読み込まない', () => {
    const forbidden = new RegExp(`(^|/)(${boundary.forbiddenFromCatalog.join('|')})(\\.|/|$)`)

    expect(IMPORTED.filter((target) => forbidden.test(target))).toEqual([])
  })
})
