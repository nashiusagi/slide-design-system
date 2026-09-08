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
import { fileURLToPath, pathToFileURL } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'

import { contrastRatio, isInSrgbGamut } from './lib/color.mjs'

/** @param {string} relativePath */
const resolve = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url))

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/** 契約ファイルと、それを検証するスキーマの対応。契約を足したらここへ足す。 */
const CONTRACTS = [{ data: 'design/tokens.json', schema: 'design/schemas/tokens.schema.json' }]

/**
 * 面として使える色。前景はこのすべての上で水準を満たす必要がある。
 *
 * 集合として持つのは、前景ごとに背景を書き並べると片方だけ書き忘れても検査が通って
 * しまうため。背景を1つ足したら、全前景がその上でも検査される。
 */
const SURFACES = ['background', 'surface', 'accentSoft']

/**
 * コントラストの必要水準。本文は 4.5:1、UI の境界とフォーカスは 3:1。
 *
 * この表は暫定で、正本は design/rules.json の `contrast` へ移す（DR-0008 / DR-0011）。
 * rules.json を作る Issue（#7 / #8）で、ここは読み込みへ置き換えて消すこと。値を
 * 二箇所に置いたまま放置すると、閾値を上げたときに片方だけが上がる。移すときは
 * 「前景 × SURFACES」という展開の形と、下の未分類の検査も一緒に持っていくこと。
 */
const CONTRAST_REQUIREMENTS = [
  { role: '本文', foregrounds: ['text', 'textMuted'], minimum: 4.5 },
  { role: '強調', foregrounds: ['accent'], minimum: 4.5 },
  { role: '状態色', foregrounds: ['danger', 'warning', 'success'], minimum: 4.5 },
  { role: 'UI 境界とフォーカス', foregrounds: ['border'], minimum: 3 },
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
 * 算出したコントラストと実際の描画がずれる。
 *
 * @param {Record<string, string>} colors
 * @returns {string[]}
 */
export function checkGamut(colors) {
  return Object.entries(colors)
    .filter(([name]) => !name.startsWith('$'))
    .filter(([, value]) => !isInSrgbGamut(/** @type {string} */ (value)))
    .map(([name, value]) => `design/tokens.json: color.${name} が sRGB 色域の外にある（${value}）`)
}

/**
 * 用途ごとのコントラストが水準を満たしているか。値は記録を読まずに計算し直す。
 * 記録を信じると、記録の側が古いときに検査ごと素通りする。
 *
 * @param {Record<string, string>} colors
 * @returns {string[]}
 */
export function checkContrast(colors) {
  return [...checkEveryColorHasRole(colors), ...checkRatios(colors)]
}

/**
 * どの色にも役割が割り当てられているか。
 *
 * 前景の一覧を手で並べているので、色を足して CONTRAST_REQUIREMENTS へ書き忘れると、
 * その色だけ無検査のまま緑で通る。背景側は SURFACES との総当たりで塞がっているが、
 * 前景側は列挙のままなので、未分類そのものを検査して塞ぐ。
 *
 * @param {Record<string, string>} colors
 * @returns {string[]}
 */
function checkEveryColorHasRole(colors) {
  const assigned = new Set([...SURFACES, ...CONTRAST_REQUIREMENTS.flatMap(({ foregrounds }) => foregrounds)])

  return Object.keys(colors)
    .filter((name) => !name.startsWith('$'))
    .filter((name) => !assigned.has(name))
    .map(
      (name) =>
        `scripts/validate-design.mjs: color.${name} がどの役割にも割り当てられておらず、コントラストが検査されない`,
    )
}

/**
 * 割り当てられた役割ごとに、面の上での比が水準を満たしているか。
 *
 * @param {Record<string, string>} colors
 * @returns {string[]}
 */
function checkRatios(colors) {
  return CONTRAST_REQUIREMENTS.flatMap(({ role, foregrounds, minimum }) =>
    foregrounds.flatMap((foreground) =>
      SURFACES.filter((background) => background !== foreground).flatMap((background) => {
        const ratio = contrastRatio(colors[foreground], colors[background])

        if (ratio >= minimum) {
          return []
        }

        return [
          `design/tokens.json: ${role}（${foreground} on ${background}）が ${ratio}:1 で、${minimum}:1 を満たさない`,
        ]
      }),
    ),
  )
}

/**
 * キャンバス寸法の正本は design/tokens.json だが、ランタイムは設計契約から独立して
 * 動く必要があるため src/runtime/canvas.ts が数値を持つ（DR-0004 / DR-0021）。
 * 両者がずれると no-overflow の基準面が条件ごとに変わり、lint では検出できない。
 *
 * TypeScript を解析せず正規表現で読むのは、この検査のためにビルド系を持ち込まない
 * ため。定数の書き方が変わって読めなくなったときは、素通りせず失敗として出す。
 *
 * @param {string} source src/runtime/canvas.ts の中身
 * @param {{ width: number, height: number }} canvas
 * @returns {string[]}
 */
export function checkCanvasMatchesRuntime(source, canvas) {
  const { width, height } = canvas

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

function main() {
  const tokens = readJson('design/tokens.json')
  const canvasSource = readFileSync(resolve('src/runtime/canvas.ts'), 'utf8')

  const checks = [
    { name: '契約が JSON Schema を満たす', run: () => checkSchemas() },
    { name: '色が sRGB 色域に収まる', run: () => checkGamut(tokens.color) },
    { name: 'コントラストが水準を満たす', run: () => checkContrast(tokens.color) },
    {
      name: 'キャンバス寸法がランタイムと一致する',
      run: () => checkCanvasMatchesRuntime(canvasSource, tokens.canvas),
    },
  ]

  const problems = checks.flatMap(({ name, run }) => {
    const found = run()

    console.log(`${found.length === 0 ? 'ok  ' : 'NG  '}${name}`)

    return found
  })

  if (problems.length > 0) {
    console.error(`\n${problems.join('\n')}`)
    process.exit(1)
  }
}

// テストから読み込むときは走らせない。process.exit と標準出力を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
