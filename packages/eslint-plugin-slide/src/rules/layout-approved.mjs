/**
 * `layout-approved` — `<Slide layout="...">` の値が design/layouts/ の契約に無い
 * 名前を弾く（design/rules.json / DR-0030）。
 *
 * `layout` の値が文字列リテラル（`layout="x"` と、波括弧で包んだ `layout={"x"}` の
 * 両方を含む）でないとき（変数・式）は静的に判定できないため対象にしない。
 * ランタイム（src/runtime/Slide.tsx）は値を検査しない設計（DR-0030）なので、
 * 動的な値そのものを禁止する根拠は無い。
 */
import { jsxAttributeStringValue } from '../lib/jsx-style.mjs'
import { listLayouts } from '../lib/design-contracts.mjs'

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Slide の layout に design/layouts/ の契約に無い名前を使わない',
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
