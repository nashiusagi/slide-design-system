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
 * 今は tokens / layouts / components / decks がある。rules は後続の Issue で入る。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'

import { contrastRatio, isInSrgbGamut } from './lib/color.mjs'
import { parseDeck } from './lib/deck.mjs'

/** @param {string} relativePath */
const resolve = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url))

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/**
 * layout / component 契約のファイル名（拡張子抜き）。ここが名前の唯一の一覧で、
 * 読み込む対象・スキーマ検証の対象のどちらもここから導く。契約を足したらここへ
 * 足すだけでよく、ファイルの列挙を CONTRACTS 側へ複製しない（DR-0035）。
 *
 * ただし design/schemas/layout.schema.json と component.schema.json の name /
 * allowedIn / slots.component の enum は JSON Schema の静的な列挙なので、ここと
 * 独立に更新が要る。増減させたときは両方のスキーマも合わせて直すこと。
 */
const LAYOUT_NAMES = ['title', 'bullets', 'statement']
const COMPONENT_NAMES = ['slide-title', 'bullet-list', 'statement', 'emphasis']

/** 契約ファイルと、それを検証するスキーマの対応。契約を足したらここへ足す。 */
const CONTRACTS = [
  { data: 'design/tokens.json', schema: 'design/schemas/tokens.schema.json' },
  ...LAYOUT_NAMES.map((name) => ({
    data: `design/layouts/${name}.json`,
    schema: 'design/schemas/layout.schema.json',
  })),
  ...COMPONENT_NAMES.map((name) => ({
    data: `design/components/${name}.json`,
    schema: 'design/schemas/component.schema.json',
  })),
]

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
 * 複数の契約ファイルが同じスキーマ（layout / component）を共有するため、
 * スキーマパスごとに一度だけ compile する。同じ $id を持つスキーマを ajv に
 * 二度 compile させると衝突で例外になる。
 *
 * @returns {string[]}
 */
function checkSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  /** @type {Map<string, import('ajv').ValidateFunction>} */
  const validators = new Map()

  /** @param {string} schemaPath */
  const validatorFor = (schemaPath) => {
    const cached = validators.get(schemaPath)

    if (cached !== undefined) {
      return cached
    }

    const compiled = ajv.compile(readJson(schemaPath))
    validators.set(schemaPath, compiled)

    return compiled
  }

  return CONTRACTS.flatMap(({ data, schema }) => {
    const validate = validatorFor(schema)

    if (validate(readJson(data))) {
      return []
    }

    return (validate.errors ?? []).map(
      (error) => `${data}: ${error.instancePath || '/'} ${error.message}`,
    )
  })
}

/**
 * design/decks/*.md が deck 契約として成立しているか（DR-0016 / DR-0017）。
 *
 * パース自体の構文エラー（frontmatter が無い等）と、正規化後の JSON Schema
 * 違反（keyMessage が無い、layout が契約外 等）の両方をここで捕まえる。
 *
 * スキーマはファイルパスではなく読み込み済みの値で受け取る。ファイルの読み込みは
 * main() に寄せ、ここは引数だけで完結する純関数にする（DR-0032の帰結）。
 *
 * @param {{ path: string, source: string }[]} decks
 * @param {object} deckSchema design/schemas/deck.schema.json の中身
 * @returns {string[]}
 */
export function checkDecks(decks, deckSchema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(deckSchema)

  return decks.flatMap(({ path, source }) => {
    /** @type {ReturnType<typeof parseDeck>} */
    let normalized

    try {
      normalized = parseDeck(source)
    } catch (error) {
      return [`${path}: ${/** @type {Error} */ (error).message}`]
    }

    if (validate(normalized)) {
      return []
    }

    return (validate.errors ?? []).map((error) => `${path}: ${error.instancePath || '/'} ${error.message}`)
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
 * design/layout.css が、レイアウト契約の classes をちょうど実装しているか
 * （DR-0018 / DR-0030）。過不足どちらも検査する。契約に無いクラスが実装に
 * 残っていると、使われなくなったレイアウトの実装が残り続けても気付けない。
 *
 * CSS を正式にパースせず正規表現で読むのは、キャンバス寸法の検査（下記）と同じ
 * 理由による。3 レイアウト分の小さな契約に対して別途パーサを持ち込まない。
 *
 * @param {{ name: string, classes: string[] }[]} layouts
 * @param {string} cssSource design/layout.css の中身
 * @returns {string[]}
 */
export function checkLayoutClasses(layouts, cssSource) {
  const withoutComments = cssSource.replace(/\/\*[\s\S]*?\*\//g, '')
  const declared = new Set(layouts.flatMap((layout) => layout.classes))

  // クラス名は「次の { の直前までの部分（セレクタ）」からだけ拾う。宣言ブロックの
  // 中（例: カスタムプロパティの値に書かれた文字列）まで拾うと、実装していない
  // クラスを値としてだけ書いても「実装済み」と誤判定できてしまう。
  //
  // セレクタの中でも、属性セレクタの引用符付き値（例: [data-x=".slide--x"]）は
  // 除いてから拾う。除かないと、実際にはスタイリングしていない空ルールの
  // 属性値へクラス名らしき文字列を書くだけで「実装済み」と誤判定できてしまう。
  const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)].map((match) =>
    match[1].replace(/\[[^\]]*\]/g, ''),
  )
  const implemented = new Set(
    selectors.flatMap((selector) => [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1])),
  )

  const missing = [...declared]
    .filter((name) => !implemented.has(name))
    .map((name) => `design/layout.css: レイアウト契約の classes にある .${name} を実装していない`)

  const extra = [...implemented]
    .filter((name) => name.startsWith('slide--') && !declared.has(name))
    .map((name) => `design/layout.css: .${name} を実装しているが、design/layouts/ のどの契約にも無い`)

  return [...missing, ...extra]
}

