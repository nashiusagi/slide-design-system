/**
 * manifest（生成タスクが必要とする deck / layout / component の一覧）から、
 * 正本の中で本当に必要な契約ファイルだけを解決する（DR-0013）。
 *
 *   node scripts/resolve-design-contract.mjs <manifest.json>
 *
 * 出力は解決済み契約（resources に path の一覧を持つ JSON）を標準出力へ書く。
 * ファイルの中身はここではなく Skill 側が読む。正本を Skill やこの JSON へ
 * 複製しないことが DR-0013 の核なので、resources は path だけを持ち、
 * 契約ファイルの中身を埋め込まない。
 *
 * manifest が参照する deck / layout / component が存在しない、または deck 契約
 * 自体が構文・スキーマを満たさないときはエラーで止める。曖昧なまま解決を続けると、
 * 存在しない契約を読んだつもりの AI が生成を進めてしまう。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import Ajv2020 from 'ajv/dist/2020.js'

import { parseDeck } from './lib/deck.mjs'

/** @param {string} relativePath */
const resolve = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url))

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/**
 * layout / component 契約のファイル名（拡張子抜き）。
 * scripts/validate-design.mjs の LAYOUT_NAMES / COMPONENT_NAMES と同じ一覧だが、
 * 契約を検証する側（design:check）と契約を解決する側（この Skill）は目的が違う
 * ため、ここでは複製として持つ。存在チェックは checkSchemas 側が既に担っている。
 */
const LAYOUT_NAMES = ['title', 'bullets', 'statement']
const COMPONENT_NAMES = ['slide-title', 'bullet-list', 'statement', 'emphasis']

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
 * @param {string} name
 * @returns {Resource}
 */
function layoutResource(name) {
  if (!LAYOUT_NAMES.includes(name)) {
    throw new Error(`Unknown layout reference: ${name}`)
  }

  return { id: `layout.${name}`, path: `design/layouts/${name}.json` }
}

/** @param {string} name */
function componentResource(name) {
  if (!COMPONENT_NAMES.includes(name)) {
    throw new Error(`Unknown component reference: ${name}`)
  }

  return { id: `component.${name}`, path: `design/components/${name}.json` }
}

/**
 * deck を解決する。存在しない deck 名、frontmatter を欠いた構文エラー、
 * スキーマ違反（未知の layout 等）のすべてをここでエラーにする。
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
 *   layoutsByName: Record<string, { slots: { component: string }[] }>,
 * }} catalog
 */
export function resolveManifest(manifest, { deckSources, deckSchema, layoutsByName }) {
  const decks = manifest.decks ?? []
  const requestedLayouts = manifest.layouts ?? []
  const requestedComponents = manifest.components ?? []

  if (decks.length === 0 && requestedLayouts.length === 0 && requestedComponents.length === 0) {
    throw new Error('少なくとも1つの deck / layout / component 参照が必要です')
  }

  /** @type {Map<string, Resource>} */
  const selected = new Map(BASE_RESOURCES.map((resource) => [resource.id, resource]))

  /** layout を選択し、その slots が要求する component も連れてくる。 */
  const addLayout = (/** @type {string} */ name) => {
    const resource = layoutResource(name)
    selected.set(resource.id, resource)

    const layout = layoutsByName[name]

    for (const slot of layout?.slots ?? []) {
      const componentRes = componentResource(slot.component)
      selected.set(componentRes.id, componentRes)
    }
  }

  for (const name of requestedLayouts) {
    addLayout(name)
  }

  for (const name of requestedComponents) {
    const resource = componentResource(name)
    selected.set(resource.id, resource)
  }

  for (const name of decks) {
    const { resource, layoutNames } = resolveDeck(name, deckSources, deckSchema)
    selected.set(resource.id, resource)

    for (const layoutName of layoutNames) {
      addLayout(layoutName)
    }
  }

  return {
    version: '1.0.0',
    requested: { decks, layouts: requestedLayouts, components: requestedComponents },
    resources: [...selected.values()],
  }
}

/** @param {string} manifestPath 呼び出し元からの相対、または絶対パス */
export function resolveManifestFile(manifestPath) {
  const manifest = /** @type {Manifest} */ (JSON.parse(readFileSync(manifestPath, 'utf8')))

  const deckSchema = readJson('design/schemas/deck.schema.json')
  const layoutsByName = Object.fromEntries(
    LAYOUT_NAMES.map((name) => [name, readJson(`design/layouts/${name}.json`)]),
  )

  /** @type {Record<string, string>} */
  const deckSources = {}
  for (const name of manifest.decks ?? []) {
    try {
      deckSources[name] = readFileSync(resolve(`design/decks/${name}.md`), 'utf8')
    } catch {
      // 存在しない deck はここでは読めないだけにし、resolveManifest 側の
      // 「Unknown deck reference」で一本化してエラーメッセージを揃える。
    }
  }

  return resolveManifest(manifest, { deckSources, deckSchema, layoutsByName })
}

function main() {
  const manifestPath = process.argv[2]

  if (manifestPath === undefined) {
    console.error('Usage: node scripts/resolve-design-contract.mjs <manifest.json>')
    process.exitCode = 1
    return
  }

  try {
    console.log(JSON.stringify(resolveManifestFile(manifestPath), null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

// テストから読み込むときは走らせない。process.exit と標準出力を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
