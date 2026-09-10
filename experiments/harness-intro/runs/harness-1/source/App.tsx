import '../design/theme.css'
import '../design/layout.css'
import './runtime/runtime.css'

import { Deck, Slide } from './runtime'

/**
 * デッキ契約（design/decks/harness-intro.md）が宣言する 3 枚（title → bullets →
 * statement）をそのまま実装する。ここで定義する SlideTitle / BulletList /
 * Statement は design/components/*.json の props 契約（text: string /
 * items: string[]）をそのまま満たす。見た目は design/layout.css の
 * `slide--<layout>` が持つ箱の中で、design/theme.css の `--dh-*` トークンだけを
 * 使って組む（スタイル本体は ./index.css に置く）。
 */

type SlideTitleProps = {
  text: string
}

function SlideTitle({ text }: SlideTitleProps) {
  return <h1 className="dh-slide-title">{text}</h1>
}

type BulletListProps = {
  items: string[]
}

function BulletList({ items }: BulletListProps) {
  return (
    <ul className="dh-bullet-list">
      {items.map((item) => (
        <li key={item} className="dh-bullet-list__item">
          {item}
        </li>
      ))}
    </ul>
  )
}

type StatementProps = {
  text: string
}

function Statement({ text }: StatementProps) {
  return <p className="dh-statement">{text}</p>
}

export function App() {
  return (
    <Deck>
      <Slide layout="title">
        <SlideTitle text="AIが書き、機械が検査し、直す仕組み" />
      </Slide>

      <Slide layout="bullets">
        <SlideTitle text="設計契約は5層に分かれている" />
        <BulletList
          items={[
            'tokens: 色・余白・文字サイズなどの値そのもの',
            'layouts: スライドがどんな役割を担うときに選ぶかの基準',
            'components: スライド内部品の使用可否と props の形',
            'rules: 検査の閾値',
            'decks: 何を伝えるかという素材',
          ]}
        />
      </Slide>

      <Slide layout="statement">
        <Statement text="書くのは AI、決めるのは契約" />
      </Slide>
    </Deck>
  )
}
