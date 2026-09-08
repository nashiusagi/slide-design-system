/**
 * 契約違反を静的に検出する ESLint プラグイン（DR-0011）。
 *
 * ここに export するルール ID の集合と、design/rules.json の method: "lint" の
 * ルール ID 集合が1対1で対応することは scripts/validate-design.mjs が検査する。
 */
import componentApproved from './rules/component-approved.mjs'
import deckConformance from './rules/deck-conformance.mjs'
import layoutApproved from './rules/layout-approved.mjs'
import noRawColor from './rules/no-raw-color.mjs'
import noRawScale from './rules/no-raw-scale.mjs'

const plugin = {
  meta: {
    name: 'eslint-plugin-slide',
  },
  rules: {
    'no-raw-color': noRawColor,
    'no-raw-scale': noRawScale,
    'layout-approved': layoutApproved,
    'component-approved': componentApproved,
    'deck-conformance': deckConformance,
  },
}

export default plugin
