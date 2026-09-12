/**
 * 検査そのものが複製を捕まえられるかを固定する。
 *
 * 正しい入力で ok になることは pnpm canonical:check が毎回示すので、ここが持つのは
 * 壊れた入力を渡したときに必ず1件返るという側（DR-0033 帰結）。
 *
 * フィクスチャは正本から値を取って組み立てる。ここへ値を書き写すと、正本が変わっても
 * このテストだけが古い値で緑を返し、検査が禁じている複製をテストが実演することになる。
 * 再現する対象は指摘ログの代表例で、各ケースにカテゴリIDと出所の PR を書く。
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  MIN_REASON_LENGTH,
  applyAllowlist,
  checkAllowlistShape,
  collectCanonicalLists,
  collectCanonicalPairings,
  collectCanonicalValues,
  collectScanTargets,
  findPairingDuplications,
  findStructureDuplications,
  findValueDuplications,
} from './check-canonical-duplication.mjs'

/** @param {string} path */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const tokens = readJson('design/tokens.json')
const rules = readJson('design/rules.json')
const layouts = ['bullets', 'statement', 'title'].map((name) => readJson(`design/layouts/${name}.json`))
const components = ['bullet-list', 'emphasis', 'slide-title', 'statement'].map((name) =>
  readJson(`design/components/${name}.json`),
)

const values = collectCanonicalValues({ tokens, rules })
const lists = collectCanonicalLists({ layouts, components, rules })
const pairings = collectCanonicalPairings({ layouts, components })

/** @param {string} source */
const valuesIn = (source) => findValueDuplications('README.md', source, values)

describe('collectCanonicalValues / findValueDuplications', () => {
  /* `contract/design-data-duplicated`（通算10回、PR #13 初出）の代表例。 */
  it('トークンの色を散文へ書き写すと捕まえる', () => {
    const found = valuesIn(`アクセントには ${tokens.color.accent} を使う。`)

    expect(found).toHaveLength(1)
    expect(found[0].target).toContain('color.accent')
  })

  /* `decisions/dr-restates-canonical-value`（通算6回、PR #41 / #47）の代表例。 */
  it('検査の閾値を単位付きで書き写すと捕まえる', () => {
    const found = valuesIn(`本文の下限は ${rules.minFontSize.px}px とする。`)

    expect(found).toHaveLength(1)
    expect(found[0].target).toContain('minFontSize.px')
  })

  it('閾値をインラインコードだけで置いても捕まえる', () => {
    const found = valuesIn(`本文の下限は \`${rules.minFontSize.px}\` とする。`)

    expect(found).toHaveLength(1)
    expect(found[0].target).toContain('minFontSize.px')
  })

  /* `contract/value-outside-source-of-truth`（通算4回、PR #13 初出）の代表例。 */
  it('キャンバス寸法を対で書き写すと捕まえる', () => {
    const found = valuesIn(`${tokens.canvas.width}x${tokens.canvas.height} の固定キャンバスで測る。`)

    expect(found).toHaveLength(1)
    expect(found[0].target).toContain('canvas')
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

  it('別の値の一部に含まれる数字を報告しない', () => {
    const found = valuesIn(`余白は ${tokens.space['2xs']}7px ではない。`)

    expect(found).toEqual([])
  })

  /*
   * 塞げていない形を、塞げているかのように書かないための固定（DR-0046 帰結）。
   * ここが緑でなくなったら、抜け道が塞がったということなので DR の帰結を直す。
   */
  it('単位もコード記法も伴わない裸の数値は、既知の抜け道として報告しない', () => {
    expect(valuesIn(`コントラスト比は ${rules.contrast.requirements[0].minimum} 以上とする。`)).toEqual([])
  })

  it('短くありふれた文字列（`none` 等）を値として報告しない', () => {
    expect(valuesIn(`影の既定は ${tokens.shadow.none} とする。`)).toEqual([])
  })
})

/** @param {string} source */
const structureIn = (source) => findStructureDuplications('README.md', source, lists)

describe('findStructureDuplications', () => {
  /* `contract/contract-structure-duplicated`（通算6回、PR #27）の代表例。 */
  it('レイアウトの一覧を表として複製すると捕まえる', () => {
    const source = ['| name | 役割 |', '| --- | --- |', ...layouts.map((layout) => `| ${layout.name} | 説明 |`)].join(
      '\n',
    )
    const found = structureIn(source)

    expect(found.length).toBeGreaterThan(0)
    expect(found[0].target).toContain('design/layouts/')
  })

  it('箇条書きへ1行1件で並べても捕まえる', () => {
    const source = layouts.map((layout) => `- \`${layout.name}\` — 説明`).join('\n')

    expect(structureIn(source).length).toBeGreaterThan(0)
  })

  it('順序を入れ替えても捕まえる', () => {
    const source = [...layouts].reverse().map((layout) => `- \`${layout.name}\``).join('\n')

    expect(structureIn(source).length).toBeGreaterThan(0)
  })

  it('一覧の全項目が1行に並ぶ形も捕まえる', () => {
    const found = structureIn(`レイアウトは ${layouts.map((layout) => `\`${layout.name}\``).join(' / ')} の3種。`)

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
    expect(found[0].target).toContain('rules[].id')
  })

  it('1件だけの言及は複製として報告しない', () => {
    expect(structureIn(`- \`${layouts[0].name}\` を選ぶ基準は契約にある`)).toEqual([])
  })

  it('同じ1件が複数行に現れても、一覧の複製として報告しない', () => {
    const source = [`- \`${layouts[0].name}\` を選ぶ`, `- \`${layouts[0].name}\` を選ばない`].join('\n')

    expect(structureIn(source)).toEqual([])
  })

  it('箇条書き・表の外に散った言及は報告しない', () => {
    const source = layouts.map((layout) => `\`${layout.name}\` は役割で選ぶ。`).join('\n\n')

    expect(structureIn(source)).toEqual([])
  })

  it('名前を部分文字列として含む語（クラス名等）を項目と見なさない', () => {
    const source = layouts.map((layout) => `- \`.slide--${layout.name}\` を当てる`).join('\n')

    expect(structureIn(source)).toEqual([])
  })
})

