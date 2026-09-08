import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'

import rule from './layout-approved.mjs'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('layout-approved', () => {
  it('valid / invalid', () => {
    ruleTester.run('layout-approved', rule, {
      valid: [
        'const el = <Slide layout="title">x</Slide>',
        'const el = <Slide layout="bullets">x</Slide>',
        'const el = <Slide layout="statement">x</Slide>',
        // Slide 以外の要素の layout 属性は対象外。
        'const el = <Foo layout="unknown" />',
        // 静的に読めない値（変数経由）は対象外。ランタイムは値を検査しない設計（DR-0030）。
        'const el = <Slide layout={dynamicLayout}>x</Slide>',
        // 波括弧で包んだ文字列リテラルでも、契約にある名前なら通る。
        'const el = <Slide layout={"title"}>x</Slide>',
      ],
      invalid: [
        {
          code: 'const el = <Slide layout="unknown-layout">x</Slide>',
          errors: [{ messageId: 'unapprovedLayout' }],
        },
        {
          code: 'const el = <Slide layout="section">x</Slide>',
          errors: [{ messageId: 'unapprovedLayout' }],
        },
        {
          // layout="x" と layout={"x"} は同じ意味。波括弧で包むだけで
          // 検査を回避できないことを固定する。
          code: 'const el = <Slide layout={"unknown-layout"}>x</Slide>',
          errors: [{ messageId: 'unapprovedLayout' }],
        },
      ],
    })
  })
})
