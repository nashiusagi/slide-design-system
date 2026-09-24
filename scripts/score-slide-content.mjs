/**
 * スライドが `keyMessage` を伝えられているかを、契約を基準に判定する（#70 / DR-0056）。
 *
 *   pnpm build && node scripts/score-slide-content.mjs [--dist=<dir>] [--deck=<path>] [--out=<path>]
 *   node scripts/score-slide-content.mjs --dry-run   # API を叩かず送信内容だけ出す
 *
 * `pnpm measure` は「はみ出したか」「文字が小さすぎないか」を見る。lint は部品の使い方を
 * 見る。**そのスライドが伝えたいことを伝えられているかは、どちらも見ていない。** ここは
 * その穴だけを埋める。
 *
 * 判定基準は実行時に契約から読み、実装へ書き写さない（DR-0046）。
 *
 *   - 何を伝えるはずか       … deck 契約の `keyMessage`
 *   - どの役割を担うはずか   … `design/layouts/<layout>.json` の `role`
 *   - どのレイアウトが適切か … 同 `role` / `whenToUse` / `whenNotToUse`
 *
 * **判定は2リクエストに分ける。** 「役割を果たしているか」には宣言済みのレイアウトが
 * 要るが、「どのレイアウトが向くか」にそれを渡すと宣言をなぞるだけになる。1つの state に
 * 両方の質問を置くと、宣言が漏れているかどうかを確かめられない。
 *
 * **`pnpm check` には入れない**（DR-0056 決定4）。ネットワークと API キーを check の
 * 必須依存にしない。キーが無ければこのコマンド自身が落ちる。無言で飛ばす経路は作らない。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

import { parseDeck } from './lib/deck.mjs'
import { extractSlideText } from './lib/slide-text.mjs'

/** @param {string} path */
const resolvePath = (path) => (isAbsolute(path) ? path : fileURLToPath(new URL(`../${path}`, import.meta.url)))

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'

/**
 * 判定の段階。`role` が求めることを果たせているかを、レイアウトによらず同じ刻みで測る。
 *
 * **何を「果たす」かはレイアウトごとに違う**（DR-0056 決定2）。刻みだけをここに置き、
 * 中身は `design/layouts/<layout>.json` の `role` が決める。刻みまで契約から取ろうとすると、
 * 全レイアウトの契約へ同じ4段階を書くことになり、正本が増える。
 */
const CONVEYANCE_LEVELS = [
  '表示されている文字は、その役割が求めることを何も果たしていない。別の話題を扱っているか、字面が無関係である。',
  '話題は重なっているが、その役割が求めることは果たせていない。何を受け取るべきかは読み手が自分で補う必要がある。',
  'その役割が求めることはおおむね果たせているが、一部が欠けているか、他の情報に埋もれて焦点がぼけている。',
  '表示されている文字だけで、その役割が求めることを過不足なく果たしている。',
]

/**
 * @typedef {{ title: string, slides: { layout: string, keyMessage: string }[] }} ScorableDeck
 */

/**
 * 採点に要る形が揃っているかを確かめる。
 *
 * `parseDeck` が担うのは構文の正規化だけで、`layout` や `keyMessage` があるかは
 * `design/schemas/deck.schema.json` の検証（`pnpm design:check`）に委ねられている。
 * ここはその検証を通っていない deck も受け取りうるので、**採点が黙って undefined を
 * 相手に走らないよう**、要る項目だけを自分で確かめる。
 *
 * @param {Record<string, unknown> & { slides: Record<string, unknown>[] }} document
 * @param {string} source エラーに出すパス
 * @returns {ScorableDeck}
 */
export function toScorableDeck(document, source) {
  if (typeof document.title !== 'string' || document.title.trim().length === 0) {
    throw new Error(`${source}: frontmatter に title が無い。`)
  }

  const slides = document.slides.map((slide, index) => {
    if (typeof slide.layout !== 'string' || typeof slide.keyMessage !== 'string') {
      throw new Error(`${source}: ${index + 1} 枚目に layout か keyMessage が無い。pnpm design:check で deck 契約を確かめること。`)
    }

    return { layout: slide.layout, keyMessage: slide.keyMessage }
  })

  return { title: document.title, slides }
}

/**
 * `design/layouts/*.json` を読む。
 *
 * @param {string} [layoutsDir]
 * @returns {Map<string, { name: string, role: string, whenToUse: string[], whenNotToUse: string[] }>}
 */