describe('findPairingDuplications', () => {
  /* `contract/contract-structure-duplicated` のうち、対応表として写された形。 */
  it('allowedIn の対応表を複製すると捕まえる', () => {
    const source = components
      .map((component) => `| ${component.name} | ${component.allowedIn.join(' / ')} |`)
      .join('\n')
    const found = findPairingDuplications('README.md', source, pairings)

    expect(found.length).toBeGreaterThan(0)
    expect(found[0].target).toContain('allowedIn')
  })

  it('対応が1行しか無ければ報告しない', () => {
    const source = `| ${components[0].name} | ${components[0].allowedIn.join(' / ')} |`

    expect(findPairingDuplications('README.md', source, pairings)).toEqual([])
  })
})

describe('checkAllowlistShape', () => {
  const valid = {
    path: 'README.md',
    target: 'design/tokens.json の color.accent',
    reason: 'あ'.repeat(MIN_REASON_LENGTH),
  }

  it('理由のある例外は通す', () => {
    expect(checkAllowlistShape({ allowed: [valid] })).toEqual([])
  })

  it('理由の無い例外を拒む', () => {
    expect(checkAllowlistShape({ allowed: [{ path: valid.path, target: valid.target }] })).toHaveLength(1)
  })

  it('理由が短すぎる例外を拒む', () => {
    const found = checkAllowlistShape({
      allowed: [{ ...valid, reason: 'あ'.repeat(MIN_REASON_LENGTH - 1) }],
    })

    expect(found).toHaveLength(1)
    expect(found[0]).toContain('reason')
  })

  it('path / target を欠く例外を拒む', () => {
    expect(checkAllowlistShape({ allowed: [{ target: valid.target, reason: valid.reason }] })).toHaveLength(1)
    expect(checkAllowlistShape({ allowed: [{ path: valid.path, reason: valid.reason }] })).toHaveLength(1)
  })

  it('allowed が配列でないときに落ちる', () => {
    expect(checkAllowlistShape({})).toHaveLength(1)
  })
})

describe('applyAllowlist', () => {
  const problem = {
    path: 'README.md',
    line: 1,
    target: 'design/tokens.json の color.accent',
    message: 'README.md:1: design/tokens.json の color.accent がそのまま書かれている',
  }
  const entry = { path: problem.path, target: problem.target, reason: 'あ'.repeat(MIN_REASON_LENGTH) }

  it('登録された例外に一致する報告を抑える', () => {
    expect(applyAllowlist([problem], [entry])).toEqual({ remaining: [], unused: [] })
  })

  it('別のファイルの同じ複製は抑えない', () => {
    const { remaining } = applyAllowlist([problem], [{ ...entry, path: 'DESIGN.md' }])

    expect(remaining).toHaveLength(1)
  })

  it('別の正本についての複製は抑えない', () => {
    const { remaining } = applyAllowlist([problem], [{ ...entry, target: 'design/tokens.json の color.border' }])

    expect(remaining).toHaveLength(1)
  })

  it('使われていない例外を報告する', () => {
    const { unused } = applyAllowlist([], [entry])

    expect(unused).toHaveLength(1)
  })
})

describe('collectScanTargets', () => {
  const targets = collectScanTargets()
  const paths = targets.map(({ path }) => path)

  /*
   * 走査対象が空でも、報告が0件なら検査は緑を返す。対象の取りこぼしは「壊れていても
   * 緑」を作るため、実ファイルが入っていることを固定する（DR-0027 帰結）。
   */
  it('正本を参照できない文書を走査対象に含む', () => {
    expect(paths).toContain('README.md')
    expect(paths).toContain('DESIGN.md')
    expect(paths).toContain('docs/decisions/0046-prose-checked-for-canonical-duplication.md')
    expect(paths).toContain('skills/slide-harness/SKILL.md')
    expect(paths.some((path) => path.startsWith('src/docs/'))).toBe(true)
    expect(paths.some((path) => path.startsWith('.claude/skills/'))).toBe(true)
  })

  it('レビュー記録を走査しない', () => {
    expect(paths.some((path) => path.startsWith('docs/reviews/'))).toBe(false)
  })

  it('走査対象の中身を読み込んでいる', () => {
    expect(targets.every(({ source }) => source.length > 0)).toBe(true)
  })
})
