/**
 * `scripts/check-decisions.mjs` の検査が、実際に壊れた入力を落とすことを固定する。
 *
 * **valid（今の main が緑）だけを確かめても、検査が機能している証拠にはならない。**
 * 何も判定しない検査でも valid は緑になるからだ（`inspection/invalid-case-untested`、
 * 累計5回）。だからここでは、各検査が捕まえるべき壊れ方を1つずつ**実際に作って**
 * 落ちることを見る。
 *
 * 壊れた入力は、検査関数へ内容の Map と `exists` の判定を渡して作る。リポジトリの
 * 実ファイルを書き換えないので、テストが失敗しても後片付けが要らない。
 */
import { describe, expect, it } from 'vitest'

import {
  checkFencesClosed,
  checkFrontMatter,
  checkIndexCovers,
  checkLinksResolve,
  checkReferencesExist,
  extractPaths,
  listDecisions,
  listScannedFiles,
  matchesExclude,
  runChecks,
  stripCodeBlocks,
} from './check-decisions.mjs'

/**
 * 実在するとみなすパスの集合から `exists` を作る。
 *
 * @param {string[]} paths
 * @returns {(path: string) => boolean}
 */
const existsIn = (paths) => (path) => new Set(paths).has(path)

describe('runChecks（いまのリポジトリ）', () => {
  it('4つの検査すべてに対して緑である', () => {
    for (const { label, failures } of runChecks()) {
      expect(failures, `${label}: ${failures.join(' / ')}`).toEqual([])
    }
  })

  it('走査対象に docs/reviews を含めない（履歴は古い参照を持つのが正常）', () => {
    expect(listScannedFiles().some((file) => file.startsWith('docs/reviews/'))).toBe(false)
  })

  it('走査対象に Skill・DR・スクリプトを含む', () => {
    const files = listScannedFiles()

    expect(files.some((file) => file.startsWith('.claude/skills/'))).toBe(true)
    expect(files.some((file) => file.startsWith('docs/decisions/'))).toBe(true)
    expect(files.some((file) => file.startsWith('scripts/'))).toBe(true)
  })

  it('走査対象に experiments を含む（相対リンクの階層が分かれる唯一の場所）', () => {
    expect(listScannedFiles().some((file) => file.startsWith('experiments/'))).toBe(true)
  })

  it('走査対象から experiments の Run 記録を外す（書き換えない履歴）', () => {
    expect(listScannedFiles().some((file) => file.includes('/runs/'))).toBe(false)
  })

  it('DR を番号の重複なく列挙する', () => {
    const decisions = listDecisions()

    expect(decisions.length).toBeGreaterThan(0)
    expect(new Set(decisions.map((decision) => decision.number)).size).toBe(decisions.length)
  })
})

describe('checkReferencesExist', () => {
  const numbers = new Set(['0024', '0052'])

  it('存在しない DR 番号を参照すると落ちる', () => {
    const failures = checkReferencesExist({
      numbers,
      sources: new Map([['docs/x.md', 'これは DR-9999 に従う\n']]),
    })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('DR-9999 は存在しない')
    expect(failures[0]).toContain('docs/x.md:1')
  })

  it('実在する番号なら落ちない', () => {
    expect(checkReferencesExist({ numbers, sources: new Map([['docs/x.md', 'DR-0024 を見よ']]) })).toEqual([])
  })

  it('コードブロックの中の番号は参照とみなさない（書式サンプル）', () => {
    const sources = new Map([['docs/x.md', ['```markdown', 'DR-9999 のように書く', '```'].join('\n')]])

    expect(checkReferencesExist({ numbers, sources })).toEqual([])
  })

  it('行番号を正しく報告する（コードブロックを飛ばしてもずれない）', () => {
    const sources = new Map([['docs/x.md', ['', '```', 'x', '```', 'DR-9999'].join('\n')]])

    expect(checkReferencesExist({ numbers, sources })[0]).toContain('docs/x.md:5')
  })
})

