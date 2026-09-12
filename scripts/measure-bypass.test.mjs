/**
 * measure ルールの bypass フィクスチャを実行する（DR-0044）。
 *
 * lint 側（packages/eslint-plugin-slide/src/rules/bypass.test.mjs）と同じく、
 * design/rules.json を端から回して実行する。ブラウザは要らない。
 * `evaluateSlideMeasurements` はブラウザに依存しない純粋関数で、フィクスチャは
 * そこへ渡す要素データを組み立てる。
 *
 * 事例が使う閾値（キャンバス寸法・許容誤差・フォントサイズ下限・コントラスト水準）は
 * ここで正本から読んで context に入れ、事例へ渡す。事例側へ値を書き写させない
 * （DR-0033）。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { REPO_ROOT, loadBypassFixtures } from './lib/bypass-fixtures.mjs'
import { IMPLEMENTED_MEASURE_RULE_IDS } from './lib/measure-rules.mjs'
import { evaluateSlideMeasurements, resolveTextContrastMinimum } from './measure-slides.mjs'

// リポジトリルートの解決に new URL() の相対解決を使わない。vitest の
// environment: 'jsdom' はグローバルの URL を差し替えており、その下で
// file: スキームを外れた URL を返す（scripts/validate-design.test.mjs の
// 同種のコメントを参照）。
/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(join(REPO_ROOT, relativePath), 'utf8'))

const tokens = readJson('design/tokens.json')
const rules = readJson('design/rules.json')

const implemented = new Set(IMPLEMENTED_MEASURE_RULE_IDS)
const measureRules = /** @type {any[]} */ (rules.rules).filter(
  (rule) => rule.method === 'measure' && implemented.has(rule.id),
)
const fixtures = await loadBypassFixtures(measureRules)

const context = {
  slideNumber: 1,
  step: 0,
  canvas: tokens.canvas,
  overflowToleranceInPx: rules.noOverflow.toleranceInPx,
  minFontSizePx: rules.minFontSize.px,
  contrastMinimum: resolveTextContrastMinimum(rules.contrast),
}

describe('bypass フィクスチャ（measure）', () => {
  for (const rule of measureRules) {
    const fixture = fixtures.get(rule.id)?.fixture

    if (fixture === undefined || fixture === null) {
      continue
    }

    for (const one of fixture.cases) {
      const expectation = one.expect === 'violation' ? '違反として捕まる' : '通る'

      it(`${rule.id}: ${one.name} → ${expectation}`, () => {
        const records = one.records(context)

        // 通る側の事例は「違反が出ないこと」しか見ないので、records が空でも緑になる。
        // 空の事例は、除外や境界を事例で埋めたことにならない（DR-0044）。
        expect(records.length).toBeGreaterThan(0)

        const violations = evaluateSlideMeasurements(records, context).filter(
          (/** @type {any} */ violation) => violation.rule === rule.id,
        )

        if (one.expect === 'violation') {
          expect(violations.length).toBeGreaterThan(0)
        } else {
          expect(violations).toEqual([])
        }
      })
    }
  }
})
