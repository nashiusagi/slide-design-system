/**
 * 正本の値・一覧・対応表が、正本を参照できない文書へ写されていないかを検査する
 * （DR-0046）。
 *
 *   node scripts/check-canonical-duplication.mjs
 *
 * 見るのは「正本の外にある文書」であって、契約そのものではない。契約が契約として
 * 成立しているかは scripts/validate-design.mjs が持つ（DR-0009）。実行口は
 * pnpm check に一本化する（DR-0028）。
 *
 * skills/slide-harness/SKILL.md に対する「文章」の複製（layout の役割説明、rule の
 * description、DESIGN.md の行）は、引き続き validate-design.mjs の
 * checkSkillNoDesignDataDuplication が持つ。あちらは色の値も見るため、SKILL.md の色は
 * 両方の検査が報告する（DR-0046 の却下案）。こちらが持つのは値・一覧・対応表で、
 * 対象ファイルも判定の形も違う。
 *
 * 検出する値・一覧はこのファイルに列挙しない。実行時に正本を読んで組み立てる。
 * 列挙すれば、この検査自身が禁じている複製になる。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { collectFiles, escapeForRegExp } from './lib/fs-walk.mjs'

/**
 * このファイルから見たリポジトリルート。`scripts/` から1階層上。
 * `scripts/lib/bypass-fixtures.mjs` の `REPO_ROOT` と同じ求め方で、vitest から
 * 読み込んだときも同じ場所を指す（`new URL(<相対パス>, import.meta.url)` の方は
 * Vite のアセット変換に食われるため使わない）。
 */
const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

/** @param {string} relativePath */
const resolve = (relativePath) => join(REPO_ROOT, relativePath)

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/**
 * 走査する場所。正本を参照できない文書、すなわち「値を書き写したくなる場所」を挙げる。
 * ここがこの一覧の唯一の在り処で、README や DR へ写さない。
 *
 * `design/` は走査しない。この検査が読む正本そのもの（`tokens.json` / `rules.json` /
 * `layouts/` / `components/`）を対象にすると自己言及になり、`decks/` は layout 名を契約
 * データとして持つ deck 契約で、書き写しではない。
 * `docs/reviews/` も走査しない。レビュー記録は過去の指摘を引用するために値を含むのが
 * 正常で、かつ書き換えない履歴だからだ（DR-0046 帰結）。実験の記録（`experiments/` の
 * Run 採点結果）も履歴だが、同じ場所に AI へ渡すお題も置かれているため、ディレクトリ
 * ごと走査対象に入れ、記録の側を例外リストで扱う。
 */
export const SCAN_ROOTS = [
  { path: 'README.md', extensions: ['.md'], exclude: [] },
  { path: 'DESIGN.md', extensions: ['.md'], exclude: [] },
  { path: 'scripts/README.md', extensions: ['.md'], exclude: [] },
  { path: 'packages/README.md', extensions: ['.md'], exclude: [] },
  { path: 'docs', extensions: ['.md'], exclude: ['docs/reviews/'] },
  { path: '.claude/skills', extensions: ['.md'], exclude: [] },
  { path: 'skills', extensions: ['.md'], exclude: [] },
  { path: 'experiments', extensions: ['.md'], exclude: [] },
  { path: 'src/docs', extensions: ['.ts', '.tsx', '.css'], exclude: [] },
]

/** 例外エントリの `reason` に要求する最小の文字数。一語の言い訳を例外として通さない。 */
export const MIN_REASON_LENGTH = 20

/**
 * 文字列の値を「特徴的」と見なす最小の長さ。これより短い値（`none` / `0` / `md`）は
 * 文書の普通の語と衝突するため、値としての一致を見ない。単位付きの値（`1px` /
 * `100%`）はこの下限を免除する（単位が付いている時点で値として書かれている）。
 */
export const MIN_LITERAL_LENGTH = 6

/** 数値＋単位の形か。`1px` / `100%` を指す。 */
const UNIT_LITERAL = /^\d+(\.\d+)?(px|%)$/

/**
 * 数値に続く単位として見る記法。ここに無い単位（`em` / `pt` / 日本語の「ピクセル」）は
 * 検出しない。塞げていない形として DR-0046 の帰結に挙げてある。
 */
const UNITS = 'px|%'

