/**
 * `component-approved` の bypass フィクスチャ（DR-0044）。
 *
 * 契約名をローカルで埋める書き方は、関数宣言・アロー関数・class 宣言・class 式と
 * 記法が分かれる。どれか1つの記法だけを見ていると、記法を変えるだけで素通りする。
 */

/** @type {import('../../../../scripts/lib/bypass-fixtures.mjs').BypassFixture} */
export default {
  cases: [
    {
      axis: 'alternate-notation',
      name: 'class 式での再定義。宣言（ClassDeclaration）と別のノード型を持つ',
      code: 'const Emphasis = class { render() { return null } }',
      expect: 'violation',
      messageId: 'shadowed',
    },
    {
      axis: 'alternate-notation',
      name: 'アロー関数での再定義',
      code: 'const BulletList = () => <ul />',
      expect: 'violation',
      messageId: 'shadowed',
    },
    {
      axis: 'alternate-notation',
      name: '名前付き関数式での再定義',
      code: 'const Statement = function Inner() { return <p /> }',
      expect: 'violation',
      messageId: 'shadowed',
    },
    {
      axis: 'alternate-notation',
      name: '波括弧で包んだ layout。allowedIn の判定を包み方で回避できない',
      code: 'import { Statement } from "../components"\nconst el = <Slide layout={"title"}><Statement text="x" /></Slide>',
      expect: 'violation',
      messageId: 'disallowedLayout',
    },
    {
      axis: 'alternate-notation',
      name: '置換の無いテンプレートリテラルの layout',
      code: 'import { Statement } from "../components"\nconst el = <Slide layout={`title`}><Statement text="x" /></Slide>',
      expect: 'violation',
      messageId: 'disallowedLayout',
    },
    {
      exclusion: 'import-reference',
      name: 'import で持ち込んだ契約名は再定義ではない',
      code: 'import { Statement } from "../components"\nconst el = <Slide layout="statement"><Statement text="x" /></Slide>',
      expect: 'ok',
    },
    {
      exclusion: 'member-expression-name',
      name: '名前空間付きの要素名は見ない',
      code: 'const el = <Slide layout="title"><Foo.Statement text="x" /></Slide>',
      expect: 'ok',
    },
    {
      exclusion: 'layout-not-static',
      name: '囲む Slide の layout が静的に読めないと、allowedIn と突き合わせる相手が決まらない',
      code: 'import { Statement } from "../components"\nconst el = <Slide layout={dynamicLayout}><Statement text="x" /></Slide>',
      expect: 'ok',
    },
  ],
}
