/**
 * 検査そのものが複製を捕まえられるかを固定する。
 *
 * 正しい入力で ok になることは pnpm canonical:check が毎回示すので、ここが持つのは
 * 壊れた入力を渡したときに必ず1件返るという側（DR-0033 帰結）。塞げていない形も、
 * 塞げていないまま固定する。塞いだつもりの形が増減したら、ここが落ちる。
 *
 * フィクスチャは正本から値と一覧を取って組み立てる。ここへ書き写すと、正本が変わっても
 * このテストだけが古い値で緑を返し、検査が禁じている複製をテストが実演することになる。
 * 再現する対象は指摘ログの代表例で、各ケースにカテゴリIDと出所の PR を書く。
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  MIN_REASON_LENGTH,
  applyAllowlist,
  checkAllowlistShape,
  codeSpans,
  collectCanonicalLists,
  collectCanonicalPairings,
  collectCanonicalValues,
  collectProblems,
  collectScanTargets,
  findPairingDuplications,
  findStructureDuplications,
  findValueDuplications,
  readContractsIn,
} from './check-canonical-duplication.mjs'

/** @param {string} path */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const tokens = readJson('design/tokens.json')
const rules = readJson('design/rules.json')
const layouts = readContractsIn('design/layouts')
const components = readContractsIn('design/components')

const values = collectCanonicalValues({ tokens, rules })
const lists = collectCanonicalLists({ layouts, components, rules })
const pairings = collectCanonicalPairings({ components })

/** @param {string} source */
const valuesIn = (source) => findValueDuplications('README.md', source, values)