/**
 * `value` を、語の途中では一致しない正規表現にする。
 *
 * 前後が英数字・ピリオド・ハイフンのときは一致させない。`4` が `24px` や `4.5` の
 * 一部として当たると、報告の大半が偶然の一致になり、検査そのものが無視される。
 *
 * @param {string} value
 * @returns {string}
 */
function boundedPattern(value) {
  const head = /^[\w]/.test(value) ? '(?<![\\w.-])' : ''
  const tail = /[\w]$/.test(value) ? '(?![\\w-])' : ''

  return `${head}${escapeForRegExp(value)}${tail}`
}

/**
 * 行に含まれるインラインコードの中身を返す。バックティックの対を跨いで一致させないため、
 * 行全体への正規表現ではなくスパンを切り出してから中を見る。`` `a` 18 `b` `` の 18 は
 * どのスパンにも入らない。
 *
 * @param {string} line
 * @returns {string[]}
 */
export function codeSpans(line) {
  return [...line.matchAll(/`([^`\n]+)`/g)].map((matched) => matched[1])
}

/**
 * 正本の値を集める。返すのは「文書に現れたら複製と見なす形」まで含んだ照合器で、
 * 値そのものの一覧ではない。
 *
 * 判定する形を絞る理由は DR-0046 の決定2にある。単位もインラインコードも伴わない
 * 裸の数値は、既知の抜け道として検出しない。
 *
 * @param {{ tokens: any, rules: any }} canonical
 * @returns {{ targets: string[], value: string, matches: (line: string) => boolean }[]}
 */
export function collectCanonicalValues({ tokens, rules }) {
  /** @type {Map<string, { value: string, matches: (line: string) => boolean, targets: string[] }>} */
  const collected = new Map()

  /**
   * @param {string} key 値の種類と値を合わせた重複排除キー
   * @param {string} value
   * @param {(line: string) => boolean} matches
   * @param {string} target
   */
  const add = (key, value, matches, target) => {
    const existing = collected.get(key)

    if (existing === undefined) {
      collected.set(key, { value, matches, targets: [target] })

      return
    }

    if (!existing.targets.includes(target)) {
      existing.targets.push(target)
    }
  }

  /**
   * 文字列の値。色・書体・影のように、偶然一致しない形をそのまま見る。
   * `MIN_LITERAL_LENGTH` に満たない短い値は、文書の普通の語と衝突するため見ない。
   *
   * @param {string} value
   * @param {string} target
   */
  const addText = (value, target) => {
    if (value.length < MIN_LITERAL_LENGTH && !UNIT_LITERAL.test(value)) {
      return
    }

    const pattern = new RegExp(boundedPattern(value))

    add(`text:${value}`, value, (line) => pattern.test(line), target)
  }

  /**
   * 数値。単位付き（`18px` / `100%`）と、インラインコードだけで置かれた形
   * （`` `18` ``）を見る。
   *
   * @param {number} value
   * @param {string} target
   */
  const addNumber = (value, target) => {
    const literal = String(value)
    const withUnit = new RegExp(`(?<![\\w.-])${escapeForRegExp(literal)}\\s?(${UNITS})(?![\\w-])`)

    add(
      `number:${literal}`,
      literal,
      (line) => withUnit.test(line) || codeSpans(line).some((span) => span.trim() === literal),
      target,
    )
  }

  /**
   * 契約の木を辿って値を集める。`$` で始まるキーは説明と算出値で、トークンではない
   * （scripts/generate-theme.mjs の flatten と同じ判定）。算出値（`$measured`）は
   * 書き写されると「検証済み」の誤った合図になるため、こちらは対象に含める。
   *
   * 文字列を拾うかどうかは呼び出し側が決める。`design/rules.json` の文字列は説明文
   * （description）や役割名で、値ではなく文章の複製として扱う領分だからだ。
   *
   * @param {any} node
   * @param {string[]} path
   * @param {{ file: string, skipKeys?: string[], withText: boolean }} options
   */
  const walkContract = (node, path, options) => {
    for (const [key, value] of Object.entries(node)) {
      if ((key.startsWith('$') && key !== '$measured') || options.skipKeys?.includes(key)) {
        continue
      }

      const nextPath = [...path, key]
      const target = `${options.file} の ${nextPath.join('.')}`

      if (typeof value === 'object' && value !== null) {
        walkContract(value, nextPath, options)
      } else if (typeof value === 'number') {
        addNumber(value, target)
      } else if (typeof value === 'string' && options.withText) {
        addText(value, target)
      }
    }
  }

  walkContract(tokens, [], { file: 'design/tokens.json', withText: true })

  /*
   * rules.json は数値だけを木ごと拾う。閾値を足せば検出対象も増える。`rules` 配列は
   * ルール定義そのもの（id / description / 宣言）で、値ではないため辿らない。id の
   * 一覧は collectCanonicalLists が持つ。
   */
  walkContract(rules, [], { file: 'design/rules.json', skipKeys: ['rules'], withText: false })

  for (const literal of rules.noRawScale.allowedLiterals) {
    addText(literal, 'design/rules.json の noRawScale.allowedLiterals')
  }

  /*
   * キャンバス寸法は対で書き写される。幅と高さを別々の数値として見るだけでは、
   * この形（単位もインラインコードも伴わない）が素通りする。
   */
  const canvasPair = new RegExp(
    `(?<![\\w.-])${tokens.canvas.width}\\s*[x×*]\\s*${tokens.canvas.height}(?![\\w-])`,
  )

  add(
    `pair:${tokens.canvas.width}x${tokens.canvas.height}`,
    `${tokens.canvas.width}x${tokens.canvas.height}`,
    (line) => canvasPair.test(line),
    'design/tokens.json の canvas',
  )

  return [...collected.values()]
}

/**
 * 正本の一覧を集める。値ではなく「並び」が写されたことを見るために使う。
 *
 * @param {{ layouts: any[], components: any[], rules: any }} canonical
 * @returns {{ target: string, items: string[] }[]}
 */
export function collectCanonicalLists({ layouts, components, rules }) {
  return [
    { target: 'design/layouts/ の name 一覧', items: layouts.map((layout) => layout.name) },
    { target: 'design/components/ の name 一覧', items: components.map((component) => component.name) },
    {
      target: 'design/rules.json の rules[].id 一覧',
      items: rules.rules.map((/** @type {{ id: string }} */ rule) => rule.id),
    },
  ]
}

/**
 * 正本の対応表を集める。`allowedIn`（= layout 側の `slots`、DR-0035）は component 名と
 * layout 名の対で、一覧としてではなく表として写される
 * （`contract/contract-structure-duplicated`）。
 *
 * component と layout が同名の対（`statement`）は持たない。1つの語が両側を兼ねるため、
 * その語に触れた行がすべて「対応を書いた行」になり、対応表でない箇条書きを報告して
 * しまう。同名の対は、この判定では見ないものとして扱う。
 *
 * @param {{ components: any[] }} canonical
 * @returns {{ target: string, pairs: { component: string, layout: string }[] }[]}
 */
export function collectCanonicalPairings({ components }) {
  return [
    {
      target: 'design/components/ の allowedIn 対応表',
      pairs: components.flatMap((component) =>
        component.allowedIn
          .filter((/** @type {string} */ layoutName) => layoutName !== component.name)
          .map((/** @type {string} */ layoutName) => ({ component: component.name, layout: layoutName })),
      ),
    },
  ]
}

/**
 * 文書に現れた正本の値を報告する。
 *
 * @param {string} path
 * @param {string} source
 * @param {{ targets: string[], value: string, matches: (line: string) => boolean }[]} values
 * @returns {{ path: string, line: number, targets: string[], message: string }[]}
 */
export function findValueDuplications(path, source, values) {
  return source.split('\n').flatMap((line, index) =>
    values
      .filter(({ matches }) => matches(line))
      .map(({ targets, value }) => ({
        path,
        line: index + 1,
        targets,
        message: `${path}:${index + 1}: ${targets.join(' / ')}（${value}）がそのまま書かれている`,
      })),
  )
}

/** 箇条書き・先頭にパイプを置く表の行か。番号は `1.` と `1)` の両方を見る。 */
const ENUMERATION_HEAD = /^\s*([-*+]\s|\d+[.)]\s|\|)/

/**
 * 列の区切りとしてのパイプを持つ行か。判定の前にインラインコードを落とす。落とさないと、
 * シェルのパイプやコード例を含むだけの地の文（「`foo | bar` のようにつなぐ」）が表の行に
 * 見える。
 *
 * @param {string} text
 * @returns {boolean}
 */
const hasPipeCell = (text) => /\s\|\s/.test(text.replace(/`[^`\n]*`/g, ''))

