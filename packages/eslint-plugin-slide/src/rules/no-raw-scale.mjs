/**
 * `no-raw-scale` — JSX の `style` に生の長さリテラルを書かない（design/rules.json）。
 *
 * 単位ではなく「リテラルか、トークン変数（`var(--dh-*)`）への参照か」で判定する
 * （DR-0011: 単位で判定すると rem / em / % 等の単位を変えるだけで素通りする）。
 *
 * 対象は「数値そのもの、または単位付きの数値」に見える値だけに絞る
 * （NUMERIC_LENGTH）。'center' / 'flex' のようなキーワード値まで対象にすると、
 * 長さではない値を「生の長さリテラル」と誤って報告することになる。色のような
 * 他の生値は no-raw-color が持つ。
 *
 * `var(--dh-*)` への参照は文字・括弧を含み NUMERIC_LENGTH に一致しないため、
 * この絞り込みだけで自然に対象から外れる。数値に見えるが例外として許す値
 * （`0` / `100%` / `1px` 等）は design/rules.json の `noRawScale.allowedLiterals`
 * に列挙する。
 *
 * `calc()` によるトークンの合成はまだ許していない。現状のコードベースに
 * 使用例が無いため、必要になった時点で `design/rules.json` と合わせて対応する。
 *
 * `opacity` / `zIndex` 等、値が長さではないプロパティは対象から外す
 * （UNITLESS_PROPERTIES）。
 *
 * `margin: "8px 16px"` のようなショートハンドの複合値は、空白区切りのトークンへ
 * 分解してからそれぞれを NUMERIC_LENGTH に通す。文字列全体を1つの値として
 * 判定すると、複合値であるという理由だけで生の長さが素通りする。
 * `var(--dh-*, 16px)` のようにトークン参照が丸括弧の中に空白を含む場合に
 * 誤って分割しないよう、丸括弧の深さを見ながらトップレベルの空白だけで区切る。
 */
import { extractStyleProperties, literalText } from '../lib/jsx-style.mjs'
import { readRules } from '../lib/design-contracts.mjs'

const UNITLESS_PROPERTIES = new Set([
  'opacity',
  'zIndex',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'lineHeight',
  'order',
  'zoom',
])

const NUMERIC_LENGTH = /^-?\d+(\.\d+)?(px|rem|em|vh|vw|vmin|vmax|pt|ch|%)?$/

/**
 * トップレベル（丸括弧の外）の空白でだけ区切る。`var(--dh-x, 16px)` のように
 * 丸括弧の中に空白を含むトークンを分断しない。
 * @param {string} text
 * @returns {string[]}
 */
function splitTopLevelTokens(text) {
  const tokens = []
  let depth = 0
  let current = ''

  for (const char of text) {
    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    }

    if (/\s/.test(char) && depth === 0) {
      if (current !== '') {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current !== '') {
    tokens.push(current)
  }

  return tokens
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'JSX の style に生の長さリテラルを書かず、--dh-* トークン変数を経由する',
    },
    schema: [],
    messages: {
      rawScale:
        "'{{property}}' に生の長さリテラル '{{value}}' が書かれている。design/theme.css の --dh-* トークン変数（var(--dh-space-*) 等）を経由すること。",
    },
  },
  create(context) {
    const allowedLiterals = new Set(readRules().noRawScale.allowedLiterals)

    return {
      /** @param {any} node */
      'JSXAttribute[name.name="style"]'(node) {
        for (const { key, valueNode } of extractStyleProperties(node)) {
          if (UNITLESS_PROPERTIES.has(key)) {
            continue
          }

          const text = literalText(valueNode)

          if (text === null) {
            continue
          }

          const trimmed = text.trim()

          for (const token of splitTopLevelTokens(trimmed)) {
            if (!NUMERIC_LENGTH.test(token) || allowedLiterals.has(token)) {
              continue
            }

            context.report({
              node: valueNode,
              messageId: 'rawScale',
              data: { property: key, value: token },
            })
          }
        }
      },
    }
  },
}

export default rule
