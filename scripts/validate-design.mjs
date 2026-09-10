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
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

import slidePlugin from '../packages/eslint-plugin-slide/src/index.mjs'
import { contrastRatio, isInSrgbGamut } from './lib/color.mjs'
import { parseDeck } from './lib/deck.mjs'
import { IMPLEMENTED_MEASURE_RULE_IDS } from './lib/measure-rules.mjs'
import { resolveManifestFile } from './resolve-design-contract.mjs'

/** @param {string} relativePath */
const resolve = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url))

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/**
 * layout / component 契約のファイル名（拡張子抜き）。ここが名前の唯一の一覧で、
 * 読み込む対象・スキーマ検証の対象のどちらもここから導く。契約を足したらここへ
 * 足すだけでよく、ファイルの列挙を CONTRACTS 側へ複製しない（DR-0035）。
 *
 * ただし design/schemas/layout.schema.json・component.schema.json・deck.schema.json
 * の name / allowedIn / slots.component / slides.items.layout の enum は JSON Schema
 * の静的な列挙なので、ここと独立に更新が要る。増減させたときは3つのスキーマすべてを
 * 合わせて直すこと。
 */
const LAYOUT_NAMES = ['title', 'bullets', 'statement']
const COMPONENT_NAMES = ['slide-title', 'bullet-list', 'statement', 'emphasis']