/** GFM の表の区切り行（`--- | ---`）か。先頭・末尾のパイプは省けるため任意にする。 */
const TABLE_DELIMITER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/

/**
 * 各行が箇条書き・表の行かを返す。
 *
 * 先頭のパイプを省いた表も見るが、パイプを持つだけでは表と見なさない。GFM の表は
 * 区切り行（`--- | ---`）を必ず伴うので、パイプを持つ行が続く範囲に区切り行があるときだけ
 * 表として扱う。区切り行を要求しないと、「前段 | 後段 の順で進む」のような地の文が表の行に
 * なり、離れた単発の言及どうしが1つのブロックへ繋がって誤検出になる。
 *
 * @param {string[]} lines
 * @returns {boolean[]}
 */
function markEnumerationLines(lines) {
  const marks = lines.map((text) => ENUMERATION_HEAD.test(text))

  for (let start = 0; start < lines.length; start += 1) {
    if (!hasPipeCell(lines[start]) || marks[start]) {
      continue
    }

    let end = start

    while (end + 1 < lines.length && hasPipeCell(lines[end + 1])) {
      end += 1
    }

    if (lines.slice(start, end + 1).some((text) => TABLE_DELIMITER.test(text))) {
      for (let index = start; index <= end; index += 1) {
        marks[index] = true
      }
    }

    start = end
  }

  return marks
}

