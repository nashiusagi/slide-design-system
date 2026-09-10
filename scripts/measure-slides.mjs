/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * ビルド出力を実ブラウザで開き、実測で検査する（DR-0011）。
 *
 *   pnpm build && node scripts/measure-slides.mjs
 *
 * 対象は `dist/`（DR-0022）。本番と同一の物を検査する。lint（ESLint）では
 * 判定できない「実際に壊れているか」を、レイアウト矩形と computed style の
 * 実測で判定する。
 *
 * 実装するのは design/rules.json の method: "measure" のうち no-overflow /
 * min-font-size / contrast の3つ。deck-body-fidelity はここに含まない
 * （design/rules.json の対応する rule の description を参照）。
 *
 * 判定対象は DOM 要素（`querySelectorAll('*')`）のみ。`::before` / `::after` の
 * `content` で描画される疑似要素は対象に入らない。現在のコンポーネント契約
 * （design/components/ / design/layout.css）は `content:` を使っていないため
 * 今は到達しないが、将来使うようになった場合はここが空振りする。
 *
 * 出力は `measurements.json`（--out で変更可）。
 */
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { chromium } from 'playwright'

import { contrastRatioFromRgb, parseCssRgb } from './lib/color.mjs'
import { IMPLEMENTED_MEASURE_RULE_IDS } from './lib/measure-rules.mjs'

/**
 * リポジトリルート相対のパスを絶対パスへ。呼び出し側の cwd に依存させないため、
 * 基準はこのファイル自身の位置（import.meta.url）に取る（validate-design.mjs と同じ）。
 * 絶対パスが渡されたときはそのまま使う（CLI の `--dist` / `--out` 用）。
 *
 * @param {string} path
 */
const resolve = (path) => (isAbsolute(path) ? path : fileURLToPath(new URL(`../${path}`, import.meta.url)))

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/** @type {Record<string, string>} */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

/**
 * `dist/` を配信する最小限の静的サーバ。
 *
 * vite build の出力は `<script type="module">` を使う（DR-0022）。ES Modules は
 * `file://` からの読み込みをブラウザが拒否するため、http で配信する必要がある。
 *
 * @param {string} distDir
 * @returns {Promise<import('node:http').Server>}
 */
function startStaticServer(distDir) {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0])
    const filePath = join(distDir, pathname === '/' ? '/index.html' : pathname)

    try {
      const body = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })

  return new Promise((resolvePromise, rejectPromise) => {
    server.on('error', rejectPromise)
    server.listen(0, () => resolvePromise(server))
  })
}

/**
 * 現在位置の URL hash。`src/runtime/hash.ts` の `formatHash` と同じ書式（DR-0029）。
 *
 * scripts は Node で直接動き、TypeScript を transpile する仕組みを持たないため
 * `src/runtime/hash.ts` を import せず、書式（`#/<スライド番号>/<段階>`。段階 0 は
 * 省略）だけをここへ複製する。書式の正本は DR-0029 と `hash.ts` にある。
 *
 * @param {number} slideNumber 1 始まり
 * @param {number} step 0 始まり
 */
function hashFor(slideNumber, step) {
  return step === 0 ? `#/${slideNumber}` : `#/${slideNumber}/${step}`
}

/**
 * `.slide-deck` の data 属性を読む。
 *
 * @param {import('playwright').Page} page
 */
function readDeckState(page) {
  return page.evaluate(() => {
    const deck = document.querySelector('.slide-deck')

    if (!(deck instanceof HTMLElement)) {
      throw new Error('.slide-deck が見つからない。ビルド出力が壊れているか、Deck を使っていない。')
    }

    return {
      slideCount: Number(deck.dataset.slideCount),
      slideIndex: Number(deck.dataset.slideIndex),
      step: Number(deck.dataset.step),
      stepCount: Number(deck.dataset.stepCount),
    }
  })
}

