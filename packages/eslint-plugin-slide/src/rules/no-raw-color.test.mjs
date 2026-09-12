import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'

import rule from './no-raw-color.mjs'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('no-raw-color', () => {
  it('valid / invalid', () => {
    ruleTester.run('no-raw-color', rule, {
      valid: [
        'const el = <div style={{ color: "var(--dh-color-text)" }} />',
        'const el = <div style={{ backgroundColor: "var(--dh-color-surface)" }} />',
        // 色以外のプロパティは対象外。
        'const el = <div style={{ padding: "16px" }} />',
        // style 自体が変数（spread 相当）で、プロパティを静的に読めない。
        'const el = <div style={colorStyles} />',
        // style 自体が無い。
        'const el = <div />',
      ],
      invalid: [
        {
          code: 'const el = <div style={{ color: "#ff0000" }} />',
          errors: [{ messageId: 'rawColor' }],
        },
        {
          code: 'const el = <div style={{ backgroundColor: "rgb(255, 0, 0)" }} />',
          errors: [{ messageId: 'rawColor' }],
        },
        {
          code: 'const el = <div style={{ fill: "oklch(0.5 0.2 30)" }} />',
          errors: [{ messageId: 'rawColor' }],
        },
        {
          // 複数のプロパティが違反していれば、その数だけ報告する。
          code: 'const el = <div style={{ color: "#fff", borderColor: "#000" }} />',
          errors: [{ messageId: 'rawColor' }, { messageId: 'rawColor' }],
        },
      ],
    })
  })
})