describe('collectCanonicalValues / findValueDuplications', () => {
  /* `contract/design-data-duplicated`（通算10回、PR #13 初出）の代表例。 */
  it('トークンの色を他の文書へ書き写すと捕まえる', () => {
    const found = valuesIn(`アクセントには ${tokens.color.accent} を使う。`)

    expect(found).toHaveLength(1)
    expect(found[0].targets).toContain('design/tokens.json の color.accent')
  })

  /* `decisions/dr-restates-canonical-value`（通算6回、PR #41 / #47）の代表例。 */
  it('検査の閾値を単位付きで書き写すと捕まえる', () => {
    const found = valuesIn(`本文の下限は ${rules.minFontSize.px}px とする。`)

    expect(found).toHaveLength(1)
    expect(found[0].targets).toContain('design/rules.json の minFontSize.px')
  })

  it('閾値をインラインコードだけで置いても捕まえる', () => {
    const found = valuesIn(`本文の下限は \`${rules.minFontSize.px}\` とする。`)

    expect(found).toHaveLength(1)
    expect(found[0].targets).toContain('design/rules.json の minFontSize.px')
  })

  /*
   * rules.json の閾値は木ごと拾う。名指しで読むと、閾値を足したときに検査だけが
   * 増えない。この誤差はテストからは見えないので、閾値の場所が違う値で固定する。
   */
  it('minFontSize 以外の閾値も、正本を辿って拾う', () => {
    const found = valuesIn(`許容誤差は \`${rules.noOverflow.toleranceInPx}\` とする。`)

    expect(found).toHaveLength(1)
    expect(found[0].targets).toContain('design/rules.json の noOverflow.toleranceInPx')
  })

  /* `contract/value-outside-source-of-truth`（通算4回、PR #13 初出）の代表例。 */
  it('キャンバス寸法を対で書き写すと捕まえる', () => {
    const found = valuesIn(`${tokens.canvas.width}x${tokens.canvas.height} の固定キャンバスで測る。`)

    expect(found).toHaveLength(1)
    expect(found[0].targets).toContain('design/tokens.json の canvas')
  })

  it('キャンバス寸法の対は空白や区切り記号を挟んでも捕まえる', () => {
    expect(valuesIn(`${tokens.canvas.width} x ${tokens.canvas.height} のキャンバス`)).toHaveLength(1)
    expect(valuesIn(`${tokens.canvas.width}×${tokens.canvas.height} のキャンバス`)).toHaveLength(1)
  })

  it('報告に複製が現れた行番号が入る', () => {
    const found = findValueDuplications('README.md', `1行目\n2行目\nアクセントは ${tokens.color.accent}`, values)

    expect(found).toHaveLength(1)
    expect(found[0].line).toBe(3)
    expect(found[0].message).toContain('README.md:3')
  })

  it('同じ値を持つ正本が複数あるとき、報告はどちらの在り処も挙げる', () => {
    const shared = values.find(({ targets }) => targets.length > 1)

    expect(shared).toBeDefined()
    expect(valuesIn(`余白は \`${shared?.value}\` とする。`)[0].targets.length).toBeGreaterThan(1)
  })

  it('正本を参照しているだけの記述は捕まえない', () => {
    expect(valuesIn('アクセントの値は `design/tokens.json` の `color.accent` にある。')).toEqual([])
  })

  /*
   * 誤検出が支配的になると検査そのものが無視される（DR-0046 決定2）。散文に普通に
   * 現れる数字で報告が出ないことを固定する。
   */
  it('散文の数字（フェーズ番号・回数）を値として報告しない', () => {
    expect(valuesIn('Phase 1.5 で追加する。レビューは 3 周を上限とする。')).toEqual([])
  })

  it('正本の値が、より長い数値リテラルの一部として現れたときは報告しない', () => {
    expect(valuesIn(`余白は ${tokens.space['2xs']}7px ではない。`)).toEqual([])
  })

  it('隣り合う別々のインラインコードに挟まれた数値を報告しない', () => {
    expect(valuesIn(`\`design/rules.json\` ${rules.minFontSize.px} \`design/tokens.json\``)).toEqual([])
  })

  /*
   * 以下は塞げていない形（DR-0046 帰結の「既知の抜け道」）。緑でなくなったら抜け道が
   * 塞がったということなので、DR の帰結を直す。
   */
  it('単位もコード記法も伴わない裸の数値は、既知の抜け道として報告しない', () => {
    expect(valuesIn(`コントラスト比は ${rules.contrast.requirements[0].minimum} 以上とする。`)).toEqual([])
  })

  it('px / % 以外の単位、および数値と単位のあいだに装飾が入る形は、既知の抜け道として報告しない', () => {
    expect(valuesIn(`行間は ${tokens.type.lineHeight.tight}em とする。`)).toEqual([])
    expect(valuesIn(`本文の下限は **${rules.minFontSize.px}**px とする。`)).toEqual([])
    expect(valuesIn(`本文の下限は ${rules.minFontSize.px} ピクセルとする。`)).toEqual([])
  })

  it('短くありふれた文字列（`none` 等）は、既知の抜け道として報告しない', () => {
    expect(valuesIn(`影の既定は ${tokens.shadow.none} とする。`)).toEqual([])
  })
})

describe('codeSpans', () => {
  it('インラインコードの中身だけを返す', () => {
    expect(codeSpans('`a` 18 `b`')).toEqual(['a', 'b'])
  })
})

/** @param {string} source */
const structureIn = (source) => findStructureDuplications('README.md', source, lists)

/** @param {(name: string) => string} row */
const layoutBlock = (row) => layouts.map((layout) => row(layout.name)).join('\n')

