/**
 * 正本の値・一覧が、正本を参照できない散文へ写されていないかを検査する（DR-0046）。
 *
 *   node scripts/check-canonical-duplication.mjs
 *
 * 見るのは「正本の外にある文書」であって、契約そのものではない。契約が契約として
 * 成立しているかは scripts/validate-design.mjs が持つ（DR-0009）。実行口は
 * pnpm check に一本化する（DR-0028）。
 *
 * skills/slide-harness/SKILL.md に対する「文章」の複製（layout の役割説明、rule の
 * description、DESIGN.md の行）は、引き続き validate-design.mjs の
 * checkSkillNoDesignDataDuplication が持つ。こちらが持つのは値と一覧で、判定の形が
 * 違う（DR-0046 の却下案）。両者の守備範囲を混ぜない。
 *
 * 検出する値・一覧はこのファイルに列挙しない。実行時に正本を読んで組み立てる。
 * 列挙すれば、この検査自身が禁じている複製になる。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { collectFiles, escapeForRegExp } from './lib/fs-walk.mjs'

/**
 * リポジトリの根。`pnpm` 経由で実行するとき、作業ディレクトリは package.json の
 * 置き場所（= リポジトリの根）になる。
 *
 * 他のスクリプトは `import.meta.url` から根を求めているが、この検査だけは cwd を使う。
 * 走査対象が空でないことをテストで固定する必要があり（対象の取りこぼしは「壊れていても
 * 緑」を作る）、テストは vitest の変換を通る。変換後の `import.meta.url` は file URL では
 * なくなるため、そこから根を求めると実行時とテストで別の場所を指す。
 */
const ROOT = process.cwd()

/** @param {string} relativePath */
const resolve = (relativePath) => join(ROOT, relativePath)

/** @param {string} relativePath */
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(relativePath), 'utf8'))

/**
 * 走査する場所。正本を参照できない文書、すなわち「値を書き写したくなる場所」を挙げる。
 * ここがこの一覧の唯一の在り処で、README や DR へ写さない。
 *
 * docs/reviews/ は走査しない。レビュー記録は過去の指摘を引用するために値を含むのが
 * 正常で、かつ書き換えない履歴だからだ（DR-0046 帰結）。
 */
export const SCAN_ROOTS = [
  { path: 'README.md', extensions: ['.md'], exclude: [] },
  { path: 'DESIGN.md', extensions: ['.md'], exclude: [] },
  { path: 'docs', extensions: ['.md'], exclude: ['docs/reviews/'] },
  { path: '.claude/skills', extensions: ['.md'], exclude: [] },
  { path: 'skills', extensions: ['.md'], exclude: [] },
  { path: 'src/docs', extensions: ['.ts', '.tsx', '.css'], exclude: [] },
]

/** 例外エントリの `reason` に要求する最小の文字数。一語の言い訳を例外として通さない。 */
export const MIN_REASON_LENGTH = 20

/**
 * 文字列の値を「特徴的」と見なす最小の長さ。これより短い値（`none` / `0` / `md`）は
 * 散文の普通の語と衝突するため、値としての一致を見ない。単位付きの値（`1px` /
 * `100%`）はこの下限を免除する（単位が付いている時点で値として書かれている）。
 */
const MIN_LITERAL_LENGTH = 6

/** 数値＋単位の形か。`1px` / `100%` を指す。 */
const UNIT_LITERAL = /^\d+(\.\d+)?(px|%)$/

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
 * 正本の値を集める。返すのは「散文に現れたら複製と見なす形」まで含んだ照合器で、
 * 値そのものの一覧ではない。
 *
 * 判定する形を3つに絞る理由は DR-0046 の決定2にある。単位もインラインコードも
 * 伴わない裸の数値は、既知の抜け道として検出しない。
 *
 * @param {{ tokens: any, rules: any }} canonical
 * @returns {{ target: string, value: string, patterns: RegExp[] }[]}
 */
