/**
 * 決定記録（DR）の参照・索引・冒頭欄の整合を検査する（DR-0054）。
 *
 *   node scripts/check-decisions.mjs
 *
 * 見るのは**参照が指す先が実在し、番号と一致しているか**であって、決定の中身では
 * ない。中身の是非は人が読む。実行口は pnpm check に一本化する（DR-0028）。
 *
 * この検査が捕まえるのは、レビューで繰り返し出た次の壊れ方だ。
 *
 * - `decisions/wrong-dr-citation` — 誤った DR 番号を根拠として引用した
 * - `decisions/citation-points-to-wrong-file` — 引用したファイル・節が実在しない
 * - `decisions/index-section-mismatch` — 索引の登録が内容と合わない
 * - `code/relative-link-wrong-depth` — 相対リンクの階層が合わず、実在しないパスを指す
 *
 * どれも「読めば分かるが、読まなければ緑のまま通る」形をしている。PR #60 では
 * 書式ファイルの DR リンク2本が1階層浅く、必須項目の根拠へ辿れない状態のまま
 * `pnpm check` が緑だった。
 *
 * **捕まえられないものも書いておく。** `decisions/consequence-not-followed`（帰結が
 * 手順へ反映されていない）は意味の問題で、ここでは扱わない。判断は DR-0054。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, normalize, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectFiles } from './lib/fs-walk.mjs'

/**
 * このファイルから見たリポジトリルート。`scripts/` から1階層上。
 * `check-canonical-duplication.mjs` と同じ求め方で、vitest から読み込んだときも
 * 同じ場所を指す。
 */
const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

/** DR が置かれる場所。索引もここにある。 */
const DECISIONS_DIR = 'docs/decisions'

/** 索引のファイル名。 */
const INDEX_FILE = 'README.md'

/**
 * 走査する場所。DR 参照は文書のどこにでも書かれるので、リポジトリ内の Markdown を
 * 広く見る。
 *
 * `docs/reviews/` は走査しない。レビュー記録は過去の指摘をそのまま引用するために
 * 古い番号・古いパスを含むのが正常で、かつ書き換えない履歴だからだ
 * （`check-canonical-duplication.mjs` が同じ理由で外しているのに揃える）。
 * `node_modules` / `dist` は生成物。
 */
export const SCAN_ROOTS = [
  { path: 'README.md', kind: 'file' },
  { path: 'DESIGN.md', kind: 'file' },
  { path: 'docs', kind: 'dir', exclude: ['docs/reviews/'] },
  { path: '.claude/skills', kind: 'dir', exclude: [] },
  { path: 'skills', kind: 'dir', exclude: [] },
  { path: 'scripts', kind: 'dir', exclude: [] },
  { path: 'packages', kind: 'dir', exclude: ['packages/**/node_modules/', 'packages/**/dist/'] },
]

/** `DR-0012` のような参照。番号は4桁に固定する。 */
const DR_REFERENCE = /DR-(\d{4})/g

/**
 * Markdown のリンク。`[表示テキスト](パス)` を拾う。パスに `)` は含めない
 * （このリポジトリのリンクはすべてその形で、括弧を含むパスは無い）。
 */
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g

/** 冒頭欄の行。`- **状態**: 承認済み` の形。 */
const FRONT_FIELD = /^- \*\*(状態|日付|関連|正本|実装)\*\*:\s*(.*)$/

/** 索引の行。`| [0024](./0024-decision-records-not-adr.md) | 決定記録は… |` の形。 */
const INDEX_ROW = /^\|\s*\[(\d{4})\]\(\.\/([^)]+)\)\s*\|/

/** すべての DR に必須の冒頭欄。 */
const REQUIRED_FIELDS = ['状態', '日付', '関連']

/** `**日付**: 2026-09-22` の形。 */
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/

/**
 * `**正本**:` 行に書いてよくないパス。DR が決めた規則をそのまま実装したコードを
 * 正本にすると、コードを書き換えた時点で DR ではなくコードが正しいことになり、
 * 実装が DR に従っているかを検査する足場が消える（`docs/decisions/README.md`
 * 「新しい決定を追加するとき」の3）。在り処を示したいときは `**実装**:` を使う。
 *
 * 判定は拡張子で行う。`.mjs` / `.ts` / `.tsx` / `.js` / `.jsx` は実装コードとみなす。
 */
