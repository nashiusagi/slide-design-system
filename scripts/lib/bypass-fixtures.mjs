/**
 * bypass フィクスチャの置き場所と読み込み（DR-0044）。
 *
 * 検査ルールのテストは「捕まえたい違反」から書かれる。捕まえたい違反はルールを
 * 書いた本人が考えたものなので、必ず捕まる。素通りする書き方は本人が思いつか
 * なかった書き方であり、だからテストにも無い。bypass フィクスチャは、その
 * 「思いつかなかった書き方」を軸（design/rules.json の bypassAxes）として先に
 * 列挙させ、軸ごとに事例を要求する仕組みである。
 *
 * フィクスチャは method ごとに置き場所が違う。lint はルール実装の隣、measure は
 * ここから見える scripts/lib/measure-bypass/ に置く。置き場所の規則はこの
 * ファイルの fixturePathFor が唯一の定義で、検査（scripts/validate-design.mjs）と
 * 実行（各 *.bypass.test.mjs）の両方がここを通る。
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** このファイルから見たリポジトリルート。scripts/lib/ から2階層上。 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * @typedef {{
 *   axis?: string,
 *   exclusion?: string,
 *   name: string,
 *   expect: 'violation' | 'ok',
 * } & Record<string, any>} BypassCase
 *
 * @typedef {{
 *   cases: BypassCase[],
 *   setup?: () => any,
 *   teardown?: (value: any) => void,
 * }} BypassFixture
 *
 * `setup` / `teardown` は、実行に実ファイルが要るルール（deck-conformance）だけが持つ。
 * setup の戻り値は各事例の options へ渡り、teardown が後片付けをする。
 */

/**
 * ルールの bypass フィクスチャの、リポジトリルートからの相対パス。
 *
 * @param {{ id: string, method: string }} rule
 * @returns {string}
 */
export function fixturePathFor(rule) {
  return rule.method === 'lint'
    ? `packages/eslint-plugin-slide/src/rules/${rule.id}.bypass.mjs`
    : `scripts/lib/measure-bypass/${rule.id}.bypass.mjs`
}

/**
 * design/rules.json の各ルールについて、bypass フィクスチャを読む。無ければ null。
 *
 * 読めない（構文エラー等）ときに例外を投げっぱなしにしない。投げると「フィクスチャが
 * 壊れている」という事実が、無関係なスタックトレースとして他の検査ごと止める形で
 * 出る。null ではなく理由を持たせて返し、呼び出し側の検査結果として並べる。
 *
 * @param {{ id: string, method: string }[]} rules
 * @returns {Promise<Map<string, { fixture: BypassFixture | null, error: string | null }>>}
 */
export async function loadBypassFixtures(rules) {
  /** @type {Map<string, { fixture: BypassFixture | null, error: string | null }>} */
  const loaded = new Map()

  for (const rule of rules) {
    const relativePath = fixturePathFor(rule)
    const absolutePath = join(REPO_ROOT, relativePath)

    if (!existsSync(absolutePath)) {
      loaded.set(rule.id, { fixture: null, error: null })
      continue
    }

    try {
      const module = await import(pathToFileURL(absolutePath).href)
      loaded.set(rule.id, { fixture: module.default, error: null })
    } catch (error) {
      loaded.set(rule.id, {
        fixture: null,
        error: `${relativePath}: 読み込めない: ${/** @type {Error} */ (error).message}`,
      })
    }
  }

  return loaded
}

/**
 * フィクスチャの事例のうち、指定した軸のものだけを返す。
 *
 * @param {BypassFixture} fixture
 * @param {'violation' | 'ok'} expectation
 * @returns {BypassCase[]}
 */
export function casesExpecting(fixture, expectation) {
  return fixture.cases.filter((one) => one.expect === expectation)
}