export function loadLayouts(layoutsDir) {
  const dir = layoutsDir ?? resolvePath('design/layouts')
  const names = JSON.parse(readFileSync(resolvePath('design/schemas/deck.schema.json'), 'utf8')).properties.slides.items
    .properties.layout.enum

  return new Map(
    names.map((/** @type {string} */ name) => [name, JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'))]),
  )
}

/**
 * レイアウトの `role` / `whenToUse` / `whenNotToUse` を Choice の criteria へ変換する。
 *
 * 散文へ畳まず構造のまま渡す。畳む過程でこちらが言い換えると、レイアウト契約の正本が
 * 2つになる。
 *
 * @param {ReturnType<typeof loadLayouts>} layouts
 */
export function buildLayoutCriteria(layouts) {
  /** @type {Record<string, { 役割: string, 選ぶとき: string[], 選ばないとき: string[] }>} */
  const criteria = {}

  for (const [name, layout] of layouts) {
    criteria[name] = { 役割: layout.role, 選ぶとき: layout.whenToUse, 選ばないとき: layout.whenNotToUse }
  }

  return criteria
}

/**
 * 「役割を果たしているか」を聞くリクエスト。宣言済みのレイアウトの `role` を渡す。
 *
 * @param {ScorableDeck} deck
 * @param {{ slideNumber: number, lines: string[] }[]} rendered
 * @param {ReturnType<typeof loadLayouts>} layouts
 */
export function buildConveyanceRequest(deck, rendered, layouts) {
  const state = {
    deck_title: deck.title,
    slide_count: deck.slides.length,
    slides: deck.slides.map((slide, index) => ({
      position: index + 1,
      role: /** @type {{ role: string }} */ (layouts.get(slide.layout)).role,
      key_message: slide.keyMessage,
      rendered_text: rendered[index].lines,
    })),
  }

  /** @type {Record<string, unknown>} */
  const questions = {}

  deck.slides.forEach((_, index) => {
    const path = `slides[${index}]`

    questions[`slide${index + 1}`] = {
      type: 'score',
      instructions: {
        question:
          `\`${path}.rendered_text\` は、そのスライドに実際に表示されている文字を上から順に並べたものである。` +
          `このスライドは \`${path}.role\` の役割を担い、\`${path}.key_message\` を伝えることになっている。` +
          `表示されている文字だけを読んだ観客に対して、**その役割の範囲で** key_message が伝わっているかを判定する。` +
          `key_message の文言がそのまま書かれている必要は無い。` +
          `役割が情報を足さないことを求めているなら、その役割が果たすべきところまで伝わっていれば足りる。`,
      },
      criteria: CONVEYANCE_LEVELS,
    }
  })

  return { state, model: MODEL, questions }
}

/**
 * 「どのレイアウトが向くか」を聞くリクエスト。**宣言済みのレイアウトを渡さない。**
 *
 * @param {ScorableDeck} deck
 * @param {{ slideNumber: number, lines: string[] }[]} rendered
 * @param {ReturnType<typeof loadLayouts>} layouts
 */
export function buildLayoutRequest(deck, rendered, layouts) {
  const state = {
    deck_title: deck.title,
    slide_count: deck.slides.length,
    slides: deck.slides.map((slide, index) => ({
      position: index + 1,
      key_message: slide.keyMessage,
      rendered_text: rendered[index].lines,
    })),
  }

  /** @type {Record<string, unknown>} */
  const questions = {}
  const criteria = buildLayoutCriteria(layouts)

  deck.slides.forEach((_, index) => {
    questions[`slide${index + 1}`] = {
      type: 'choice',
      instructions: {
        question:
          `\`slides[${index}]\` の内容（key_message と rendered_text）を、どのレイアウトで表すのが最も適切かを選ぶ。` +
          `現在どのレイアウトで作られているかは判断材料にしない。内容だけを見て選ぶ。`,
      },
      criteria,
    }
  })

  return { state, model: MODEL, questions }
}

/**
 * @param {unknown} body
 * @param {string} [apiKey]
 */
export async function callTypeSafe(body, apiKey = process.env.TYPESAFE_API_KEY) {
  if (!apiKey) {
    throw new Error(
      'TYPESAFE_API_KEY が無い。この検査は外部 API を使う（DR-0056）。キーを渡すか --dry-run を付けること。',
    )
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`TypeSafe API が ${response.status} を返した: ${await response.text()}`)
  }

  return response.json()
}

/**
 * 生の判定を、このリポジトリの用語での所見へ畳む。
 *
 * **判定と方針を分ける。** 閾値を変えても再推論は要らない。閾値の根拠は DR-0056 決定3。
 *
 * @param {Pick<ScorableDeck, 'slides'>} deck
 * @param {{ slideNumber: number, lines: string[] }[]} rendered
 * @param {Record<string, { score: number, confidence: number, probabilities: Record<string, number> }>} conveyance
 * @param {Record<string, { choice: string, confidence: number, probabilities: Record<string, number> }>} layoutFit
 * @param {{ conveyanceMin: number, conveyanceReviewConfidence: number, layoutReviewConfidence: number }} thresholds
 */
export function summarize(deck, rendered, conveyance, layoutFit, thresholds) {
  return deck.slides.map((slide, index) => {
    const key = `slide${index + 1}`
    const conveyed = conveyance[key]
    const fit = layoutFit[key]
    /** @type {{ rule: string, detail: string }[]} */
    const findings = []

    if (conveyed.score < thresholds.conveyanceMin) {
      findings.push({
        rule: 'key-message-conveyed',
        detail: `${slide.layout} の役割の範囲でも keyMessage が伝わっていない（${conveyed.score.toFixed(2)} < ${thresholds.conveyanceMin}）: 「${slide.keyMessage}」`,
      })
    }

    if (fit.choice !== slide.layout) {
      findings.push({
        rule: 'layout-fit',
        detail: `契約は ${slide.layout} だが、内容には ${fit.choice} が向く（p=${fit.probabilities[fit.choice].toFixed(2)}）`,
      })
    }

    return {
      slideNumber: index + 1,
      declaredLayout: slide.layout,
      keyMessage: slide.keyMessage,
      renderedText: rendered[index].lines,
      conveyance: conveyed,
      layoutFit: fit,
      findings,
      // 確信度の意味がルールごとに違うので、線も別に持つ（DR-0056 決定3）。
      needsHumanReview:
        conveyed.confidence < thresholds.conveyanceReviewConfidence ||
        fit.confidence < thresholds.layoutReviewConfidence,
    }
  })
}

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {{ dist: string, deck: string, out: string | null, dryRun: boolean }} */
  const args = { dist: 'dist', deck: 'design/decks/harness-intro.md', out: null, dryRun: false }

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--dist=')) args.dist = arg.slice('--dist='.length)
    else if (arg.startsWith('--deck=')) args.deck = arg.slice('--deck='.length)
    else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length)
    else throw new Error(`知らない引数: ${arg}`)
  }

  return args
}

