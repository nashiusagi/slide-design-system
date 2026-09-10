import '../design/theme.css'
import '../design/layout.css'
import './runtime/runtime.css'

import { Deck, Slide } from './runtime'

/**
 * デッキ契約（design/decks/harness-intro.md）が宣言する 3 枚（title → bullets →
 * statement）をそのまま実装する。design/components/*.json（slide-title /
 * bullet-list / statement）の正規実装は Phase 1 時点ではまだ存在しない
 * （別 Issue で用意される）ため、ここではその代わりとしてローカルに
 * SlideTitle / BulletList / Statement を再定義せず、契約が想定するクラス名
 * （dh-slide-title / dh-bullet-list / dh-bullet-list__item / dh-statement）を
 * 素の JSX に直接当てて同じ見た目を再現する。見た目は design/layout.css の
 * `slide--<layout>` が持つ箱の中で、design/theme.css の `--dh-*` トークンだけを
 * 使って組む（スタイル本体は ./index.css に置く）。
 */

export function App() {
  return (
    <Deck>
      <Slide layout="title">
        <h1 className="dh-slide-title">AIが書き、機械が検査し、直す仕組み</h1>
      </Slide>

      <Slide layout="bullets">
        <h1 className="dh-slide-title">設計契約は5層に分かれている</h1>
        <ul className="dh-bullet-list">
          <li className="dh-bullet-list__item">
            tokens: 色・余白・文字サイズなどの値そのもの
          </li>
          <li className="dh-bullet-list__item">
            layouts: スライドがどんな役割を担うときに選ぶかの基準
          </li>
          <li className="dh-bullet-list__item">
            components: スライド内部品の使用可否と props の形
          </li>
          <li className="dh-bullet-list__item">rules: 検査の閾値</li>
          <li className="dh-bullet-list__item">decks: 何を伝えるかという素材</li>
        </ul>
      </Slide>

      <Slide layout="statement">
        <p className="dh-statement">書くのは AI、決めるのは契約</p>
      </Slide>
    </Deck>
  )
}
