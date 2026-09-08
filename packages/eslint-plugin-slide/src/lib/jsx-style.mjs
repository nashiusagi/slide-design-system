/**
 * `style={{ ... }}` の中身を読む共通処理。no-raw-color / no-raw-scale の両方が使う。
 *
 * 見るのは `style` prop のオブジェクトリテラルだけに絞る。design/components/*.json の
 * props は文言か配列だけで色・長さを持たず（DR-0035）、契約の外から色・長さが
 * JSX に混ざる経路は現状 `style` しかない。変数参照や spread（`style={vars}`）は
 * 静的に追えないため対象にしない。追えない書き方を対象にすると、変数を経由するだけで
 * 素通りする抜け道を lint 自身が示すことになる。
 */

/**
 * JSXAttribute（`style` という名前のもの）から、静的に読めるオブジェクトの
 * プロパティだけを取り出す。
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
    if (property.type !== 'Property' || property.computed) {
      return []
    }

    const key = property.key.type === 'Identifier' ? property.key.name : property.key.value

    if (typeof key !== 'string') {
      return []
    }

    return [{ key, valueNode: property.value }]
  })
}

/**
 * リテラルの文字列表現を返す。文字列リテラル・数値リテラルのみ対応する。
 * それ以外（テンプレートリテラル・識別子など）は静的に値を持たないので null。
 *
 * @param {any} node
 * @returns {string | null}
 */
export function literalText(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }

  if (node.type === 'Literal' && typeof node.value === 'number') {
    return String(node.value)
  }

  return null
}

/**
 * JSXAttribute の値から、静的な文字列を取り出す。JSX は同じ意味の値を
 * `attr="x"`（Literal）と `attr={"x"}`（JSXExpressionContainer で包んだ Literal）の
 * どちらでも書けるため、後者だけを見落とすと波括弧で包むだけで検査を回避できてしまう。
 *
 * @param {any} attributeNode JSXAttribute
 * @returns {{ valueNode: any, text: string } | undefined}
 */
export function jsxAttributeStringValue(attributeNode) {
  const value = attributeNode.value

  if (value?.type === 'Literal' && typeof value.value === 'string') {
    return { valueNode: value, text: value.value }
  }

  if (
    value?.type === 'JSXExpressionContainer' &&
    value.expression?.type === 'Literal' &&
    typeof value.expression.value === 'string'
  ) {
    return { valueNode: value.expression, text: value.expression.value }
  }

  return undefined
}
