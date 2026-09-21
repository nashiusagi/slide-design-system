import { describe, expect, it } from 'vitest'

import { formatDocsHash, parseDocsHash } from './hash'
import { RULES_PAGE_ID } from './page-ids'
import {
  RULES,
  UNIMPLEMENTED_RULE_IDS,
  ruleImplemented,
  ruleSectionId,
  rulesByMethod,
  thresholdEntries,
  thresholdKey,
} from './rules'

/**
 * 契約ファイルの実体。カタログが読んだものと突き合わせる。
 *
 * `src/docs/rules.ts` とは別の綴り方（リポジトリルート起点）で書いている。同じ相対パスを
 * 写すと、パスがずれたときに両方が同時に空になり、突き合わせが素通りする。
 */
const RAW_RULES = Object.values(
  import.meta.glob<Record<string, unknown>>('/design/rules.json', { eager: true, import: 'default' }),
)[0]

/** 契約のトップレベルにある `rules[]`。 */
const RAW_RULE_LIST = RAW_RULES.rules as { id: string; method: string }[]

describe('RULES', () => {
  it('design/rules.json のルールをすべて読む', () => {
    expect(RAW_RULE_LIST.length).toBeGreaterThan(0)
    expect(RULES).toHaveLength(RAW_RULE_LIST.length)
    expect(RULES.map((rule) => rule.id)).toEqual(RAW_RULE_LIST.map((rule) => rule.id))
  })

  /*
   * 契約の形（RuleContract）は正本のスキーマの写しなので、読んだ結果が実際にその形を
   * しているかを見る。キーが1つ改名されただけで、ページは undefined を描く。
   */
  it('各ルールが表示に要る項目を持つ', () => {
    for (const rule of RULES) {
      expect(rule.id.length).toBeGreaterThan(0)
      expect(rule.method.length).toBeGreaterThan(0)
      expect(rule.severity.length).toBeGreaterThan(0)
      expect(rule.description.length).toBeGreaterThan(0)
    }
  })
})

describe('ruleSectionId', () => {
  /*
   * 節 ID が hash の書式に収まること。収まらないIDが入ると、そのルールを指すリンクは
   * 書式違反となり、押した人は先頭ページへ落ちる（DR-0048）。
   */
  it('どのルールの節 ID も、hash として往復する', () => {
    for (const rule of RULES) {
      const sectionId = ruleSectionId(rule.id)
      const hash = formatDocsHash(RULES_PAGE_ID, sectionId)

      expect(parseDocsHash(hash), `${rule.id} が hash の書式に合わない`).toEqual({
        pageId: RULES_PAGE_ID,
        sectionId,
      })
    }
  })
})

describe('rulesByMethod', () => {
  it('契約に現れた順で method ごとに束ね、どのルールも1度だけ現れる', () => {
    const groups = rulesByMethod(RULES)

    expect(groups.map(([method]) => method)).toEqual([...new Set(RAW_RULE_LIST.map((rule) => rule.method))])
    expect(groups.flatMap(([, rules]) => rules.map((rule) => rule.id))).toEqual(
      RAW_RULE_LIST.map((rule) => rule.id),
    )

    for (const [method, rules] of groups) {
      for (const rule of rules) {
        expect(rule.method).toBe(method)
      }
    }
  })

  /*
   * method の一覧をカタログが持たないこと——知らない method が来ても束が出る——を、架空の
   * 値で固定する。実在の method で見ると、対応表を持つ実装でも通ってしまう。
   */
  it('知らない method でも束にする', () => {
    const rule = { id: 'alfa', method: 'divination', severity: 'error', description: '架空' }

    expect(rulesByMethod([rule])).toEqual([['divination', [rule]]])
  })
})

describe('thresholdKey', () => {
  it('ルールIDのハイフンをキャメルケースへ畳む', () => {
    expect(thresholdKey('alfa')).toBe('alfa')
    expect(thresholdKey('alfa-bravo')).toBe('alfaBravo')
    expect(thresholdKey('alfa-bravo-charlie')).toBe('alfaBravoCharlie')
  })
})

describe('thresholdEntries', () => {
  /*
   * ここが本命。閾値ブロックはルールIDのキャメルケースで引いており、対応表を持たない。
   * 引けないブロックが1つでもあると、その値は画面のどこにも出ないまま契約にだけ在る状態に
   * なる。トップレベル側から見て、全ブロックにルールが対応していることを見る。
   */
  it('契約のトップレベルにある閾値ブロックは、どれかのルールから引ける', () => {
    const ruleKeys = new Set(RULES.map((rule) => thresholdKey(rule.id)))
    const blocks = Object.keys(RAW_RULES).filter(
      (key) => !key.startsWith('$') && key !== 'rules',
    )

    expect(blocks.length).toBeGreaterThan(0)

    for (const key of blocks) {
      expect(ruleKeys, `${key} を引くルールが無い`).toContain(key)
    }
  })

  it('閾値ブロックの中身を、$ で始まるキーを除いて返す', () => {
    const ruleKeys = RULES.map((rule) => rule.id).filter((id) => thresholdEntries(id) !== null)

    expect(ruleKeys.length).toBeGreaterThan(0)

    for (const id of ruleKeys) {
      const block = RAW_RULES[thresholdKey(id)] as Record<string, unknown>

      expect(thresholdEntries(id)).toEqual(
        Object.entries(block).filter(([key]) => !key.startsWith('$')),
      )
      expect(thresholdEntries(id)?.map(([key]) => key)).not.toContain('$comment')
    }
  })

  it('閾値を持たないルールでは null を返す', () => {
    // 架空の名前で見る。実在のルールで書くと、そのルールが閾値を持った日にテストが
    // 「閾値を持たない」を主張し続ける。
    expect(thresholdEntries('alfa-bravo')).toBeNull()
  })
})

describe('ruleImplemented', () => {
  /*
   * 未実装の一覧がルールIDの綴りとして正しいこと。綴りを誤ると、未実装のルールが
   * 「実装済み」と表示され、しかも型検査も lint も通る。
   *
   * scripts/validate-design.mjs 側は、綴り誤りを「実装されていない measure ルール」として
   * 落とすが、lint 側のIDやそもそも存在しないIDを書いた場合は黙って免除が効かないだけになる。
   */
  it('未実装として挙がっているIDが、どれも実在するルールである', () => {
    const ids = RULES.map((rule) => rule.id)

    for (const id of UNIMPLEMENTED_RULE_IDS) {
      expect(ids, `${id} というルールは無い`).toContain(id)
    }
  })

  it('一覧に在れば未実装、無ければ実装済みとする', () => {
    expect(ruleImplemented('alfa', ['bravo'])).toBe(true)
    expect(ruleImplemented('bravo', ['bravo'])).toBe(false)
    expect(ruleImplemented('bravo', [])).toBe(true)
  })
})
