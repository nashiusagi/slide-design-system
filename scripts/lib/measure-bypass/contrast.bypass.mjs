/**
 * `contrast` の bypass フィクスチャ（DR-0044）。
 *
 * 境界の両側は、白地に対する灰色2つで作る。#767676 は白地で比 4.5 をわずかに
 * 上回り、#777777 はわずかに下回る（WCAG 2.1 の 4.5:1 をまたぐ既知の対）。
 * design/rules.json の contrast.requirements を厳しくすると ok 側が落ちるので、
 * 閾値を動かしたことがこのフィクスチャにも現れる。
 */

/** @param {any} context */
const withinCanvas = (context) => ({
  left: 0,
  top: 0,
  right: context.canvas.width,
  bottom: context.canvas.height,
})

/** @type {import('../bypass-fixtures.mjs').BypassFixture} */
export default {
  cases: [
    {
      axis: 'boundary',
      name: '基準をわずかに上回る前景色は通る',
      expect: 'ok',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > p[0]',
          rect: withinCanvas(context),
          hasDirectText: true,
          fontSizePx: context.minFontSizePx,
          color: 'rgb(118, 118, 118)',
          backgroundLayers: [[255, 255, 255, 1]],
        },
      ],
    },
    {
      axis: 'boundary',
      name: '基準をわずかに下回ると落ちる。1段階分の差で判定が変わる',
      expect: 'violation',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > p[0]',
          rect: withinCanvas(context),
          hasDirectText: true,
          fontSizePx: context.minFontSizePx,
          color: 'rgb(119, 119, 119)',
          backgroundLayers: [[255, 255, 255, 1]],
        },
      ],
    },
    {
      axis: 'value-composition',
      name: '半透明な背景は下の層と合成する。alpha を捨てて不透明として扱うと誤って通る',
      expect: 'violation',
      records: (/** @type {any} */ context) => [
        {
          // 黒 50% を白地に重ねた実際の背景は灰色。不透明な黒として扱うと、
          // 白い前景とのコントラストが十分に見えてしまう。
          selector: 'section[0] > p[0]',
          rect: withinCanvas(context),
          hasDirectText: true,
          fontSizePx: context.minFontSizePx,
          color: 'rgb(255, 255, 255)',
          backgroundLayers: [[0, 0, 0, 0.5]],
        },
      ],
    },
    {
      exclusion: 'no-direct-text',
      name: '直接のテキストを持たない要素は見ない。前景色が描かれない',
      expect: 'ok',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > div[0]',
          rect: withinCanvas(context),
          hasDirectText: false,
          fontSizePx: context.minFontSizePx,
          color: 'rgb(254, 254, 254)',
          backgroundLayers: [[255, 255, 255, 1]],
        },
      ],
    },
  ],
}
