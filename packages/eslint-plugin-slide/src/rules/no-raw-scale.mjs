/**
 * `no-raw-scale` — JSX の `style` に生の長さリテラルを書かない（design/rules.json）。
 *
 * 単位ではなく「リテラルか、トークン変数（`var(--dh-*)`）への参照か」で判定する
 * （DR-0011: 単位で判定すると rem / em / % 等の単位を変えるだけで素通りする）。
 *
 * 対象は「数値そのもの、または単位付きの数値」に見える値だけに絞る（NUMERIC_LENGTH）。
 *
 * **このルールが意図的に見ない領域は design/rules.json の scopeExclusions が
 * 正本**（DR-0044）。ここに書き写さない。
 *
 * `var(--dh-*)` への参照は判定前に取り除く（フォールバックがあればその値に
 * 置き換える）ため、参照そのものは対象にならない。数値に見えるが例外として許す値
 * （`0` / `100%` / `1px` 等）は design/rules.json の `noRawScale.allowedLiterals`
 * に列挙する。
 *
 * `margin: "8px 16px"` のようなショートハンドの複合値は、空白区切りのトークンへ
 * 分解してからそれぞれを NUMERIC_LENGTH に通す。文字列全体を1つの値として
 * 判定すると、複合値であるという理由だけで生の長さが素通りする。
 * 丸括弧の中に空白を含む値（`calc(100% - 8px)` 等）を誤って分割しないよう、
 * 丸括弧の深さを見ながらトップレベルの空白だけで区切る。
 */
import { expandVarFallbacks, extractStyleProperties, literalText } from '../lib/jsx-style.mjs'
import { descriptionOf, readRules } from '../lib/design-contracts.mjs'

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

// CSS の単位は ASCII の大小を区別しない（`16PX` も `16px` として描画される）。
// 判定の前に小文字へ寄せるので、パターン側は小文字だけを列挙する。
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
      description: descriptionOf('no-raw-scale'),
    },
    schema: [],
    messages: {
      rawScale:
        "'{{property}}' に生の長さリテラル '{{value}}' が書かれている。design/theme.css の --dh-* トークン変数（var(--dh-space-*) 等）を経由すること。",
    },
  },
  create(context) {
    // 許容リストも小文字へ寄せて持つ。判定する値だけを正規化すると、
    // 許容された値を大文字の単位で書いたとき（`1PX`）に違反として報告される。
    const allowedLiterals = new Set(
      readRules().noRawScale.allowedLiterals.map((/** @type {string} */ one) => one.toLowerCase()),
    )

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

          // var() のフォールバックへ長さリテラルを書けば、それが実際に描画される
          // 値になる。var() に包まれているという理由で中身を見ないと、包むだけで
          // 素通りする。
          const trimmed = expandVarFallbacks(text).trim()

          for (const token of splitTopLevelTokens(trimmed)) {
            const normalized = token.toLowerCase()

            if (!NUMERIC_LENGTH.test(normalized) || allowedLiterals.has(normalized)) {
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
