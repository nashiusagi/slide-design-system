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
 * 判定はしない。指摘が既に持っている2つの情報を読む。
 *
 *   1. `指摘した観点` 欄（`references/review-file-format.md`）— どの観点から挙がったか
 *   2. カテゴリIDの接頭辞（`references/finding-format.md`）
 *
 * **2つは和集合を取る。どちらか一方を優先して切り落とさない**（DR-0055 決定3）。
 * 欄だけを見ると、欄が省かれた指摘（実データに存在する）が接頭辞の手掛かりを失う。
 * 接頭辞だけを見ると、複数観点から挙がったことが消える。
 *
 * **渡し損ねを黙って起こさない。** 次の3つはいずれも全観点へ渡す。
 *
 *   - `blocker` の指摘
 *   - 欄の観点名を1つでも解決できなかった指摘
 *   - 欄も接頭辞も解決できなかった指摘
 *
 * さらに、**カテゴリID形の見出しを1つでも指摘として取り込めなかったファイルは、
 * 選別せず全文を渡す**（`fallback`）。書式は揺れる。取りこぼしたぶんは `findingCount`
 * にすら入らないので、指摘単位の退避路より手前で消える。ファイル単位の退避路が要る。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(REPO_ROOT, '.claude/skills/pr-review')

/**
 * 全観点へ渡す重要度。`finding-format.md` の重要度表で最も重い値。
 *
 * 語彙そのものは表から読む（`loadSeverities`）が、この1語だけは実装の分岐なので
 * ここに置く。表の行の並びを「重い順」と解釈して先頭を取る形にすると、表に順序の
 * 意味があることが表のどこにも書かれないまま実装だけが依存する。正本側にも同じ
 * 断りを置いてある。
 */
const ALWAYS_BROADCAST = 'blocker'

/** 見出し行。`#` の数（深さ）と中身を取る。 */
const HEADING = /^(#{1,6})\s+(.*)$/
/** カテゴリID形の見出し。backtick の有無は問わない（古い記録は付けていない）。 */
const FINDING_TITLE = /^`?([a-z][a-z0-9-]*)\/([a-z0-9-]+)`?/
/** `- **指摘した観点**: 日本語ドキュメント / 設計契約との整合（2観点から独立に挙がった）` */
const PERSPECTIVE_FIELD = /^- \*\*指摘した観点\*\*:\s*(.+)$/
/** `指摘した観点` 欄の区切り。実データは `/` と `、` の両方を使う。 */
const PERSPECTIVE_SEPARATOR = /[/、,]/
/**
 * 欄の末尾に付く注記。行末で閉じるものだけを、連続するぶんまとめて外す。
 *
 * **注記の後にまだ観点名が続く形は外せない**（`A、B（…注記…）、C` のような欄が
 * 実データにある）。その注記が区切り文字を含むと、観点名が断片へ割れる。正規表現で
 * 末尾を見るやり方の限界で、根治には既知の観点名への最長一致が要る。恒久対応は
 * https://github.com/nashiusagi/slide-design-system/issues/67 が扱う。
 *
 * 割れた断片は観点名として解決できないので、安全弁（DR-0055 決定4）で全観点へ渡る。
 * 落ちはしないが、その指摘については選別が効かない。`unresolvedPerspectives` に出る。
 */
const TRAILING_ANNOTATION = /(?:[（(][^）)]*[）)]\s*)+$/

/**
 * `references/finding-format.md` の重要度表から、重要度の語彙を読む。
 *
 * 実装へ書き写さないのは、語が増減・改称されたときに片方だけが古くなるため。
 * 認識できない重要度の節は、その下の指摘ごと静かに消える形で壊れる。
 *
 * @param {string} [source] 省略時は正本を読む
 * @returns {string[]}
 */