const IMPLEMENTATION_EXTENSIONS = ['.mjs', '.ts', '.tsx', '.js', '.jsx']

/** @param {string} relativePath */
const resolve = (relativePath) => join(REPO_ROOT, relativePath)

/** @param {string} relativePath */
const read = (relativePath) => readFileSync(resolve(relativePath), 'utf8')

/**
 * コードブロックの中身を空行へ置き換える。書式サンプル（`docs/decisions/README.md`
 * の「新しい決定を追加するとき」や `references/*.md` のテンプレート）には、実在
 * しないパスや `<N>` のような穴埋めが例として書かれる。あれは参照ではない。
 *
 * 行数を保つため、中身は空行に置き換える（報告する行番号がずれない）。
 *
 * @param {string} source
 * @returns {string}
 */
export function stripCodeBlocks(source) {
  const lines = source.split('\n')
  let inFence = false

  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence
        return ''
      }

      return inFence ? '' : line.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length))
    })
    .join('\n')
}

/**
 * `docs/decisions/` にある DR を列挙する。索引（README.md）は DR ではない。
 *
 * @returns {{ number: string, file: string }[]}
 */
export function listDecisions() {
  return readdirSync(resolve(DECISIONS_DIR))
    .filter((name) => /^\d{4}-.+\.md$/.test(name))
    .sort()
    .map((name) => ({ number: name.slice(0, 4), file: `${DECISIONS_DIR}/${name}` }))
}

/**
 * 走査対象の Markdown を列挙する。
 *
 * @returns {string[]}
 */
export function listScannedFiles() {
  return SCAN_ROOTS.flatMap((root) => {
    if (root.kind === 'file') {
      return existsSync(resolve(root.path)) ? [root.path] : []
    }

    if (!existsSync(resolve(root.path))) {
      return []
    }

    return collectFiles(resolve(root.path))
      .filter((relativePath) => relativePath.endsWith('.md'))
      .map((relativePath) => `${root.path}/${relativePath}`)
      .filter((path) => !(root.exclude ?? []).some((prefix) => matchesExclude(path, prefix)))
  })
}

/**
 * 除外パターンに当てはまるか。`packages/**\/node_modules/` のような `**` を含む
 * 書き方も扱えるようにする。
 *
 * @param {string} path
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesExclude(path, pattern) {
  if (!pattern.includes('*')) {
    return path.startsWith(pattern)
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').split('**').join('.*')
  return new RegExp(`^${escaped}`).test(path)
}

/**
 * 走査対象のファイルを読み、パス → 内容の Map にする。
 *
 * 検査関数はこの Map を受け取る。**実ファイルシステムから切り離すためだ**——
 * そうしないと、壊れた入力に対して落ちることをテストできない。valid だけを見る
 * テストは、何も判定しない検査でも通る（`inspection/invalid-case-untested`）。
 *
 * @param {string[]} files
 * @returns {Map<string, string>}
 */
export function readSources(files) {
  return new Map(files.map((file) => [file, read(file)]))
}

/**
 * パスが実在するかの既定の判定。テストでは差し替える。
 *
 * @param {string} relativePath
 * @returns {boolean}
 */
export const defaultExists = (relativePath) => existsSync(resolve(relativePath))

/**
 * すべての `DR-NNNN` 参照が実在するかを検査する。
 *
 * @param {{ numbers: Set<string>, sources: Map<string, string> }} context
 * @returns {string[]}
 */
export function checkReferencesExist({ numbers, sources }) {
  /** @type {string[]} */
  const failures = []

  for (const [file, content] of sources) {
    const source = stripCodeBlocks(content)

    source.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(DR_REFERENCE)) {
        if (!numbers.has(match[1])) {
          failures.push(`${file}:${index + 1} — DR-${match[1]} は存在しない`)
        }
      }
    })
  }

  return failures
}

