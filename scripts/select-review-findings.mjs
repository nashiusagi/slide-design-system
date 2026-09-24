/**
 * 前周のレビュー記録から、ある観点のレビュアーへ渡す指摘だけを選ぶ（#64）。
 *
 *   node scripts/select-review-findings.mjs --review=<path> --perspective=<agents/*.md>
 *   node scripts/select-review-findings.mjs --review=<path> --report
 *
 * 再レビューでは前周のレビュー全文を全観点へ渡していた（`pr-review/SKILL.md` 手順2）。
 * 周を重ねるほど記録は伸び、それを観点の数だけ配るので、読ませる量が単調に増える。
 * ここは「その観点に関係する指摘だけ」を切り出して、配る量を減らす。
 *
 * 判定はしない。指摘が既に持っている2つの情報だけを読む。
 *
 *   1. `指摘した観点` 欄（`references/review-file-format.md`）— どの観点から挙がったか。
 *      複数観点から挙がった指摘はそのすべてが書かれる
 *   2. カテゴリIDの接頭辞（`references/finding-format.md`）— 1 が無い・読めないときの土台
 *
 * **どちらも読めない指摘は全観点へ渡す。** 渡しすぎは前の状態に戻るだけだが、
 * 渡し損ねると同じ指摘が再生産され、周が伸びて削減分を食い潰す。迷ったら渡す。
 *
 * `blocker` は判定によらず全観点へ渡す。最も重い指摘を仕分けで落とす形にしない。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(REPO_ROOT, '.claude/skills/pr-review')

/** 見出しから重要度を読む。`## blocker（2周目）` のように周が付くことがある。 */
const SEVERITY_HEADING = /^## (blocker|should|consider)(?:（.*）)?\s*$/
/** 指摘の見出し。カテゴリIDは backtick で囲まれ、`（同上）` のような注記が続くことがある。 */
const FINDING_HEADING = /^### `([a-z][a-z0-9-]*)\/([a-z0-9-]+)`/
/** `- **指摘した観点**: 日本語ドキュメント / 設計契約との整合（2観点から独立に挙がった）` */
const PERSPECTIVE_FIELD = /^- \*\*指摘した観点\*\*:\s*(.+)$/

/**
 * `references/finding-format.md` の表から、接頭辞と指示ファイルの対応を読む。
 *
 * この対応をここへ書き写さないのは、接頭辞が増減したときに片方だけが古くなるため。
 * `code` が `code-quality.md` に対応するように、接頭辞とファイル名は一致しない。
 *
 * @param {string} [source] 省略時は正本を読む
 * @returns {Map<string, string>} 接頭辞 -> 指示ファイル（`agents/*.md`）
 */
export function loadPrefixMap(source) {
  const text = source ?? readFileSync(join(SKILL_DIR, 'references/finding-format.md'), 'utf8')
  /** @type {Map<string, string>} */
  const map = new Map()

  for (const line of text.split('\n')) {
    const row = /^\|\s*`([a-z][a-z0-9-]*)`\s*\|\s*`(agents\/[a-z0-9-]+\.md)`\s*\|/.exec(line)
    if (row !== null) {
      map.set(row[1], row[2])
    }
  }

  if (map.size === 0) {
    throw new Error('references/finding-format.md から接頭辞と指示ファイルの対応を読めない。表の書式が変わった可能性がある。')
  }

  return map
}

/**
 * `SKILL.md` 手順4 の観点表から、観点名と指示ファイルの対応を読む。
 *
 * 観点名の正本はあの表であり、ここにも finding-format.md にも書き写さない。
 *
 * @param {string} [source] 省略時は正本を読む
 * @returns {Map<string, string>} 観点名 -> 指示ファイル（`agents/*.md`）
 */
