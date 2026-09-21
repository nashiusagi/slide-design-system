import { describe, expect, it } from 'vitest'

import { formatDocsHash, parseDocsHash } from './hash'
import { RULES_PAGE_ID } from './page-ids'
import {
  HUMAN_JUDGED_METHOD,
  RULES,
  UNIMPLEMENTED_RULE_IDS,
  ruleImplementation,
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

    /*
     * 名前が対応しているだけでは足りない。ブロックが配列やスカラーへ変わると
     * `thresholdEntries` は null を返し、値は画面から静かに消える。引いた結果が描ける形で
     * あることまで見る。
     */
    for (const rule of RULES) {
      if (blocks.includes(thresholdKey(rule.id))) {
        expect(thresholdEntries(rule.id), `${rule.id} の閾値ブロックを引けない`).not.toBeNull()
      }
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

describe('ruleImplementation', () => {
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

  /*
   * 契約の文章と未実装の一覧は、同じ状態を別々に述べている。`design/rules.json` の
   * description が「未実装」と書いたルールは、一覧にも載っていなければならない（DR-0051 帰結）。
   *
   * 判定の根拠は一覧のほうで、この検査は両者が食い違ったことを知らせるだけだ。実装した人が
   * 一覧から外して契約の文章を直し忘れると、カードは「実装済み」と表示しつつ本文で「未実装」と
   * 言い続ける——その状態でここが落ちる。
   */
  it('契約の description が未実装と述べるルールは、未実装の一覧にも載っている', () => {
    const declaredUnimplemented = RULES.filter((rule) => rule.description.includes('未実装')).map(
      (rule) => rule.id,
    )

    expect(declaredUnimplemented.length).toBeGreaterThan(0)
    expect([...declaredUnimplemented].sort()).toEqual(
      [...UNIMPLEMENTED_RULE_IDS].filter((id) => declaredUnimplemented.includes(id)).sort(),
    )

    for (const id of UNIMPLEMENTED_RULE_IDS) {
      expect(declaredUnimplemented, `${id} が契約の description では未実装と読めない`).toContain(id)
    }
  })

  it('一覧に在れば未実装、無ければ実装済みとする', () => {
    const rule = { id: 'bravo', method: 'lint', severity: 'error', description: '架空' }

    expect(ruleImplementation({ ...rule, id: 'alfa' }, ['bravo'])).toBe('implemented')
    expect(ruleImplementation(rule, ['bravo'])).toBe('unimplemented')
    expect(ruleImplementation(rule, [])).toBe('implemented')
  })

  /*
   * 人が判断する method（DR-0011）には実装対応の検査が無く、一覧に無いことが実装の存在を
   * 意味しない。ここを実装済みと表示すると、自動検査が効いているという誤った読みになる。
   *
   * いまの契約にこの method のルールは無いので、架空のルールで固定する。契約に現れるのを
   * 待つと、現れた日に初めて表示が壊れていたことが分かる。
   */
  it('人が判断する method は、一覧の有無によらず実装の話にしない', () => {
    const rule = { id: 'charlie', method: HUMAN_JUDGED_METHOD, severity: 'error', description: '架空' }

    expect(ruleImplementation(rule, [])).toBe('human')
    expect(ruleImplementation(rule, ['charlie'])).toBe('human')
  })
})
