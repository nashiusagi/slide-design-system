/**
 * manifest（生成タスクが必要とする deck / layout / component の一覧）から、
 * 正本の中で本当に必要な契約ファイルだけを解決する（DR-0013）。
 *
 *   node scripts/resolve-design-contract.mjs <manifest.json>
 *
 * 解決結果は `HARNESS_RESOLVED.json`（実行時のカレントディレクトリ）へ書き出す
 * （Issue #9）。中身は resources に path の一覧を持つだけの JSON で、契約ファイルの
 * 中身は埋め込まない。正本を Skill やこの JSON へ複製しないことが DR-0013 の核であり、
 * ファイルの中身はここではなく Skill 側が実際のパスを読んで参照する。
 *
 * manifest が参照する deck / layout / component が存在しない、または deck 契約
 * 自体が構文・スキーマを満たさないときはエラーで止める。曖昧なまま解決を続けると、
 * 存在しない契約を読んだつもりの AI が生成を進めてしまう。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'

import { parseDeck } from './lib/deck.mjs'

/** @param {string} relativePath */
const resolve = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url))

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/** どの manifest でも常に読む、experiment に依存しない契約。 */
const BASE_RESOURCES = [
  { id: 'design.md', path: 'DESIGN.md' },
  { id: 'tokens', path: 'design/tokens.json' },
  { id: 'rules', path: 'design/rules.json' },
  { id: 'theme.css', path: 'design/theme.css' },
  { id: 'layout.css', path: 'design/layout.css' },
]

/**
 * @typedef {{ decks?: string[], layouts?: string[], components?: string[] }} Manifest
 * @typedef {{ id: string, path: string }} Resource
 */

/**
 * manifest のフィールドが「文字列の配列」であることを確かめる。配列でない値
 * （例: 単一の文字列）を渡すと、後続の for..of が文字列を1文字ずつ deck / layout /
 * component 名として反復してしまい、"Unknown layout reference: s" のような誤った
 * 原因のエラーになる。ここで先に弾き、原因をそのまま伝える。
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string[]}
 */
function assertStringArray(value, fieldName) {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`manifest の '${fieldName}' は文字列の配列である必要があります`)
  }

  return value
}

/**
 * @param {string} name
 * @param {Set<string>} knownNames design/layouts/ に実在するファイル名（拡張子抜き）
 * @returns {Resource}
 */
function layoutResource(name, knownNames) {
  if (!knownNames.has(name)) {
    throw new Error(`Unknown layout reference: ${name}`)
  }

  return { id: `layout.${name}`, path: `design/layouts/${name}.json` }
}

/**
 * @param {string} name
 * @param {Set<string>} knownNames design/components/ に実在するファイル名（拡張子抜き）
 */
function componentResource(name, knownNames) {
  if (!knownNames.has(name)) {
    throw new Error(`Unknown component reference: ${name}`)
  }

  return { id: `component.${name}`, path: `design/components/${name}.json` }
}

/**
 * deck を解決する。存在しない deck 名、frontmatter を欠いた構文エラー、
 * スキーマ違反（未知の layout 等）のすべてをここでエラーにする。
 *
 * `deckSources` は呼び出し側が design/decks/ の実在ファイルからのみ組み立てる
 * （resolveManifestFile を参照）。ここでは名前からファイルパスを組み立てて読む
 * ことをしない。deck 名をそのままパスへ埋め込むと、`../` を含む名前で
 * design/decks/ の外にある任意のファイルを deck として読み込めてしまう。
 *
 * layout を明示的な slots 経由で辿るのではなく、deck の各スライドが宣言する
 * layout をそのまま資源として要求する。deck 契約が「実際に使う layout」を
 * 過不足なく述べているので、slots を再度読んで導出する必要が無い。
 *
 * @param {string} name
 * @param {Record<string, string>} deckSources deck 名 → design/decks/<name>.md の中身
 * @param {object} deckSchema design/schemas/deck.schema.json の中身
 * @returns {{ resource: Resource, layoutNames: string[] }}
 */
