import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RULES, UNIMPLEMENTED_RULE_IDS, ruleSectionId, rulesByMethod, thresholdEntries } from '../rules'
import { Rules } from './Rules'

/** ルール1件のカード。節 ID で引く。 */
function cardOf(container: HTMLElement, ruleId: string): HTMLElement {
  const card = container.querySelector(`#${CSS.escape(ruleSectionId(ruleId))}`)

  expect(card, `${ruleId} のカードが無い`).not.toBeNull()

  return card as HTMLElement
}

describe('Rules', () => {
  it('契約のルールをすべて、契約の並びで描く', () => {
    const { container } = render(<Rules />)

    expect(RULES.length).toBeGreaterThan(0)
    expect([...container.querySelectorAll('.doc-rule')].map((card) => card.id)).toEqual(
      rulesByMethod(RULES).flatMap(([, rules]) => rules.map((rule) => ruleSectionId(rule.id))),
    )
  })

  /*
   * method ごとの区分け。見出しは契約の method の値そのもので、カタログ側の対応表を通さない
   * （通すと、schema の enum へ値が増えたときにその束だけが名無しで出る）。
   */
  it('method ごとに束ね、見出しに method の値を出す', () => {
    render(<Rules />)

    const methods = rulesByMethod(RULES).map(([method]) => method)

    expect(methods.length).toBeGreaterThan(1)
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(
      methods,
    )
  })

  it('各ルールの ID・severity・説明を出す', () => {
    const { container } = render(<Rules />)

    for (const rule of RULES) {
      const card = cardOf(container, rule.id)

      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(rule.id)
      expect(card).toHaveTextContent(rule.severity)
      expect(card).toHaveTextContent(rule.description)
      expect(card).toHaveTextContent(rule.method)
    }
  })

  /*
   * 閾値。契約の値がそのままカードの中に出ることを、値の側から見る。
   *
   * 数・文字列・配列・入れ子のオブジェクトが混在するので、葉まで降りて文字列化した値を
   * 突き合わせる。1つでも落ちると、閾値を持つルールが「持たないルール」と同じ姿で並ぶ。
   */
  it('閾値を持つルールについて、契約の値を併記する', () => {
    const { container } = render(<Rules />)

    /** 葉の値をすべて集める。`$` で始まるキーは閾値ではないので降りない。 */
    const leaves = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.flatMap(leaves)
      }

      if (typeof value === 'object' && value !== null) {
        return Object.entries(value)
          .filter(([key]) => !key.startsWith('$'))
          .flatMap(([, nested]) => leaves(nested))
      }

      return [String(value)]
    }

    const withThresholds = RULES.filter((rule) => thresholdEntries(rule.id) !== null)

    expect(withThresholds.length).toBeGreaterThan(0)

    for (const rule of withThresholds) {
      const card = cardOf(container, rule.id)
      const entries = thresholdEntries(rule.id) ?? []

      for (const [key, value] of entries) {
        expect(card, `${rule.id} の ${key} が出ていない`).toHaveTextContent(key)

        for (const leaf of leaves(value)) {
          expect(card, `${rule.id} の ${key} の値 ${leaf} が出ていない`).toHaveTextContent(leaf)
        }
      }
    }
  })

  /*
   * 実装の有無。未実装の一覧に在るルールだけが「未実装」と出る。件数も見る——1件だけ正しく
   * 出して残りを取り違える実装でも、個別の照合だけなら通る余地がある。
   */
  it('未実装のルールを未実装として出し、それ以外は実装済みとして出す', () => {
    const { container } = render(<Rules />)

    expect(UNIMPLEMENTED_RULE_IDS.length).toBeGreaterThan(0)

    for (const rule of RULES) {
      const card = cardOf(container, rule.id)
      const implemented = !UNIMPLEMENTED_RULE_IDS.includes(rule.id)

      expect(card.querySelector('[data-implemented]')).toHaveAttribute(
        'data-implemented',
        String(implemented),
      )
      expect(card).toHaveTextContent(implemented ? '実装済み' : '未実装')
    }

    expect(container.querySelectorAll('[data-implemented="false"]')).toHaveLength(
      UNIMPLEMENTED_RULE_IDS.length,
    )
  })
})