describe('checkLinksResolve', () => {
  it('リンク先が実在しないと落ちる', () => {
    const failures = checkLinksResolve({
      sources: new Map([['docs/decisions/0001-a.md', '[DR-0024](./0024-b.md)']]),
      exists: existsIn([]),
    })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('リンク先が実在しない')
  })

  it('階層が1つ浅いリンクを落とす（PR #60 で実害が出た形）', () => {
    const sources = new Map([
      ['.claude/skills/pr-review/references/review-file-format.md', '[DR-0052](../../../docs/decisions/0052-x.md)'],
    ])
    const failures = checkLinksResolve({ sources, exists: existsIn(['docs/decisions/0052-x.md']) })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('../../../docs/decisions/0052-x.md')
  })

  it('階層が正しければ落ちない', () => {
    const sources = new Map([
      ['.claude/skills/pr-review/references/review-file-format.md', '[DR-0052](../../../../docs/decisions/0052-x.md)'],
    ])

    expect(checkLinksResolve({ sources, exists: existsIn(['docs/decisions/0052-x.md']) })).toEqual([])
  })

  it('リンクテキストの番号とリンク先の番号が食い違うと落ちる', () => {
    const sources = new Map([['docs/decisions/0001-a.md', '[DR-0024](./0052-other.md)']])
    const failures = checkLinksResolve({ sources, exists: existsIn(['docs/decisions/0052-other.md']) })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('DR-0024 と書いてリンク先は 0052')
  })

  it('外部 URL と見出しリンクは見ない', () => {
    const sources = new Map([['docs/x.md', '[a](https://example.com/x.md) [b](#section)']])

    expect(checkLinksResolve({ sources, exists: existsIn([]) })).toEqual([])
  })
})

describe('checkIndexCovers', () => {
  const decisions = [
    { number: '0001', file: 'docs/decisions/0001-a.md' },
    { number: '0002', file: 'docs/decisions/0002-b.md' },
  ]
  const exists = existsIn(['docs/decisions/0001-a.md', 'docs/decisions/0002-b.md'])

  it('索引に無い DR があると落ちる', () => {
    const index = ['### 節', '| [0001](./0001-a.md) | A |'].join('\n')
    const failures = checkIndexCovers({ decisions, index, exists })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('DR-0002')
  })

  it('索引にあるが実在しない DR も落ちる', () => {
    const index = ['### 節', '| [0001](./0001-a.md) | A |', '| [0002](./0002-b.md) | B |', '| [0003](./0003-c.md) | C |'].join('\n')
    const failures = checkIndexCovers({ decisions, index, exists })

    expect(failures.some((failure) => failure.includes('索引にある DR-0003 が存在しない'))).toBe(true)
  })

  it('節の中が昇順でないと落ちる', () => {
    const index = ['### 節', '| [0002](./0002-b.md) | B |', '| [0001](./0001-a.md) | A |'].join('\n')
    const failures = checkIndexCovers({ decisions, index, exists })

    expect(failures.some((failure) => failure.includes('昇順'))).toBe(true)
  })

  it('索引の番号とリンク先が食い違うと落ちる', () => {
    const index = ['### 節', '| [0001](./0002-b.md) | A |', '| [0002](./0002-b.md) | B |'].join('\n')
    const failures = checkIndexCovers({ decisions, index, exists })

    expect(failures.some((failure) => failure.includes('食い違う'))).toBe(true)
  })

  it('揃っていれば落ちない', () => {
    const index = ['### 節', '| [0001](./0001-a.md) | A |', '| [0002](./0002-b.md) | B |'].join('\n')

    expect(checkIndexCovers({ decisions, index, exists })).toEqual([])
  })

  it('節が分かれていれば、節ごとに昇順を見る', () => {
    const index = ['### 甲', '| [0002](./0002-b.md) | B |', '### 乙', '| [0001](./0001-a.md) | A |'].join('\n')

    expect(checkIndexCovers({ decisions, index, exists })).toEqual([])
  })
})

