/**
 * `layout-approved` の bypass フィクスチャ（DR-0044）。
 */

/** @type {import('../../../../scripts/lib/bypass-fixtures.mjs').BypassFixture} */
export default {
  cases: [
    {
      axis: 'alternate-notation',
      name: '波括弧で包んだ文字列リテラル。layout="x" と layout={"x"} は同じ意味',
      code: 'const el = <Slide layout={"unknown-layout"}>x</Slide>',
      expect: 'violation',
      messageId: 'unapprovedLayout',
    },
    {
      axis: 'alternate-notation',
      name: '置換の無いテンプレートリテラル。包み方を変えても値は1つに決まる',
      code: 'const el = <Slide layout={`unknown-layout`}>x</Slide>',
      expect: 'violation',
      messageId: 'unapprovedLayout',
    },
    {
      exclusion: 'non-static-value',
      name: '変数を経由した layout は見ない（DR-0030: ランタイムは値を検査しない）',
      code: 'const el = <Slide layout={dynamicLayout}>x</Slide>',
      expect: 'ok',
    },
    {
      exclusion: 'non-slide-element',
      name: 'Slide 以外の要素の layout 属性は見ない',
      code: 'const el = <Foo layout="unknown-layout" />',
      expect: 'ok',
    },
  ],
}