/**
 * 連続する箇条書き・表の行をブロックとして切り出す。
 *
 * 空行ではブロックを切らない。項目のあいだに空行を入れた箇条書き（loose list）は
 * Markdown としては1つの箇条書きで、切ってしまうと空行を1つ入れるだけで検査を
 * 抜けられる。切るのは、箇条書きでも表でもない中身のある行が来たときだけ。
 *
 * @param {string[]} lines
 * @returns {{ start: number, lines: { number: number, text: string }[] }[]}
 */
function enumerationBlocks(lines) {
  /** @type {{ start: number, lines: { number: number, text: string }[] }[]} */
  const blocks = []
  /** @type {{ number: number, text: string }[]} */
  let current = []

  const flush = () => {
    if (current.length > 0) {
      blocks.push({ start: current[0].number, lines: current })
      current = []
    }
  }

  const marks = markEnumerationLines(lines)

  lines.forEach((text, index) => {
    if (marks[index]) {
      current.push({ number: index + 1, text })
    } else if (text.trim() !== '') {
      flush()
    }
  })

  flush()

  return blocks
}

/** @param {string} item */
const itemPattern = (item) => new RegExp(`(?<![\\w-])${escapeForRegExp(item)}(?![\\w-])`)

/**
 * 文書に現れた正本の一覧を報告する。
 *
 * 順序は問わない。同順だけを見ると、行を入れ替えるだけで素通りする（DR-0046 決定3）。
 * 1行1件で2件以上並ぶ形と、1行にその一覧の全項目が並ぶ形の両方を報告する。
 *
 * @param {string} path
 * @param {string} source
 * @param {{ target: string, items: string[] }[]} lists
 * @returns {{ path: string, line: number, targets: string[], message: string }[]}
 */
export function findStructureDuplications(path, source, lists) {
  const lines = source.split('\n')
  const blocks = enumerationBlocks(lines)

  const fromBlocks = lists.flatMap(({ target, items }) =>
    blocks.flatMap(({ start, lines: blockLines }) => {
      const found = new Set(
        blockLines.flatMap(({ text }) => items.filter((item) => itemPattern(item).test(text))),
      )
      const linesWithItem = blockLines.filter(({ text }) =>
        items.some((item) => itemPattern(item).test(text)),
      )

      if (found.size < 2 || linesWithItem.length < 2) {
        return []
      }

      return [
        {
          path,
          line: start,
          targets: [target],
          message: `${path}:${start}: ${target}が表・箇条書きへ写されている（${[...found].join(' / ')}）`,
        },
      ]
    }),
  )

  const fromSingleLines = lists.flatMap(({ target, items }) =>
    lines.flatMap((text, index) =>
      items.length >= 2 && items.every((item) => itemPattern(item).test(text))
        ? [
            {
              path,
              line: index + 1,
              targets: [target],
              message: `${path}:${index + 1}: ${target}が1行へ写されている（${items.join(' / ')}）`,
            },
          ]
        : [],
    ),
  )

  return [...fromBlocks, ...fromSingleLines]
}

