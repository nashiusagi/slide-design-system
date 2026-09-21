import './runtime/runtime.css'

import { BulletList, Emphasis, SlideTitle, Statement } from './components'
import { Deck, Fragment, Slide } from './runtime'

/**
 * 仮のスライド。ランタイムと部品が動くことを確かめるためだけに置く。
 *
 * 中身は `design/components/` の実装（DR-0050）で組む。素の `<h1>` / `<li>` /
 * `<p>` は使わない——契約に実装が付いた以上、ここが素の要素のままだと、契約を
 * 通さない書き方の見本がリポジトリに残る。
 *
 * 見た目はまだ付かない。`design/theme.css` / `design/layout.css` をここから
 * 読み込んでいないので、部品のクラスは当たるが値が無い。読み込みを足す Issue が
 * `pnpm measure` の `pnpm check` への組み込みまで持つ（DR-0038 の帰結）。
 *
 * 文言はここにベタ書きしてある。対応する deck 契約は
 * `design/decks/harness-intro.md`（`deck-conformance` が枚数と layout の並びを
 * 突き合わせている）だが、本文をそこから引く形にはなっていない。引くようにするのは
 * 別 Issue で、ここに deck の文言を写すこともしない。
 */
export function App() {
  return (
    <Deck>
      <Slide layout="title" notes="ランタイムの動作確認用。">
        <SlideTitle text="slide-design-system" />
      </Slide>

      <Slide layout="bullets" notes="Fragment で本文をまとめて出す。">
        <SlideTitle text="Phase 1 のランタイム" />
        <Fragment index={1}>
          <BulletList
            items={['固定キャンバスのスケーリング', 'URL による現在位置の同期', '段階表示']}
          />
        </Fragment>
      </Slide>

      <Slide layout="statement">
        <Statement
          text={
            <>
              はみ出しは<Emphasis text="実測" />で判定できる
            </>
          }
        />
      </Slide>
    </Deck>
  )
}
