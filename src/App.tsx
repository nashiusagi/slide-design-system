import './runtime/runtime.css'

import { Deck, Fragment, Slide } from './runtime'

/**
 * 仮のスライド。ランタイムが動くことを確かめるためだけに置く。
 *
 * 見た目は付けない。レイアウトの実装は design/layout.css（#5）が持ち、
 * 文言は deck 契約（#6）から来る。ここに先取りして書かない。
 */
export function App() {
  return (
    <Deck>
      <Slide layout="title" notes="ランタイムの動作確認用。">
        <h1>slide-design-system</h1>
        <p>設計契約 → AI 生成 → 機械検査 → 修正</p>
      </Slide>

      <Slide layout="bullets" notes="Fragment で 1 項目ずつ出す。">
        <h2>Phase 1 のランタイム</h2>
        <ul>
          <Fragment index={1}>
            <li>固定キャンバスのスケーリング</li>
          </Fragment>
          <Fragment index={2}>
            <li>URL による現在位置の同期</li>
          </Fragment>
          <Fragment index={3}>
            <li>段階表示</li>
          </Fragment>
        </ul>
      </Slide>

      <Slide layout="statement">
        <p>はみ出しは実測で判定できる</p>
      </Slide>
    </Deck>
  )
}
