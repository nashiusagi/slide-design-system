/**
 * ビルド出力から、スライド1枚ごとの「実際に画面へ出ている文字」を取る（#70）。
 *
 * deck 契約や `App.tsx` のソースではなく描画結果を読む。判定したいのは「契約どおりに
 * 書かれているか」ではなく「観客が読む文字で伝わるか」だからだ。ソースを読むと、
 * 画面に出ていない文字（コメント、条件で隠れた要素）まで数えてしまう。
 *
 * ここは取り出すだけで、判定はしない（`scripts/score-slide-content.mjs`）。
 */
import { originOf, startStaticServer } from './static-server.mjs'

/**
 * 現在表示中のスライドから、文字を持つ末端要素を DOM 順に拾う。
 *
 * ブラウザの中で走る関数として `page.evaluate` へ渡すため、Node 側のモジュールを
 * 参照できない。末端要素に限るのは、親要素で拾うと子の文字が重複して数えられるため。
 *
 * @returns {string[]}
 */
export function collectVisibleLines() {
  const canvas = document.querySelector('.slide-canvas')

  if (canvas === null) {
    throw new Error('.slide-canvas が見つからない。ビルド出力が壊れているか、Slide を使っていない。')
  }

  return [...canvas.querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0)
    .map((el) => (el.textContent ?? '').trim())
}

/**
 * `dist/` を開いて、スライドごとの表示文字を取る。
 *
 * 段階送り（Fragment）を持つスライドは最終段階まで進めてから読む。段階で後から出る
 * 文字も観客は読むので、途中で測ると本文の一部を落とす。
 *
 * @param {string} distDir
 * @param {typeof import('playwright').chromium} browserType
 * @returns {Promise<{ slideNumber: number, lines: string[] }[]>}
 */
export async function extractSlideText(distDir, browserType) {
  const server = await startStaticServer(distDir)
  const origin = originOf(server)
  const browser = await browserType.launch()

  try {
    const page = await browser.newPage()
    await page.goto(`${origin}/#/1`)
    await page.waitForFunction(() => document.querySelector('.slide-deck') !== null)

    const slideCount = await page.evaluate(() =>
      Number(/** @type {HTMLElement} */ (document.querySelector('.slide-deck')).dataset.slideCount),
    )

    /** @type {{ slideNumber: number, lines: string[] }[]} */
    const slides = []

    for (let slideNumber = 1; slideNumber <= slideCount; slideNumber += 1) {
      await page.goto(`${origin}/#/${slideNumber}`)
      await page.waitForFunction(
        (expected) => document.querySelector('.slide-deck')?.getAttribute('data-slide-index') === String(expected),
        slideNumber - 1,
      )

      const stepCount = await page.evaluate(() =>
        Number(/** @type {HTMLElement} */ (document.querySelector('.slide-deck')).dataset.stepCount ?? 1),
      )

      if (stepCount > 1) {
        await page.goto(`${origin}/#/${slideNumber}/${stepCount - 1}`)
        await page.waitForFunction(
          (expected) => document.querySelector('.slide-deck')?.getAttribute('data-step') === String(expected),
          stepCount - 1,
        )
      }

      slides.push({ slideNumber, lines: await page.evaluate(collectVisibleLines) })
    }

    return slides
  } finally {
    await browser.close()
    await new Promise((resolvePromise) => server.close(() => resolvePromise(undefined)))
  }
}
