/**
 * `component-approved` — design/components/ の契約名をローカルで再定義
 * （シャドーイング）しない。契約名の component は、その `allowedIn` に無い
 * layout の下で使わない（design/rules.json）。
 *
 * component の実際の React 実装（`SlideTitle` 等）はまだ無い（DR-0035:
 * 「component の実際の React 実装は別 Issue が決める」）。このルールは
 * 実装の中身を検査するのではなく、契約名と同じ名前を**この JSX 契約と無関係な
 * 実装で埋めていないか**（別モジュールが提供する正規の実装をインポートせず、
 * 同名のローカル関数・変数・クラスをこのファイルで定義していないか）と、
 * 使う場所が `allowedIn` と一致しているかだけを見る。import による参照は
 * 対象にしない（正規の実装をインポートして使うことを妨げないため）。
 */
import { jsxAttributeStringValue } from '../lib/jsx-style.mjs'
import { listComponents, toPascalCase } from '../lib/design-contracts.mjs'

/**
 * ノードの直近の祖先から、layout 属性が静的に読める `<Slide>` を探す。
 *
 * ESLint の visitor が渡すノードの型は `@types/estree` に依存させず `any` で
 * 受ける（jsx-style.mjs 冒頭のコメントと同じ理由）。
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {any} node
 * @returns {string | undefined} 見つからない、または layout が静的に読めなければ undefined
 */
function findEnclosingLayout(context, node) {
  const ancestors = context.sourceCode.getAncestors(node)

  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const ancestor = /** @type {any} */ (ancestors[i])

    if (ancestor.type !== 'JSXElement' || ancestor.openingElement?.name?.name !== 'Slide') {
      continue
    }

    /** @type {any[]} */
    const attributes = ancestor.openingElement.attributes
    const layoutAttribute = attributes.find(
      (attribute) => attribute.type === 'JSXAttribute' && attribute.name?.name === 'layout',
    )

    return layoutAttribute === undefined ? undefined : jsxAttributeStringValue(layoutAttribute)?.text
  }

  return undefined
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'design/components/ の契約名をローカルで再定義しない。契約名の使用箇所は allowedIn の layout と一致させる',
    },
    schema: [],
    messages: {
      shadowed:
        "'{{name}}' は design/components/ の契約名。ローカルで再定義せず、正規の実装を import して使うこと。",
      disallowedLayout:
        "'{{name}}' は layout='{{layout}}' では使えない。design/components/{{contractName}}.json の allowedIn は {{allowedIn}}。",
    },
  },
  create(context) {
    const components = listComponents()
    const byPascalName = new Map(
      components.map((component) => [toPascalCase(component.name), component]),
    )

    /** @param {any} idNode */
    function checkShadow(idNode) {
      const name = /** @type {any} */ (idNode).name

      if (typeof name === 'string' && byPascalName.has(name)) {
        context.report({ node: idNode, messageId: 'shadowed', data: { name } })
      }
    }

    return {
      FunctionDeclaration(node) {
        if (node.id) {
          checkShadow(node.id)
        }
      },
      ClassDeclaration(node) {
        if (node.id) {
          checkShadow(node.id)
        }
      },
      VariableDeclarator(node) {
        const initType = node.init?.type

        if (
          node.id.type === 'Identifier' &&
          (initType === 'ArrowFunctionExpression' ||
            initType === 'FunctionExpression' ||
            initType === 'ClassExpression')
        ) {
          checkShadow(node.id)
        }
      },
      /** @param {any} node */
      JSXOpeningElement(node) {
        const name = node.name?.name

        if (typeof name !== 'string' || !byPascalName.has(name)) {
          return
        }

        const layout = findEnclosingLayout(context, node)

        if (layout === undefined) {
          return
        }

        const component = byPascalName.get(name)

        // JSXOpeningElement に入った時点で byPascalName.has(name) は真だが、
        // TypeScript は Map#has と #get の呼び出しをまたいで絞り込まないため、
        // ここで明示的に undefined を弾く。
        if (component === undefined || component.allowedIn.includes(layout)) {
          return
        }

        context.report({
          node,
          messageId: 'disallowedLayout',
          data: {
            name,
            layout,
            contractName: component.name,
            allowedIn: component.allowedIn.join(' / '),
          },
        })
      },
    }
  },
}

export default rule
