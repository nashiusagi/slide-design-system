// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  assertMapsAgree,
  buildLookup,
  countUnparsedHeadings,
  loadPerspectiveMap,
  loadPrefixMap,
  loadSeverities,
  normalizePerspectiveName,
  parseFindings,
  selectForPerspective,
  splitPerspectiveField,
  summarize,
  targetsFor,
} from './select-review-findings.mjs'

/** 正本の表を模したもの。対応の中身ではなく、読み取りと合成の形だけを固定する。 */
const PREFIX_MAP = new Map([
  ['contract', 'agents/contract.md'],
  ['writing', 'agents/writing.md'],
  ['code', 'agents/code-quality.md'],
])

const PERSPECTIVE_MAP = new Map([
  ['設計契約との整合', 'agents/contract.md'],
  ['日本語ドキュメント', 'agents/writing.md'],
  ['コード品質', 'agents/code-quality.md'],
])

const SEVERITIES = ['blocker', 'should', 'consider']
const MAPS = { prefixMap: PREFIX_MAP, perspectiveMap: PERSPECTIVE_MAP, severities: SEVERITIES }

/** @param {string} body */
function review(body) {
  return `# PR #1 レビュー\n\n## 要約\n\n所感。\n\n${body}\n`
}

describe('loadSeverities', () => {
  it('重要度の語彙を、正本の重要度表から読む', () => {
    expect(loadSeverities()).toContain('blocker')
  })

  it('重要度表が無ければ、空の語彙を返さず落ちる', () => {
    expect(() => loadSeverities('# 節が無い')).toThrow(/「## 重要度」の節が無い/)
  })

  it('全観点へ渡す重要度が表から消えたら落ちる（黙って配らなくならない）', () => {
    expect(() => loadSeverities('\n## 重要度\n\n| 値 | 意味 |\n|---|---|\n| `should` | x |\n')).toThrow(
      /'blocker' が無い/,
    )
  })
})

describe('loadPrefixMap', () => {
  it('接頭辞と指示ファイルの対応を、正本の表から読む', () => {
    expect(loadPrefixMap().get('contract')).toBe('agents/contract.md')
  })

  it('接頭辞とファイル名が一致しない対応も読む（この対応が要る理由そのもの）', () => {
    expect(loadPrefixMap().get('code')).toBe('agents/code-quality.md')
  })

  it('表を読めなければ、空の対応を返さず落ちる', () => {
    expect(() => loadPrefixMap('# 見出しだけで表が無い')).toThrow(/接頭辞と指示ファイルの対応を読めない/)
  })
})

describe('loadPerspectiveMap', () => {
  it('観点名と指示ファイルの対応を、正本の観点表から読む', () => {
    expect(loadPerspectiveMap().get('設計契約との整合')).toBe('agents/contract.md')
  })

  it('表のヘッダ行を観点として取り込まない', () => {
    expect(loadPerspectiveMap().has('観点')).toBe(false)
  })

  it('観点表を読めなければ落ちる', () => {
    expect(() => loadPerspectiveMap('# 観点表が無い')).toThrow(/観点表を読めない/)
  })
})

describe('assertMapsAgree', () => {
  it('接頭辞表が観点表に無い指示ファイルを指していたら落ちる', () => {
    const stray = new Map([...PREFIX_MAP, ['ops', 'agents/ops.md']])
    expect(() => assertMapsAgree(stray, PERSPECTIVE_MAP)).toThrow(/観点表に無い指示ファイル/)
  })

  it('正本どうしは食い違っていない', () => {
    expect(() => assertMapsAgree(loadPrefixMap(), loadPerspectiveMap())).not.toThrow()
  })
})

describe('normalizePerspectiveName / buildLookup', () => {
  it('観点名そのものに含まれる括弧を落とす（正本の名前が括弧を含む）', () => {
    expect(normalizePerspectiveName('決定記録（DR）との整合')).toBe('決定記録との整合')
  })

  it('正本の観点名が、そのままでも注記付きでも括弧無しでも同じ観点へ解決する', () => {
    const lookup = buildLookup(loadPerspectiveMap())
    /** @param {string} value */
    const resolve = (value) => lookup.get(value) ?? lookup.get(normalizePerspectiveName(value))

    expect(resolve('決定記録（DR）との整合')).toBe('agents/decisions.md')
    expect(resolve('決定記録との整合')).toBe('agents/decisions.md')
    expect(resolve('決定記録（DR）との整合（2観点から独立に挙がった）')).toBe('agents/decisions.md')
  })

  it('正規化で2つの観点が同じ鍵に潰れたら落ちる', () => {
    const colliding = new Map([
      ['決定記録（DR）との整合', 'agents/decisions.md'],
      ['決定記録（記録）との整合', 'agents/contract.md'],
    ])
    expect(() => buildLookup(colliding)).toThrow(/別の観点と衝突する/)
  })
})

describe('splitPerspectiveField', () => {
  it('スラッシュ区切りの複数観点を分解する', () => {
    expect(splitPerspectiveField('日本語ドキュメント / 設計契約との整合')).toEqual([
      '日本語ドキュメント',
      '設計契約との整合',
    ])
  })

  it('読点区切りも分解する（実データが両方使っている）', () => {
    expect(splitPerspectiveField('検査ルールの実効性、コード品質')).toEqual(['検査ルールの実効性', 'コード品質'])
  })

  it('注記を剥がさずに返す（剥がすと正本の観点名が壊れるため、照合側で正規化する）', () => {
    expect(splitPerspectiveField('決定記録（DR）との整合（2観点から独立に指摘）')).toEqual([
      '決定記録（DR）との整合（2観点から独立に指摘）',
    ])
  })
})

describe('parseFindings', () => {
  it('重要度の節を、その下の指摘へ引き継ぐ', () => {
    const findings = parseFindings(
      review('## blocker\n\n### `contract/a` — x\n\n本文\n\n## should\n\n### `writing/b` — y\n\n本文'),
      SEVERITIES,
    )
    expect(findings.map((f) => [f.categoryId, f.severity])).toEqual([
      ['contract/a', 'blocker'],
      ['writing/b', 'should'],
    ])
  })

  it('周の中で1段下げた重要度見出しと、その下の4階層の指摘を拾う（実データの多数派の書き方）', () => {
    const findings = parseFindings(
      review('## 2周目（2026-01-01）\n\n### should\n\n#### `writing/a` — x\n\n本文\n\n#### `code/b` — y\n\n本文'),
      SEVERITIES,
    )
    expect(findings.map((f) => [f.categoryId, f.severity])).toEqual([
      ['writing/a', 'should'],
      ['code/b', 'should'],
    ])
  })

  it('backtick の無いカテゴリID見出しも拾う（古い記録は付けていない）', () => {
    const findings = parseFindings(review('## should\n\n### contract/a — x\n\n本文'), SEVERITIES)
    expect(findings.map((f) => f.categoryId)).toEqual(['contract/a'])
  })

  it('重要度の節と同じ深さの見出しで節を抜ける（`## 落とした指摘` の見出しを指摘にしない）', () => {
    const findings = parseFindings(
      review('## should\n\n### `writing/a` — x\n\n本文\n\n## 落とした指摘\n\n### `writing/b` — 成立しない'),
      SEVERITIES,
    )
    expect(findings.map((f) => f.categoryId)).toEqual(['writing/a'])
  })

  it('周が付いた重要度見出し（`## blocker（2周目）`）も重要度として読む', () => {
    const findings = parseFindings(review('## blocker（2周目）\n\n### `contract/a` — x\n\n本文'), SEVERITIES)
    expect(findings.map((f) => f.severity)).toEqual(['blocker'])
  })

  it('重要度の節の外にある指摘見出しは拾わない（重要度が決まらないため）', () => {
    expect(parseFindings(review('### 所感\n\n#### `writing/a` — x\n\n本文'), SEVERITIES)).toEqual([])
  })

  it('指摘の本文を見出しから次の指摘の手前まで保持する（渡す量の実測に使う）', () => {
    const [finding] = parseFindings(review('## should\n\n### `writing/a` — x\n\n- **場所**: a.md:1\n'), SEVERITIES)
    expect(finding.text).toContain('- **場所**: a.md:1')
  })
})

describe('countUnparsedHeadings', () => {
  it('重要度の節の外にある指摘見出しを、取りこぼしとして数える', () => {
    const markdown = review('### 所感\n\n#### `writing/a` — x\n\n本文')
    expect(countUnparsedHeadings(markdown, parseFindings(markdown, SEVERITIES))).toBe(1)
  })

  it('すべて拾えていれば 0', () => {
    const markdown = review('## should\n\n### `writing/a` — x\n\n本文')
    expect(countUnparsedHeadings(markdown, parseFindings(markdown, SEVERITIES))).toBe(0)
  })
})

describe('実在のレビュー記録', () => {
  // 合成フィクスチャだけでは、書式の揺れによる取りこぼしを検出できない。実データの
  // 2つの書き方（`## blocker（N周目）` と `### should` > `#### id`）を両方通す。
  /** @param {string} name */
  const real = (name) => readFileSync(new URL(`../docs/reviews/${name}`, import.meta.url), 'utf8')

  it.each(['pr-60.md', 'pr-61.md', 'pr-58.md', 'pr-57.md'])(
    '%s のカテゴリID形の見出しを1件も取りこぼさない',
    (name) => {
      const markdown = real(name)
      expect(countUnparsedHeadings(markdown, parseFindings(markdown))).toBe(0)
    },
  )

  it('周をまたいだ指摘を拾う（pr-60 は1周目14件・2周目以降6件）', () => {
    expect(parseFindings(real('pr-60.md')).length).toBe(20)
  })

  it('括弧を含む観点名から挙がった指摘が、実記録でもその観点へ渡る', () => {
    // 観点表の `決定記録（DR）との整合` は名前自体に括弧を含む。注記だけを剥がす実装は
    // この観点を永久に解決できず、複数観点から挙がった指摘を落としていた。
    const markdown = real('pr-61.md')
    const fromDecisions = parseFindings(markdown).filter((finding) =>
      finding.perspectives.some((/** @type {string} */ name) => normalizePerspectiveName(name).startsWith('決定記録')),
    )
    const passed = selectForPerspective(markdown, 'agents/decisions.md').selected.map((f) => f.categoryId)

    expect(fromDecisions.length).toBeGreaterThan(0)
    for (const finding of fromDecisions) {
      expect(passed).toContain(finding.categoryId)
    }
  })

  it('欄に観点名でない値が混ざる指摘は、接頭辞で確定させず全観点へ渡る', () => {
    // 実記録の欄には `統合時の検証で確認` のような、観点名でない値が入ることがある。
    const markdown = real('pr-61.md')
    const findings = parseFindings(markdown)
    const lookup = buildLookup(loadPerspectiveMap())
    const unresolved = findings.filter(
      (finding) =>
        finding.severity !== 'blocker' &&
        finding.perspectives.length > 0 &&
        finding.perspectives.some((name) => (lookup.get(name) ?? lookup.get(normalizePerspectiveName(name))) === undefined),
    )
    const passed = selectForPerspective(markdown, 'agents/phase.md').selected.map((f) => f.categoryId)

    expect(unresolved.length).toBeGreaterThan(0)
    for (const finding of unresolved) {
      expect(passed).toContain(finding.categoryId)
    }
  })

  it('重要度の節の外に指摘がある記録では、選別せず全文へ縮退する', () => {
    const markdown = real('pr-55.md')
    expect(selectForPerspective(markdown, 'agents/writing.md').fallback).toBe(true)
  })
})

describe('targetsFor', () => {
  const all = ['agents/contract.md', 'agents/writing.md', 'agents/code-quality.md']
  const lookup = buildLookup(PERSPECTIVE_MAP)
  /** @param {Partial<import('./select-review-findings.mjs').Finding>} [over] */
  const finding = (over) => ({ categoryId: 'writing/a', prefix: 'writing', severity: 'should', perspectives: [], text: '', ...over })

  it('blocker は、欄にも接頭辞にもよらず全観点へ渡る', () => {
    expect(targetsFor(finding({ severity: 'blocker' }), PREFIX_MAP, lookup, all)).toEqual({
      targets: all,
      basis: 'broadcast',
    })
  })

  it('欄と接頭辞の和集合へ渡る（どちらか一方を優先して切り落とさない）', () => {
    const { targets, basis } = targetsFor(
      finding({ categoryId: 'contract/a', prefix: 'contract', perspectives: ['日本語ドキュメント'] }),
      PREFIX_MAP,
      lookup,
      all,
    )
    expect([...targets].sort()).toEqual(['agents/contract.md', 'agents/writing.md'])
    expect(basis).toBe('field+prefix')
  })

  it('欄が無ければ、接頭辞だけで決める', () => {
    expect(targetsFor(finding({ categoryId: 'code/a', prefix: 'code' }), PREFIX_MAP, lookup, all)).toEqual({
      targets: ['agents/code-quality.md'],
      basis: 'prefix',
    })
  })

  it('欄の観点名を1つでも解決できなければ、接頭辞で確定させず全観点へ渡る', () => {
    expect(
      targetsFor(finding({ perspectives: ['日本語ドキュメント', '知らない観点'] }), PREFIX_MAP, lookup, all).basis,
    ).toBe('unresolved-perspective')
  })

  it('欄も接頭辞も読めない指摘は、落とさず全観点へ渡る', () => {
    expect(targetsFor(finding({ categoryId: 'unknown/a', prefix: 'unknown' }), PREFIX_MAP, lookup, all)).toEqual({
      targets: all,
      basis: 'unresolved',
    })
  })

  it('接頭辞が観点表に無いファイルを指していても、どこへも渡らない状態にしない', () => {
    const stray = new Map([...PREFIX_MAP, ['ops', 'agents/ops.md']])
    expect(targetsFor(finding({ categoryId: 'ops/a', prefix: 'ops' }), stray, lookup, all).targets).toEqual(all)
  })
})

describe('selectForPerspective', () => {
  const markdown = review(
    [
      '## blocker',
      '',
      '### `code/only-code` — blocker は全員が読む',
      '',
      '- **指摘した観点**: コード品質',
      '',
      '## should',
      '',
      '### `writing/only-writing` — 日本語だけ',
      '',
      '- **指摘した観点**: 日本語ドキュメント',
      '',
      '### `contract/both` — 2観点から',
      '',
      '- **指摘した観点**: 設計契約との整合 / 日本語ドキュメント',
    ].join('\n'),
  )

  it('その観点のものと blocker だけを渡す', () => {
    const { selected } = selectForPerspective(markdown, 'agents/writing.md', MAPS)
    expect(selected.map((f) => f.categoryId)).toEqual(['code/only-code', 'writing/only-writing', 'contract/both'])
  })

  it('関係しない指摘は渡さず、渡さなかった側へ残す（記録に使う）', () => {
    const { selected, dropped } = selectForPerspective(markdown, 'agents/contract.md', MAPS)
    expect(selected.map((f) => f.categoryId)).toEqual(['code/only-code', 'contract/both'])
    expect(dropped.map((f) => f.categoryId)).toEqual(['writing/only-writing'])
  })

  it('取りこぼしがある記録では fallback を立てる（呼ぶ側は全文を渡す）', () => {
    const { fallback, unparsed } = selectForPerspective(review('### 所感\n\n#### `writing/a` — x'), 'agents/writing.md', MAPS)
    expect(fallback).toBe(true)
    expect(unparsed).toBe(1)
  })

  it('観点表に無い観点を指定したら落ちる', () => {
    expect(() => selectForPerspective(markdown, 'agents/nope.md', MAPS)).toThrow(/観点表に無い/)
  })
})

describe('summarize', () => {
  it('選別前に渡していた量は、記録の全文 × 観点数で測る', () => {
    const markdown = review('## should\n\n### `writing/a` — x\n\n本文')
    const result = summarize(markdown, MAPS)

    expect(result.beforeSelection).toBe(markdown.length * 3)
    expect(result.afterSelection).toBeLessThan(result.beforeSelection)
  })

  it('観点ごとに、渡さなかった指摘を重要度つきで列挙する', () => {
    const markdown = review('## should\n\n### `writing/a` — x\n\n本文')
    const entry = summarize(markdown, MAPS).perPerspective.find((e) => e.perspective === 'agents/contract.md')

    expect(entry?.dropped).toEqual([{ categoryId: 'writing/a', severity: 'should' }])
  })

  it('記録には観点名で書けるよう、指示ファイル名と観点名の両方を返す', () => {
    const entry = summarize(review('## should\n\n### `writing/a` — x'), MAPS).perPerspective[0]
    expect(entry.perspectiveName).toBe('設計契約との整合')
  })
})