describe('findStructureDuplications', () => {
  /* `contract/contract-structure-duplicated`（通算6回、PR #27）の代表例。 */
  it('レイアウトの一覧を表として複製すると捕まえる', () => {
    const source = ['| name | 役割 |', '| --- | --- |', layoutBlock((name) => `| ${name} | 説明 |`)].join('\n')
    const found = structureIn(source)

    expect(found.length).toBeGreaterThan(0)
    expect(found[0].targets).toContain('design/layouts/ の name 一覧')
  })

  it('箇条書きへ1行1件で並べても捕まえる', () => {
    expect(structureIn(layoutBlock((name) => `- \`${name}\` — 説明`)).length).toBeGreaterThan(0)
  })

  it('順序を入れ替えても捕まえる', () => {
    const source = [...layouts].reverse().map((layout) => `- \`${layout.name}\``).join('\n')

    expect(structureIn(source).length).toBeGreaterThan(0)
  })

  it('項目のあいだに空行を入れた箇条書きでも捕まえる', () => {
    expect(structureIn(layoutBlock((name) => `- \`${name}\`\n`)).length).toBeGreaterThan(0)
  })

  it('丸括弧の番号付き箇条書きでも捕まえる', () => {
    expect(structureIn(layoutBlock((name) => `1) \`${name}\``)).length).toBeGreaterThan(0)
  })

  it('先頭のパイプを省いた表でも捕まえる', () => {
    const source = ['name | 役割', '--- | ---', layoutBlock((name) => `${name} | 説明`)].join('\n')

    expect(structureIn(source).length).toBeGreaterThan(0)
  })

  /*
   * パイプを持つだけで表と見なすと、区切り記号としてパイプを使った地の文が表の行になり、
   * 離れた単発の言及どうしが1つのブロックへ繋がって誤検出になる。
   */
  it('区切り行を伴わない、パイプを含む地の文は表として扱わない', () => {
    const source = [
      `処理は 前段 | 後段 の順で進む。今日は \`${layouts[0].name}\` を試した。`,
      `別の日に 検証 | 修正 の順で進めた。今日は \`${layouts[1].name}\` を試した。`,
    ].join('\n')

    expect(structureIn(source)).toEqual([])
  })

  it('一覧の全項目が1行に並ぶ形も捕まえる', () => {
    const found = structureIn(`レイアウトは ${layouts.map((layout) => `\`${layout.name}\``).join(' / ')}。`)

    expect(found.length).toBeGreaterThan(0)
    expect(found[0].message).toContain('1行へ写されている')
  })

  it('ルールIDの一覧を箇条書きへ複製すると捕まえる', () => {
    const source = rules.rules
      .filter((/** @type {any} */ rule) => rule.method === 'lint')
      .map((/** @type {any} */ rule) => `- \`${rule.id}\` — 説明`)
      .join('\n')
    const found = structureIn(source)

    expect(found.length).toBeGreaterThan(0)
    expect(found[0].targets).toContain('design/rules.json の rules[].id 一覧')
  })

  it('1件だけの言及は複製として報告しない', () => {
    expect(structureIn(`- \`${layouts[0].name}\` を選ぶ基準は契約にある`)).toEqual([])
  })

  it('同じ1件が複数行に現れても、一覧の複製として報告しない', () => {
    const source = [`- \`${layouts[0].name}\` を選ぶ`, `- \`${layouts[0].name}\` を選ばない`].join('\n')

    expect(structureIn(source)).toEqual([])
  })

  /*
   * 表の行の判定にパイプを使うため、コード例にパイプを含むだけの地の文が表の行として
   * 扱われると、離れた単発の言及どうしがブロックとして繋がり、複製でないものを報告する。
   */
  it('コード例にパイプを含む地の文は、箇条書き・表の行として扱わない', () => {
    const source = [
      `- \`${layouts[0].name}\` を選ぶ基準は契約にある`,
      'コマンドは `foo | bar` のようにパイプでつなぐ。',
      `- \`${layouts[1].name}\` を選ぶ基準も契約にある`,
    ].join('\n')

    expect(structureIn(source)).toEqual([])
  })

  it('箇条書き・表の外に散った言及は報告しない', () => {
    expect(structureIn(layouts.map((layout) => `\`${layout.name}\` は役割で選ぶ。`).join('\n\n'))).toEqual([])
  })

  it('名前を部分文字列として含む語（クラス名等）を項目と見なさない', () => {
    expect(structureIn(layoutBlock((name) => `- \`.slide--${name}\` を当てる`))).toEqual([])
  })
})

/** @param {string} source */
const pairingsIn = (source) => findPairingDuplications('README.md', source, pairings)