async function main() {
  const { dist, deck: deckPath, out, dryRun } = parseArgs(process.argv.slice(2))
  const rules = JSON.parse(readFileSync(resolvePath('design/rules.json'), 'utf8'))
  const thresholds = {
    conveyanceMin: rules.keyMessageConveyed.conveyanceMin,
    conveyanceReviewConfidence: rules.keyMessageConveyed.reviewConfidence,
    layoutReviewConfidence: rules.layoutFit.reviewConfidence,
  }

  const deck = toScorableDeck(parseDeck(await readFile(resolvePath(deckPath), 'utf8')), deckPath)
  const layouts = loadLayouts()
  const rendered = await extractSlideText(resolvePath(dist), chromium)

  // 枚数が食い違う Run では、位置で対応づけても別のスライドどうしを比べることになる。
  // 黙って続けず落とす。どの描画スライドがどの keyMessage に対応するかを当てる工程は
  // この検査の範囲外（#70 の非スコープ）。
  if (rendered.length !== deck.slides.length) {
    throw new Error(
      `契約は ${deck.slides.length} 枚だが、描画されたのは ${rendered.length} 枚。位置での対応づけが成り立たないので採点しない。`,
    )
  }

  const conveyanceRequest = buildConveyanceRequest(deck, rendered, layouts)
  const layoutRequest = buildLayoutRequest(deck, rendered, layouts)

  if (dryRun) {
    console.log(JSON.stringify({ conveyance: conveyanceRequest, layoutFit: layoutRequest }, null, 2))
    return
  }

  const [conveyance, layoutFit] = await Promise.all([callTypeSafe(conveyanceRequest), callTypeSafe(layoutRequest)])
  const slides = summarize(deck, rendered, conveyance.answers, layoutFit.answers, thresholds)
  const violations = slides.flatMap((slide) => slide.findings)

  const result = {
    generatedAt: new Date().toISOString(),
    dist,
    deck: deckPath,
    model: conveyance.model,
    thresholds,
    pass: violations.length === 0,
    slides,
  }

  if (out) {
    await writeFile(resolvePath(out), `${JSON.stringify(result, null, 2)}\n`)
  }

  for (const slide of slides) {
    console.log(
      `${slide.findings.length === 0 ? 'ok  ' : 'NG  '}スライド${slide.slideNumber} (${slide.declaredLayout}) ` +
        `伝達=${slide.conveyance.score.toFixed(2)}(確信 ${slide.conveyance.confidence.toFixed(2)}) ` +
        `レイアウト=${slide.layoutFit.choice}(確信 ${slide.layoutFit.confidence.toFixed(2)})` +
        `${slide.needsHumanReview ? ' [要確認]' : ''}`,
    )
    for (const finding of slide.findings) {
      console.log(`      ${finding.rule}: ${finding.detail}`)
    }
  }

  console.log(`\n${result.pass ? 'ok  ' : 'NG  '}content（${slides.length} 枚 / ${violations.length} 件）`)
  if (out) console.log(`→ ${out}`)

  if (!result.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
