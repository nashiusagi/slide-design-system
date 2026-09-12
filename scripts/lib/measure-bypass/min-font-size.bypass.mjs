/**
 * `min-font-size` の bypass フィクスチャ（DR-0044）。
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
      name: '下限ちょうどは満たす',
      expect: 'ok',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > p[0]',
          rect: withinCanvas(context),
          hasDirectText: true,
          fontSizePx: context.minFontSizePx,
          color: 'rgb(0, 0, 0)',
          backgroundLayers: [[255, 255, 255, 1]],
        },
      ],
    },
    {
      axis: 'boundary',
      name: '下限をわずかに割ると落ちる。丸めて比べると小数の差が消える',
      expect: 'violation',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > p[0]',
          rect: withinCanvas(context),
          hasDirectText: true,
          fontSizePx: context.minFontSizePx - 0.01,
          color: 'rgb(0, 0, 0)',
          backgroundLayers: [[255, 255, 255, 1]],
        },
      ],
    },
    {
      exclusion: 'no-direct-text',
      name: '直接のテキストを持たない要素は見ない。描かれる文字が無い',
      expect: 'ok',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > div[0]',
          rect: withinCanvas(context),
          hasDirectText: false,
          fontSizePx: 1,
          color: 'rgb(0, 0, 0)',
          backgroundLayers: [[255, 255, 255, 1]],
        },
      ],
    },
  ],
}