describe('findPairingDuplications', () => {
  /* `contract/contract-structure-duplicated` のうち、対応表として写された形。 */
  it('allowedIn の対応表を複製すると捕まえる', () => {
    const source = components
      .flatMap((component) =>
        component.allowedIn
          .filter((/** @type {string} */ name) => name !== component.name)
          .map((/** @type {string} */ name) => `| ${component.name} | ${name} |`),
      )
      .join('\n')
    const found = pairingsIn(source)

    expect(found.length).toBeGreaterThan(0)
    expect(found[0].targets).toContain('design/components/ の allowedIn 対応表')
  })

  it('対応が1行しか無ければ報告しない', () => {
    expect(pairingsIn(`| ${components[0].name} | ${components[0].allowedIn.join(' / ')} |`)).toEqual([])
  })

  /*
   * component と layout に同名の対（statement）があるため、名前の共起だけで判定すると
   * その語に触れた箇条書きがすべて対応表として報告される。誤検出は例外登録を呼び、
   * 例外はそのファイルの対応表検査ごと黙らせる。
   */
  it('component と layout が同名の語に触れただけの箇条書きを報告しない', () => {
    const sameName = components.find((component) => component.allowedIn.includes(component.name))

    expect(sameName).toBeDefined()
    expect(
      pairingsIn([`- \`${sameName?.name}\` レイアウトの説明`, `- \`${sameName?.name}\` 部品の説明`].join('\n')),
    ).toEqual([])
  })

  it('正本に無い組み合わせが並んでいても報告しない', () => {
    const component = components.find((candidate) => candidate.allowedIn.length === 1)
    const outside = layouts.find((layout) => !component?.allowedIn.includes(layout.name))
    const row = `- \`${component?.name}\` は \`${outside?.name}\` に置ける`

    expect(pairingsIn([row, row].join('\n'))).toEqual([])
  })
})

const validEntry = {
  path: 'README.md',
  target: 'design/tokens.json の color.accent',
  reason: 'あ'.repeat(MIN_REASON_LENGTH),
  count: 1,
}

/**
 * エントリから項目を1つ落とす。欠けたときに落ちることを見るためのもので、分割代入で
 * 捨て変数を作ると lint が未使用として落とす。
 *
 * @param {Record<string, unknown>} entry
 * @param {string} key
 */
const without = (entry, key) => Object.fromEntries(Object.entries(entry).filter(([name]) => name !== key))

describe('checkAllowlistShape', () => {
  it('理由と件数のある例外は通す', () => {
    expect(checkAllowlistShape({ allowed: [validEntry] })).toEqual([])
  })

  it('理由の無い例外を拒む', () => {
    expect(
      checkAllowlistShape({ allowed: [{ path: validEntry.path, target: validEntry.target, count: 1 }] }),
    ).toHaveLength(1)
  })

  it('理由が短すぎる例外を拒む', () => {
    const found = checkAllowlistShape({
      allowed: [{ ...validEntry, reason: 'あ'.repeat(MIN_REASON_LENGTH - 1) }],
    })

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('reason')
  })

  it('件数の無い例外を拒む', () => {
    expect(checkAllowlistShape({ allowed: [without(validEntry, 'count')] })).toHaveLength(1)
  })

  it('path / target を欠く例外を拒む', () => {
    expect(checkAllowlistShape({ allowed: [without(validEntry, 'path')] })).toHaveLength(1)
    expect(checkAllowlistShape({ allowed: [without(validEntry, 'target')] })).toHaveLength(1)
  })

  it('allowed が配列でないときに落ちる', () => {
    expect(checkAllowlistShape({})).toHaveLength(1)
  })
})