describe('checkFrontMatter', () => {
  const decisions = [{ number: '0002', file: 'docs/decisions/0002-b.md' }]
  const numbers = new Set(['0001', '0002'])
  /**
   * 冒頭欄の行から、DR 1本分の内容の Map を作る。
   *
   * @param {string[]} lines
   * @returns {Map<string, string>}
   */
  const front = (lines) => new Map([['docs/decisions/0002-b.md', [...lines, '', '## 文脈'].join('\n')]])

  it('必須欄が無いと落ちる', () => {
    const sources = front(['# DR-0002: B', '', '- **状態**: 承認済み'])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn([]) })

    expect(failures.some((failure) => failure.includes('**日付** が無い'))).toBe(true)
    expect(failures.some((failure) => failure.includes('**関連** が無い'))).toBe(true)
  })

  it('日付の書式が違うと落ちる', () => {
    const sources = front(['- **状態**: 承認済み', '- **日付**: 2026/09/22', '- **関連**: なし'])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn([]) })

    expect(failures.some((failure) => failure.includes('日付が YYYY-MM-DD ではない'))).toBe(true)
  })

  it('関連に存在しない DR を挙げると落ちる', () => {
    const sources = front(['- **状態**: 承認済み', '- **日付**: 2026-09-22', '- **関連**: [DR-9999](./9999-x.md)'])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn([]) })

    expect(failures.some((failure) => failure.includes('関連に挙げた DR-9999 は存在しない'))).toBe(true)
  })

  it('関連が自分自身を指すと落ちる', () => {
    const sources = front(['- **状態**: 承認済み', '- **日付**: 2026-09-22', '- **関連**: DR-0002'])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn([]) })

    expect(failures.some((failure) => failure.includes('自分自身'))).toBe(true)
  })

  it('正本に挙げたパスが実在しないと落ちる', () => {
    const sources = front(['- **状態**: 承認済み', '- **日付**: 2026-09-22', '- **関連**: なし', '- **正本**: `design/missing.json`'])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn([]) })

    expect(failures.some((failure) => failure.includes('**正本** に挙げたパスが実在しない'))).toBe(true)
  })

  it('正本に実装コードを挙げると落ちる（README の規則）', () => {
    const sources = front(['- **状態**: 承認済み', '- **日付**: 2026-09-22', '- **関連**: なし', '- **正本**: `scripts/x.mjs`'])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn(['scripts/x.mjs']) })

    expect(failures.some((failure) => failure.includes('**正本** に実装コードを挙げている'))).toBe(true)
  })

  it('同じパスを **実装** に挙げるなら落ちない', () => {
    const sources = front(['- **状態**: 承認済み', '- **日付**: 2026-09-22', '- **関連**: なし', '- **実装**: `scripts/x.mjs`'])

    expect(checkFrontMatter({ decisions, numbers, sources, exists: existsIn(['scripts/x.mjs']) })).toEqual([])
  })

  it('契約データを正本に挙げるのは落ちない', () => {
    const sources = front(['- **状態**: 承認済み', '- **日付**: 2026-09-22', '- **関連**: なし', '- **正本**: `design/tokens.json`'])

    expect(checkFrontMatter({ decisions, numbers, sources, exists: existsIn(['design/tokens.json']) })).toEqual([])
  })
})

describe('stripCodeBlocks', () => {
  it('コードブロックの中身を落とし、行数を保つ', () => {
    const source = ['本文の DR-0001', '```markdown', '例の中の DR-9999', '```', '本文の DR-0002'].join('\n')
    const { stripped } = stripCodeBlocks(source)

    expect(stripped.split('\n')).toHaveLength(5)
    expect(stripped).toContain('DR-0001')
    expect(stripped).not.toContain('DR-9999')
    expect(stripped).toContain('DR-0002')
  })

  it('インラインコードの中身も落とす（書式の説明に現れる番号は参照ではない）', () => {
    expect(stripCodeBlocks('`DR-9999` のように書く').stripped).not.toContain('DR-9999')
  })

  it('コードブロックの外のリンクは残す', () => {
    expect(stripCodeBlocks('[DR-0024](./0024-x.md) を見よ').stripped).toContain('DR-0024')
  })
})

describe('extractPaths', () => {
  it('バッククォートで囲まれたパスを取り出す', () => {
    expect(extractPaths('`design/tokens.json`')).toEqual(['design/tokens.json'])
  })

  it('複数のパスをすべて取り出す', () => {
    expect(extractPaths('`a/b.md`, `c/d.mjs`（注記）')).toEqual(['a/b.md', 'c/d.mjs'])
  })

  it('パスでないコード片は拾わない（関数名・定数名）', () => {
    expect(extractPaths('`checkStarterMatchesRoot` が比較する')).toEqual([])
    expect(extractPaths('`STATIC_LEAK_PATTERNS`')).toEqual([])
  })
})

