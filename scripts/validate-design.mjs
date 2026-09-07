/**
 * 設計契約そのものを検証する（DR-0009）。
 *
 *   node scripts/validate-design.mjs
 *
 * ここが見るのは「契約が契約として成立しているか」であり、生成されたスライドは
 * 見ない。生成物の検査は lint（ESLint プラグイン）と measure（Playwright）が持つ
 * （DR-0011）。実行口は pnpm check に一本化する（DR-0028）。
 *
 * 骨格として、契約が増えるたびに CONTRACTS と CHECKS へ足していく形にしてある。
 * 今は tokens だけがある。layouts / components / decks / rules は後続の Issue で入る。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'

import { contrastRatio, isInSrgbGamut } from './lib/color.mjs'

/** @param {string} relativePath */
const resolve = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url))

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/** 契約ファイルと、それを検証するスキーマの対応。契約を足したらここへ足す。 */
const CONTRACTS = [{ data: 'design/tokens.json', schema: 'design/schemas/tokens.schema.json' }]

/**
 * コントラストの必要水準。本文は 4.5:1、UI の境界とフォーカスは 3:1。
 *
 * この表は暫定で、正本は design/rules.json の `contrast` へ移す（DR-0008 / DR-0011）。
 * rules.json を作る Issue（#7 / #8）で、ここは読み込みへ置き換えて消すこと。値を
 * 二箇所に置いたまま放置すると、閾値を上げたときに片方だけが上がる。
 */
const CONTRAST_REQUIREMENTS = [
  { foreground: 'text', background: 'background', minimum: 4.5, role: '本文' },
  { foreground: 'text', background: 'surface', minimum: 4.5, role: '本文' },
  { foreground: 'text', background: 'accentSoft', minimum: 4.5, role: '本文' },
  { foreground: 'textMuted', background: 'background', minimum: 4.5, role: '補助文' },
  { foreground: 'textMuted', background: 'surface', minimum: 4.5, role: '補助文' },
  { foreground: 'accent', background: 'background', minimum: 4.5, role: '強調' },
  { foreground: 'accent', background: 'surface', minimum: 4.5, role: '強調' },
  { foreground: 'accent', background: 'accentSoft', minimum: 4.5, role: '強調' },
  { foreground: 'danger', background: 'background', minimum: 4.5, role: '状態色' },
  { foreground: 'warning', background: 'background', minimum: 4.5, role: '状態色' },
  { foreground: 'success', background: 'background', minimum: 4.5, role: '状態色' },
  { foreground: 'border', background: 'background', minimum: 3, role: 'UI 境界' },
  { foreground: 'border', background: 'surface', minimum: 3, role: 'UI 境界' },
  { foreground: 'accent', background: 'background', minimum: 3, role: 'フォーカス' },
]

/**
 * 契約が JSON Schema を満たすか。
 *
 * @returns {string[]}
 */
function checkSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true })

  return CONTRACTS.flatMap(({ data, schema }) => {
    const validate = ajv.compile(readJson(schema))

    if (validate(readJson(data))) {
      return []
    }

    return (validate.errors ?? []).map(
      (error) => `${data}: ${error.instancePath || '/'} ${error.message}`,
    )
  })
}

/**
 * 色が sRGB の色域に収まっているか。外れた色はブラウザがクリップするため、
 * 実測したコントラストと実際の描画がずれる。
 *
 * @returns {string[]}
 */
function checkGamut() {
  const colors = readJson('design/tokens.json').color

  return Object.entries(colors)
    .filter(([name]) => !name.startsWith('$'))
    .filter(([, value]) => !isInSrgbGamut(/** @type {string} */ (value)))
    .map(([name, value]) => `design/tokens.json: color.${name} が sRGB 色域の外にある（${value}）`)
}

/**
 * 用途ごとのコントラストが水準を満たしているか。値は記録を読まずに計算し直す。
 * 記録を信じると、記録の側が古いときに検査ごと素通りする。
 *
 * @returns {string[]}
 */
function checkContrast() {
  const colors = readJson('design/tokens.json').color

  return CONTRAST_REQUIREMENTS.flatMap(({ foreground, background, minimum, role }) => {
    const ratio = contrastRatio(colors[foreground], colors[background])

    if (ratio >= minimum) {
      return []
    }

    return [
      `design/tokens.json: ${role}（${foreground} on ${background}）が ${ratio}:1 で、${minimum}:1 を満たさない`,
    ]
  })
}

/**
 * キャンバス寸法の正本は design/tokens.json だが、ランタイムは設計契約から独立して
 * 動く必要があるため src/runtime/canvas.ts が数値を持つ（DR-0004 / DR-0021）。
 * 両者がずれると no-overflow の基準面が条件ごとに変わり、lint では検出できない。
 *
 * TypeScript を解析せず正規表現で読むのは、この検査のためにビルド系を持ち込まない
 * ため。定数の書き方が変わって読めなくなったときは、素通りせず失敗として出す。
 *
 * @returns {string[]}
 */
function checkCanvasMatchesRuntime() {
  const source = readFileSync(resolve('src/runtime/canvas.ts'), 'utf8')
  const { width, height } = readJson('design/tokens.json').canvas

  return [
    ['CANVAS_WIDTH', width],
    ['CANVAS_HEIGHT', height],
  ].flatMap(([constantName, expected]) => {
    const matched = new RegExp(`export const ${constantName} = (\\d+)`).exec(source)

    if (matched === null) {
      return [`src/runtime/canvas.ts: ${constantName} の宣言を読み取れない`]
    }

    if (Number(matched[1]) !== expected) {
      return [
        `src/runtime/canvas.ts: ${constantName} が ${matched[1]} で、design/tokens.json の canvas（${expected}）と食い違う`,
      ]
    }

    return []
  })
}

const CHECKS = [
  { name: '契約が JSON Schema を満たす', run: checkSchemas },
  { name: '色が sRGB 色域に収まる', run: checkGamut },
  { name: 'コントラストが水準を満たす', run: checkContrast },
  { name: 'キャンバス寸法がランタイムと一致する', run: checkCanvasMatchesRuntime },
]

function main() {
  const problems = CHECKS.flatMap(({ name, run }) => {
    const found = run()

    console.log(`${found.length === 0 ? 'ok  ' : 'NG  '}${name}`)

    return found
  })

  if (problems.length > 0) {
    console.error(`\n${problems.join('\n')}`)
    process.exit(1)
  }
}

main()