describe('applyAllowlist', () => {
  /** @param {number} line */
  const problemAt = (line) => ({
    path: validEntry.path,
    line,
    targets: [validEntry.target, 'design/tokens.json の color.border'],
    message: `README.md:${line}: design/tokens.json の color.accent がそのまま書かれている`,
  })

  it('登録された例外に一致する報告を抑える', () => {
    expect(applyAllowlist([problemAt(1)], [validEntry])).toEqual({ remaining: [], mismatched: [] })
  })

  it('報告が挙げる在り処のどれかと一致すれば抑える', () => {
    const entry = { ...validEntry, target: 'design/tokens.json の color.border' }

    expect(applyAllowlist([problemAt(1)], [entry]).remaining).toEqual([])
  })

  it('別のファイルの同じ複製は抑えない', () => {
    expect(applyAllowlist([problemAt(1)], [{ ...validEntry, path: 'DESIGN.md' }]).remaining).toHaveLength(1)
  })

  it('別の正本についての複製は抑えない', () => {
    const entry = { ...validEntry, target: 'design/tokens.json の color.surface' }

    expect(applyAllowlist([problemAt(1)], [entry]).remaining).toHaveLength(1)
  })

  /*
   * 件数を見ないと、1つの例外が同じファイル・同じ正本についての新しい複製を
   * いくつでも黙って飲み込む。
   */
  it('抑えた件数が count より多ければ報告する', () => {
    const { mismatched } = applyAllowlist([problemAt(1), problemAt(2)], [validEntry])

    expect(mismatched).toHaveLength(1)
    expect(mismatched[0]).toContain('count')
  })

  it('使われていない例外を報告する', () => {
    expect(applyAllowlist([], [validEntry]).mismatched).toHaveLength(1)
  })
})

describe('collectProblems', () => {
  const duplicated = { path: 'README.md', source: `アクセントは ${tokens.color.accent} である。` }
  const input = { values, lists: [], pairings: [], targets: [duplicated] }

  it('例外が当たれば問題として残らない', () => {
    const { problems } = collectProblems({ ...input, allowlist: { allowed: [validEntry] } })

    expect(problems).toEqual([])
  })

  /*
   * 例外リストの形が壊れているとき、例外を当てたまま緑を返すと、理由を書かずに検査を
   * 黙らせる経路になる。この結線は main() 側にあったのでは固定できない。
   */
  it('理由を欠いた例外リストのときは、例外を1件も当てない', () => {
    const { problems } = collectProblems({
      ...input,
      allowlist: { allowed: [{ ...validEntry, reason: '短い' }] },
    })

    expect(problems.some((problem) => problem.includes('reason'))).toBe(true)
    expect(problems.some((problem) => problem.includes('color.accent'))).toBe(true)
  })

  it('検査ごとの内訳を返す', () => {
    const { checks } = collectProblems({ ...input, allowlist: { allowed: [] } })

    expect(checks.map(({ name }) => name)).toHaveLength(4)
    expect(checks[0].problems).toHaveLength(1)
  })
})

describe('collectScanTargets', () => {
  const targets = collectScanTargets()
  const paths = targets.map(({ path }) => path)

  /*
   * 走査対象が空でも、報告が0件なら検査は緑を返す。対象の取りこぼしは「壊れていても
   * 緑」を作るため、実ファイルが入っていることを固定する（DR-0028 帰結）。
   */
  it('正本を参照できない文書を走査対象に含む', () => {
    expect(paths).toContain('README.md')
    expect(paths).toContain('DESIGN.md')
    expect(paths).toContain('scripts/README.md')
    expect(paths).toContain('docs/decisions/0046-prose-checked-for-canonical-duplication.md')
    expect(paths).toContain('skills/slide-harness/SKILL.md')
    expect(paths.some((path) => path.startsWith('experiments/'))).toBe(true)
    expect(paths.some((path) => path.startsWith('src/docs/'))).toBe(true)
    expect(paths.some((path) => path.startsWith('.claude/skills/'))).toBe(true)
  })

  it('レビュー記録と正本そのものを走査しない', () => {
    expect(paths.some((path) => path.startsWith('docs/reviews/'))).toBe(false)
    expect(paths.some((path) => path.startsWith('design/'))).toBe(false)
  })

  it('走査対象の中身を読み込んでいる', () => {
    expect(targets.every(({ source }) => source.length > 0)).toBe(true)
  })
})