export function collectCanonicalValues({ tokens, rules }) {
  /** @type {Map<string, { value: string, patterns: RegExp[], targets: string[] }>} */
  const collected = new Map()

  /**
   * @param {string} key 値の種類と値を合わせた重複排除キー
   * @param {string} value
   * @param {string[]} patterns
   * @param {string} target
   */
  const add = (key, value, patterns, target) => {
    const existing = collected.get(key)

    if (existing === undefined) {
      collected.set(key, { value, patterns: patterns.map((source) => new RegExp(source)), targets: [target] })

      return
    }

    if (!existing.targets.includes(target)) {
      existing.targets.push(target)
    }
  }

  /**
   * 文字列の値。色・書体・影のように、偶然一致しない形をそのまま見る。
   *
   * @param {string} value
   * @param {string} target
   */
  const addText = (value, target) => {
    if (value.length < MIN_LITERAL_LENGTH && !UNIT_LITERAL.test(value)) {
      return
    }

    add(`text:${value}`, value, [boundedPattern(value)], target)
  }

  /**
   * 数値。単位付き（`18px` / `100%`）と、インラインコードだけで置かれた形
   * （`` `18` ``）を見る。
   *
   * @param {number} value
   * @param {string} target
   */
  const addNumber = (value, target) => {
    const literal = escapeForRegExp(String(value))

    add(
      `number:${value}`,
      String(value),
      [`(?<![\\w.-])${literal}\\s?(px|%)(?![\\w-])`, '`\\s*' + literal + '\\s*`'],
      target,
    )
  }

  /**
   * トークンの木を辿る。`$` で始まるキーは説明と算出値で、トークンではない
   * （scripts/generate-theme.mjs の flatten と同じ判定）。算出値（`$measured`）は
   * 書き写されると「検証済み」の誤った合図になるため、こちらは対象に含める。
   *
   * @param {any} node
   * @param {string[]} path
   */
  const walkTokens = (node, path) => {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$') && key !== '$measured') {
        continue
      }

      const nextPath = [...path, key]
      const target = `design/tokens.json の ${nextPath.join('.')}`

      if (typeof value === 'object' && value !== null) {
        walkTokens(value, nextPath)
      } else if (typeof value === 'number') {
        addNumber(value, target)
      } else if (typeof value === 'string') {
        addText(value, target)
      }
    }
  }

  walkTokens(tokens, [])

  for (const requirement of rules.contrast.requirements) {
    addNumber(requirement.minimum, 'design/rules.json の contrast.requirements[].minimum')
  }

  addNumber(rules.minFontSize.px, 'design/rules.json の minFontSize.px')
  addNumber(rules.noOverflow.toleranceInPx, 'design/rules.json の noOverflow.toleranceInPx')

  for (const literal of rules.noRawScale.allowedLiterals) {
    addText(literal, 'design/rules.json の noRawScale.allowedLiterals')
  }

  /*
   * キャンバス寸法は `1280x720` の対で書き写される。幅と高さを別々の数値として見るだけ
   * では、この形（単位もインラインコードも伴わない）が素通りする。
   */
  add(
    `pair:${tokens.canvas.width}x${tokens.canvas.height}`,
    `${tokens.canvas.width}x${tokens.canvas.height}`,
    [`(?<![\\w.-])${tokens.canvas.width}\\s*[x×*]\\s*${tokens.canvas.height}(?![\\w-])`],
    'design/tokens.json の canvas',
  )

  return [...collected.values()].map(({ value, patterns, targets }) => ({
    target: targets.join(' / '),
    value,
    patterns,
  }))
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
 * 正本の対応表を集める。`allowedIn` / `slots` は component 名と layout 名の対で、
 * 一覧としてではなく表として写される（`contract/contract-structure-duplicated`）。
 *
 * @param {{ layouts: any[], components: any[] }} canonical
 * @returns {{ target: string, left: string[], right: string[] }[]}
 */
export function collectCanonicalPairings({ layouts, components }) {
  return [
    {
      target: 'design/components/ の allowedIn 対応表',
      left: components.map((component) => component.name),
      right: layouts.map((layout) => layout.name),
    },
  ]
}

/**
 * 散文に現れた正本の値を報告する。
 *
 * @param {string} path
 * @param {string} source
 * @param {{ target: string, value: string, patterns: RegExp[] }[]} values
 * @returns {{ path: string, line: number, target: string, message: string }[]}
 */
export function findValueDuplications(path, source, values) {
  return source.split('\n').flatMap((line, index) =>
    values
      .filter(({ patterns }) => patterns.some((pattern) => pattern.test(line)))
      .map(({ target, value }) => ({
        path,
        line: index + 1,
        target,
        message: `${path}:${index + 1}: ${target}（${value}）がそのまま書かれている`,
      })),
  )
}

/**
 * 連続する箇条書き・表の行をブロックとして切り出す。区切り行（`|---|`）は
 * ブロックを切らない。ブロックの外に散った言及は複製ではないため、行単位ではなく
 * ブロック単位で数える。
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

  lines.forEach((text, index) => {
    if (/^\s*([-*+]\s|\d+\.\s|\|)/.test(text)) {
      current.push({ number: index + 1, text })
    } else {
      flush()
    }
  })

  flush()

  return blocks
}

/** @param {string} item */
const itemPattern = (item) => new RegExp(`(?<![\\w-])${escapeForRegExp(item)}(?![\\w-])`)

