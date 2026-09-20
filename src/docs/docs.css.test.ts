import { describe, expect, it } from 'vitest'

import boundary from '../../scripts/cross-entry-boundary.json'
import docsCss from './docs.css?raw'

/*
 * カタログの CSS が読み込む相手を検査する。
 *
 * `docs.css` はどのテストからも読まれないので、読み込み宣言の行はここへ来るまで機械の目に
 * 一度も触れていなかった。プレビューが「`design/layout.css` の実装そのもの」であること
 * （DR-0047 決定1）を支えているのはこの1行だけで、消しても他の検査はすべて緑のまま通る。
 *
 * 読み込み宣言の相手だけを取り出して突き合わせる。
 */
const IMPORTED = [...docsCss.matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)].map(([, target]) => target)

/*
 * 読み込みが空なら、そこで落とす。vitest は CSS の読み込みを空文字へ差し替えるので、
 * vite.config.ts の test.css.include への列挙が漏れると、以下の検査はすべて
 * 「@import が0件」の状態で素通りする（DR-0043 決定1 と同じ形）。
 */
if (docsCss.length === 0) {
  throw new Error(
    'src/docs/docs.css を読み込めなかった（中身が空）。vite.config.ts の test.css.include へ入っているか確認すること（DR-0043）。',
  )
}

describe('docs.css', () => {
  it('プレビューの根拠になる契約 CSS を読み込んでいる', () => {
    expect(IMPORTED).toContain('../../design/theme.css')
    expect(IMPORTED).toContain('../../design/layout.css')
  })

  /*
   * カタログはスライド本体（src/App.tsx / src/runtime/）を参照しない（DR-0042）。この禁止は
   * ESLint の no-restricted-imports で効いているが、対象は .ts / .tsx だけで CSS の @import は
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