function resolveDeck(name, deckSources, deckSchema) {
  const source = deckSources[name]

  if (source === undefined) {
    throw new Error(`Unknown deck reference: ${name}`)
  }

  /** @type {ReturnType<typeof parseDeck>} */
  let normalized

  try {
    normalized = parseDeck(source)
  } catch (error) {
    throw new Error(`design/decks/${name}.md: ${/** @type {Error} */ (error).message}`, { cause: error })
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(deckSchema)

  if (!validate(normalized)) {
    const messages = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`)
    throw new Error(`design/decks/${name}.md がdeck契約を満たさない: ${messages.join('; ')}`)
  }

  const layoutNames = [
    ...new Set(/** @type {{ slides: { layout: string }[] }} */ (normalized).slides.map((slide) => slide.layout)),
  ]

  return { resource: { id: `deck.${name}`, path: `design/decks/${name}.md` }, layoutNames }
}

/**
 * manifest が要求する契約だけを解決する。ファイル読み込みは main() に寄せ、
 * ここは引数だけで完結する純関数にする（DR-0032 の帰結と同じ考え方）。
 *
 * @param {Manifest} manifest
 * @param {{
 *   deckSources: Record<string, string>,
 *   deckSchema: object,
 *   layoutNames: string[],
 *   componentNames: string[],
 *   layoutsByName: Record<string, { slots: { component: string }[] }>,
 * }} catalog
 */
export function resolveManifest(manifest, { deckSources, deckSchema, layoutNames, componentNames, layoutsByName }) {
  const decks = assertStringArray(manifest.decks, 'decks')
  const requestedLayouts = assertStringArray(manifest.layouts, 'layouts')
  const requestedComponents = assertStringArray(manifest.components, 'components')

  if (decks.length === 0 && requestedLayouts.length === 0 && requestedComponents.length === 0) {
    throw new Error('少なくとも1つの deck / layout / component 参照が必要です')
  }

  const knownLayoutNames = new Set(layoutNames)
  const knownComponentNames = new Set(componentNames)

  /** @type {Map<string, Resource>} */
  const selected = new Map(BASE_RESOURCES.map((resource) => [resource.id, resource]))

  /** layout を選択し、その slots が要求する component も連れてくる。 */
  const addLayout = (/** @type {string} */ name) => {
    const resource = layoutResource(name, knownLayoutNames)
    selected.set(resource.id, resource)

    const layout = layoutsByName[name]

    for (const slot of layout?.slots ?? []) {
      const componentRes = componentResource(slot.component, knownComponentNames)
      selected.set(componentRes.id, componentRes)
    }
  }

  for (const name of requestedLayouts) {
    addLayout(name)
  }

  for (const name of requestedComponents) {
    const resource = componentResource(name, knownComponentNames)
    selected.set(resource.id, resource)
  }

  for (const name of decks) {
    const { resource, layoutNames: usedLayoutNames } = resolveDeck(name, deckSources, deckSchema)
    selected.set(resource.id, resource)

    for (const layoutName of usedLayoutNames) {
      addLayout(layoutName)
    }
  }

  return {
    version: '1.0.0',
    requested: { decks, layouts: requestedLayouts, components: requestedComponents },
    resources: [...selected.values()],
  }
}

/** @param {string} directory design/layouts や design/components への相対パス */
function jsonStemsOf(directory) {
  return readdirSync(resolve(directory))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
}

/**
 * manifest ファイルを読み、design/ の実在ファイルに対して解決する。
 *
 * layout / component の一覧はハードコードせず、design/layouts・design/components
 * ディレクトリの実際の一覧から導く。手書きの一覧を持つと、正本にファイルを
 * 足したときにここだけ更新を忘れ、実在する契約なのに解決できないという食い違いが
 * 起きる。deck も同様に、design/decks の実在ファイルからのみ `deckSources` を
 * 組み立てる。manifest が渡す deck 名を直接ファイルパスへ埋め込まないことで、
 * `../` を含む名前による design/decks/ の外への参照を構造的に防ぐ。
 *
 * @param {string} manifestPath 呼び出し元からの相対、または絶対パス
 */
export function resolveManifestFile(manifestPath) {
  const manifest = /** @type {Manifest} */ (JSON.parse(readFileSync(manifestPath, 'utf8')))

  const deckSchema = readJson('design/schemas/deck.schema.json')

  const layoutNames = jsonStemsOf('design/layouts')
  const componentNames = jsonStemsOf('design/components')
  const layoutsByName = Object.fromEntries(layoutNames.map((name) => [name, readJson(`design/layouts/${name}.json`)]))

  const deckSources = Object.fromEntries(
    readdirSync(resolve('design/decks'))
      .filter((file) => file.endsWith('.md'))
      .map((file) => [file.slice(0, -'.md'.length), readFileSync(resolve(`design/decks/${file}`), 'utf8')]),
  )

  return resolveManifest(manifest, { deckSources, deckSchema, layoutNames, componentNames, layoutsByName })
}

function main() {
  const manifestPath = process.argv[2]

  if (manifestPath === undefined) {
    console.error('Usage: node scripts/resolve-design-contract.mjs <manifest.json>')
    process.exitCode = 1
    return
  }

  try {
    const resolved = resolveManifestFile(manifestPath)
    writeFileSync('HARNESS_RESOLVED.json', `${JSON.stringify(resolved, null, 2)}\n`)
    console.log(`HARNESS_RESOLVED.json を書き出した（resources ${resolved.resources.length}件）。`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

// テストから読み込むときは走らせない。process.exit と副作用（ファイル書き出し）を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
