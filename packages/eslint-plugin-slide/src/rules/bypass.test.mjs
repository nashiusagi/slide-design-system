/**
 * lint ルールの bypass フィクスチャを実行する（DR-0044）。
 *
 * ルールごとにテストを書き足すのではなく、design/rules.json の method: "lint" を
 * 端から回して、対応するフィクスチャをすべて実行する。ここを通らないフィクスチャは
 * 作れない——書いたのに走らせ忘れる、という抜け方を無くすため、実行の入口を1つに
 * 絞ってある。フィクスチャが無いルールは scripts/validate-design.mjs が捕まえる。
 */
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'

import { loadBypassFixtures } from '../../../../scripts/lib/bypass-fixtures.mjs'
import { readRules } from '../lib/design-contracts.mjs'
import plugin from '../index.mjs'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const lintRules = /** @type {any[]} */ (readRules().rules).filter((rule) => rule.method === 'lint')
const fixtures = await loadBypassFixtures(lintRules)

/**
 * 事例の options を解決する。deck 契約のように実ファイルを要るルールでは、
 * フィクスチャの setup が返した値から options を組み立てる。
 *
 * @param {any} one
 * @param {any} setupValue
 */
function optionsOf(one, setupValue) {
  if (typeof one.options === 'function') {
    return one.options(setupValue)
  }

  return one.options ?? []
}

/**
 * 事例が期待する報告の一覧。1つの値が複数の違反へ分解される事例（ショートハンドの
 * 複合値など）は messageIds で件数まで書く。件数を問わないと、複合値のうち1つしか
 * 捕まえていない実装が通ってしまう。
 *
 * @param {any} one
 * @returns {string[]}
 */
function messageIdsOf(one) {
  return one.messageIds ?? [one.messageId]
}

describe('bypass フィクスチャ（lint）', () => {
  for (const rule of lintRules) {
    const entry = fixtures.get(rule.id)
    const fixture = entry?.fixture

    if (fixture === undefined || fixture === null) {
      continue
    }

    const implementation = /** @type {any} */ (plugin.rules)[rule.id]

    it(`${rule.id}: 書き方を変えた違反が素通りせず、除外した領域は通る`, () => {
      const setupValue = fixture.setup?.()

      try {
        ruleTester.run(rule.id, implementation, {
          valid: fixture.cases
            .filter((/** @type {any} */ one) => one.expect === 'ok')
            .map((/** @type {any} */ one) => ({
              name: one.name,
              code: one.code,
              options: optionsOf(one, setupValue),
            })),
          invalid: fixture.cases
            .filter((/** @type {any} */ one) => one.expect === 'violation')
            .map((/** @type {any} */ one) => ({
              name: one.name,
              code: one.code,
              options: optionsOf(one, setupValue),
              errors: messageIdsOf(one).map((messageId) => ({ messageId })),
            })),
        })
      } finally {
        fixture.teardown?.(setupValue)
      }
    })
  }
})
