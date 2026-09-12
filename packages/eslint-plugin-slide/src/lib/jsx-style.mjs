/**
 * `style={{ ... }}` の中身を読む共通処理。no-raw-color / no-raw-scale の両方が使う。
 *
 * 見るのは `style` prop のオブジェクトリテラルだけに絞る。design/components/*.json の
 * props は文言か配列だけで色・長さを持たず（DR-0035）、契約の外から色・長さが
 * JSX に混ざる経路は現状 `style` しかない。変数参照や spread（`style={vars}`）は
 * 静的に追えないため対象にしない。追えない書き方を対象にすると、変数を経由するだけで
 * 素通りする抜け道を lint 自身が示すことになる。
 *
 * 「静的に読めるかどうか」の線引きは、値の意味ではなく書き方で決まる。同じ値を
 * 別の記法で書けるなら、どの記法でも同じ結果にする必要がある（DR-0044）。この
 * ファイルが吸収する記法差は3つ——computed な文字列キー、置換の無いテンプレート
 * リテラル、`var()` のフォールバック値——で、いずれも bypass フィクスチャが
 * 固定している。
 */

/**
 * JSXAttribute（`style` という名前のもの）から、静的に読めるオブジェクトの
 * プロパティだけを取り出す。
 *
 * computed なキー（`{ ["color"]: ... }`）も、キーが文字列リテラルなら静的に
 * 読める。読まずに捨てると、キーを角括弧で包むだけで対象プロパティの判定を
 * 回避できる。
 *
 * ESLint の visitor が渡すノードの型は `@types/estree` に依存させず `any` で
 * 受ける。ESLint 自体は型を持たずに配布されており、AST の形は実行時にしか
 * 分からない前提のコード（visitor パターン）なので、ここを厳密に型付けしても
 * 実質的な安全性は増えない。
 *
 * @param {any} attributeNode JSXAttribute
 * @returns {{ key: string, valueNode: any }[]}
 */
export function extractStyleProperties(attributeNode) {
  const value = attributeNode.value

  if (value?.type !== 'JSXExpressionContainer') {
    return []
  }

  const expression = value.expression

  if (expression?.type !== 'ObjectExpression') {
    return []
  }

  return /** @type {any[]} */ (expression.properties).flatMap((property) => {
    if (property.type !== 'Property') {
      return []
    }

    const key = property.computed ? staticStringOf(property.key) : keyNameOf(property.key)

    if (key === null) {
      return []
    }

    return [{ key, valueNode: property.value }]
  })
}

/**
 * computed でないキーの名前。`{ color: ... }` と `{ "color": ... }` の両方を扱う。
 *
 * @param {any} keyNode
 * @returns {string | null}
 */
function keyNameOf(keyNode) {
  if (keyNode.type === 'Identifier') {
    return keyNode.name
  }

  return typeof keyNode.value === 'string' ? keyNode.value : null
}

/**
 * 静的に値の決まる文字列ノードから、その文字列を返す。文字列リテラルと、
 * 置換を持たないテンプレートリテラル（`` `title` ``）を同じものとして扱う。
 * どちらも実行時の値が1つに決まるため、片方だけを見ると記法を変えるだけで
 * 検査を回避できる。
 *
 * @param {any} node
 * @returns {string | null}
 */
export function staticStringOf(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }

  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((/** @type {any} */ quasi) => quasi.value.cooked).join('')
  }

  return null
}

/**
 * リテラルの文字列表現を返す。文字列（テンプレートリテラルを含む）と数値のみ対応する。
 * それ以外（識別子・式など）は静的に値を持たないので null。
 *
 * @param {any} node
 * @returns {string | null}
 */
export function literalText(node) {
  const asString = staticStringOf(node)

  if (asString !== null) {
    return asString
  }

  if (node.type === 'Literal' && typeof node.value === 'number') {
    return String(node.value)
  }

  return null
}

/**
 * JSXAttribute の値から、静的な文字列を取り出す。JSX は同じ意味の値を
 * `attr="x"`（Literal）と `attr={"x"}`（JSXExpressionContainer で包んだ Literal）と
 * `` attr={`x`} ``（同、テンプレートリテラル）のどれでも書けるため、一部だけを
 * 見落とすと包み方を変えるだけで検査を回避できてしまう。
 *
 * @param {any} attributeNode JSXAttribute
 * @returns {{ valueNode: any, text: string } | undefined}
 */
export function jsxAttributeStringValue(attributeNode) {
  const value = attributeNode.value

  if (value?.type === 'JSXExpressionContainer') {
    const text = staticStringOf(value.expression)

    return text === null ? undefined : { valueNode: value.expression, text }
  }

  const text = staticStringOf(value)

  return text === null ? undefined : { valueNode: value, text }
}

/**
 * `var(` の開き括弧に対応する閉じ括弧の位置。見つからなければ -1。
 *
 * @param {string} text
 * @param {number} openIndex
 */
function matchingParenthesis(text, openIndex) {
  let depth = 0

  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '(') {
      depth += 1
    } else if (text[i] === ')') {
      depth -= 1

      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

/**
 * 丸括弧の深さ0にある最初のカンマの位置。無ければ -1。
 *
 * @param {string} text
 */
function topLevelComma(text) {
  let depth = 0

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') {
      depth += 1
    } else if (text[i] === ')') {
      depth -= 1
    } else if (text[i] === ',' && depth === 0) {
      return i
    }
  }

  return -1
}

/**
 * `var(--x)` を空文字へ、`var(--x, フォールバック)` をフォールバックへ置き換える。
 * 入れ子（フォールバックがさらに `var()` を含む形）も解けるまで繰り返す。
 *
 * フォールバックは「その変数が未定義のときに実際に描画される値」であり、
 * 契約の外の値をそこへ書けば契約の外の値が描画される。`var()` に包まれている
 * という理由だけで中身を見ないと、包むだけで検査を素通りできる。
 *
 * @param {string} text
 * @returns {string} `var()` を取り除いた後の値
 */
export function expandVarFallbacks(text) {
  let current = text

  for (let guard = 0; guard < 10; guard += 1) {
    const start = current.search(/\bvar\(/i)

    if (start === -1) {
      return current
    }

    const openIndex = current.indexOf('(', start)
    const closeIndex = matchingParenthesis(current, openIndex)

    if (closeIndex === -1) {
      return current
    }

    const inner = current.slice(openIndex + 1, closeIndex)
    const commaIndex = topLevelComma(inner)
    const fallback = commaIndex === -1 ? '' : inner.slice(commaIndex + 1).trim()

    current = `${current.slice(0, start)} ${fallback} ${current.slice(closeIndex + 1)}`
  }

  return current
}

/**
 * 値が参照しているカスタムプロパティ名をすべて返す。`var(--dh-color-text)` なら
 * `['--dh-color-text']`。
 *
 * @param {string} text
 * @returns {string[]}
 */
export function varReferenceNames(text) {
  return [...text.matchAll(/\bvar\(\s*(--[\w-]+)/gi)].map((match) => match[1])
}
