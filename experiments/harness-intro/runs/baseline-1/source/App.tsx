import './runtime/runtime.css'
import './deck.css'

import { Deck, Fragment, Slide } from './runtime'

/**
 * 「AIがスライドを書き、機械が検査し、直す」という仕組みそのものを説明する13枚。
 * layout 名はランタイムには検査されない（このワークスペースには design/ 契約が
 * 存在しないため）。ここでは自作の deck.css 側で対応するクラスを用意している。
 */
export function App() {
  return (
    <Deck>
      {/* 1. 表紙 */}
      <Slide layout="title">
        <p className="kicker">how this repository writes slides</p>
        <h1 className="title-main">
          <span className="em-cyan">AI</span>がスライドを書き、
          <br />
          <span className="em-emerald">機械</span>が検査し、直す。
        </h1>
        <p className="title-sub">見た目を最終的に決めているのは誰か、という話。</p>
        <div className="title-footer">
          <span>設計契約</span>
          <span>AI 生成</span>
          <span>自動検査</span>
        </div>
      </Slide>

      {/* 2. 課題提起：AIに自由に書かせると崩れる */}
      <Slide layout="statement">
        <p className="kicker">まず、困っていたこと</p>
        <h2 className="heading">AIにスライドを作らせると、たいてい崩れる</h2>
        <ul className="bullet-list tone-red">
          <Fragment index={1}>
            <li>1枚目と5枚目で、見出しの大きさが違う</li>
          </Fragment>
          <Fragment index={2}>
            <li>スライドごとに余白の取り方がバラバラ</li>
          </Fragment>
          <Fragment index={3}>
            <li>色の使い方に一貫性がなく、統一感が出ない</li>
          </Fragment>
          <Fragment index={4}>
            <li>気づけば、文字や図がキャンバスからはみ出している</li>
          </Fragment>
        </ul>
        <Fragment index={5}>
          <p className="closing-line">自由に書かせるほど、そろわなくなる。</p>
        </Fragment>
      </Slide>

      {/* 3. 登場人物は3人 */}
      <Slide layout="roles">
        <p className="kicker">登場人物は3人</p>
        <h2 className="heading">人・AI・機械が、それぞれ別の仕事を持つ</h2>
        <div className="role-grid">
          <div className="role-card role-card--human">
            <div className="role-badge">人</div>
            <h3 className="role-title">人</h3>
            <p className="role-desc">
              どこまでを自由にし、どこからを禁止するか。その範囲＝設計契約を、あらかじめ決める。
            </p>
          </div>
          <div className="role-card role-card--ai">
            <div className="role-badge">AI</div>
            <h3 className="role-title">AI</h3>
            <p className="role-desc">
              その契約の内側で、実際にスライドの文章と構成を書く。
            </p>
          </div>
          <div className="role-card role-card--machine">
            <div className="role-badge">機</div>
            <h3 className="role-title">機械</h3>
            <p className="role-desc">
              できあがったスライドが契約通りかを検査し、外れていれば直すよう促す。
            </p>
          </div>
        </div>
      </Slide>

      {/* 4. 仕組み全体：書く→検査する→直す のループ */}
      <Slide layout="diagram">
        <p className="kicker">仕組みの全体像</p>
        <h2 className="heading">「書く → 検査する → 直す」をくり返す</h2>
        <div className="diagram-area">
          <div className="loop-row">
            <Fragment index={1}>
              <div className="loop-box loop-box--human">
                <span className="loop-index">STEP 1</span>
                <span className="loop-actor">人</span>
                <span className="loop-text">設計契約を定める</span>
              </div>
            </Fragment>
            <Fragment index={1}>
              <span className="loop-arrow">→</span>
            </Fragment>
            <Fragment index={2}>
              <div className="loop-box loop-box--ai">
                <span className="loop-index">STEP 2</span>
                <span className="loop-actor">AI</span>
                <span className="loop-text">契約の中でスライドを書く</span>
              </div>
            </Fragment>
            <Fragment index={2}>
              <span className="loop-arrow">→</span>
            </Fragment>
            <Fragment index={3}>
              <div className="loop-box loop-box--machine">
                <span className="loop-index">STEP 3</span>
                <span className="loop-actor">機械</span>
                <span className="loop-text">契約通りか検査する</span>
              </div>
            </Fragment>
            <Fragment index={3}>
              <span className="loop-arrow">→</span>
            </Fragment>
            <Fragment index={4}>
              <div className="loop-box loop-box--machine">
                <span className="loop-index">STEP 4</span>
                <span className="loop-actor">機械 / AI</span>
                <span className="loop-text">ずれていれば直す</span>
              </div>
            </Fragment>
          </div>
          <Fragment index={4}>
            <p className="loop-caption">⟲ 検査を通るまで、STEP 2〜4 をくり返す</p>
          </Fragment>
        </div>
      </Slide>

      {/* 5. なぜ機械が検査するのか */}
      <Slide layout="statement">
        <p className="kicker">なぜ人ではなく機械なのか</p>
        <h2 className="heading">検査を機械に任せる理由</h2>
        <ul className="bullet-list tone-emerald">
          <Fragment index={1}>
            <li>同じ基準を、何百枚になっても疲れずに当てはめられる</li>
          </Fragment>
          <Fragment index={2}>
            <li>「なんとなく良さそう」ではなく、数値で測るので見落としがない</li>
          </Fragment>
          <Fragment index={3}>
            <li>人は1枚1枚のレビューではなく、基準そのものを作ることに集中できる</li>
          </Fragment>
        </ul>
      </Slide>

      {/* 6. 機械が検査するには基準が要る、という橋渡し */}
      <Slide layout="statement">
        <p className="kicker">ただし</p>
        <h2 className="heading">機械は、「基準」がなければ検査できない</h2>
        <p className="lede">
          何をもって「正しい」とするのかが決まっていなければ、機械は○も×もつけられない。
        </p>
        <Fragment index={1}>
          <p className="closing-line">その基準の正体が、「設計契約」。</p>
        </Fragment>
      </Slide>

      {/* 7. 設計契約とは何か（内側/外側） */}
      <Slide layout="diagram">
        <p className="kicker">設計契約とは何か</p>
        <h2 className="heading">人が先に、書いていい範囲を決めておく</h2>
        <div className="boundary-outer">
          <span className="boundary-outer-label">契約の外</span>
          <span className="boundary-outer-text">ここには存在しない色・レイアウト・数値は使えない</span>
          <div className="boundary-inner">
            <span className="boundary-inner-label">契約の内側</span>
            <span className="boundary-inner-text">AI はここで、自由に書いてよい</span>
          </div>
        </div>
      </Slide>

      {/* 8. 契約は一枚岩ではない */}
      <Slide layout="statement">
        <p className="kicker">設計契約の中身</p>
        <h2 className="heading">設計契約は、一枚岩ではない</h2>
        <ul className="bullet-list">
          <Fragment index={1}>
            <li>「これはOK、これはNG」を1つのルールで決めているわけではない</li>
          </Fragment>
          <Fragment index={2}>
            <li>性質の違う決め事が、何層にも重なってできている</li>
          </Fragment>
          <Fragment index={3}>
            <li>値を決める層、構造を決める層、それを検査する層…と役割が分かれている</li>
          </Fragment>
        </ul>
      </Slide>

      {/* 9. 4つの層 */}
      <Slide layout="diagram">
        <p className="kicker">設計契約を積み重ねる層</p>
        <h2 className="heading">性質の違う4つの層が積み重なっている</h2>
        <div className="diagram-area">
          <div className="layer-stack">
            <Fragment index={4}>
              <div className="layer-row layer-row--4">
                <span className="layer-name">なぜそう決めたか</span>
                <span className="layer-desc">その値・構造・ルールを、なぜそう決めたのかという理由の記録</span>
              </div>
            </Fragment>
            <Fragment index={3}>
              <div className="layer-row layer-row--3">
                <span className="layer-name">検査ルール</span>
                <span className="layer-desc">できあがったスライドが契約通りかを、機械が自動で確かめる基準</span>
              </div>
            </Fragment>
            <Fragment index={2}>
              <div className="layer-row layer-row--2">
                <span className="layer-name">構造</span>
                <span className="layer-desc">スライドがとりうる型（見出しと箇条書き、図解、比較 など）</span>
              </div>
            </Fragment>
            <Fragment index={1}>
              <div className="layer-row layer-row--1">
                <span className="layer-name">値</span>
                <span className="layer-desc">色・余白・文字の大きさといった、具体的な数値そのもの</span>
              </div>
            </Fragment>
          </div>
        </div>
      </Slide>

      {/* 10. 役割分担の再整理（表） */}
      <Slide layout="roles">
        <p className="kicker">もう一度、役割を整理する</p>
        <h2 className="heading">誰が「決め」、誰が「書き」、誰が「確かめる」か</h2>
        <div className="role-grid">
          <div className="role-card role-card--human">
            <div className="role-badge">人</div>
            <h3 className="role-title">決める</h3>
            <p className="role-desc">値・構造・検査ルール・その理由まで、契約の4つの層すべてを決める</p>
          </div>
          <div className="role-card role-card--ai">
            <div className="role-badge">AI</div>
            <h3 className="role-title">書く</h3>
            <p className="role-desc">与えられた層の中で、文章・構成・言い回しを実際に書く</p>
          </div>
          <div className="role-card role-card--machine">
            <div className="role-badge">機</div>
            <h3 className="role-title">確かめる</h3>
            <p className="role-desc">書かれたものが契約からはみ出していないかを検査し、直す</p>
          </div>
        </div>
      </Slide>

      {/* 11. AIは中では自由、外には出られない */}
      <Slide layout="split">
        <p className="kicker">AIの自由と、その境界</p>
        <h2 className="heading">契約の中では自由。契約の外には出られない</h2>
        <div className="split-row">
          <div className="split-col split-col--ok">
            <p className="split-col-title">中では自由にできる</p>
            <ul>
              <li>用意された型の中から、どのレイアウトを使うか選ぶ</li>
              <li>見出しや本文の言い回し、伝え方の工夫</li>
              <li>どの情報を残し、どれを削るかの取捨選択</li>
              <li>段階表示など、話の運び方の組み立て</li>
            </ul>
          </div>
          <div className="split-col split-col--ng">
            <p className="split-col-title">外には出られない</p>
            <ul>
              <li>契約にない色や余白の数値を、新しく作り出す</li>
              <li>用意されていないレイアウトを、その場で発明する</li>
              <li>キャンバスからはみ出すほど詰め込む</li>
              <li>検査ルールが弾く書き方を、そのまま押し通す</li>
            </ul>
          </div>
        </div>
      </Slide>

      {/* 12. この仕組みのメリット */}
      <Slide layout="statement">
        <p className="kicker">この仕組みで変わること</p>
        <h2 className="heading">仕組みにしておくと、何が変わるのか</h2>
        <ul className="bullet-list tone-amber">
          <Fragment index={1}>
            <li>何百枚のスライドを生成しても、見た目がそろい続ける</li>
          </Fragment>
          <Fragment index={2}>
            <li>崩れても人が気づく前に、機械が気づいて直しが回る</li>
          </Fragment>
          <Fragment index={3}>
            <li>人は1枚ずつのレビューではなく、契約というルール作りに集中できる</li>
          </Fragment>
        </ul>
      </Slide>

      {/* 13. まとめ */}
      <Slide layout="closing">
        <p className="kicker">まとめ</p>
        <h2 className="heading">3行で言うと</h2>
        <ol className="recap-list">
          <li>
            <span className="recap-num">1</span>
            <span>書くのは AI</span>
          </li>
          <li>
            <span className="recap-num">2</span>
            <span>検査して直すのは機械</span>
          </li>
          <li>
            <span className="recap-num">3</span>
            <span>契約の範囲を決めるのは人</span>
          </li>
        </ol>
        <p className="closing-statement">
          AIの自由は、無制限ではない。人があらかじめ決めた設計契約という何層もの枠の中でだけ、
          AIは自由に書く。
        </p>
      </Slide>
    </Deck>
  )
}
