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
      ],
    })
  })
})
