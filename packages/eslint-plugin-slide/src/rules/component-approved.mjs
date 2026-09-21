/**
 * `component-approved` — design/components/ の契約名をローカルで再定義
 * （シャドーイング）しない。契約名の component は、その `allowedIn` に無い
 * layout の下で使わない（design/rules.json）。
 *
 * このルールは実装の中身を検査するのではなく、契約名と同じ名前を**この JSX 契約と
 * 無関係な実装で埋めていないか**（別モジュールが提供する正規の実装をインポートせず、
 * 同名のローカル関数・変数・クラスをこのファイルで定義していないか）と、
 * 使う場所が `allowedIn` と一致しているかだけを見る。
 *
 * 正規の実装（DR-0050）だけは、契約名を定義する側である。そこまで再定義として弾くと、
 * import して使うべき相手がどこにも作れない。正規の実装を置くディレクトリは、ルール
 * オプション `implementsContractsIn` で外から与える（`eslint.config.js`）。置き場所を
 * ルールへ書き込まないのは、実装の在り処を決めるのが DR-0050 であって、この検査では
 * ないからだ。名前の一覧を設定へ書かないのも同じ理由による——設定とファイルの対応が
 * ずれたときに、ずれた側が広い方へ倒れる。
 *
 * 再定義は関数宣言・アロー関数・関数式・class 宣言・class 式と記法が分かれる。
 * どれか1つを見落とすと、記法を変えるだけで素通りする（component-approved.bypass.mjs）。
 *
 * **このルールが意図的に見ない領域は design/rules.json の scopeExclusions が
 * 正本**（DR-0044）。
 */
import { basename, extname, isAbsolute, join, relative } from 'node:path'

import { jsxAttributeStringValue } from '../lib/jsx-style.mjs'
import { descriptionOf, listComponents, toPascalCase } from '../lib/design-contracts.mjs'

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

/**
 * このファイルが正規の実装として定義してよい契約名。オプションが無ければ null。
 *
 * 見るのはパス全体で、指定されたディレクトリの直下にある `<名前>.<拡張子>` にちょうど
 * 一致したときだけ、その `<名前>` を返す。**この形をどこまで許すかは
 * `design/rules.json` の `canonical-implementation` が正本**（DR-0044）。一致しない
 * 書き方の実例は `component-approved.bypass.mjs` に事例として置いてある。
 *
 * 返す名前が契約名として実在するかは見ない。実在しない名前を返しても、呼び出し側の
 * 対応表に無いので何も外れない。
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {string | null}
 */
function canonicalNameFor(context) {
  const directory = context.options[0]?.implementsContractsIn

  if (typeof directory !== 'string' || directory.length === 0) {
    return null
  }

  const filename = context.filename

  // RuleTester は相対パスの filename をそのまま渡す。実行時は絶対パスで来るので、
  // どちらもリポジトリルート（context.cwd）からの相対パスへ揃えてから突き合わせる。
  const relativePath = isAbsolute(filename) ? relative(context.cwd, filename) : filename
  const name = basename(relativePath, extname(relativePath))

  return relativePath === join(directory, `${name}${extname(relativePath)}`) && !name.includes('.')
    ? name
    : null
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: descriptionOf('component-approved'),
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          /**
           * 正規の実装を置くディレクトリ（リポジトリルートからの相対パス）。ここの直下に
           * ある `<契約名>.<拡張子>` だけが、自分の契約名の定義を許される
           * （design/rules.json の scopeExclusions の `canonical-implementation`）。
           */
          implementsContractsIn: { type: 'string' },
        },
      },
    ],
    messages: {
      shadowed:
        "'{{name}}' は design/components/ の契約名。ローカルで再定義せず、正規の実装を import して使うこと。",
      disallowedLayout:
        "'{{name}}' は layout='{{layout}}' では使えない。design/components/{{contractName}}.json の allowedIn は {{allowedIn}}。",
    },
  },
  create(context) {
    const components = listComponents()
    const definableName = canonicalNameFor(context)
    const byPascalName = new Map(
      components.map((component) => [toPascalCase(component.name), component]),
    )

    /** @param {any} idNode */
    function checkShadow(idNode) {
      const name = /** @type {any} */ (idNode).name

      // 自分の契約名だけは定義してよい。それ以外の契約名は、実装のファイルでも弾く。
      if (name === definableName) {
        return
      }

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
