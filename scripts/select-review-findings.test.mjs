// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  loadPerspectiveMap,
  loadPrefixMap,
  parseFindings,
  selectForPerspective,
  splitPerspectiveField,
  summarize,
  targetsFor,
} from './select-review-findings.mjs'

/** 正本の表を模したもの。対応の中身ではなく、読み取りの形だけを固定する。 */
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

const MAPS = { prefixMap: PREFIX_MAP, perspectiveMap: PERSPECTIVE_MAP }

/** @param {string} body */
function review(body) {
  return `# PR #1 レビュー\n\n## 要約\n\n所感。\n\n${body}\n`
}

describe('loadPrefixMap', () => {
  it('接頭辞と指示ファイルの対応を、正本の表から読む', () => {
    const map = loadPrefixMap()
    expect(map.get('contract')).toBe('agents/contract.md')
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

describe('splitPerspectiveField', () => {
  it('単一の観点をそのまま返す', () => {
    expect(splitPerspectiveField('日本語ドキュメント')).toEqual(['日本語ドキュメント'])
  })

  it('スラッシュ区切りの複数観点を分解する', () => {
    expect(splitPerspectiveField('日本語ドキュメント / 設計契約との整合')).toEqual([
      '日本語ドキュメント',
      '設計契約との整合',
    ])
  })

  it('末尾の注記を剥がす（注記は最後の観点に食い込んで書かれる）', () => {
    expect(splitPerspectiveField('日本語ドキュメント / 設計契約との整合（2観点から独立に挙がった）')).toEqual([
      '日本語ドキュメント',
      '設計契約との整合',
    ])
  })
})

describe('parseFindings', () => {
  it('重要度の節を、その下の指摘へ引き継ぐ', () => {
    const findings = parseFindings(
      review('## blocker\n\n### `contract/a` — x\n\n本文\n\n## should\n\n### `writing/b` — y\n\n本文'),
    )
    expect(findings.map((f) => [f.categoryId, f.severity])).toEqual([
      ['contract/a', 'blocker'],
      ['writing/b', 'should'],
    ])
  })

  it('`指摘した観点` 欄を読む', () => {
    const [finding] = parseFindings(
      review('## should\n\n### `writing/a` — x\n\n- **指摘した観点**: 日本語ドキュメント / コード品質\n'),
    )
    expect(finding.perspectives).toEqual(['日本語ドキュメント', 'コード品質'])
  })

  it('`落とした指摘` の節にある見出しを指摘として数えない', () => {
    const findings = parseFindings(review('## should\n\n### `writing/a` — x\n\n本文\n\n## 落とした指摘\n\n### `writing/b` — 成立しない'))
    expect(findings.map((f) => f.categoryId)).toEqual(['writing/a'])
  })

  it('周の節をまたいだ指摘を、どちらも拾う', () => {
    const findings = parseFindings(
      review('## should\n\n### `writing/a` — x\n\n本文\n\n## 2周目（2026-01-01）\n\n## blocker（2周目）\n\n### `contract/b` — y\n\n本文'),
    )
    expect(findings.map((f) => [f.categoryId, f.severity])).toEqual([
      ['writing/a', 'should'],
      ['contract/b', 'blocker'],
    ])
  })

  it('指摘の本文を見出しから次の指摘の手前まで保持する（渡す量の実測に使う）', () => {
    const [finding] = parseFindings(review('## should\n\n### `writing/a` — x\n\n- **場所**: a.md:1\n- **提案**: 直す\n'))
    expect(finding.text).toContain('- **場所**: a.md:1')
    expect(finding.text).toContain('- **提案**: 直す')
  })
})

describe('targetsFor', () => {
  const all = ['agents/contract.md', 'agents/writing.md', 'agents/code-quality.md']

  it('blocker は、観点の欄にも接頭辞にもよらず全観点へ渡る', () => {
    const finding = { categoryId: 'writing/a', prefix: 'writing', severity: 'blocker', perspectives: ['日本語ドキュメント'], text: '' }
    expect(targetsFor(finding, PREFIX_MAP, PERSPECTIVE_MAP, all)).toEqual({ targets: all, basis: 'blocker' })
  })

  it('複数観点から挙がった指摘は、その全部へ渡る', () => {
    const finding = {
      categoryId: 'writing/a',
      prefix: 'writing',
      severity: 'should',
      perspectives: ['日本語ドキュメント', '設計契約との整合'],
      text: '',
    }
    const { targets } = targetsFor(finding, PREFIX_MAP, PERSPECTIVE_MAP, all)
    expect([...targets].sort()).toEqual(['agents/contract.md', 'agents/writing.md'])
  })

  it('観点の欄が無ければ、接頭辞だけで決める', () => {
    const finding = { categoryId: 'code/a', prefix: 'code', severity: 'should', perspectives: [], text: '' }
    expect(targetsFor(finding, PREFIX_MAP, PERSPECTIVE_MAP, all)).toEqual({
      targets: ['agents/code-quality.md'],
      basis: 'prefix',
    })
  })

  it('観点の欄が観点名でない値でも、接頭辞へ落ちて1観点に決まる', () => {
    const finding = { categoryId: 'writing/a', prefix: 'writing', severity: 'should', perspectives: ['統合時の検証で確認'], text: '' }
    expect(targetsFor(finding, PREFIX_MAP, PERSPECTIVE_MAP, all).targets).toEqual(['agents/writing.md'])
  })

  it('欄も接頭辞も読めない指摘は、落とさず全観点へ渡る', () => {
    const finding = { categoryId: 'unknown/a', prefix: 'unknown', severity: 'consider', perspectives: [], text: '' }
    expect(targetsFor(finding, PREFIX_MAP, PERSPECTIVE_MAP, all)).toEqual({ targets: all, basis: 'unresolved' })
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

  it('観点表に無い観点を指定したら落ちる', () => {
    expect(() => selectForPerspective(markdown, 'agents/nope.md', MAPS)).toThrow(/観点表に無い/)
  })
})

describe('summarize', () => {
  it('選別の前後で渡る文字数を出す（削減量の実測に使う）', () => {
    const markdown = review('## should\n\n### `writing/a` — x\n\n本文\n\n### `contract/b` — y\n\n本文')
    const result = summarize(markdown, MAPS)

    expect(result.findingCount).toBe(2)
    expect(result.perspectiveCount).toBe(3)
    expect(result.after).toBeLessThan(result.before)
  })

  it('観点ごとに、渡さなかった指摘を重要度つきで列挙する', () => {
    const markdown = review('## should\n\n### `writing/a` — x\n\n本文')
    const entry = summarize(markdown, MAPS).perPerspective.find((e) => e.perspective === 'agents/contract.md')

    expect(entry?.dropped).toEqual([{ categoryId: 'writing/a', severity: 'should' }])
  })
})