/**
 * 現在表示中のスライド（`.slide-canvas` 配下）から、判定に要る生データを集める。
 *
 * 判定そのもの（はみ出し・フォントサイズ・コントラストの合否）はブラウザの外
 * （Node 側）で行う。ここは値を集めるだけの薄い層にし、合否のロジックを
 * `evaluateSlideMeasurements` としてブラウザ無しでテストできるようにする。
 *
 * 対象は「直接のテキストノードを持つ要素」（フォントサイズ・コントラストの判定用）
 * と「非ゼロサイズの全要素」（はみ出し判定用）。前者は後者に含まれる。
 *
 * @param {import('playwright').Page} page
 */
function collectElementRecords(page) {
  return page.evaluate(() => {
    /** @param {Element} el */
    function describe(el) {
      const parts = []
      /** @type {Element | null} */
      let node = el

      while (node && node !== document.body) {
        /** @type {Element | null} */
        const parent = node.parentElement
        const index = parent ? [...parent.children].indexOf(node) : 0
        parts.unshift(`${node.tagName.toLowerCase()}[${index}]`)
        node = parent
      }

      return parts.join(' > ')
    }

    /** @param {Element} el */
    function hasDirectText(el) {
      return [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')
    }

    /**
     * oklch(L C H) を 0..255 の sRGB へ。`scripts/lib/color.mjs` の
     * `oklchToRgb255` と同じ式（色域外はクリップする）。ここはブラウザ内で
     * 実行される page.evaluate のクロージャで、Node 側のモジュールを import
     * できないため複製している。
     *
     * @param {number} l
     * @param {number} c
     * @param {number} h
     * @returns {[number, number, number]}
     */
    function oklchToRgb255(l, c, h) {
      const radians = (h * Math.PI) / 180
      const a = c * Math.cos(radians)
      const b = c * Math.sin(radians)

      const lms = [
        (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
        (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
        (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
      ]

      const linear = [
        4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
        -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
        -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
      ]

      return /** @type {[number, number, number]} */ (
        linear.map((value) => {
          const clipped = Math.min(Math.max(value, 0), 1)
          const encoded = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * Math.pow(clipped, 1 / 2.4) - 0.055

          return Math.round(encoded * 255)
        })
      )
    }

    /**
     * 要素からドキュメントへ向かって並んだ、透明でない背景レイヤー（`[r, g, b, alpha]`）。
     * 完全に透明な背景を持つ要素は、実際にはその祖先の背景の上に描画される。半透明の
     * 背景も、alpha を捨てて「不透明」として扱うと合成前の色のまま判定してしまい、
     * 実際の描画結果とズレる。合成そのものは Node 側の `compositeBackgroundLayers`
     * が行う（ブラウザ無しでテストできるようにするため、ここでは生データだけを返す）。
     *
     * `background-color` に `--dh-color-*`（oklch 記法、DR-0008）を直接当てた要素は、
     * `getComputedStyle` が `rgb()` へ変換せず `oklch()` のまま返すことがある
     * （`color` プロパティで実際に確認された事象と同じ。DR-0011 の帰結）。ここで
     * 認識できない記法が来たら黙ってスキップせず例外にする。壊れていることが
     * 見えないまま「実際より薄い背景で合成した」結果を返すと、コントラスト判定が
     * 実測とズレていることに誰も気付けない。
     *
     * @param {Element} el
     * @returns {[number, number, number, number][]}
     */
    function backgroundLayers(el) {
      /** @type {[number, number, number, number][]} */
      const layers = []
      /** @type {Element | null} */
      let node = el

      while (node) {
        const value = getComputedStyle(node).backgroundColor
        const rgbMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value)
        const oklchMatch = rgbMatch
          ? null
          : /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(value)

        /** @type {{ rgb: [number, number, number], alpha: number }} */
        const parsed = rgbMatch
          ? {
              rgb: [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])],
              alpha: rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]),
            }
          : oklchMatch
            ? {
                rgb: oklchToRgb255(Number(oklchMatch[1]), Number(oklchMatch[2]), Number(oklchMatch[3])),
                alpha: oklchMatch[4] === undefined ? 1 : Number(oklchMatch[4]),
              }
            : (() => {
                throw new Error(`backgroundColor が rgb()/rgba()/oklch() のいずれでもない: ${value}`)
              })()
        const { rgb, alpha } = parsed

        if (alpha > 0) {
          layers.push([rgb[0], rgb[1], rgb[2], alpha])

          if (alpha >= 1) {
            break
          }
        }

        node = node.parentElement
      }

      return layers
    }

    const canvas = document.querySelector('.slide-canvas')

    if (!(canvas instanceof HTMLElement)) {
      throw new Error('.slide-canvas が見つからない。')
    }

    return [...canvas.querySelectorAll('*')]
      .map((el) => {
        const rect = el.getBoundingClientRect()

        if (rect.width <= 0 || rect.height <= 0) {
          return null
        }

        const style = getComputedStyle(el)

        return {
          selector: describe(el),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          hasDirectText: hasDirectText(el),
          fontSizePx: Number.parseFloat(style.fontSize),
          color: style.color,
          backgroundLayers: backgroundLayers(el),
        }
      })
      .filter((record) => record !== null)
  })
}