export function loadPerspectiveMap(source) {
  const text = source ?? readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')
  /** @type {Map<string, string>} */
  const map = new Map()

  for (const line of text.split('\n')) {
    const row = /^\|\s*([^|`]+?)\s*\|\s*`(agents\/[a-z0-9-]+\.md)`\s*\|/.exec(line)
    if (row !== null && row[1] !== '観点') {
      map.set(row[1], row[2])
    }
  }

  if (map.size === 0) {
    throw new Error('pr-review/SKILL.md の観点表を読めない。表の書式が変わった可能性がある。')
  }

  return map
}

/**
 * `指摘した観点` 欄の値を観点名の配列へ分解する。
 *
 * 書式は `/` 区切りで、末尾に `（2観点から独立に挙がった）` のような注記が付くことが
 * ある。注記は要素ごとに剥がす——注記が最後の要素に食い込んで書かれるため。
 *
 * @param {string} value
 * @returns {string[]}
 */
export function splitPerspectiveField(value) {
  return value
    .split('/')
    .map((part) => part.replace(/（[^）]*）/g, '').trim())
    .filter((part) => part.length > 0)
}

/**
 * @typedef {{
 *   categoryId: string,
 *   prefix: string,
 *   severity: string,
 *   perspectives: string[],
 *   text: string,
 * }} Finding
 */

/**
 * レビュー記録を指摘単位へ分解する。
 *
 * 重要度は直前の `## blocker` / `## should` / `## consider` 見出しから引き継ぐ。
 * `## 落とした指摘` 以降のように重要度の節を抜けた領域では、指摘の本体は現れない。
 *
 * @param {string} markdown `docs/reviews/pr-<N>.md` の中身
 * @returns {Finding[]}
 */
export function parseFindings(markdown) {
  const lines = markdown.split('\n')
  /** @type {Finding[]} */
  const findings = []
  /** @type {string | null} */
  let severity = null
  /** @type {Finding | null} */
  let current = null

  const flush = () => {
    if (current !== null) {
      current.text = current.text.replace(/\s+$/, '')
      findings.push(current)
      current = null
    }
  }

  for (const line of lines) {
    const severityHeading = SEVERITY_HEADING.exec(line)

    if (severityHeading !== null) {
      flush()
      severity = severityHeading[1]
      continue
    }

    // 重要度以外の `## ` 見出し（`## 落とした指摘`、`## <N>周目` など）に入ったら、
    // そこから先の `### ` は指摘の本体ではない。
    if (line.startsWith('## ')) {
      flush()
      severity = null
      continue
    }

    const findingHeading = FINDING_HEADING.exec(line)

    if (findingHeading !== null && severity !== null) {
      flush()
      current = {
        categoryId: `${findingHeading[1]}/${findingHeading[2]}`,
        prefix: findingHeading[1],
        severity,
        perspectives: [],
        text: `${line}\n`,
      }
      continue
    }

    if (current === null) {
      continue
    }

    current.text += `${line}\n`

    const perspectiveField = PERSPECTIVE_FIELD.exec(line)
    if (perspectiveField !== null) {
      current.perspectives = splitPerspectiveField(perspectiveField[1])
    }
  }

  flush()
  return findings
}

/**
 * 1件の指摘を、どの指示ファイル（観点）へ渡すかを決める。
 *
 * @param {Finding} finding
 * @param {Map<string, string>} prefixMap
 * @param {Map<string, string>} perspectiveMap
 * @param {string[]} allTargets
 * @returns {{ targets: string[], basis: string }}
 */
export function targetsFor(finding, prefixMap, perspectiveMap, allTargets) {
  if (finding.severity === 'blocker') {
    return { targets: [...allTargets], basis: 'blocker' }
  }

  // `指摘した観点` 欄が読めたぶんを優先する。複数観点から挙がった指摘はここに全部載る。
  /** @type {string[]} */
  const fromField = finding.perspectives.flatMap((name) => {
    const target = perspectiveMap.get(name)
    return target === undefined ? [] : [target]
  })

  const fromPrefix = prefixMap.get(finding.prefix)
  const targets = [...new Set([...fromField, ...(fromPrefix === undefined ? [] : [fromPrefix])])]

  if (targets.length === 0) {
    // 欄も接頭辞も読めない。渡し損ねて再生産させるより、前の状態（全員へ渡す）に倒す。
    return { targets: [...allTargets], basis: 'unresolved' }
  }

  return {
    targets,
    basis: fromField.length > 0 ? (fromPrefix === undefined ? 'field' : 'field+prefix') : 'prefix',
  }
}

/**
 * ある観点へ渡す指摘と、渡さなかった指摘に分ける。
 *
 * @param {string} markdown レビュー記録の中身
 * @param {string} perspectiveFile 渡す先の指示ファイル（`agents/*.md`）
 * @param {{ prefixMap?: Map<string, string>, perspectiveMap?: Map<string, string> }} [maps]
 */
export function selectForPerspective(markdown, perspectiveFile, maps = {}) {
  const prefixMap = maps.prefixMap ?? loadPrefixMap()
  const perspectiveMap = maps.perspectiveMap ?? loadPerspectiveMap()
  const allTargets = [...new Set(perspectiveMap.values())]

  if (!allTargets.includes(perspectiveFile)) {
    throw new Error(`観点 '${perspectiveFile}' は観点表に無い。指定できるのは: ${allTargets.join(' / ')}`)
  }

  const findings = parseFindings(markdown)
  /** @type {(Finding & { basis: string })[]} */
  const selected = []
  /** @type {(Finding & { basis: string })[]} */
  const dropped = []

  for (const finding of findings) {
    const { targets, basis } = targetsFor(finding, prefixMap, perspectiveMap, allTargets)
    ;(targets.includes(perspectiveFile) ? selected : dropped).push({ ...finding, basis })
  }

  return { selected, dropped, findingCount: findings.length }
}

/**
 * 観点ごとの選別結果をまとめる。削減量の実測と、渡さなかった指摘の記録に使う。
 *
 * @param {string} markdown
 * @param {{ prefixMap?: Map<string, string>, perspectiveMap?: Map<string, string> }} [maps]
 */
export function summarize(markdown, maps = {}) {
  const prefixMap = maps.prefixMap ?? loadPrefixMap()
  const perspectiveMap = maps.perspectiveMap ?? loadPerspectiveMap()
  const allTargets = [...new Set(perspectiveMap.values())]
  const findings = parseFindings(markdown)
  const fullSize = findings.reduce((sum, finding) => sum + finding.text.length, 0)

  const perPerspective = allTargets.map((target) => {
    const { selected, dropped } = selectForPerspective(markdown, target, { prefixMap, perspectiveMap })
    return {
      perspective: target,
      selectedCount: selected.length,
      selectedSize: selected.reduce((sum, finding) => sum + finding.text.length, 0),
      dropped: dropped.map((finding) => ({ categoryId: finding.categoryId, severity: finding.severity })),
    }
  })

  return {
    findingCount: findings.length,
    perspectiveCount: allTargets.length,
    before: fullSize * allTargets.length,
    after: perPerspective.reduce((sum, entry) => sum + entry.selectedSize, 0),
    perPerspective,
  }
}

/**
 * @param {string[]} argv
 * @returns {{ review: string, perspective: string | null, report: boolean }}
 */
function parseArgs(argv) {
  /** @type {{ review: string | null, perspective: string | null, report: boolean }} */
  const args = { review: null, perspective: null, report: false }

  for (const arg of argv) {
    if (arg === '--report') args.report = true
    else if (arg.startsWith('--review=')) args.review = resolve(arg.slice('--review='.length))
    else if (arg.startsWith('--perspective=')) args.perspective = arg.slice('--perspective='.length)
    else throw new Error(`知らない引数: ${arg}`)
  }

  if (args.review === null) {
    throw new Error('--review=<レビュー記録のパス> が要る')
  }

  if (args.perspective === null && !args.report) {
    throw new Error('--perspective=<agents/*.md> か --report のどちらかが要る')
  }

  return { ...args, review: args.review }
}

function main() {
  const { review, perspective, report } = parseArgs(process.argv.slice(2))
  const markdown = readFileSync(review, 'utf8')

  if (report) {
    const result = summarize(markdown)
    const ratio = result.before === 0 ? 0 : Math.round((1 - result.after / result.before) * 100)

    console.log(`指摘 ${result.findingCount} 件 / 観点 ${result.perspectiveCount}`)
    console.log(`全文を配ると ${result.before.toLocaleString()} 文字、選別すると ${result.after.toLocaleString()} 文字（削減 ${ratio}%）\n`)

    for (const entry of result.perPerspective) {
      console.log(`  ${entry.perspective.padEnd(22)} ${String(entry.selectedCount).padStart(3)} 件 ${String(entry.selectedSize).padStart(7)} 文字`)
    }
    return
  }

  if (perspective === null) {
    throw new Error('--perspective=<agents/*.md> が要る')
  }

  const { selected } = selectForPerspective(markdown, perspective)
  console.log(selected.map((finding) => finding.text).join('\n\n'))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
