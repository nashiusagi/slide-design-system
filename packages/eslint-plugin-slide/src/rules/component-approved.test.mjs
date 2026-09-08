import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'

import rule from './component-approved.mjs'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('component-approved', () => {
  it('valid / invalid', () => {
    ruleTester.run('component-approved', rule, {
      valid: [
        // 正規の実装を import して、allowedIn どおりの layout で使う分には問題ない。
        'import { Statement } from "../components"\nconst el = <Slide layout="statement"><Statement text="x" /></Slide>',
        'import { SlideTitle } from "../components"\nconst el = <Slide layout="title"><SlideTitle text="x" /></Slide>',
        'import { SlideTitle } from "../components"\nconst el = <Slide layout="bullets"><SlideTitle text="x" /></Slide>',
        // 契約名と関係の無いローカル関数・変数は対象外。
        'function Card() { return <div /> }',
        'const Card = () => <div />',
        // Slide の外（契約が及ばない場所）で使われている分には、layout が
        // 判定できないので何も言わない。
        'const el = <Statement text="x" />',
        // layout が静的に読めないときも判定できないので何も言わない。
        'const el = <Slide layout={dynamicLayout}><Statement text="x" /></Slide>',
        // 波括弧で包んだ文字列リテラルでも、allowedIn どおりの layout なら通る。
        'import { Statement } from "../components"\nconst el = <Slide layout={"statement"}><Statement text="x" /></Slide>',
      ],
      invalid: [
        {
          // 契約名をローカルの関数で再定義している。
          code: 'function Statement() { return <p /> }',
          errors: [{ messageId: 'shadowed' }],
        },
        {
          code: 'const BulletList = () => <ul />',
          errors: [{ messageId: 'shadowed' }],
        },
        {
          code: 'class Emphasis { render() { return null } }',
          errors: [{ messageId: 'shadowed' }],
        },
        {
          // class 式（宣言ではなく式）での再定義。const X = class {} は
          // ClassDeclaration と違うノード型を持つため別経路で検出する必要がある。
          code: 'const Emphasis = class { render() { return null } }',
          errors: [{ messageId: 'shadowed' }],
        },
        {
          // layout="x" と layout={"x"} は同じ意味。波括弧で包むだけで
          // allowedIn の検査を回避できないことを固定する。
          code: 'import { Statement } from "../components"\nconst el = <Slide layout={"title"}><Statement text="x" /></Slide>',
          errors: [{ messageId: 'disallowedLayout' }],
        },
        {
          // bullet-list の allowedIn は ["bullets"] のみ。title では使えない。
          code: 'import { BulletList } from "../components"\nconst el = <Slide layout="title"><BulletList items={["x"]} /></Slide>',
          errors: [{ messageId: 'disallowedLayout' }],
        },
        {
          // statement の allowedIn は ["statement"] のみ。
          code: 'import { Statement } from "../components"\nconst el = <Slide layout="title"><Statement text="x" /></Slide>',
          errors: [{ messageId: 'disallowedLayout' }],
        },
      ],
    })
  })
})
