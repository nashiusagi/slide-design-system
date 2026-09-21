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
        // 波括弧で包んだ文字列リテラルでも、allowedIn どおりの layout なら通る。
        'import { Statement } from "../components"\nconst el = <Slide layout={"statement"}><Statement text="x" /></Slide>',
        // 正規の実装（DR-0050）は自分の契約名を定義する側。ここを再定義として弾くと、
        // import して使うべき相手をどこにも作れない。許すのはファイル名と一致する名前だけ。
        {
          code: 'export function Statement({ text }) { return <p className="statement">{text}</p> }',
          filename: 'src/components/Statement.tsx',
          options: [{ implementsContracts: true }],
        },
      ],
      invalid: [
        {
          // 契約名をローカルの関数で再定義している。
          code: 'function Statement() { return <p /> }',
          errors: [{ messageId: 'shadowed' }],
        },
        {
          code: 'class Emphasis { render() { return null } }',
          errors: [{ messageId: 'shadowed' }],
        },
        {
          // オプションを空で与えても緩まない。既定が緩むと、どのファイルでも契約名を埋められる。
          // options を省いた事例とは別の経路（オプションの解決）を踏む。
          code: 'export function Statement({ text }) { return <p>{text}</p> }',
          filename: 'src/components/Statement.tsx',
          options: [{}],
          errors: [{ messageId: 'shadowed' }],
        },
        {
          // 正規の実装のファイルでも、外れるのは自分の契約名だけ。別の契約名を
          // ローカル実装で埋める書き方は弾く（PR #56 のレビューで見つかった抜け道）。
          code: 'const Emphasis = () => <strong className="emph" />\nexport function Statement() { return <p><Emphasis /></p> }',
          filename: 'src/components/Statement.tsx',
          options: [{ implementsContracts: true }],
          errors: [{ messageId: 'shadowed' }],
        },
        {
          // 契約名と一致しないファイル名では、何も外れない。
          code: 'export function Statement({ text }) { return <p>{text}</p> }',
          filename: 'src/components/index.ts',
          options: [{ implementsContracts: true }],
          errors: [{ messageId: 'shadowed' }],
        },
        {
          // 実装のファイルでも、allowedIn の判定までは外さない。外す範囲は再定義だけ。
          code: 'import { Statement } from "./Statement"\nconst el = <Slide layout="title"><Statement text="x" /></Slide>',
          filename: 'src/components/Statement.tsx',
          options: [{ implementsContracts: true }],
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