/**
 * @typedef {{
 *   selector: string,
 *   rect: { left: number, top: number, right: number, bottom: number },
 *   hasDirectText: boolean,
 *   fontSizePx: number,
 *   color: string,
 *   backgroundLayers: [number, number, number, number][],
 * }} ElementRecord
 */

/**
 * @typedef {{ rule: string, slideNumber: number, step: number, selector: string, detail: string }} Violation
 */

/**
 * レイアウト矩形がキャンバスからはみ出していないか。
 *
 * 判定はレイアウト矩形（getBoundingClientRect）で行う。`.slide-canvas` は
 * `overflow: hidden` でクリップするため、可視性やスクリーンショットで判定すると
 * 違反が描画結果に現れず検査が空振りする（DR-0011）。
 *
 * @param {{ left: number, top: number, right: number, bottom: number }} rect
 * @param {{ width: number, height: number }} canvas
 * @param {number} toleranceInPx
 */
export function isWithinCanvas(rect, canvas, toleranceInPx) {
  return (
    rect.left >= -toleranceInPx &&
    rect.top >= -toleranceInPx &&
    rect.right <= canvas.width + toleranceInPx &&
    rect.bottom <= canvas.height + toleranceInPx
  )
}

/**
 * @param {number} fontSizePx
 * @param {number} minFontSizePx
 */
export function meetsMinFontSize(fontSizePx, minFontSizePx) {
  return fontSizePx >= minFontSizePx
}

/**
 * contrast ルールが役割ごとに持つ最低値のうち、最も厳しい値を使う。
 *
 * 実測はレンダリング後の色を見るだけで、どの役割（本文 / 強調 / 状態色 / 境界）に
 * 対応するトークンから来た色かを判定できない。取りうる中で最も厳しい基準を使う
 * ことで、判定を緩めない（design/rules.json の contrast.requirements）。
 *
 * @param {{ requirements: { minimum: number }[] }} contrastRules
 */
export function resolveTextContrastMinimum(contrastRules) {
  return Math.max(...contrastRules.requirements.map((requirement) => requirement.minimum))
}

/**
 * 要素に近い順に並んだ透明でない背景レイヤー（`[r, g, b, alpha]`、alpha は 0 超）を
 * アルファ合成し、実際に描画される背景色を求める。
 *
 * ブラウザは祖先の背景から先に描き、その上へ子の（透明な場合がある）背景を重ねる。
 * 半透明な背景を「不透明」として扱うと、実際より暗い/明るい色を背景として誤認し、
 * コントラストの判定が実測とズレる。どの祖先にも不透明な背景が無いときは、実際に
 * 描画されるのはキャンバスの外側（ページの白）なので、白を最下層に置く。
 *
 * @param {[number, number, number, number][]} layersNearestFirst
 * @returns {[number, number, number]}
 */
