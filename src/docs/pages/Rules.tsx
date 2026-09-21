/**
 * 検査ルールのページ。`design/rules.json` のルールを `method` ごとに並べる。
 *
 * 契約の文言をここへ書き写さない（DR-0042 決定2）。並べる対象も、各項目の中身も、閾値の値も、
 * すべて `RULES` と `thresholdEntries` から引く。ここが持つのは見出しの日本語と、どの形で
 * 並べるかだけだ。`method` の見出しは契約に現れた値そのもので、日本語の呼び名を当てない——
 * 当てると、`design/schemas/rules.schema.json` の enum へ値が増えたときに、名前だけが
 * カタログ側の対応表に無いまま画面へ出ることになる。
 *
 * 実装の有無は `scripts/unimplemented-rules.json` から引く（DR-0051）。カタログは状態を
 * 持たず、`pnpm design:check` が免除に使っているのと同じ一覧を読む。人が判断する method は
 * その一覧の管轄外なので、実装の有無ではなく「人が判断」と出す。
 */
import type { ReactNode } from 'react'

import {
  IMPLEMENTATION_LABELS,
  RULES,
  UNIMPLEMENTED_RULE_IDS,
  ruleImplementation,
  ruleSectionId,
  rulesByMethod,
  thresholdEntries,
  type RuleContract,
  type ThresholdValue,
} from '../rules'

/**
 * 閾値の値。数・文字列・配列・入れ子のオブジェクトが来る。
 *
 * 形ごとに描き分けるだけで、どのルールがどの形を持つかは知らない。知る形にすると、閾値の
 * 形が変わったときにカタログ側が先に落ちるのではなく、静かに空を描く。
 */
function ThresholdValueView({ value }: { value: ThresholdValue }): ReactNode {
  if (Array.isArray(value)) {
    return (
      <ul className="doc-threshold__list">
        {value.map((item, index) => (
          <li key={index}>
            <ThresholdValueView value={item} />
          </li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <dl className="doc-threshold">
        {Object.entries(value)
          .filter(([key]) => !key.startsWith('$'))
          .map(([key, nested]) => (
            <div key={key} className="doc-threshold__row">
              <dt className="doc-threshold__key">{key}</dt>
              <dd className="doc-threshold__value">
                <ThresholdValueView value={nested} />
              </dd>
            </div>
          ))}
      </dl>
    )
  }

  return <code>{String(value)}</code>
}

/**
 * 閾値の節。持たないルールでは何も出さない。
 *
 * 「閾値なし」と書かない。閾値を持つかどうかは契約の性質で、実装の「未実装」（DR-0049 決定2 /
 * DR-0051 決定3）のように埋まるべき穴ではない。
 */
function Thresholds({ rule }: { rule: RuleContract }): ReactNode {
  const entries = thresholdEntries(rule.id)

  if (entries === null || entries.length === 0) {
    return null
  }

  return (
    <div className="doc-layout__section">
      <h4 className="doc-layout__section-title">閾値</h4>
      <ThresholdValueView value={Object.fromEntries(entries)} />
    </div>
  )
}

/** ルール1件の素性。`method` は節の見出しにも出るが、ルール単位で読めるようここにも置く。 */
function RuleMeta({ rule }: { rule: RuleContract }): ReactNode {
  const implementation = ruleImplementation(rule, UNIMPLEMENTED_RULE_IDS)

  return (
    <dl className="doc-threshold">
      <div className="doc-threshold__row">
        <dt className="doc-threshold__key">method</dt>
        <dd className="doc-threshold__value">
          <code>{rule.method}</code>
        </dd>
      </div>
      <div className="doc-threshold__row">
        <dt className="doc-threshold__key">severity</dt>
        <dd className="doc-threshold__value">
          <code>{rule.severity}</code>
        </dd>
      </div>
      <div className="doc-threshold__row">
        <dt className="doc-threshold__key">実装</dt>
        <dd className="doc-threshold__value" data-implementation={implementation}>
          {IMPLEMENTATION_LABELS[implementation]}
        </dd>
      </div>
    </dl>
  )
}

export function Rules() {
  return (
    <>
      <p className="doc-page__lead">
        design/rules.json のルールを method ごとに並べている。閾値は同じ契約のトップレベルから、
        実装の有無は pnpm design:check が免除に使う scripts/unimplemented-rules.json
        から引いている。人が判断する method のルールは、その一覧の管轄外として区別している。
      </p>

      {rulesByMethod(RULES).map(([method, rules]) => (
        <section key={method} className="doc-rule-group">
          <h2 className="doc-rule-group__title">{method}</h2>

          {rules.map((rule) => (
            <section key={rule.id} id={ruleSectionId(rule.id)} className="doc-card doc-rule">
              <h3 className="doc-card__title">{rule.id}</h3>
              <p className="doc-card__body">{rule.description}</p>

              <RuleMeta rule={rule} />
              <Thresholds rule={rule} />
            </section>
          ))}
        </section>
      ))}
    </>
  )
}
