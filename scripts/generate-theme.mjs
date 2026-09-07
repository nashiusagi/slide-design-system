/**
 * `design/tokens.json` から `design/theme.css` の `--dh-*` を生成する。
 *
 *   node scripts/generate-theme.mjs           生成して書き出す
 *   node scripts/generate-theme.mjs --check   生成し直した結果と現物を突き合わせる
 *
 * トークンが正本で、theme.css は生成物（DR-0018 / README の正本表）。--check は
 * 「theme.css を手で直した」「トークンを直して生成し忘れた」のどちらも検出する。
 * 検出しないと、契約の値と実際に効く CSS が静かにずれる。
 *
 * コントラストと色相差の実測値は tokens.json の `$measured` へ書き戻す。記録先を
 * tokens.json と定めたのは DR-0008 の帰結。人が書き写すと古くなるので、この
 * スクリプトが唯一の書き手になり、--check が再計算と突き合わせる。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { contrastRatio, hueDistance, oklchToHex, parseOklch } from './lib/color.mjs'

/**
 * リポジトリ内のパス。呼ばれた時点で解決する。読み込んだだけで解決すると、
 * ファイルの実体を持たない実行環境（テストランナーの変換後モジュール）で落ちる。
 *
 * @param {string} relativePath
 */
const resolve = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url))

/** 数値だが px を付けない経路。比率と字の太さは無次元。 */
const UNITLESS_PATHS = new Set(['type-line-height', 'type-weight'])

/** @typedef {Record<string, unknown>} TokenNode */

/** @param {string} name */
function toKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * トークンを `--dh-*` の並びへ平坦化する。`$` で始まるキー（$schema / $comment /
 * $measured）は説明と実測値なので変数にしない。
 *
 * @param {TokenNode} node
 * @param {string[]} path
 * @returns {{ name: string, value: string }[]}
 */
export function flatten(node, path = []) {
  /** @type {{ name: string, value: string }[]} */
  const variables = []

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue
    }

    const nextPath = [...path, toKebab(key)]

    if (typeof value === 'object' && value !== null) {
      variables.push(...flatten(/** @type {TokenNode} */ (value), nextPath))
      continue
    }

    const joined = nextPath.join('-')
    const unitless = UNITLESS_PATHS.has(nextPath.slice(0, -1).join('-'))
    const rendered = typeof value === 'number' && !unitless ? `${value}px` : String(value)

    variables.push({ name: `--dh-${joined}`, value: rendered })
  }

  return variables
}

/**
 * 全色ペアのコントラストと、色相を持つ色どうしの色相差を実測する。
 *
 * ペアは順序を持たない（コントラスト比は前景と背景を入れ替えても同じ）ので、
 * 宣言順の組み合わせだけを取る。
 *
 * @param {Record<string, string>} colors
 */
export function measure(colors) {
  const entries = Object.entries(colors).filter(([key]) => !key.startsWith('$'))
  /** @type {Record<string, number>} */
  const contrast = {}
  /** @type {Record<string, number>} */
  const hue = {}

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [nameA, valueA] = entries[i]
      const [nameB, valueB] = entries[j]

      contrast[`${nameA}|${nameB}`] = contrastRatio(valueA, valueB)

      // 無彩色は色相を持たない。0 度として並べると意味の無い差が記録される。
      if (parseOklch(valueA).c > 0 && parseOklch(valueB).c > 0) {
        hue[`${nameA}|${nameB}`] = hueDistance(valueA, valueB)
      }
    }
  }

  return { contrast, hueDistance: hue }
}

/**
 * @param {TokenNode} tokens
 * @param {{ contrast: Record<string, number>, hueDistance: Record<string, number> }} measured
 */
function renderTheme(tokens, measured) {
  const colors = /** @type {Record<string, string>} */ (tokens.color)
  const groups = Object.entries(tokens).filter(([key]) => !key.startsWith('$'))

  const hexes = Object.entries(colors)
    .filter(([key]) => !key.startsWith('$'))
    .map(([name, value]) => ` *   ${name.padEnd(12)} ${value.padEnd(22)} ${oklchToHex(value)}`)

  const contrastLines = Object.entries(measured.contrast).map(
    ([pair, ratio]) => ` *   ${pair.padEnd(26)} ${ratio.toFixed(2)}:1`,
  )

  const hueLines = Object.entries(measured.hueDistance).map(
    ([pair, degrees]) => ` *   ${pair.padEnd(26)} ${degrees} 度`,
  )

  const declarations = groups.flatMap(([groupName, group]) => {
    const variables = flatten({ [groupName]: group })

    return ['', ...variables.map(({ name, value }) => `  ${name}: ${value};`)]
  })

  return [
    '/*',
    ' * design/tokens.json から生成している。直接編集しない。',
    ' * 生成: pnpm theme:generate / 突き合わせ: pnpm theme:check',
    ' *',
    ' * 色の sRGB 換算（8bit へ丸めた後の値。実測はここを基準にしている）:',
    ...hexes,
    ' *',
    ' * 全色ペアのコントラスト比（WCAG 2.1、小数第2位で切り捨て）:',
    ...contrastLines,
    ' *',
    ' * 色相を持つ色どうしの色相角の差:',
    ...hueLines,
    ' */',
    ':root {',
    ...declarations.slice(1),
    '}',
    '',
  ].join('\n')
}

/** @param {unknown} value */
function stableJson(value) {
  return JSON.stringify(value, null, 2)
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const tokensPath = resolve('design/tokens.json')
  const themePath = resolve('design/theme.css')
  const source = readFileSync(tokensPath, 'utf8')
  const tokens = /** @type {TokenNode} */ (JSON.parse(source))
  const colors = /** @type {Record<string, string>} */ (tokens.color)

  const measured = measure(colors)
  const theme = renderTheme(tokens, measured)

  const recorded = /** @type {TokenNode} */ (tokens.$measured)
  const nextTokens = stableJson({
    ...tokens,
    $measured: { ...recorded, ...measured },
  })

  if (!checkOnly) {
    writeFileSync(themePath, theme)
    writeFileSync(tokensPath, `${nextTokens}\n`)
    console.log('design/theme.css を生成した。実測値を design/tokens.json の $measured へ書き戻した。')
    return
  }

  /** @type {string[]} */
  const drifts = []

  let current = ''
  try {
    current = readFileSync(themePath, 'utf8')
  } catch {
    drifts.push('design/theme.css が無い。')
  }

  if (current !== '' && current !== theme) {
    drifts.push('design/theme.css が design/tokens.json と食い違っている。')
  }

  if (stableJson(recorded.contrast) !== stableJson(measured.contrast)) {
    drifts.push('design/tokens.json の $measured.contrast が実測値と食い違っている。')
  }

  if (stableJson(recorded.hueDistance) !== stableJson(measured.hueDistance)) {
    drifts.push('design/tokens.json の $measured.hueDistance が実測値と食い違っている。')
  }

  if (drifts.length > 0) {
    console.error(`${drifts.join('\n')}\npnpm theme:generate を実行して差分を確認すること。`)
    process.exit(1)
  }

  console.log('design/theme.css と実測値は design/tokens.json と一致している。')
}

// テストから読み込むときは走らせない。副作用（theme.css の書き出し）を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