export function compositeBackgroundLayers(layersNearestFirst) {
  /** @type {[number, number, number]} */
  let composite = [255, 255, 255]

  for (let i = layersNearestFirst.length - 1; i >= 0; i -= 1) {
    const [r, g, b, alpha] = layersNearestFirst[i]
    composite = [
      r * alpha + composite[0] * (1 - alpha),
      g * alpha + composite[1] * (1 - alpha),
      b * alpha + composite[2] * (1 - alpha),
    ]
  }

  return [Math.round(composite[0]), Math.round(composite[1]), Math.round(composite[2])]
}

/**
 * 前景色（`rgb()` / `rgba()` の CSS 文字列）と、合成済みの背景色（0..255 の3成分）から
 * コントラスト比を求める。
 *
 * @param {string} foregroundCss
 * @param {[number, number, number]} backgroundRgb
 */
export function contrastRatioFromCss(foregroundCss, backgroundRgb) {
  return contrastRatioFromRgb(parseCssRgb(foregroundCss).rgb, backgroundRgb)
}

/**
 * 1段階分（1スライド×1段階）の要素データから違反を求める。ブラウザに依存しない
 * 純粋関数。「意図的にはみ出させたスライドで no-overflow が落ちる」（#8 完了条件）
 * は、この関数にはみ出した矩形を持つレコードを渡すことで検証できる。
 *
 * @param {ElementRecord[]} records
 * @param {{
 *   slideNumber: number,
 *   step: number,
 *   canvas: { width: number, height: number },
 *   overflowToleranceInPx: number,
 *   minFontSizePx: number,
 *   contrastMinimum: number,
 * }} context
 * @returns {Violation[]}
 */
export function evaluateSlideMeasurements(records, context) {
  const { slideNumber, step, canvas, overflowToleranceInPx, minFontSizePx, contrastMinimum } = context

  return records.flatMap((record) => {
    /** @type {Violation[]} */
    const violations = []

    if (!isWithinCanvas(record.rect, canvas, overflowToleranceInPx)) {
      violations.push({
        rule: 'no-overflow',
        slideNumber,
        step,
        selector: record.selector,
        detail: `矩形 ${JSON.stringify(record.rect)} が ${canvas.width}x${canvas.height} からはみ出している`,
      })
    }

    if (record.hasDirectText) {
      if (!meetsMinFontSize(record.fontSizePx, minFontSizePx)) {
        violations.push({
          rule: 'min-font-size',
          slideNumber,
          step,
          selector: record.selector,
          detail: `computed fontSize が ${record.fontSizePx}px で、下限 ${minFontSizePx}px を割る`,
        })
      }

      const backgroundRgb = compositeBackgroundLayers(record.backgroundLayers)
      const ratio = contrastRatioFromCss(record.color, backgroundRgb)

      if (ratio < contrastMinimum) {
        violations.push({
          rule: 'contrast',
          slideNumber,
          step,
          selector: record.selector,
          detail: `${record.color} on rgb(${backgroundRgb.join(', ')}) が ${ratio}:1 で、${contrastMinimum}:1 を満たさない`,
        })
      }
    }

    return violations
  })
}

/**
 * 1枚のスライドの全 Fragment 段階を巡回し、各段階の違反を集める。
 *
 * 段階数は Fragment の最大 index であって個数ではないため、ランタイムが報告する
 * `data-step-count` を都度読み直す。巡回中に増えたら巡回を延長する（DR-0029）。
 *
 * @param {import('playwright').Page} page
 * @param {string} origin
 * @param {number} slideNumber 1 始まり
 * @param {{ canvas: { width: number, height: number }, overflowToleranceInPx: number, minFontSizePx: number, contrastMinimum: number }} thresholds
 * @returns {Promise<Violation[]>}
 */
