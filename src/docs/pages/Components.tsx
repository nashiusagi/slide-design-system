/**
 * 部品のページ。`design/components/` の契約を1件ずつ並べる。
 *
 * 契約の文言をここへ書き写さない（DR-0042 決定2）。並べる対象も、各項目の中身も、すべて
 * `COMPONENTS` から引く。ここが持つのは見出しの日本語と、どの図形で描くかだけだ。
 *
 * **4部品すべてが「未実装」と出るのが、いまの正しい状態である。** 契約はあるが実装が無い
 * （#37 が持つ）。この穴を画面に出すことがこのページの目的で、埋まったかどうかを確かめる場所
 * になる。判定は登録表の有無で行う（DR-0049）。
 */
import type { ReactNode } from 'react'

import {
  COMPONENTS,
  COMPONENT_PREVIEWS,
  previewFor,
  type ComponentContract,
  type ComponentProp,
} from '../components'
import { formatDocsHash } from '../hash'
import { LAYOUTS, layoutSectionId } from '../layouts'

/** レイアウト名から、そのレイアウトが部品に与えるスロットの条件を引く。 */
function slotOf(layoutName: string, componentName: string) {
  return LAYOUTS.find((layout) => layout.name === layoutName)?.slots.find(
    (slot) => slot.component === componentName,
  )
}

/**
 * `allowedIn` の表。使えるレイアウトと、そこでの必須かどうか・最大数を出す。
 *
 * 必須・最大数は `design/layouts/` の `slots` が正本で、部品契約は持っていない。契約どうしの
 * 対応が取れていることは `pnpm design:check` が両方向から検査している。それでも引けない場合は
 * `—` を出す。表から行が消えると、対応が壊れたことに気づけない。
 */
function AllowedInTable({ component }: { component: ComponentContract }): ReactNode {
  return (
    <table className="doc-prop-table">
      <thead>
        <tr>
          <th scope="col">レイアウト</th>
          <th scope="col">必須</th>
          <th scope="col">最大数</th>
        </tr>
      </thead>
      <tbody>
        {component.allowedIn.map((layoutName) => {
          const slot = slotOf(layoutName, component.name)

          return (
            <tr key={layoutName}>
              <td>
                <a href={formatDocsHash('layouts', layoutSectionId(layoutName))}>{layoutName}</a>
              </td>
              <td>{slot === undefined ? '—' : slot.required ? '必須' : '任意'}</td>
              <td>{slot === undefined ? '—' : slot.max}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** `props` の表。名前・型・必須かどうか・説明。 */
function PropTable({ props }: { props: Record<string, ComponentProp> }): ReactNode {
  return (
    <table className="doc-prop-table">
      <thead>
        <tr>
          <th scope="col">名前</th>
          <th scope="col">型</th>
          <th scope="col">必須</th>
          <th scope="col">説明</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(props).map(([name, prop]) => (
          <tr key={name}>
            <td>
              <code>{name}</code>
            </td>
            <td>
              <code>{prop.type}</code>
            </td>
            <td>{prop.required ? '必須' : '任意'}</td>
            <td>{prop.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * プレビュー枠。登録があれば描き、無ければ未実装と明示する（DR-0049）。
 *
 * 空欄にしない。枠だけが並ぶと「まだ描画していない」のか「実装が無い」のかが読み手に伝わらず、
 * このページが果たす役目——契約と実装の差を見せる——が消える。
 */
function ComponentPreview({ component }: { component: ComponentContract }): ReactNode {
  const Preview = previewFor(component.name, COMPONENT_PREVIEWS)

  if (Preview === null) {
    return (
      <p className="doc-component__unimplemented" data-implemented="false">
        未実装
      </p>
    )
  }

  return (
    <div className="doc-component__preview" data-implemented="true">
      <Preview />
    </div>
  )
}

export function Components() {
  return (
    <>
      <p className="doc-page__lead">
        design/components/ の契約を並べている。プレビューは実装がある部品だけが描かれ、無いものは
        未実装と出る。いまは実装が無いので、すべて未実装になる。
      </p>

      {COMPONENTS.map((component) => (
        <section key={component.name} id={component.name} className="doc-card doc-component">
          <h2 className="doc-card__title">{component.name}</h2>
          <p className="doc-card__body">{component.role}</p>

          <ComponentPreview component={component} />

          <div className="doc-layout__section">
            <h3 className="doc-layout__section-title">使い方</h3>
            <ul className="doc-layout__list">
              {component.usage.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="doc-layout__section">
            <h3 className="doc-layout__section-title">props</h3>
            <PropTable props={component.props} />
          </div>

          <div className="doc-layout__section">
            <h3 className="doc-layout__section-title">使えるレイアウト</h3>
            <AllowedInTable component={component} />
          </div>
        </section>
      ))}
    </>
  )
}
