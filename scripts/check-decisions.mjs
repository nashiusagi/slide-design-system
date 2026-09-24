/**
 * 決定記録（DR）の参照・索引・冒頭欄の整合を検査する（DR-0054）。
 *
 *   node scripts/check-decisions.mjs
 *
 * 見るのは**参照が指す先が実在するか、番号と一致しているか、冒頭欄が書式を満たすか**
 * であって、決定の中身ではない。中身の是非は人が読む。実行口は pnpm check に
 * 一本化する（DR-0028）。
 *
 * **リンクの実在は、走査対象の中の相対 `.md` リンクすべてを見る**（DR へのリンクに
 * 限らない）。番号の一致だけが DR 固有の判定だ。
 *
 * この検査が捕まえるのは、レビューで繰り返し出た次の壊れ方だ。
 *
 * - `decisions/wrong-dr-citation` — **存在しない番号**の引用まで。実在する誤番号は見ない
 * - `decisions/citation-points-to-wrong-file` — **ファイルの実在**まで。引用先の節が
 *   その内容を持つかは見ない
 * - `decisions/index-section-mismatch` — **網羅と昇順**まで。節の分類が内容と合うかは見ない
 * - `code/relative-link-wrong-depth` — 相対リンクの階層が合わず、実在しないパスを指す
 *   （これは全部捕まえられる）
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
 * 走査する場所。**ここに挙げた根の下の `.md` だけを見る包含リスト**で、除外の宣言
 * ではない。`.md` 以外は、根に挙がっていても見ない。
 *
 * **`.md` に限るのは、「これは例だ」と印を付ける手段が Markdown にしか無いから
 * だ**（DR-0054 決定1）。コードやデータの中の `DR-NNNN` は、コメントの本物の引用と
 * テストの偽番号（`scripts/check-decisions.test.mjs` の `DR-9999`）が同じ形で並ぶ。
 * Markdown のコードフェンスに相当する印が無く、区別するには別の取り決めが要る。
 * その結果、`scripts/*.mjs` と `design/**\/*.json` にある DR 参照は検査されない。
 * **ここを広げるかどうかは別の Issue の仕事**で、この検査は `.md` に閉じる。
 *
 * `docs/reviews/` は走査しない。レビュー記録は過去の指摘をそのまま引用するために
 * 古い番号・古いパスを含むのが正常で、かつ書き換えない履歴だからだ
 * （`check-canonical-duplication.mjs` が同じ理由で外しているのに揃える）。
 * `node_modules` / `dist` は生成物。`experiments/**\/runs/` は Run の記録で、
 * こちらも書き換えない履歴。`experiments/**\/starter/` は AI へ渡す足場の雛形で、
 * 実験のたびに複製される（DR-0039 が扱う）——雛形の中の参照は複製先ではなく
 * 雛形の側で見るべきものだが、いまは `.md` が置かれていないので外してある。
 *
 * **`experiments/` を入れているのは、相対リンクの階層が分かれている唯一の場所
 * だからだ**——`harness-intro/*.md` は2階層、`runs/README.md` は3階層で `docs/` へ
 * 戻る。PR #60 で実害が出た `code/relative-link-wrong-depth` が最も起きやすい。
 *
 * `check-canonical-duplication.mjs` の `SCAN_ROOTS` とは別の一覧で、見る対象が違う
 * （あちらは値の複製、こちらは参照の実在）。**違いは意図的で、ここが両者の関係を
 * 書く唯一の場所**にする。食い違っている4箇所の理由は次のとおり。
 *
 * - `scripts` / `packages` — あちらは README だけ、こちらはディレクトリ全体。
 *   **あちらが README に絞った理由は、あちらの docstring にも DR-0046 にも書かれて
 *   いない。** ここで推測を書くと、それが唯一の記録として固定される。こちらが全体を
 *   見る理由だけ書く——参照は `.md` ならどこに書かれていてもリンクが壊れうる
 * - `src/docs` — あちらにしか無い。`.ts` / `.tsx` / `.css` を対象にしており、
 *   こちらは `.md` に閉じるので入れても1件も拾わない
 * - `design` — こちらにしか無い。あちらにとっては正本そのもので、走査すると
 *   自己言及になる（あちらの docstring がそう書いている）
 */