async function measureSlide(page, origin, slideNumber, thresholds) {
  await page.goto(`${origin}/${hashFor(slideNumber, 0)}`)
  await page.waitForFunction(
    (expected) => document.querySelector('.slide-deck')?.getAttribute('data-slide-index') === String(expected),
    slideNumber - 1,
  )

  /** @type {Violation[]} */
  const violations = []
  let step = 0
  let maxStep = (await readDeckState(page)).stepCount

  while (step <= maxStep) {
    if (step > 0) {
      await page.goto(`${origin}/${hashFor(slideNumber, step)}`)
      await page.waitForFunction(
        (expected) => document.querySelector('.slide-deck')?.getAttribute('data-step') === String(expected),
        step,
      )
    }

    const state = await readDeckState(page)
    // data-step-count は各段階で読み直す。巡回中に増えたら巡回を延長する（DR-0029）。
    maxStep = Math.max(maxStep, state.stepCount)

    const records = await collectElementRecords(page)
    violations.push(
      ...evaluateSlideMeasurements(records, {
        slideNumber,
        step,
        canvas: thresholds.canvas,
        overflowToleranceInPx: thresholds.overflowToleranceInPx,
        minFontSizePx: thresholds.minFontSizePx,
        contrastMinimum: thresholds.contrastMinimum,
      }),
    )

    step += 1
  }

  const finalState = await readDeckState(page)

  if (finalState.step !== finalState.stepCount) {
    throw new Error(
      `スライド ${slideNumber}: 巡回後の data-step（${finalState.step}）が data-step-count（${finalState.stepCount}）と一致しない。ランタイムの段階報告が壊れている可能性がある（DR-0029）。`,
    )
  }

  return violations
}

/**
 * @param {{ dist: string, distDir: string }} options `dist` は表示・記録用の元の指定
 * （CLI 引数や既定値の "dist"）、`distDir` はサーバが実際に配信する絶対パス。
 * 記録に絶対パスを残すと、run を別マシンへ持ち込んだときの再現に使えない。
 */
async function measureDist({ dist, distDir }) {
  const tokens = readJson('design/tokens.json')
  const rules = readJson('design/rules.json')

  const thresholds = {
    canvas: { width: tokens.canvas.width, height: tokens.canvas.height },
    overflowToleranceInPx: rules.noOverflow.toleranceInPx,
    minFontSizePx: rules.minFontSize.px,
    contrastMinimum: resolveTextContrastMinimum(rules.contrast),
  }

  const server = await startStaticServer(distDir)
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('静的サーバのポートを取得できない。')
  }

  const origin = `http://127.0.0.1:${address.port}`
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage({ viewport: { width: thresholds.canvas.width, height: thresholds.canvas.height } })
    await page.goto(`${origin}/${hashFor(1, 0)}`)
    await page.waitForFunction(() => document.querySelector('.slide-deck')?.hasAttribute('data-slide-count') ?? false)

    const { slideCount } = await readDeckState(page)

    /** @type {Violation[]} */
    const violations = []

    for (let slideNumber = 1; slideNumber <= slideCount; slideNumber += 1) {
      violations.push(...(await measureSlide(page, origin, slideNumber, thresholds)))
    }

    return {
      generatedAt: new Date().toISOString(),
      dist,
      canvas: thresholds.canvas,
      rules: IMPLEMENTED_MEASURE_RULE_IDS,
      slideCount,
      pass: violations.length === 0,
      violations,
    }
  } finally {
    await browser.close()
    await new Promise((resolvePromise) => server.close(() => resolvePromise(undefined)))
  }
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ dist: string, out: string }} */
  const options = { dist: 'dist', out: 'measurements.json' }

  for (const arg of argv) {
    const [key, value] = arg.split('=')

    if (key === '--dist' && value) {
      options.dist = value
    }

    if (key === '--out' && value) {
      options.out = value
    }
  }

  return options
}

async function main() {
  const { dist, out } = parseArgs(process.argv.slice(2))
  const distDir = resolve(dist)

  const result = await measureDist({ dist, distDir })
  await writeFile(resolve(out), `${JSON.stringify(result, null, 2)}\n`)

  console.log(`${result.pass ? 'ok  ' : 'NG  '}measure（${result.slideCount} 枚 / ${result.violations.length} 件の違反）`)

  if (!result.pass) {
    console.error(
      `\n${result.violations
        .map((v) => `${v.rule}: スライド${v.slideNumber} 段階${v.step} ${v.selector} — ${v.detail}`)
        .join('\n')}`,
    )
    process.exit(1)
  }
}

// テストから読み込むときは走らせない。process.exit と標準出力、ブラウザ起動を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
