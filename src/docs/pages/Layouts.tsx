/**
 * レイアウトのページ。`design/layouts/` の契約を1件ずつ並べ、`design/layout.css` を
 * そのまま当てたプレビューを添える。
 *
 * 契約の文言をここへ書き写さない（DR-0042 決定2）。並べる対象も、各項目の中身も、
 * すべて `LAYOUTS` から引く。ここが持つのは見出しの日本語と、どの図形で描くかだけだ。
 *
 * プレビューの中身はプレースホルダ。部品（`design/components/`）の実装は在る（DR-0050）が、
 * ここが見せるのは箱の並び方で、どの部品がどこへ入るかは `slots` が決める。中身を実物に
 * 差し替えると、見せたい箱の構造が文字量に隠れる。部品そのものの見え方は `#/components`
 * にあり、あちらが実装を描く場所になっている。
 */
import type { ReactNode } from 'react'

import { LAYOUTS, layoutSectionId, type LayoutContract, type LayoutSlot } from '../layouts'
import { cssVar } from '../tokens'

/** 文字列の並びを箇条書きにする。使うとき・使わないときで同じ形を使う。 */
function TextList({ title, items }: { title: string; items: string[] }): ReactNode {
  return (
    <div className="doc-layout__section">
      <h3 className="doc-layout__section-title">{title}</h3>
      <ul className="doc-layout__list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * スロットの表。部品名・必須かどうか・最大数を出す。
 *
 * 部品名は `design/components/` の契約名。部品のページ（`#/components`）は在り、逆向き
 * （部品 → レイアウト）のリンクは Components のページが張っている。こちらからのリンクは
 * 未着手で、張らない理由があるわけではない。張り方は逆向きと同じ（節つき hash、DR-0048）。
 */
function SlotTable({ slots }: { slots: LayoutSlot[] }): ReactNode {
  return (
    <table className="doc-slot-table">
      <thead>
        <tr>
          <th scope="col">部品</th>
          <th scope="col">必須</th>
          <th scope="col">最大数</th>
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => (
          <tr key={slot.component}>
            <td>{slot.component}</td>
            <td>{slot.required ? '必須' : '任意'}</td>
            <td>{slot.max}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * プレビュー。契約の `classes` をそのまま当てた箱を、実寸で作ってから縮めて見せる。
 *
 * 余白と配置は `design/layout.css` が当たった結果であり、カタログ側では再現しない
 * （DR-0047 決定1）。カタログが用意するのは箱だけで、寸法は `design/tokens.json` の
 * `canvas` から当てる。実行時の `.slide` から写す機構の性質は `box-sizing` の1つに
 * 留める（DR-0047 決定2）。カタログは `src/runtime/` を参照できない（DR-0042）ため、
 * ここだけは同じ箱を自前で作る。
 *
 * 中身はスロットごとのプレースホルダ。ここでは箱の並び方だけが分かる形にしてある。
 */
function LayoutPreview({ layout }: { layout: LayoutContract }): ReactNode {
  return (
    <div className="doc-canvas">
      <div
        className={['doc-canvas__frame', ...layout.classes].join(' ')}
        style={{ width: cssVar(['canvas', 'width']), height: cssVar(['canvas', 'height']) }}
      >
        {layout.slots.map((slot) => (
          <p key={slot.component} className="doc-slot-placeholder">
            {slot.component}
          </p>
        ))}
      </div>
    </div>
  )
}

export function Layouts() {
  return (
    <>
      <p className="doc-page__lead">
        design/layouts/ の契約を並べている。プレビューは契約の classes
        を当てた実寸の箱を縮めたもので、余白と配置は design/layout.css
        が当たった結果そのものである。中身は部品の実装ができるまでプレースホルダ。
      </p>

      {LAYOUTS.map((layout) => (
        <section key={layout.name} id={layoutSectionId(layout.name)} className="doc-card doc-layout">
          <h2 className="doc-card__title">{layout.name}</h2>
          <p className="doc-card__body">{layout.role}</p>

          <LayoutPreview layout={layout} />

          <TextList title="使うとき" items={layout.whenToUse} />
          <TextList title="使わないとき" items={layout.whenNotToUse} />

          <div className="doc-layout__section">
            <h3 className="doc-layout__section-title">スロット</h3>
            <SlotTable slots={layout.slots} />
          </div>

          <div className="doc-layout__section">
            <h3 className="doc-layout__section-title">クラス</h3>
            <ul className="doc-layout__list">
              {layout.classes.map((className) => (
                <li key={className}>
                  <code>.{className}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </>
  )
}