/**
 * 文書に現れた正本の対応表を報告する。正本にある対（component 名とその `allowedIn` の
 * layout 名）が同じ行に並ぶ行が、同じブロックに2行以上あり、対が2種類以上あれば
 * 対応表の複製と見なす。同じ対が繰り返されているだけの箇条書きは報告しない。
 *
 * @param {string} path
 * @param {string} source
 * @param {{ target: string, pairs: { component: string, layout: string }[] }[]} pairings
 * @returns {{ path: string, line: number, targets: string[], message: string }[]}
 */
export function findPairingDuplications(path, source, pairings) {
  const blocks = enumerationBlocks(source.split('\n'))

  return pairings.flatMap(({ target, pairs }) =>
    blocks.flatMap(({ start, lines: blockLines }) => {
      const pairsIn = (/** @type {string} */ text) =>
        pairs.filter((pair) => itemPattern(pair.component).test(text) && itemPattern(pair.layout).test(text))

      const pairedLines = blockLines.filter(({ text }) => pairsIn(text).length > 0)
      const found = new Set(
        pairedLines.flatMap(({ text }) => pairsIn(text).map((pair) => `${pair.component} → ${pair.layout}`)),
      )

      if (pairedLines.length < 2 || found.size < 2) {
        return []
      }

      return [
        {
          path,
          line: start,
          targets: [target],
          message: `${path}:${start}: ${target}が表・箇条書きへ写されている（${[...found].join(' / ')}）`,
        },
      ]
    }),
  )
}

/**
 * 例外リストの形を検査する。理由の無い例外を登録できないようにするのが目的で、
 * ここが緩むと例外リストが「検査を黙らせる場所」になる（DR-0046 決定）。
 *
 * @param {any} allowlist
 * @returns {string[]}
 */
export function checkAllowlistShape(allowlist) {
  if (!Array.isArray(allowlist?.allowed)) {
    return ['scripts/canonical-duplication-allowlist.json: allowed が配列でない']
  }

  return allowlist.allowed.flatMap((/** @type {any} */ entry, /** @type {number} */ index) => {
    const where = `scripts/canonical-duplication-allowlist.json: allowed[${index}]`

    if (typeof entry?.path !== 'string' || entry.path === '') {
      return [`${where}: path が無い`]
    }

    if (typeof entry?.target !== 'string' || entry.target === '') {
      return [`${where}（${entry.path}）: target が無い`]
    }

    if (typeof entry?.reason !== 'string' || entry.reason.trim().length < MIN_REASON_LENGTH) {
      return [
        `${where}（${entry.path} / ${entry.target}）: reason が無いか短すぎる（${MIN_REASON_LENGTH} 文字以上で、なぜ正本を参照できないのかを書く）`,
      ]
    }

    if (!Number.isInteger(entry?.count) || entry.count < 1) {
      return [
        `${where}（${entry.path} / ${entry.target}）: count が無いか1以上の整数でない（この例外が抑える報告の件数を書く）`,
      ]
    }

    return []
  })
}

/**
 * 例外リストを当てる。
 *
 * エントリは抑える件数（`count`）を持ち、実際に抑えた件数がそれと違えば報告する。
 * 件数を見ないと、1つのエントリが同じファイルの同じ正本についての新しい複製を
 * いくつでも黙って飲み込む。使われていないエントリも同じ理由で報告する。正本や文書を
 * 直した後に例外だけが残ると、次の複製をその例外が黙って通す。
 *
 * @param {{ path: string, line: number, targets: string[], message: string }[]} problems
 * @param {{ path: string, target: string, reason: string, count: number }[]} allowed
 * @returns {{ remaining: string[], mismatched: string[] }}
 */
export function applyAllowlist(problems, allowed) {
  /** @type {number[]} */
  const suppressed = allowed.map(() => 0)

  const remaining = problems
    .filter((problem) => {
      const index = allowed.findIndex(
        (entry) => entry.path === problem.path && problem.targets.includes(entry.target),
      )

      if (index === -1) {
        return true
      }

      suppressed[index] += 1

      return false
    })
    .map((problem) => problem.message)

  const mismatched = allowed.flatMap((entry, index) => {
    const actual = suppressed[index]

    if (actual === entry.count) {
      return []
    }

    const where = `scripts/canonical-duplication-allowlist.json（${entry.path} / ${entry.target}）`

    return actual === 0
      ? [`${where}: 使われていない例外がある。複製が解消したなら削除する`]
      : [
          `${where}: 例外が抑えた件数（${actual}）が count（${entry.count}）と違う。増えたなら複製を直し、減ったなら count を下げる`,
        ]
  })

  return { remaining, mismatched }
}