describe('checkFencesClosed', () => {
  it('閉じていないフェンスがあると落ちる', () => {
    const sources = new Map([['docs/x.md', ['# x', '', '```markdown', '例'].join('\n')]])
    const failures = checkFencesClosed({ sources })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('docs/x.md:3')
    expect(failures[0]).toContain('以降の行は検査されない')
  })

  it('閉じていれば落ちない', () => {
    const sources = new Map([['docs/x.md', ['```', '例', '```'].join('\n')]])

    expect(checkFencesClosed({ sources })).toEqual([])
  })

  it('`~~~` のフェンスも見る', () => {
    const sources = new Map([['docs/x.md', ['~~~', '例'].join('\n')]])

    expect(checkFencesClosed({ sources })).toHaveLength(1)
  })
})

describe('閉じ忘れが他の検査を無効化しないこと', () => {
  it('フェンスを閉じ忘れたファイルでは、参照の検査が何も見なくなる（だから別に落とす）', () => {
    const sources = new Map([['docs/x.md', ['```', 'DR-9999 に従う'].join('\n')]])

    // 参照の検査はフェンスの中を見ないので、この入力では何も返さない。
    expect(checkReferencesExist({ numbers: new Set(['0024']), sources })).toEqual([])
    // その穴を checkFencesClosed が埋める。
    expect(checkFencesClosed({ sources })).toHaveLength(1)
  })
})

describe('ミューテーションで生き残った経路', () => {
  const exists = existsIn(['docs/decisions/0001-a.md'])

  it('索引のリンク先が実在しないと落ちる', () => {
    const decisions = [{ number: '0001', file: 'docs/decisions/0001-a.md' }]
    const index = ['### 節', '| [0001](./0001-missing.md) | A |'].join('\n')
    const failures = checkIndexCovers({ decisions, index, exists })

    expect(failures.some((failure) => failure.includes('索引のリンク先が実在しない'))).toBe(true)
  })

  it('**実装** に挙げたパスが実在しないと落ちる（**正本** と同じ制約を持つ）', () => {
    const decisions = [{ number: '0002', file: 'docs/decisions/0002-b.md' }]
    const numbers = new Set(['0002'])
    const sources = new Map([
      ['docs/decisions/0002-b.md', ['- **状態**: 承認済み', '- **日付**: 2026-09-22', '- **関連**: なし', '- **実装**: `scripts/missing.mjs`', '', '## 文脈'].join('\n')],
    ])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn([]) })

    expect(failures.some((failure) => failure.includes('**実装** に挙げたパスが実在しない'))).toBe(true)
  })

  it('**状態** が無いと落ちる', () => {
    const decisions = [{ number: '0002', file: 'docs/decisions/0002-b.md' }]
    const numbers = new Set(['0002'])
    const sources = new Map([
      ['docs/decisions/0002-b.md', ['- **日付**: 2026-09-22', '- **関連**: なし', '', '## 文脈'].join('\n')],
    ])
    const failures = checkFrontMatter({ decisions, numbers, sources, exists: existsIn([]) })

    expect(failures.some((failure) => failure.includes('**状態** が無い'))).toBe(true)
  })
})

describe('matchesExclude', () => {
  it('前方一致で除外する', () => {
    expect(matchesExclude('docs/reviews/pr-1.md', 'docs/reviews/')).toBe(true)
    expect(matchesExclude('docs/decisions/0001-a.md', 'docs/reviews/')).toBe(false)
  })

  it('`**/` が途中のセグメントに当たる', () => {
    expect(matchesExclude('packages/a/node_modules/x/README.md', 'packages/**/node_modules/')).toBe(true)
  })

  it('`**/` はセグメント0個にも当たる（glob の通例）', () => {
    expect(matchesExclude('packages/node_modules/x/README.md', 'packages/**/node_modules/')).toBe(true)
  })

  it('当たらないものは除外しない', () => {
    expect(matchesExclude('packages/README.md', 'packages/**/node_modules/')).toBe(false)
  })
})

describe('extractPaths（ルート直下とディレクトリ）', () => {
  it('ルート直下のファイルを拾う（スラッシュを含まない）', () => {
    expect(extractPaths('`package.json`')).toEqual(['package.json'])
    expect(extractPaths('`eslint.config.js`')).toEqual(['eslint.config.js'])
  })

  it('末尾スラッシュのディレクトリを拾う', () => {
    expect(extractPaths('`design/layouts/`')).toEqual(['design/layouts/'])
  })

  it('契約データのキーパスは拾わない（既知の拡張子でない）', () => {
    expect(extractPaths('`color.accent`')).toEqual([])
    expect(extractPaths('`scripts.check`')).toEqual([])
    expect(extractPaths('`build.rollupOptions.input`')).toEqual([])
  })
})