export const SCAN_ROOTS = [
  { path: 'README.md', kind: 'file' },
  { path: 'DESIGN.md', kind: 'file' },
  { path: 'docs', kind: 'dir', exclude: ['docs/reviews/'] },
  { path: '.claude/skills', kind: 'dir', exclude: [] },
  { path: 'skills', kind: 'dir', exclude: [] },
  { path: 'scripts', kind: 'dir', exclude: [] },
  { path: 'design', kind: 'dir', exclude: [] },
  { path: 'experiments', kind: 'dir', exclude: ['experiments/**/runs/', 'experiments/**/starter/'] },
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
 * パスとみなす拡張子。**スラッシュを含まない候補**（`package.json` /
 * `eslint.config.js`）をファイルと判定するために使う。
 *
 * 拡張子の形（`/\.\w+$/`）だけで判定すると、`color.accent` や `scripts.check` の
 * ような**契約データのキーパス**をファイルと誤認する（冒頭欄はそれらも書く）。
 * だから列挙する。ここに無い拡張子のルート直下ファイルは、パスとして扱われない——
 * 見逃す方向の穴だが、偽陽性で緑が信用できなくなるよりはよい。スラッシュを含む
 * 候補は拡張子を問わずパスとみなすので、この一覧が効くのはルート直下だけだ。
 */
const FILE_EXTENSIONS = ['.md', '.json', '.mjs', '.cjs', '.ts', '.mts', '.tsx', '.js', '.jsx', '.css', '.html', '.yaml', '.yml']

/**
 * `**正本**:` 行に挙げてよくないファイルの拡張子。規則とその理由は
 * `docs/decisions/README.md`「新しい決定を追加するとき」の3 が持つ。判定を拡張子に
 * 取ったのは DR-0054 決定2 で、**どの拡張子かはここが持つ**（判定の調整であって
 * 決定ではない）。
 */
const IMPLEMENTATION_EXTENSIONS = ['.mjs', '.cjs', '.ts', '.mts', '.tsx', '.js', '.jsx']

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
 * **閉じられていないフェンスも返す。** 閉じ忘れがあると以降の行がすべて空になり、
 * そのファイルの参照もリンクも検査されないまま緑になる——行を捨てる判断をした以上、
 * 捨てた範囲が意図どおりであることは検査側が保証する必要がある（PR #61 の blocker）。
 *
 * **開いた記号とその長さを覚え、CommonMark の規則で閉じる。** 閉じるのは、同じ記号が
 * 開いた長さ以上続き、その後ろが空白だけの行に限る。ここを緩めると両方向に壊れる。
 *
 * - 真偽値のトグルにすると、``` の中の `~~~` や ```js で閉じたことになり、閉じ忘れを
 *   見逃す（PR #61 2周目の blocker）
 * - 記号の種類だけを見て長さを見ないと、4個以上のバッククォートで開いたフェンスが
 *   中の3個の行で閉じたことになり、やはり閉じ忘れを見逃す。逆に長さの一致だけを
 *   求めると、`````` で正しく開閉したフェンスまで「閉じていない」と落とす
 *   （PR #61 3周目の blocker）
 *
 * 4個以上のフェンスは、コード例を入れ子で見せるときの標準の書き方だ。書式ファイルが
 * これを使えるようにしておく。
 *
 * @param {string} source
 * @returns {{ stripped: string, unclosedFrom: number | undefined }}
 */
export function stripCodeBlocks(source) {
  const lines = source.split('\n')
  /** @type {string | undefined} 開いているフェンスの記号。閉じているときは undefined */
  let fence
  /** @type {number | undefined} 閉じられていないフェンスが開いた行（1始まり） */
  let openedAt

  const stripped = lines
    .map((line, index) => {
      if (fence === undefined) {
        const opening = line.match(/^\s*(`{3,}|~{3,})/)

        if (opening) {
          fence = opening[1]
          openedAt = index + 1
          return ''
        }

        return line.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length))
      }

      if (new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(line)) {
        fence = undefined
        openedAt = undefined
      }

      return ''
    })
    .join('\n')

  return { stripped, unclosedFrom: openedAt }
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
export function matchesExclude(path, pattern) {
  if (!pattern.includes('*')) {
    return path.startsWith(pattern)
  }

  // `a/**/b` は `a/b` にも当たる（glob の通例）。`**/` を `(.*\/)?` に展開する。
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .split('**/')
    .join('(.*/)?')
    .split('**')
    .join('.*')
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
    const { stripped } = stripCodeBlocks(content)

    stripped.split('\n').forEach((line, index) => {
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
 * 相対リンクが実在するかを検査する。**DR へのリンクに限らない**（DR-0054 決定1）。
 *
 * 見るのは2つ。走査対象の中のすべての相対 `.md` リンクについてリンク先が実在する
 * こと、そしてリンクテキストが `DR-NNNN` ならリンク先のファイル名の番号と一致する
 * こと。後者だけが DR 固有だ。PR #60 で実害が出たのは前者で、`../../../` と
 * `../../../../` の取り違えが緑のまま通っていた。
 *
 * @param {{ sources: Map<string, string>, exists?: (path: string) => boolean }} context
 * @returns {string[]}
 */
export function checkLinksResolve({ sources, exists = defaultExists }) {
  /** @type {string[]} */
  const failures = []

  for (const [file, content] of sources) {
    const { stripped } = stripCodeBlocks(content)
    const baseDir = dirname(file)

    stripped.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(MARKDOWN_LINK)) {
        const [, text, target] = match

        if (!target.endsWith('.md') || /^[a-z]+:/.test(target) || target.startsWith('#')) {
          continue
        }

        const resolved = normalize(join(baseDir, target.split('#')[0]))

        if (!exists(resolved)) {
          failures.push(`${file}:${index + 1} — リンク先が実在しない: ${target}（解決先: ${resolved}）`)
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
  const { stripped: source } = stripCodeBlocks(index ?? read(indexPath))

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

        // ディレクトリ（末尾スラッシュ）は拡張子を持たないので、この判定に掛からない。
        // `src/runtime/` のような指定が実装コードを指していても落とさない——中身の
        // 何を正本と呼んでいるかは読まないと分からないため、人の目に残す（DR-0054 決定2）。
        if (field === '正本' && IMPLEMENTATION_EXTENSIONS.some((extension) => path.endsWith(extension))) {
          failures.push(`${file}:${entry.line} — **正本** に実装コードを挙げている: ${path}（在り処を示すなら **実装** を使う）`)
        }
      }
    }
  }

  return failures
}

/**
 * 冒頭欄の値からパスを取り出す。**バッククォートで囲まれたものだけ**を見る——
 * このリポジトリの冒頭欄はすべてその形で書かれており、素の文字列まで拾うと
 * 「手順5」のような補足がパスに見える。
 *
 * パスと認めるのは次の2つ。
 *
 * - 拡張子を持つもの（`package.json` / `DESIGN.md` / `src/runtime/hash.ts`）
 * - 末尾がスラッシュのもの（`design/layouts/` / `src/components/`）
 *
 * **スラッシュを必須にしない。** ルート直下のファイル（`package.json` /
 * `eslint.config.js`）を取りこぼすと、そこへ実装コードを書いた冒頭欄が
 * 検査を素通りする（PR #61 の blocker。既存の冒頭欄23件が無検査だった）。
 *
 * 逆に、関数名や定数名（`checkStarterMatchesRoot` / `STATIC_LEAK_PATTERNS`）は
 * 拡張子もスラッシュも持たないので拾わない。
 *
 * @param {string} value
 * @returns {string[]}
 */
export function extractPaths(value) {
  /** @type {string[]} */
  const paths = []

  for (const match of value.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim()

    if (!/^[\w.@-]+(\/[\w.@-]+)*\/?$/.test(candidate)) {
      continue
    }

    const isDirectory = candidate.endsWith('/')
    const hasKnownExtension = FILE_EXTENSIONS.some((extension) => candidate.endsWith(extension))

    if (isDirectory || candidate.includes('/') || hasKnownExtension) {
      paths.push(candidate)
    }
  }

  return paths
}

/**
 * コードフェンスが閉じているかを検査する。
 *
 * 閉じ忘れがあると `stripCodeBlocks` が以降の行をすべて捨てるので、そのファイルの
 * 参照・リンクは一つも見られないまま緑になる。**検査が黙って効かなくなる形**なので、
 * 落とす（[DR-0054](../docs/decisions/0054-decision-reference-checked-by-machine.md)
 * 決定3）。
 *
 * @param {{ sources: Map<string, string> }} context
 * @returns {string[]}
 */
export function checkFencesClosed({ sources }) {
  /** @type {string[]} */
  const failures = []

  for (const [file, content] of sources) {
    const { unclosedFrom } = stripCodeBlocks(content)

    if (unclosedFrom !== undefined) {
      failures.push(`${file}:${unclosedFrom} — コードフェンスが閉じていない（以降の行は検査されない）`)
    }
  }

  return failures
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
    { label: 'コードフェンスが閉じている', failures: checkFencesClosed(context) },
    { label: '参照した DR がすべて実在する', failures: checkReferencesExist(context) },
    { label: '相対リンクが実在し、DR リンクは番号と一致する', failures: checkLinksResolve(context) },
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
