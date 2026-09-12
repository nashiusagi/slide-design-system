/**
 * `no-raw-color` — JSX の `style` に生の色値を書かない（design/rules.json）。
 *
 * 色を運ぶ CSS プロパティを固定の一覧で持ち、生の色値は hex（`#fff` 等）と
 * CSS の色関数（`rgb()` / `oklch()` 等）をパターンとして検出する。値が `var()` に
 * 包まれていても、フォールバックに書かれた色は実際に描かれるので中身まで見る。
 *
 * **このルールが意図的に見ない領域は design/rules.json の scopeExclusions が
 * 正本**（DR-0044）。ここに書き写さない。除外の一つひとつは
 * no-raw-color.bypass.mjs が「通ること」として固定している。
 */
import { expandVarFallbacks, extractStyleProperties, literalText, varReferenceNames } from '../lib/jsx-style.mjs'
import { descriptionOf } from '../lib/design-contracts.mjs'

const COLOR_PROPERTIES = new Set([
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'caretColor',
  'accentColor',
  'fill',
  'stroke',
  'stopColor',
])

const TOKEN_PREFIX = '--dh-'
// 値のどこに現れても捕まえる。先頭に錨を打つと `var(--dh-x, #fff)` のように
// 何かに包むだけで素通りする。
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: descriptionOf('no-raw-color'),
    },
    schema: [],
    messages: {
      rawColor:
        "'{{property}}' に生の色値 '{{value}}' が書かれている。design/theme.css の --dh-* トークン変数（var(--dh-color-*)）を経由すること。",
      nonTokenVariable:
        "'{{property}}' が参照している '{{variable}}' は --dh-* トークン変数ではない。design/theme.css が定義する --dh-* トークン変数を経由すること。",
    },
  },
  create(context) {
    return {
      /** @param {any} node */
      'JSXAttribute[name.name="style"]'(node) {
        for (const { key, valueNode } of extractStyleProperties(node)) {
          if (!COLOR_PROPERTIES.has(key)) {
            continue
          }

          const text = literalText(valueNode)

          if (text === null) {
            continue
          }

          for (const variable of varReferenceNames(text)) {
            if (!variable.startsWith(TOKEN_PREFIX)) {
              context.report({
                node: valueNode,
                messageId: 'nonTokenVariable',
                data: { property: key, variable },
              })
            }
          }

          // var() のフォールバックは、その変数が未定義のときに実際に描画される値。
          // 中身を見ないと var() に包むだけで素通りする。
          if (RAW_COLOR.test(expandVarFallbacks(text).trim())) {
            context.report({
              node: valueNode,
              messageId: 'rawColor',
              data: { property: key, value: text },
            })
          }
        }
      },
    }
  },
}

export default rule