/**
 * DR へのリンクが、その番号のファイルを実際に指しているかを検査する。
 *
 * 見るのは2つ。リンク先が実在すること、そしてリンクテキストの `DR-NNNN` と
 * リンク先のファイル名の番号が一致すること。PR #60 で実害が出たのは前者で、
 * `../../../` と `../../../../` の取り違えが緑のまま通っていた。
 *
 * @param {{ sources: Map<string, string>, exists?: (path: string) => boolean }} context
 * @returns {string[]}
 */
export function checkLinksResolve({ sources, exists = defaultExists }) {
  /** @type {string[]} */
  const failures = []

  for (const [file, content] of sources) {
    const source = stripCodeBlocks(content)
    const baseDir = dirname(file)

    source.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(MARKDOWN_LINK)) {
        const [, text, target] = match

        if (!target.endsWith('.md') || /^[a-z]+:/.test(target) || target.startsWith('#')) {
          continue
        }

        const resolved = normalize(join(baseDir, target.split('#')[0]))

        if (!exists(resolved)) {
          failures.push(`${file}:${index + 1} — リンク先が実在しない: ${target}`)
          continue
        }

        const textNumber = text.match(/DR-(\d{4})/)?.[1]
        const targetNumber = resolved.match(/(\d{4})-[^/]+\.md$/)?.[1]

        if (textNumber && targetNumber && textNumber !== targetNumber) {
          failures.push(`${file}:${index + 1} — DR-${textNumber} と書いてリンク先は ${targetNumber}: ${target}`)
        }
      }
    })
  }

  return failures
}

/**
 * 索引が全 DR を漏れなく登録しているか、節の中が番号の昇順かを検査する。
 *
 * @param {{ decisions: { number: string, file: string }[], index?: string, exists?: (path: string) => boolean }} context
 * @returns {string[]}
 */
