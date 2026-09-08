/**
 * `layout-approved` — `<Slide layout="...">` の値が design/layouts/ の契約に無い
 * 名前を弾く（design/rules.json / DR-0030）。
 *
 * `layout` の値が文字列リテラルでないとき（変数・式）は静的に判定できないため
 * 対象にしない。ランタイム（src/runtime/Slide.tsx）は値を検査しない設計
 * （DR-0021）なので、動的な値そのものを禁止する根拠は無い。
 */
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
        const value = node.value

        if (value?.type !== 'Literal' || typeof value.value !== 'string') {
          return
        }

        if (approved.has(value.value)) {
          return
        }

        context.report({
          node: value,
          messageId: 'unapprovedLayout',
          data: { layout: value.value, approved: [...approved].join(' / ') },
        })
      },
    }
  },
}

export default rule
