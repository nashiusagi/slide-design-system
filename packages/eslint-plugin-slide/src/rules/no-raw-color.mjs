/**
 * `no-raw-color` — JSX の `style` に生の色値を書かない（design/rules.json）。
 *
 * 色を運ぶ CSS プロパティを固定の一覧で持つ。`background` / `border` のような
 * ショートハンドは色以外（長さ・スタイル種別）も同じ文字列に混ざるため対象に
 * 含めない。ショートハンドを対象にすると「色ではない部分」を色として誤検出する。
 *
 * 生の色値は hex（`#fff` 等）と CSS の色関数（`rgb()` / `oklch()` 等）だけを
 * パターンとして検出する。CSS の名前付きキーワード色（`red` 等）は語彙が広く
 * 誤検出が増えるため対象にしない。トークン変数は `oklch()` で書かれる
 * （DESIGN.md）ため、この2パターンで実質的な抜け道はふさげる。
 */
import { extractStyleProperties, literalText } from '../lib/jsx-style.mjs'

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

const TOKEN_REFERENCE = /^var\(--dh-[\w-]+\)$/
const RAW_COLOR = /^#[0-9a-f]{3,8}$|^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'JSX の style に生の色値を書かず、--dh-* トークン変数を経由する',
    },
    schema: [],
    messages: {
      rawColor:
        "'{{property}}' に生の色値 '{{value}}' が書かれている。design/theme.css の --dh-* トークン変数（var(--dh-color-*)）を経由すること。",
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

          if (text === null || TOKEN_REFERENCE.test(text)) {
            continue
          }

          if (RAW_COLOR.test(text.trim())) {
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