export function checkIndexCovers({ decisions, index, exists = defaultExists }) {
  /** @type {string[]} */
  const failures = []
  const indexPath = `${DECISIONS_DIR}/${INDEX_FILE}`
  const source = stripCodeBlocks(index ?? read(indexPath))

  /** @type {Map<string, string>} 索引に載っている番号 → リンク先 */
  const listed = new Map()
  /** @type {{ section: string, numbers: string[] }[]} */
  const sections = []
  /** @type {{ section: string, numbers: string[] } | undefined} */
  let current

  source.split('\n').forEach((line, index) => {
    const heading = line.match(/^###\s+(.+)$/)

    if (heading) {
      current = { section: heading[1], numbers: [] }
      sections.push(current)
      return
    }

    const row = line.match(INDEX_ROW)

    if (!row) {
      return
    }

    const [, number, target] = row
    listed.set(number, target)
    current?.numbers.push(number)

    if (!exists(`${DECISIONS_DIR}/${target}`)) {
      failures.push(`${indexPath}:${index + 1} — 索引のリンク先が実在しない: ${target}`)
      return
    }

    if (!target.startsWith(number)) {
      failures.push(`${indexPath}:${index + 1} — 索引の番号 ${number} とリンク先が食い違う: ${target}`)
    }
  })

  for (const { number, file } of decisions) {
    if (!listed.has(number)) {
      failures.push(`${indexPath} — DR-${number}（${file}）が索引に無い`)
    }
  }

  for (const number of listed.keys()) {
    if (!decisions.some((decision) => decision.number === number)) {
      failures.push(`${indexPath} — 索引にある DR-${number} が存在しない`)
    }
  }

  for (const { section, numbers } of sections) {
    const sorted = [...numbers].sort()

    if (numbers.join(',') !== sorted.join(',')) {
      failures.push(`${indexPath} — 「${section}」の中が番号の昇順になっていない: ${numbers.join(' → ')}`)
    }
  }

  return failures
}

/**
 * DR の冒頭欄を検査する。
 *
 * - 状態 / 日付 / 関連 が揃っているか
 * - 日付が `YYYY-MM-DD` か
 * - 関連に挙げた DR が実在するか
 * - 正本 / 実装 に挙げたパスが実在するか
 * - 正本に実装コードを挙げていないか（README「新しい決定を追加するとき」の3）
 *
 * @param {{ decisions: { number: string, file: string }[], numbers: Set<string>, sources?: Map<string, string>, exists?: (path: string) => boolean }} context
 * @returns {string[]}
 */
export function checkFrontMatter({ decisions, numbers, sources, exists = defaultExists }) {
  /** @type {string[]} */
  const failures = []

  for (const { number, file } of decisions) {
    const lines = (sources?.get(file) ?? read(file)).split('\n')
    /** @type {Map<string, { value: string, line: number }>} */
    const fields = new Map()

    for (const [index, line] of lines.entries()) {
      if (line.startsWith('## ')) {
        break
      }

      const match = line.match(FRONT_FIELD)

      if (match) {
        fields.set(match[1], { value: match[2], line: index + 1 })
      }
    }

    for (const field of REQUIRED_FIELDS) {
      if (!fields.has(field)) {
        failures.push(`${file} — 冒頭欄に **${field}** が無い`)
      }
    }

    const date = fields.get('日付')

    if (date && !DATE_FORMAT.test(date.value.trim())) {
      failures.push(`${file}:${date.line} — 日付が YYYY-MM-DD ではない: ${date.value.trim()}`)
    }

    const related = fields.get('関連')

    if (related) {
      for (const match of related.value.matchAll(DR_REFERENCE)) {
        if (!numbers.has(match[1])) {
          failures.push(`${file}:${related.line} — 関連に挙げた DR-${match[1]} は存在しない`)
        }

        if (match[1] === number) {
          failures.push(`${file}:${related.line} — 関連が自分自身（DR-${number}）を指している`)
        }
      }
    }

    for (const field of ['正本', '実装']) {
      const entry = fields.get(field)

      if (!entry) {
        continue
      }

      for (const path of extractPaths(entry.value)) {
        if (!exists(path)) {
          failures.push(`${file}:${entry.line} — **${field}** に挙げたパスが実在しない: ${path}`)
          continue
        }

        if (field === '正本' && IMPLEMENTATION_EXTENSIONS.some((extension) => path.endsWith(extension))) {
          failures.push(`${file}:${entry.line} — **正本** に実装コードを挙げている: ${path}（在り処を示すなら **実装** を使う）`)
        }
      }
    }
  }

  return failures
}

/**
 * 冒頭欄の値からパスを取り出す。バッククォートで囲まれた `design/tokens.json` の形と、
 * 素の `docs/decisions/0024-...md` の形の両方を拾う。丸括弧の中の補足
 * （`（手順5・手順7）` など）はパスではない。
 *
 * @param {string} value
 * @returns {string[]}
 */
export function extractPaths(value) {
  /** @type {string[]} */
  const paths = []

  for (const match of value.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim()

    if (/^[\w.@-]+(\/[\w.@-]+)+$/.test(candidate)) {
      paths.push(candidate)
    }
  }

  return paths
}

/**
 * すべての検査を実行する。
 *
 * @returns {{ label: string, failures: string[] }[]}
 */
export function runChecks() {
  const decisions = listDecisions()
  const numbers = new Set(decisions.map((decision) => decision.number))
  const sources = readSources(listScannedFiles())
  const context = { decisions, numbers, sources }

  return [
    { label: '参照した DR がすべて実在する', failures: checkReferencesExist(context) },
    { label: 'DR へのリンクが実在し、番号と一致する', failures: checkLinksResolve(context) },
    { label: '索引が全 DR を漏れなく登録し、節の中が昇順である', failures: checkIndexCovers(context) },
    { label: 'DR の冒頭欄が揃い、挙げた参照が実在する', failures: checkFrontMatter(context) },
  ]
}

function main() {
  const results = runChecks()
  let failed = false

  for (const { label, failures } of results) {
    if (failures.length === 0) {
      console.log(`ok  ${label}`)
      continue
    }

    failed = true
    console.error(`NG  ${label}`)

    for (const failure of failures) {
      console.error(`    ${failure}`)
    }
  }

  if (failed) {
    process.exitCode = 1
  }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