/** 契約ファイルと、それを検証するスキーマの対応。契約を足したらここへ足す。 */
const CONTRACTS = [
  { data: 'design/tokens.json', schema: 'design/schemas/tokens.schema.json' },
  { data: 'design/rules.json', schema: 'design/schemas/rules.schema.json' },
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
 * 閾値は design/rules.json の contrast を正本とする（DR-0008 / DR-0011 / DR-0033）。
 * ファイルの読み込みは main() に寄せ、ここは引数だけで完結する純関数にする。
 *
 * @param {Record<string, string>} colors
 * @param {{ surfaces: string[], requirements: { role: string, foregrounds: string[], minimum: number }[] }} contrast design/rules.json の contrast
 * @returns {string[]}
 */
export function checkContrast(colors, contrast) {
  return [...checkEveryColorHasRole(colors, contrast), ...checkRatios(colors, contrast)]
}

/**
 * どの色にも役割が割り当てられているか。
 *
 * 前景の一覧は design/rules.json の contrast.requirements に手で並べているので、
 * 色を足して書き忘れると、その色だけ無検査のまま緑で通る。背景側は
 * contrast.surfaces との総当たりで塞がっているが、前景側は列挙のままなので、
 * 未分類そのものを検査して塞ぐ。
 *
 * @param {Record<string, string>} colors
 * @param {{ surfaces: string[], requirements: { foregrounds: string[] }[] }} contrast
 * @returns {string[]}
 */
function checkEveryColorHasRole(colors, contrast) {
  const assigned = new Set([
    ...contrast.surfaces,
    ...contrast.requirements.flatMap(({ foregrounds }) => foregrounds),
  ])

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
 * @param {{ surfaces: string[], requirements: { role: string, foregrounds: string[], minimum: number }[] }} contrast
 * @returns {string[]}
 */
function checkRatios(colors, contrast) {
  return contrast.requirements.flatMap(({ role, foregrounds, minimum }) =>
    foregrounds.flatMap((foreground) =>
      contrast.surfaces
        .filter((background) => background !== foreground)
        .flatMap((background) => {
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
 * design/rules.json の method: "lint" のルールIDと、packages/eslint-plugin-slide が
 * 実装するルールIDが1対1で対応しているか（DR-0011 帰結）。
 *
 * 片方向だけでは足りない。rules.json 側だけ見ると、実装だけあって契約に無い
 * ルール（正規の検査経路から外れた独自ルール）を見逃す。実装側だけ見ると、
 * 契約にあるのに実装を忘れたルールが「全ルール pass」のまま素通りする。
 *
 * @param {{ id: string, method: string }[]} rules design/rules.json の rules
 * @param {string[]} implementedRuleIds packages/eslint-plugin-slide が export するルールID
 * @returns {string[]}
 */
export function checkLintRuleCoverage(rules, implementedRuleIds) {
  const declared = new Set(rules.filter((rule) => rule.method === 'lint').map((rule) => rule.id))
  const implemented = new Set(implementedRuleIds)

  const missing = [...declared]
    .filter((id) => !implemented.has(id))
    .map((id) => `packages/eslint-plugin-slide: design/rules.json の lint ルール '${id}' が実装されていない`)

  const extra = [...implemented]
    .filter((id) => !declared.has(id))
    .map(
      (id) =>
        `packages/eslint-plugin-slide: ルール '${id}' を実装しているが、design/rules.json に method: "lint" として無い`,
    )

  return [...missing, ...extra]
}

/**
 * design/rules.json の method: "measure" のルールIDと、scripts/measure-slides.mjs が
 * 実装するルールIDが1対1で対応しているか（DR-0011 帰結）。lint 側の
 * `checkLintRuleCoverage` と同じ理由でこの検査が要る。
 *
 * lint 側と違い、`knownUnimplementedRuleIds` に列挙したIDは「未実装」を許容する。
 * `deck-body-fidelity` は宣言だけがあり実装が別 Issue に残っているため（design/rules.json
 * の該当ルールの description を参照）、これを missing として扱うと対応検査そのものが
 * 常に赤くなり、実際に実装済みの3ルール（no-overflow / min-font-size / contrast）が
 * 対応しているかどうかを、この検査からは読めなくなる。
 *
 * @param {{ id: string, method: string }[]} rules design/rules.json の rules
 * @param {string[]} implementedRuleIds scripts/measure-slides.mjs が実装するルールID
 * @param {string[]} knownUnimplementedRuleIds 未実装であることが分かっているルールID
 * @returns {string[]}
 */
export function checkMeasureRuleCoverage(rules, implementedRuleIds, knownUnimplementedRuleIds) {
  const declared = new Set(rules.filter((rule) => rule.method === 'measure').map((rule) => rule.id))
  const implemented = new Set(implementedRuleIds)
  const knownUnimplemented = new Set(knownUnimplementedRuleIds)

  const missing = [...declared]
    .filter((id) => !implemented.has(id) && !knownUnimplemented.has(id))
    .map((id) => `scripts/measure-slides.mjs: design/rules.json の measure ルール '${id}' が実装されていない`)

  const extra = [...implemented]
    .filter((id) => !declared.has(id))
    .map(
      (id) =>
        `scripts/measure-slides.mjs: ルール '${id}' を実装しているが、design/rules.json に method: "measure" として無い`,
    )

  const staleKnownUnimplemented = [...knownUnimplemented]
    .filter((id) => implemented.has(id))
    .map(
      (id) =>
        `scripts/validate-design.mjs: '${id}' は knownUnimplementedRuleIds にあるが、既に scripts/measure-slides.mjs で実装されている。許容リストから外すこと`,
    )

  return [...missing, ...extra, ...staleKnownUnimplemented]
}

/**
 * 引数の中のクラス名が、その要素自身を選択対象にしない疑似クラス。
 *
 * :not(.x) は「.x を持つ要素を除外する」条件であり、引数の .x そのものを
 * 選択・スタイリングしているわけではない。:has(.x) も同様に、実際に選択・
 * スタイリングされるのは外側の要素であって引数の .x ではない。
 *
 * 一方 :where(.x) / :is(.x) は、引数の要素そのものを選択する（詳細度が
 * 変わるだけ）。:where(.x) { color: red } は .x を実際に赤くする。ここに
 * 含めると、:where() / :is() で書かれた実装を「実装していない」と誤判定する。
 */
const NON_TARGETING_PSEUDO_CLASSES = new Set([':not', ':has'])

/**
 * セレクタ文字列が実際に対象とするクラス名の集合を返す（DR-0041）。
 *
 * NON_TARGETING_PSEUDO_CLASSES に挙げた疑似クラスの引数の中に現れるクラス名は
 * 除く。除かないと、:not(.slide--x) {} のような実際には何もスタイリングしない
 * ルールを書くだけで「実装済み」と誤判定できてしまう。
 *
 * コメント内の文字列・属性セレクタの値・宣言ブロックの中身は、CSS の構文木
 * 自体がセレクタの外に置くため、ここへは渡らない。
 *
 * @param {string} selector
 * @returns {Set<string>}
 */
function classesTargetedBySelector(selector) {
  const classes = new Set()

  selectorParser((selectors) => {
    selectors.walkClasses((classNode) => {
      let ancestor = classNode.parent
      let insideNonTargetingPseudoArgument = false

      while (ancestor !== undefined && ancestor !== null) {
        if (ancestor.type === 'pseudo' && NON_TARGETING_PSEUDO_CLASSES.has(ancestor.value.toLowerCase())) {
          insideNonTargetingPseudoArgument = true
          break
        }

        ancestor = ancestor.parent
      }

      if (!insideNonTargetingPseudoArgument) {
        classes.add(classNode.value)
      }
    })
  }).processSync(selector)

  return classes
}

/**
 * design/layout.css が、レイアウト契約の classes をちょうど実装しているか
 * （DR-0018 / DR-0030）。過不足どちらも検査する。契約に無いクラスが実装に
 * 残っていると、使われなくなったレイアウトの実装が残り続けても気付けない。
 *
 * CSS は postcss で構文木にパースしてから読む（DR-0041）。正規表現で
 * 「セレクタらしき部分」を判定する以前の実装は、コメント内の文字列・属性
 * セレクタの引用符付き値・疑似クラス引数・属性値内の `]` の4種で、実装して
 * いないクラスを実装済みと誤判定する不具合を繰り返した（PR #21 のレビュー
 * 参照）。正式な構文木を使えば、これらは元々セレクタの外か疑似クラス引数の
 * 中にしか現れないため、個別の抜け道潰しが要らなくなる。
 *
 * 構文解析自体が失敗した場合は例外を投げず、他の検査（checks の残り）が
 * 続けられるよう問題文字列として返す。checkDecks が構文エラーを扱う形と揃える。
 *
 * @param {{ name: string, classes: string[] }[]} layouts
 * @param {string} cssSource design/layout.css の中身
 * @returns {string[]}
 */
export function checkLayoutClasses(layouts, cssSource) {
  const declared = new Set(layouts.flatMap((layout) => layout.classes))
  const implemented = new Set()

  try {
    postcss.parse(cssSource).walkRules((rule) => {
      for (const className of classesTargetedBySelector(rule.selector)) {
        implemented.add(className)
      }
    })
  } catch (error) {
    return [`design/layout.css: CSS として解析できない: ${/** @type {Error} */ (error).message}`]
  }

  const missing = [...declared]
    .filter((name) => !implemented.has(name))
    .map((name) => `design/layout.css: レイアウト契約の classes にある .${name} を実装していない`)

  const extra = [...implemented]
    .filter((name) => name.startsWith('slide--') && !declared.has(name))
    .map((name) => `design/layout.css: .${name} を実装しているが、design/layouts/ のどの契約にも無い`)

  return [...missing, ...extra]
}

/**
 * 連続する空白（改行を含む）を1つに畳み、書式文字（Unicode の Cf カテゴリ。
 * ゼロ幅スペース等）を取り除く。Markdown の折り返しで複製の途中に改行が挟まる、
 * あるいはコピー時に不可視文字が混入するだけで完全一致判定をすり抜けるのを
 * 防ぐ（DR-0013）。
 */
const normalizeWhitespace = (/** @type {string} */ text) =>
  text.replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').trim()

/**
 * DESIGN.md を、複製の検出対象になりうる程度に長い行へ分ける。見出し記号・
 * 箇条書き記号は複製の本質ではないため取り除く。短い行（20文字未満）は
 * 「1280x720」のような一般的な表現と衝突しやすいため対象にしない。
 *
 * @param {string} designMdSource
 * @returns {string[]}
 */
function significantLinesOf(designMdSource) {
  return designMdSource
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length >= 20)
}

/**
 * skills/slide-harness/SKILL.md に設計データそのものが複製されていないか（DR-0013）。
 *
 * Skill は契約を参照するだけで、値や記述を埋め込んではならない。複製が起きると、
 * 正本を直しても Skill 側が古いままになり、AI が読む内容が正本とずれる。
 *
 * 埋め込みを検出できる高信号な値だけを見る。color は oklch(...) の文字列そのもの、
 * layout / component は role・whenToUse・whenNotToUse・usage の文章そのもの、
 * rules は各ルールの description そのもの、DESIGN.md は20文字以上の行そのもの。
 * space や max のような小さい数値は「3」のような一般的な語と衝突するため対象に
 * しない（この絞り込みの理由は DR-0013 の帰結にも記録する）。
 *
 * @param {string} skillSource skills/slide-harness/SKILL.md の中身
 * @param {{
 *   tokens: { color: Record<string, string> },
 *   layouts: { name: string, role: string, whenToUse: string[], whenNotToUse: string[] }[],
 *   components: { name: string, role: string, usage: string[] }[],
 *   rules: { rules: { id: string, description: string }[] },
 *   designMd: string,
 * }} contract
 * @returns {string[]}
 */
export function checkSkillNoDesignDataDuplication(skillSource, { tokens, layouts, components, rules, designMd }) {
  const normalizedSkillSource = normalizeWhitespace(skillSource)
  const isDuplicated = (/** @type {string} */ text) => normalizedSkillSource.includes(normalizeWhitespace(text))

  const colorProblems = Object.entries(tokens.color)
    .filter(([name]) => !name.startsWith('$'))
    .filter(([, value]) => isDuplicated(value))
    .map(([name, value]) => `skills/slide-harness/SKILL.md: design/tokens.json の color.${name}（${value}）がそのまま書かれている`)

  const layoutProblems = layouts.flatMap((layout) =>
    [layout.role, ...layout.whenToUse, ...layout.whenNotToUse]
      .filter((text) => isDuplicated(text))
      .map(
        (text) =>
          `skills/slide-harness/SKILL.md: design/layouts/${layout.name}.json の記述がそのまま書かれている: "${text}"`,
      ),
  )

  const componentProblems = components.flatMap((component) =>
    [component.role, ...component.usage]
      .filter((text) => isDuplicated(text))
      .map(
        (text) =>
          `skills/slide-harness/SKILL.md: design/components/${component.name}.json の記述がそのまま書かれている: "${text}"`,
      ),
  )

  const ruleProblems = rules.rules
    .filter((rule) => isDuplicated(rule.description))
    .map((rule) => `skills/slide-harness/SKILL.md: design/rules.json のルール '${rule.id}' の description がそのまま書かれている`)

  const designMdProblems = significantLinesOf(designMd)
    .filter((line) => isDuplicated(line))
    .map((line) => `skills/slide-harness/SKILL.md: DESIGN.md の記述がそのまま書かれている: "${line}"`)

  return [...colorProblems, ...layoutProblems, ...componentProblems, ...ruleProblems, ...designMdProblems]
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

/**
 * scripts/resolve-design-contract.mjs（#9）が design/ の実データに対して実際に
 * 動くかを固定する。resolveManifestFile は import.meta.url からの相対パス解決に
 * URL を使っており、vitest（jsdom 環境、checkDecks の説明を参照）の下では壊れるため
 * vitest では検証できない。ここで実データに対して呼び、pnpm check（design:check、
 * 素の node 実行）経由で固定する。
 *
 * 正常系・存在しない deck 参照に加え、deck 名に `../` を含めても
 * design/decks/ の外を読まないこと（パストラバーサル対策）も実データに対して
 * 固定する。この防御自体が壊れても resolveManifest 側の単体テスト（手書きの
 * fixture のみを対象）は検知できないため、ここでの確認が唯一の回帰検査になる。
 *
 * @returns {string[]}
 */
function checkResolveDesignContractSmoke() {
  const dir = mkdtempSync(join(tmpdir(), 'validate-design-resolve-smoke-'))

  try {
    const manifestPath = join(dir, 'manifest.json')

    writeFileSync(manifestPath, JSON.stringify({ decks: ['harness-intro'] }))

    /** @type {{ resources: { id: string }[] }} */
    let resolved

    try {
      resolved = resolveManifestFile(manifestPath)
    } catch (error) {
      return [
        `scripts/resolve-design-contract.mjs: 実在する deck 'harness-intro' を解決できない: ${/** @type {Error} */ (error).message}`,
      ]
    }

    const resolvedIds = new Set(resolved.resources.map((resource) => resource.id))
    const expectedIds = ['design.md', 'tokens', 'rules', 'theme.css', 'layout.css', 'deck.harness-intro']
    const missingIds = expectedIds.filter((id) => !resolvedIds.has(id))

    if (missingIds.length > 0) {
      return [
        `scripts/resolve-design-contract.mjs: 'harness-intro' の解決結果に ${missingIds.join(', ')} が無い`,
      ]
    }

    writeFileSync(manifestPath, JSON.stringify({ decks: ['no-such-deck'] }))

    try {
      resolveManifestFile(manifestPath)
      return ["scripts/resolve-design-contract.mjs: 存在しない deck 参照（'no-such-deck'）がエラーにならない"]
    } catch {
      // 期待どおり。次のパストラバーサル確認へ進む。
    }

    // deck 名に `../` を含めても design/decks/ の外を読まないこと（回帰防止）。
    writeFileSync(manifestPath, JSON.stringify({ decks: ['../../../../../../etc/passwd'] }))

    try {
      resolveManifestFile(manifestPath)
      return [
        "scripts/resolve-design-contract.mjs: deck 参照に '../' を含めても design/decks/ の外を読まずにエラーにする、という保証が壊れている",
      ]
    } catch {
      return []
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const tokens = readJson('design/tokens.json')
  const rules = readJson('design/rules.json')
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
      name: 'deck 契約が構文・JSON Schema を満たす',
      run: () => checkDecks(decks, readJson('design/schemas/deck.schema.json')),
    },
    { name: '色が sRGB 色域に収まる', run: () => checkGamut(tokens.color) },
    { name: 'コントラストが水準を満たす', run: () => checkContrast(tokens.color, rules.contrast) },
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
    {
      name: 'design/rules.json の lint ルールと eslint-plugin-slide の実装が対応する',
      run: () => checkLintRuleCoverage(rules.rules, Object.keys(slidePlugin.rules)),
    },
    {
      name: 'design/rules.json の measure ルールと measure-slides.mjs の実装が対応する',
      run: () => checkMeasureRuleCoverage(rules.rules, IMPLEMENTED_MEASURE_RULE_IDS, ['deck-body-fidelity']),
    },
    {
      name: 'skills/slide-harness/SKILL.md に設計データが複製されていない',
      run: () =>
        checkSkillNoDesignDataDuplication(readFileSync(resolve('skills/slide-harness/SKILL.md'), 'utf8'), {
          tokens,
          layouts,
          components,
          rules,
          designMd: readFileSync(resolve('DESIGN.md'), 'utf8'),
        }),
    },
    {
      name: 'resolve-design-contract.mjs が design/ の実データを解決できる',
      run: () => checkResolveDesignContractSmoke(),
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