/**
 * layout の slots と component の allowedIn が、両方向から見て矛盾していないか。
 * どちらの契約にも同じ対応関係を書いているため、片方だけ直すと矛盾したまま残る
 * （DR-0035）。
 *
 * 片方向（slots → allowedIn）だけでは、「実際には使われていない layout を
 * allowedIn に書いてしまう」誤りを検出できない。allowedIn 側の一覧を signature
 * として信じる読み手（AI や将来の component-approved 相当のルール）がいる以上、
 * 逆方向（allowedIn → slots）も見る必要がある。
 *
 * @param {{ name: string, slots: { component: string }[] }[]} layouts
 * @param {{ name: string, allowedIn: string[] }[]} components
 * @returns {string[]}
 */
export function checkLayoutComponentConsistency(layouts, components) {
  const layoutsByName = new Map(layouts.map((layout) => [layout.name, layout]))
  const componentsByName = new Map(components.map((component) => [component.name, component]))

  const fromSlots = layouts.flatMap((layout) =>
    layout.slots.flatMap(({ component: componentName }) => {
      const component = componentsByName.get(componentName)

      if (component === undefined) {
        return [
          `design/layouts/${layout.name}.json: slots が参照する component '${componentName}' の契約が無い`,
        ]
      }

      if (!component.allowedIn.includes(layout.name)) {
        return [
          `design/components/${componentName}.json: allowedIn に '${layout.name}' が無いが、design/layouts/${layout.name}.json の slots から使われている`,
        ]
      }

      return []
    }),
  )

  const fromAllowedIn = components.flatMap((component) =>
    component.allowedIn.flatMap((layoutName) => {
      const layout = layoutsByName.get(layoutName)

      if (layout === undefined) {
        return [
          `design/components/${component.name}.json: allowedIn が参照する layout '${layoutName}' の契約が無い`,
        ]
      }

      if (!layout.slots.some((slot) => slot.component === component.name)) {
        return [
          `design/components/${component.name}.json: allowedIn に '${layoutName}' があるが、design/layouts/${layoutName}.json の slots に '${component.name}' が無い`,
        ]
      }

      return []
    }),
  )

  return [...fromSlots, ...fromAllowedIn]
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
  const layouts = LAYOUT_NAMES.map((name) => readJson(`design/layouts/${name}.json`))
  const components = COMPONENT_NAMES.map((name) => readJson(`design/components/${name}.json`))
  const layoutCss = readFileSync(resolve('design/layout.css'), 'utf8')
  const decks = readdirSync(resolve('design/decks'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({
      path: `design/decks/${name}`,
      source: readFileSync(resolve(`design/decks/${name}`), 'utf8'),
    }))

  const checks = [
    { name: '契約が JSON Schema を満たす', run: () => checkSchemas() },
    {
      name: 'deck 契約が構文・Schema を満たす',
      run: () => checkDecks(decks, readJson('design/schemas/deck.schema.json')),
    },
    { name: '色が sRGB 色域に収まる', run: () => checkGamut(tokens.color) },
    { name: 'コントラストが水準を満たす', run: () => checkContrast(tokens.color) },
    {
      name: 'キャンバス寸法がランタイムと一致する',
      run: () => checkCanvasMatchesRuntime(canvasSource, tokens.canvas),
    },
    {
      name: 'layout.css がレイアウト契約の classes をちょうど実装する',
      run: () => checkLayoutClasses(layouts, layoutCss),
    },
    {
      name: 'layout と component の対応が矛盾していない',
      run: () => checkLayoutComponentConsistency(layouts, components),
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
