/**
 * `layout-approved` — `<Slide layout="...">` の値が design/layouts/ の契約に無い
 * 名前を弾く（design/rules.json / DR-0030）。
 *
 * `layout` の値の読み取りは jsx-style.mjs の jsxAttributeStringValue に寄せる。
 * `layout="x"` / `layout={"x"}` / `` layout={`x`} `` は同じ値であり、記法ごとに
 * 別の結果になってはいけない。
 *
 * **このルールが意図的に見ない領域は design/rules.json の scopeExclusions が
 * 正本**（DR-0044）。
 */
import { jsxAttributeStringValue } from '../lib/jsx-style.mjs'
import { descriptionOf, listLayouts } from '../lib/design-contracts.mjs'

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: descriptionOf('layout-approved'),
    },
    schema: [],
    messages: {
      unapprovedLayout:
        "layout='{{layout}}' は design/layouts/ の契約に無い。承認済みの layout は {{approved}}。",
    },
  },
  create(context) {
    const approved = new Set(listLayouts().map((layout) => layout.name))

    return {
      /** @param {any} node */
      'JSXOpeningElement[name.name="Slide"] > JSXAttribute[name.name="layout"]'(node) {
        const resolved = jsxAttributeStringValue(node)

        if (resolved === undefined) {
          return
        }

        if (approved.has(resolved.text)) {
          return
        }

        context.report({
          node: resolved.valueNode,
          messageId: 'unapprovedLayout',
          data: { layout: resolved.text, approved: [...approved].join(' / ') },
        })
      },
    }
  },
}

export default rule
