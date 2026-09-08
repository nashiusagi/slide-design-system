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
        // 静的に読めない値（変数経由）は対象外。ランタイムは値を検査しない設計（DR-0021）。
        'const el = <Slide layout={dynamicLayout}>x</Slide>',
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
