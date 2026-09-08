/**
 * `deck-conformance` — deck 契約（design/decks/*.md）の枚数・順序・layout 割当と、
 * 実装ファイルの `<Slide layout="...">` の並びが一致する（design/rules.json /
 * DR-0011 / DR-0017）。
 *
 * 対応する deck 契約はファイル名の規則では決めず、ルールオプション `deck` で
 * 明示する（eslint.config.js の `files` で対象ファイルを絞り込み、その
 * ブロックで `deck` を指定する）。複数 TSX ファイルに1つの deck が分かれる
 * 構成（Phase 2 の人間オーサリング）にどう対応するかは、実際にそういう構成が
 * 必要になった時点で決める。
 *
 * `body` がある場合の素材の欠落・改変はここでは見ない。静的解析では変数や
 * テンプレートリテラルを経由した本文を復元できないため、レンダリング後の DOM
 * テキストと照合する measure 系の `deck-body-fidelity`（#8）が持つ。
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import { parseDeck } from '../../../../scripts/lib/deck.mjs'

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '実装ファイルの Slide の並びが対応する deck 契約と一致する',
    },
    schema: [
      {
        type: 'object',
        properties: {
          deck: {
            type: 'string',
            minLength: 1,
            description: 'design/decks/*.md への、リポジトリルートからの相対パス',
          },
        },
        required: ['deck'],
        additionalProperties: false,
      },
    ],
    messages: {
      unreadableDeck: "deck 契約 '{{deck}}' を読み込めない: {{message}}",
      countMismatch:
        "スライド枚数が deck 契約（{{expected}}枚）と一致しない（実装は{{actual}}枚）。deck: {{deck}}",
      layoutMismatch:
        "{{index}}枚目の layout が deck 契約と一致しない。期待値: '{{expected}}'、実装: '{{actual}}'。deck: {{deck}}",
      unresolvedLayout:
        "{{index}}枚目の layout の値が静的に読み取れないため deck 契約と比較できない（期待値: '{{expected}}'）。deck: {{deck}}",
    },
  },
  create(context) {
    const deckOption = context.options[0]?.deck

    if (typeof deckOption !== 'string') {
      return {}
    }

    /** @type {{ node: any, layout: string | undefined }[]} */
    const slideElements = []

    return {
      /** @param {any} node */
      'JSXOpeningElement[name.name="Slide"]'(node) {
        /** @type {any[]} */
        const attributes = node.attributes
        const layoutAttribute = attributes.find(
          (attribute) => attribute.type === 'JSXAttribute' && attribute.name?.name === 'layout',
        )
        const value = layoutAttribute?.value
        const layout = value?.type === 'Literal' && typeof value.value === 'string' ? value.value : undefined

        slideElements.push({ node, layout })
      },
      'Program:exit'(program) {
        const deckPath = resolvePath(context.cwd, deckOption)

        /** @type {{ slides: { layout: string }[] }} */
        let deck

        try {
          deck = /** @type {any} */ (parseDeck(readFileSync(deckPath, 'utf8')))
        } catch (error) {
          context.report({
            node: program,
            messageId: 'unreadableDeck',
            data: { deck: deckOption, message: /** @type {Error} */ (error).message },
          })
          return
        }

        if (deck.slides.length !== slideElements.length) {
          context.report({
            node: program,
            messageId: 'countMismatch',
            data: {
              deck: deckOption,
              expected: String(deck.slides.length),
              actual: String(slideElements.length),
            },
          })
        }

        const length = Math.min(deck.slides.length, slideElements.length)

        for (let i = 0; i < length; i += 1) {
          const expected = deck.slides[i].layout
          const actual = slideElements[i]

          if (actual.layout === undefined) {
            context.report({
              node: actual.node,
              messageId: 'unresolvedLayout',
              data: { deck: deckOption, index: String(i + 1), expected },
            })
            continue
          }

          if (actual.layout !== expected) {
            context.report({
              node: actual.node,
              messageId: 'layoutMismatch',
              data: { deck: deckOption, index: String(i + 1), expected, actual: actual.layout },
            })
          }
        }
      },
    }
  },
}

export default rule
