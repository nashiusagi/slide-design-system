import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'

import rule from './no-raw-scale.mjs'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('no-raw-scale', () => {
  it('valid / invalid', () => {
    ruleTester.run('no-raw-scale', rule, {
      valid: [
        'const el = <div style={{ padding: "var(--dh-space-md)" }} />',
        'const el = <div style={{ fontSize: "var(--dh-type-size-body)" }} />',
        // design/rules.json の noRawScale.allowedLiterals にある例外値。
        'const el = <div style={{ margin: "0" }} />',
        'const el = <div style={{ width: "100%" }} />',
        'const el = <div style={{ borderWidth: "1px" }} />',
        // 単位を持たないプロパティは対象外。
        'const el = <div style={{ opacity: 0.5, zIndex: 10, flexGrow: 1 }} />',
        // 数値に見えないキーワード値は「長さ」ではないので対象外。色は no-raw-color が持つ。
        'const el = <div style={{ textAlign: "center", color: "#ff0000" }} />',
        // 静的に読めない値（変数経由）は対象外。
        'const el = <div style={dynamicStyles} />',
        'const el = <div style={{ padding: spaceMd }} />',
        'const el = <div />',
        // ショートハンドの複合値。トークンごとに allowedLiterals・トークン変数への
        // 参照・数値に見えないキーワード（solid）のいずれかであれば通す。
        'const el = <div style={{ border: "1px solid var(--dh-border-color)" }} />',
      ],
      invalid: [
        {
          code: 'const el = <div style={{ padding: "16px" }} />',
          errors: [{ messageId: 'rawScale' }],
        },
        {
          // 数値リテラルも React では px 相当として解釈されるため対象。
          code: 'const el = <div style={{ fontSize: 24 }} />',
          errors: [{ messageId: 'rawScale' }],
        },
        {
          // 単位を変えるだけでは素通りしない（DR-0011: 単位ではなくリテラルかどうかで判定）。
          code: 'const el = <div style={{ fontSize: "1.5rem" }} />',
          errors: [{ messageId: 'rawScale' }],
        },
        {
          code: 'const el = <div style={{ gap: "8%" }} />',
          errors: [{ messageId: 'rawScale' }],
        },
        {
          // ショートハンドの複合値。空白区切りの各トークンを個別に見ないと、
          // 複合値であるという理由だけで生の長さがまるごと素通りする。
          code: 'const el = <div style={{ margin: "8px 16px" }} />',
          errors: [{ messageId: 'rawScale' }, { messageId: 'rawScale' }],
        },
        {
          // トークン変数への参照とリテラルが混在するショートハンド。リテラル側だけを捕まえる。
          code: 'const el = <div style={{ border: "2px solid var(--dh-border-color)" }} />',
          errors: [{ messageId: 'rawScale' }],
        },
      ],
    })
  })
})