export function loadSeverities(source) {
  const text = source ?? readFileSync(join(SKILL_DIR, 'references/finding-format.md'), 'utf8')
  const section = /\n## 重要度\n([\s\S]*?)(?=\n## |$)/.exec(text)

  if (section === null) {
    throw new Error('references/finding-format.md に「## 重要度」の節が無い。正本の構成が変わった可能性がある。')
  }

  const severities = [...section[1].matchAll(/^\|\s*`([a-z][a-z0-9-]*)`\s*\|/gm)].map((row) => row[1])

  if (severities.length === 0) {
    throw new Error('references/finding-format.md の重要度表を読めない。表の書式が変わった可能性がある。')
  }

  if (!severities.includes(ALWAYS_BROADCAST)) {
    throw new Error(`重要度表に '${ALWAYS_BROADCAST}' が無い。全観点へ渡す重要度が決められない。`)
  }

  return severities
}

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
 * 観点名を照合用の形へ正規化する。
 *
 * 括弧の中身を落とす。`指摘した観点` 欄の注記（`（2観点から独立に挙がった）`）と、
 * **観点名そのものに含まれる括弧**（`決定記録（DR）との整合`）の両方が落ちる。
 * 両側を同じ規則で正規化すれば、注記付きでも短い表記でも同じ鍵に寄る。
 *
 * 片側だけを剥がすと、正本の名前が照合できなくなる（実際にそう壊れた）。
 *
 * @param {string} name
 */
export function normalizePerspectiveName(name) {
  return name.replace(/[（(][^）)]*[）)]/g, '').trim()
}

/**
 * 観点名 -> 指示ファイル の対応を、正規化した鍵で引けるようにする。
 *
 * @param {Map<string, string>} perspectiveMap
 * @returns {Map<string, string>}
 */
export function buildLookup(perspectiveMap) {
  /** @type {Map<string, string>} */
  const lookup = new Map()

  for (const [name, file] of perspectiveMap) {
    lookup.set(name, file)

    const normalized = normalizePerspectiveName(name)
    const existing = lookup.get(normalized)

    if (existing !== undefined && existing !== file) {
      throw new Error(`観点名 '${name}' の正規化結果 '${normalized}' が別の観点と衝突する。観点表を確かめること。`)
    }

    lookup.set(normalized, file)
  }

  return lookup
}

/**
 * `指摘した観点` 欄の値を観点名の配列へ分解する。
 *
 * **末尾の注記を先に外してから区切る。** 注記は区切り文字（`、` や `/`）を含むことが
 * あり、先に区切ると注記が割れて、閉じ括弧だけの断片が観点名として残る。
 *
 * 外すのは行末で閉じる括弧だけだ（連続していればまとめて外す）。観点名そのものが
 * 括弧を含むことがあり（`決定記録（DR）との整合`）、途中の括弧まで外すと正本の名前が
 * 壊れる。名前の中の括弧は照合側で正規化する（`normalizePerspectiveName`）。
 *
 * **注記の後に観点名が続く形は外せない。** `TRAILING_ANNOTATION` の説明を参照。
 *
 * @param {string} value
 * @returns {string[]}
 */
