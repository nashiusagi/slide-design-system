/**
 * design/ 配下の契約を読む共通処理。
 *
 * 契約名の一覧をルールごとに複製しない。scripts/validate-design.mjs と同様、
 * ファイルを都度読み直す（キャッシュしない）ことで、lint 実行のたびに最新の
 * 契約を見る。ESLint はプロセスを使い回すエディタ連携もあるため、キャッシュすると
 * 契約を直した直後の結果が古いままになりうる。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// リポジトリルートの解決に new URL() の相対解決を使わない。vitest の
// environment: 'jsdom' はグローバルの URL を差し替えており、その下で
// `new URL('../../../../', import.meta.url)` が file: スキームを外れた URL を
// 返す（scripts/validate-design.test.mjs の同種のコメントを参照）。
// fileURLToPath はグローバルの URL に依存しない node:url の関数なので、
// そこから得た絶対パスを node:path だけで遡る。
/** このパッケージから見たリポジトリルート。src/lib/ から4階層上。 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/** @param {string} relativePath */
function readJson(relativePath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relativePath), 'utf8'))
}

/**
 * design/layouts/*.json をすべて読む。
 *
 * @returns {{ name: string, slots: { component: string, required: boolean, max: number }[] }[]}
 */
export function listLayouts() {
  return readdirSync(join(REPO_ROOT, 'design/layouts'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson(`design/layouts/${file}`))
}

/**
 * design/components/*.json をすべて読む。
 *
 * @returns {{ name: string, allowedIn: string[] }[]}
 */
export function listComponents() {
  return readdirSync(join(REPO_ROOT, 'design/components'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson(`design/components/${file}`))
}

/** design/rules.json を読む。 */
export function readRules() {
  return readJson('design/rules.json')
}

/**
 * ルールの説明を design/rules.json から引く。
 *
 * ルール実装の `meta.docs.description` に説明を書き下ろすと、同じルールの守備範囲を
 * 述べる場所が正本と実装の2つになり、片方だけ書き換わったときに食い違う
 * （`inspection/rule-scope-inconsistent`、DR-0044）。引いてくれば食い違いようが無い。
 * 引かずに書き下ろしていないことは scripts/validate-design.mjs が検査する。
 *
 * 正本に無いIDでも例外を投げない。投げると、ルール定義の評価時（= プラグインの
 * import 時）に落ちるため、その状態を報告するために置かれた
 * checkLintRuleCoverage の「実装しているが design/rules.json に無い」へ到達する前に
 * 検査全体が止まる。説明を持たないまま返し、報告はその検査に任せる。
 *
 * @param {string} ruleId
 * @returns {string | undefined}
 */
export function descriptionOf(ruleId) {
  const rule = /** @type {{ id: string, description: string }[]} */ (readRules().rules).find(
    (one) => one.id === ruleId,
  )

  return rule?.description
}

/**
 * kebab-case の契約名を、JSX で使う PascalCase の component 名へ変える。
 * `slide-title` → `SlideTitle`。
 *
 * @param {string} kebabName
 */
export function toPascalCase(kebabName) {
  return kebabName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