/**
 * 散文に現れた正本の一覧を報告する。
 *
 * 順序は問わない。同順だけを見ると、行を入れ替えるだけで素通りする（DR-0046 決定3）。
 * 1行1件で2件以上並ぶ形と、1行にその一覧の全項目が並ぶ形の両方を報告する。
 *
 * @param {string} path
 * @param {string} source
 * @param {{ target: string, items: string[] }[]} lists
 * @returns {{ path: string, line: number, target: string, message: string }[]}
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
          target,
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
              target,
              message: `${path}:${index + 1}: ${target}が1行へ写されている（${items.join(' / ')}）`,
            },
          ]
        : [],
    ),
  )

  return [...fromBlocks, ...fromSingleLines]
}

/**
 * 散文に現れた正本の対応表を報告する。左右の名前が同じ行に並ぶ行が、同じブロックに
 * 2行以上あれば対応表の複製と見なす。
 *
 * @param {string} path
 * @param {string} source
 * @param {{ target: string, left: string[], right: string[] }[]} pairings
 * @returns {{ path: string, line: number, target: string, message: string }[]}
 */
export function findPairingDuplications(path, source, pairings) {
  const blocks = enumerationBlocks(source.split('\n'))

  return pairings.flatMap(({ target, left, right }) =>
    blocks.flatMap(({ start, lines: blockLines }) => {
      const pairedLines = blockLines.filter(
        ({ text }) =>
          left.some((item) => itemPattern(item).test(text)) &&
          right.some((item) => itemPattern(item).test(text)),
      )

      if (pairedLines.length < 2) {
        return []
      }

      return [
        {
          path,
          line: start,
          target,
          message: `${path}:${start}: ${target}が表・箇条書きへ写されている（${pairedLines.length} 行）`,
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

    return []
  })
}

/**
 * 例外リストを当てる。使われていないエントリは報告する。正本や文書を直した後に
 * 例外だけが残ると、次の複製をその例外が黙って通す。
 *
 * @param {{ path: string, line: number, target: string, message: string }[]} problems
 * @param {{ path: string, target: string, reason: string }[]} allowed
 * @returns {{ remaining: string[], unused: string[] }}
 */
export function applyAllowlist(problems, allowed) {
  const used = new Set()

  const remaining = problems
    .filter((problem) => {
      const index = allowed.findIndex(
        (entry) => entry.path === problem.path && entry.target === problem.target,
      )

      if (index === -1) {
        return true
      }

      used.add(index)

      return false
    })
    .map((problem) => problem.message)

  const unused = allowed.flatMap((entry, index) =>
    used.has(index)
      ? []
      : [
          `scripts/canonical-duplication-allowlist.json: 使われていない例外がある（${entry.path} / ${entry.target}）。複製が解消したなら削除する`,
        ],
  )

  return { remaining, unused }
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

/** @param {string} directory */
const readContractsIn = (directory) =>
  readdirSync(resolve(directory))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(join(directory, name)))

function main() {
  const tokens = readJson('design/tokens.json')
  const rules = readJson('design/rules.json')
  const layouts = readContractsIn('design/layouts')
  const components = readContractsIn('design/components')
  const allowlist = readJson('scripts/canonical-duplication-allowlist.json')

  const values = collectCanonicalValues({ tokens, rules })
  const lists = collectCanonicalLists({ layouts, components, rules })
  const pairings = collectCanonicalPairings({ layouts, components })
  const targets = collectScanTargets()

  const shapeProblems = checkAllowlistShape(allowlist)

  const checks = [
    {
      name: '正本の値が散文へ複製されていない',
      found: targets.flatMap(({ path, source }) => findValueDuplications(path, source, values)),
    },
    {
      name: '正本の一覧が散文へ複製されていない',
      found: targets.flatMap(({ path, source }) => findStructureDuplications(path, source, lists)),
    },
    {
      name: '正本の対応表が散文へ複製されていない',
      found: targets.flatMap(({ path, source }) => findPairingDuplications(path, source, pairings)),
    },
  ]

  /*
   * 例外リストの形が壊れているときは、例外を1件も当てない。壊れた例外を当てたまま
   * 緑を返すと、理由を書かずに検査を黙らせる経路になる。
   */
  const { remaining, unused } = applyAllowlist(
    checks.flatMap(({ found }) => found),
    shapeProblems.length === 0 ? allowlist.allowed : [],
  )

  const remainingMessages = new Set(remaining)
  const problems = [...shapeProblems, ...remaining, ...unused]

  for (const { name, found } of checks) {
    const left = found.filter(({ message }) => remainingMessages.has(message))

    console.log(`${left.length === 0 ? 'ok  ' : 'NG  '}${name}`)
  }

  console.log(`${shapeProblems.length === 0 && unused.length === 0 ? 'ok  ' : 'NG  '}例外リストが理由を持ち、すべて使われている`)

  if (problems.length > 0) {
    console.error(`\n${problems.join('\n')}`)
    process.exit(1)
  }
}

// テストから読み込むときは走らせない。process.exit と標準出力を持つため。
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