export function splitPerspectiveField(value) {
  return value
    .replace(TRAILING_ANNOTATION, '')
    .split(PERSPECTIVE_SEPARATOR)
    .map((part) => part.trim())
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
 * 見出しの深さを固定しない。実データは2つの書き方に割れている。
 *
 *   `## blocker`          > `` ### `id` ``      （初回、および `## blocker（2周目）`）
 *   `## 2周目` > `### should` > `` #### `id` `` （2周目以降の大半）
 *
 * 重要度の節は「重要度語だけの見出し」で始まり、それと同じ深さ以上の見出しで終わる。
 * 指摘はその節より深い見出しになる。深さを決め打ちにすると、片方の書き方の指摘が
 * 丸ごと消える（実際にそう壊れた）。
 *
 * @param {string} markdown `docs/reviews/pr-<N>.md` の中身
 * @param {string[]} [severities] 省略時は正本から読む
 * @returns {Finding[]}
 */
export function parseFindings(markdown, severities) {
  const vocabulary = severities ?? loadSeverities()
  const severityHeading = new RegExp(`^(${vocabulary.join('|')})(?:[（(].*[）)])?$`)

  /** @type {Finding[]} */
  const findings = []
  /** @type {string | null} */
  let severity = null
  let severityDepth = 0
  /** @type {Finding | null} */
  let current = null

  const flush = () => {
    if (current !== null) {
      current.text = current.text.replace(/\s+$/, '')
      findings.push(current)
      current = null
    }
  }

  for (const line of markdown.split('\n')) {
    const heading = HEADING.exec(line)

    if (heading !== null) {
      const depth = heading[1].length
      const title = heading[2].trim()

      const matchedSeverity = severityHeading.exec(title)

      if (matchedSeverity !== null) {
        flush()
        severity = matchedSeverity[1]
        severityDepth = depth
        continue
      }

      const findingTitle = FINDING_TITLE.exec(title)

      if (findingTitle !== null && severity !== null && depth > severityDepth) {
        flush()
        current = {
          categoryId: `${findingTitle[1]}/${findingTitle[2]}`,
          prefix: findingTitle[1],
          severity,
          perspectives: [],
          text: `${line}\n`,
        }
        continue
      }

      // 重要度の節と同じ深さ以上の、重要度でない見出し（`## 2周目`、`## 落とした指摘`）。
      // ここで節を抜ける。
      if (severity !== null && depth <= severityDepth) {
        flush()
        severity = null
      }

      if (current !== null) {
        current.text += `${line}\n`
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
 * ファイル中のカテゴリID形の見出しのうち、指摘として取り込めなかった数を数える。
 *
 * 0 でなければ、その記録は想定していない書き方を含む。選別せず全文を渡す判断に使う。
 *
 * @param {string} markdown
 * @param {Finding[]} findings
 */
export function countUnparsedHeadings(markdown, findings) {
  let total = 0

  for (const line of markdown.split('\n')) {
    const heading = HEADING.exec(line)
    if (heading !== null && FINDING_TITLE.test(heading[2].trim())) {
      total += 1
    }
  }

  return Math.max(0, total - findings.length)
}

/**
 * 1件の指摘を、どの指示ファイル（観点）へ渡すかを決める。
 *
 * @param {Finding} finding
 * @param {Map<string, string>} prefixMap
 * @param {Map<string, string>} lookup 正規化した観点名でも引ける対応
 * @param {string[]} allTargets
 * @returns {{ targets: string[], basis: string }}
 */
export function targetsFor(finding, prefixMap, lookup, allTargets) {
  if (finding.severity === ALWAYS_BROADCAST) {
    return { targets: [...allTargets], basis: 'broadcast' }
  }

  /** @type {string[]} */
  const fromField = []
  let unresolvedNames = 0

  for (const name of finding.perspectives) {
    const target = lookup.get(name) ?? lookup.get(normalizePerspectiveName(name))

    if (target === undefined) {
      unresolvedNames += 1
    } else {
      fromField.push(target)
    }
  }

  // 欄に書かれた観点名を1つでも解決できなければ、渡し先を確定させない。接頭辞だけで
  // 決めると、解決できなかった観点へ渡らないまま「決まった」ことになり、複数観点から
  // 挙がったという信号が静かに消える（DR-0055 決定4）。
  if (unresolvedNames > 0) {
    return { targets: [...allTargets], basis: 'unresolved-perspective' }
  }

  const fromPrefix = prefixMap.get(finding.prefix)
  const known = fromPrefix !== undefined && allTargets.includes(fromPrefix)
  const targets = [...new Set([...fromField, ...(known ? [fromPrefix] : [])])].filter((target) =>
    allTargets.includes(target),
  )

  if (targets.length === 0) {
    return { targets: [...allTargets], basis: 'unresolved' }
  }

  return {
    targets,
    basis: fromField.length > 0 ? (known ? 'field+prefix' : 'field') : 'prefix',
  }
}

/**
 * 接頭辞表と観点表が食い違っていないかを確かめる。
 *
 * 2つの表は別ファイルの正本なので、片方だけが変わる形（観点の統廃合、指示ファイルの
 * 改名）が起こりうる。そのとき黙って「その接頭辞の指摘が誰にも渡らない」状態になる
 * のを防ぐ。
 *
 * @param {Map<string, string>} prefixMap
 * @param {Map<string, string>} perspectiveMap
 */
export function assertMapsAgree(prefixMap, perspectiveMap) {
  const targets = new Set(perspectiveMap.values())
  const orphans = [...prefixMap].filter(([, file]) => !targets.has(file))

  if (orphans.length > 0) {
    throw new Error(
      `接頭辞表が、観点表に無い指示ファイルを指している: ${orphans
        .map(([prefix, file]) => `${prefix} -> ${file}`)
        .join(' / ')}。どちらかの正本が古い。`,
    )
  }
}

/**
 * @param {{ prefixMap?: Map<string, string>, perspectiveMap?: Map<string, string>, severities?: string[] }} [maps]
 */
function resolveMaps(maps = {}) {
  const prefixMap = maps.prefixMap ?? loadPrefixMap()
  const perspectiveMap = maps.perspectiveMap ?? loadPerspectiveMap()
  const severities = maps.severities ?? loadSeverities()

  assertMapsAgree(prefixMap, perspectiveMap)

  return {
    prefixMap,
    perspectiveMap,
    severities,
    lookup: buildLookup(perspectiveMap),
    allTargets: [...new Set(perspectiveMap.values())],
  }
}

/**
 * ある観点へ渡す指摘と、渡さなかった指摘に分ける。
 *
 * `fallback` が真なら、取りこぼしがあったので選別してはいけない。呼ぶ側は全文を渡す。
 *
 * @param {string} markdown レビュー記録の中身
 * @param {string} perspectiveFile 渡す先の指示ファイル（`agents/*.md`）
 * @param {Parameters<typeof resolveMaps>[0]} [maps]
 */
export function selectForPerspective(markdown, perspectiveFile, maps) {
  const { prefixMap, lookup, allTargets, severities } = resolveMaps(maps)

  if (!allTargets.includes(perspectiveFile)) {
    throw new Error(`観点 '${perspectiveFile}' は観点表に無い。指定できるのは: ${allTargets.join(' / ')}`)
  }

  const findings = parseFindings(markdown, severities)
  const unparsed = countUnparsedHeadings(markdown, findings)
  /** @type {(Finding & { basis: string })[]} */
  const selected = []
  /** @type {(Finding & { basis: string })[]} */
  const dropped = []

  for (const finding of findings) {
    const { targets, basis } = targetsFor(finding, prefixMap, lookup, allTargets)
    ;(targets.includes(perspectiveFile) ? selected : dropped).push({ ...finding, basis })
  }

  return { selected, dropped, findingCount: findings.length, unparsed, fallback: unparsed > 0 }
}

/**
 * 観点ごとの選別結果をまとめる。渡した量の実測と、渡さなかった指摘の記録に使う。
 *
 * `beforeSelection` は「選別前に渡していた量」＝記録の全文 × 観点数。選別後との比較で
 * 母数を揃えるため、指摘本文の合計ではなくファイル全体を取る。
 *
 * @param {string} markdown
 * @param {Parameters<typeof resolveMaps>[0]} [maps]
 */
export function summarize(markdown, maps) {
  const resolved = resolveMaps(maps)
  const findings = parseFindings(markdown, resolved.severities)
  const unparsed = countUnparsedHeadings(markdown, findings)
  /** @type {Map<string, string>} 指示ファイル -> 観点名（記録には観点名で書くため） */
  const names = new Map([...resolved.perspectiveMap].map(([name, file]) => [file, name]))

  const perPerspective = resolved.allTargets.map((target) => {
    const { selected, dropped } = selectForPerspective(markdown, target, maps)
    return {
      perspective: target,
      perspectiveName: names.get(target) ?? target,
      selectedCount: selected.length,
      selectedSize: selected.reduce((sum, finding) => sum + finding.text.length, 0),
      dropped: dropped.map((finding) => ({ categoryId: finding.categoryId, severity: finding.severity })),
    }
  })

  // 解決できなかった観点名を持つ指摘は、安全弁（決定4 の3項目目）で全観点へ渡る。
  // **渡るので取りこぼしではないが、その指摘については選別が効いていない。** 記録に
  // 残らないと、効かなかったことに誰も気づかないまま削減率だけが下がる。
  //
  // 全観点へ渡す重要度（決定4 の1項目目）は除く。あちらは欄の解決を試す前に渡し先が
  // 決まるので、欄が読めるかどうかは選別の実効性と関係がない。混ぜると、欄を直せば
  // 選別が効くようになると読めてしまい、本当に効いていないものが埋もれる。
  const unresolvedPerspectives = findings
    .filter((finding) => finding.severity !== ALWAYS_BROADCAST)
    .map((finding) => ({
      categoryId: finding.categoryId,
      names: finding.perspectives.filter(
        (name) => (resolved.lookup.get(name) ?? resolved.lookup.get(normalizePerspectiveName(name))) === undefined,
      ),
    }))
    .filter((entry) => entry.names.length > 0)

  return {
    findingCount: findings.length,
    unparsed,
    fallback: unparsed > 0,
    unresolvedPerspectives,
    perspectiveCount: resolved.allTargets.length,
    beforeSelection: markdown.length * resolved.allTargets.length,
    afterSelection: perPerspective.reduce((sum, entry) => sum + entry.selectedSize, 0),
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

    if (result.fallback) {
      console.log(
        `NG  取りこぼし ${result.unparsed} 件。カテゴリID形の見出しのうち、指摘として読めないものがある。\n` +
          '    この記録は選別せず全文を渡すこと。書式を確かめること。\n',
      )
    }

    const ratio = result.beforeSelection === 0 ? 0 : Math.round((1 - result.afterSelection / result.beforeSelection) * 100)
    console.log(`指摘 ${result.findingCount} 件 / 観点 ${result.perspectiveCount}`)
    console.log(
      `選別前に渡していた量（記録の全文 × 観点数） ${result.beforeSelection.toLocaleString()} 文字、` +
        `選別すると ${result.afterSelection.toLocaleString()} 文字（削減 ${ratio}%）\n`,
    )

    for (const entry of result.perPerspective) {
      console.log(`  ${entry.perspectiveName}`)
      console.log(`    渡す: ${entry.selectedCount} 件 / ${entry.selectedSize.toLocaleString()} 文字`)
      console.log(
        `    渡さない: ${
          entry.dropped.length === 0
            ? 'なし'
            : entry.dropped.map((finding) => `${finding.categoryId}（${finding.severity}）`).join(' / ')
        }`,
      )
    }

    if (result.unresolvedPerspectives.length > 0) {
      console.log(
        `\n注意: ${result.unresolvedPerspectives.length} 件の指摘で、\`指摘した観点\` 欄の観点名を解決できなかった。\n` +
          '      これらは安全弁（DR-0055 決定4）で全観点へ渡るので落ちてはいないが、選別は効いていない。',
      )
      for (const entry of result.unresolvedPerspectives) {
        console.log(`      ${entry.categoryId}: ${entry.names.map((name) => `「${name}」`).join(' / ')}`)
      }
    }

    if (result.fallback) {
      process.exitCode = 1
    }

    return
  }

  if (perspective === null) {
    throw new Error('--perspective=<agents/*.md> が要る')
  }

  const { selected, fallback, unparsed } = selectForPerspective(markdown, perspective)

  if (fallback) {
    console.error(`警告: 取りこぼし ${unparsed} 件。選別せず全文を出力する。`)
    console.log(markdown)
    return
  }

  console.log(selected.map((finding) => finding.text).join('\n\n'))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
