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
 * 出力は `measurements.json`（--out で変更可）。
 */
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { chromium } from 'playwright'

import { contrastRatioFromRgb, parseCssRgb } from './lib/color.mjs'

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
     * 実際に描画されている前景色に対する、有効な背景色を探す。
     * 透明な背景を持つ要素は、実際にはその祖先の背景の上に描画される。
     *
     * @param {Element} el
     */
    function effectiveBackgroundColor(el) {
      /** @type {Element | null} */
      let node = el

      while (node) {
        const value = getComputedStyle(node).backgroundColor
        const match = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value)
        const alpha = match?.[1] === undefined ? 1 : Number(match[1])

        if (alpha > 0) {
          return value
        }

        node = node.parentElement
      }

      // どの祖先にも不透明な背景が無いなら、実際に描画されるのはキャンバスの
      // 外側（ページの白）。判定は Node 側が rules.json の contrast.surfaces
      // ではなく実測のみを見るため、ここでは白を実測結果として返す。
      return 'rgb(255, 255, 255)'
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
          backgroundColor: effectiveBackgroundColor(el),
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
 *   backgroundColor: string,
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
 * 前景色・背景色（`rgb()` / `rgba()` の CSS 文字列）からコントラスト比を求める。
 *
 * @param {string} foregroundCss
 * @param {string} backgroundCss
 */
export function contrastRatioFromCss(foregroundCss, backgroundCss) {
  return contrastRatioFromRgb(parseCssRgb(foregroundCss).rgb, parseCssRgb(backgroundCss).rgb)
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

      const ratio = contrastRatioFromCss(record.color, record.backgroundColor)

      if (ratio < contrastMinimum) {
        violations.push({
          rule: 'contrast',
          slideNumber,
          step,
          selector: record.selector,
          detail: `${record.color} on ${record.backgroundColor} が ${ratio}:1 で、${contrastMinimum}:1 を満たさない`,
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
      rules: ['no-overflow', 'min-font-size', 'contrast'],
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