/**
 * ディレクトリにある契約ファイルを、ファイル名順に読む。一覧をどこにも列挙しないため、
 * 本体もテストもこれを通して正本から数える。
 *
 * @param {string} directory
 * @returns {any[]}
 */
export function readContractsIn(directory) {
  return readdirSync(resolve(directory))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(join(directory, name)))
}

/**
 * 走査対象のファイルを、SCAN_ROOTS から列挙する。
 *
 * @returns {{ path: string, source: string }[]}
 */
export function collectScanTargets() {
  return SCAN_ROOTS.flatMap(({ path, extensions, exclude }) => {
    const isDirectory = extname(path) === ''
    const paths = isDirectory
      ? collectFiles(resolve(path))
          .map((relativePath) => `${path}/${relativePath}`)
          .filter((candidate) => extensions.includes(extname(candidate)))
          .filter((candidate) => !exclude.some((prefix) => candidate.startsWith(prefix)))
          .sort()
      : [path]

    return paths.map((candidate) => ({ path: candidate, source: readFileSync(resolve(candidate), 'utf8') }))
  })
}

/**
 * 検査の本体。正本・走査対象・例外リストを引数で受け取り、報告だけを返す。
 *
 * 読み込みと出力を持たないので、例外リストの形が壊れているときに例外を1件も
 * 当てないことまでテストで固定できる。この結線が緩むと、理由を書かずに検査を
 * 黙らせる経路ができる。
 *
 * @param {{
 *   values: { targets: string[], value: string, matches: (line: string) => boolean }[],
 *   lists: { target: string, items: string[] }[],
 *   pairings: { target: string, pairs: { component: string, layout: string }[] }[],
 *   targets: { path: string, source: string }[],
 *   allowlist: any,
 * }} input
 * @returns {{ checks: { name: string, problems: string[] }[], problems: string[] }}
 */
export function collectProblems({ values, lists, pairings, targets, allowlist }) {
  const shapeProblems = checkAllowlistShape(allowlist)

  const found = [
    {
      name: '正本の値が他の文書へ複製されていない',
      problems: targets.flatMap(({ path, source }) => findValueDuplications(path, source, values)),
    },
    {
      name: '正本の一覧が他の文書へ複製されていない',
      problems: targets.flatMap(({ path, source }) => findStructureDuplications(path, source, lists)),
    },
    {
      name: '正本の対応表が他の文書へ複製されていない',
      problems: targets.flatMap(({ path, source }) => findPairingDuplications(path, source, pairings)),
    },
  ]

  /*
   * 例外リストの形が壊れているときは、例外を1件も当てない。壊れた例外を当てたまま
   * 緑を返すと、理由を書かずに検査を黙らせる経路になる。
   */
  const { remaining, mismatched } = applyAllowlist(
    found.flatMap(({ problems }) => problems),
    shapeProblems.length === 0 ? allowlist.allowed : [],
  )

  const remainingMessages = new Set(remaining)

  return {
    checks: [
      ...found.map(({ name, problems }) => ({
        name,
        problems: problems.map(({ message }) => message).filter((message) => remainingMessages.has(message)),
      })),
      { name: '例外リストが理由と件数を持ち、すべて使われている', problems: [...shapeProblems, ...mismatched] },
    ],
    problems: [...shapeProblems, ...remaining, ...mismatched],
  }
}

function main() {
  const rules = readJson('design/rules.json')
  const components = readContractsIn('design/components')

  const { checks, problems } = collectProblems({
    values: collectCanonicalValues({ tokens: readJson('design/tokens.json'), rules }),
    lists: collectCanonicalLists({ layouts: readContractsIn('design/layouts'), components, rules }),
    pairings: collectCanonicalPairings({ components }),
    targets: collectScanTargets(),
    allowlist: readJson('scripts/canonical-duplication-allowlist.json'),
  })

  for (const { name, problems: perCheck } of checks) {
    console.log(`${perCheck.length === 0 ? 'ok  ' : 'NG  '}${name}`)
  }

  if (problems.length > 0) {
    console.error(`\n${problems.join('\n')}`)
    process.exit(1)
  }
}

// テストから読み込むときは走らせない。process.exit と標準出力を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
