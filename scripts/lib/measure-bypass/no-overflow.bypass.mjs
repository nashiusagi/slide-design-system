/**
 * `no-overflow` の bypass フィクスチャ（DR-0044）。
 *
 * 事例は `records(context)` として書く。context にはキャンバス寸法と許容誤差が
 * 入っており、閾値そのものをここへ書き写さずに境界の両側を作れる（DR-0033:
 * 正本の値は複製しない）。
 */

/** @type {import('../bypass-fixtures.mjs').BypassFixture} */
export default {
  cases: [
    {
      axis: 'boundary',
      name: '許容誤差ちょうどのはみ出しは通る。ここを落とすと環境差だけで赤くなる',
      expect: 'ok',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > p[0]',
          rect: {
            left: 0,
            top: 0,
            right: context.canvas.width + context.overflowToleranceInPx,
            bottom: context.canvas.height + context.overflowToleranceInPx,
          },
          hasDirectText: false,
          fontSizePx: 0,
          color: 'rgb(0, 0, 0)',
          backgroundLayers: [],
        },
      ],
    },
    {
      axis: 'boundary',
      name: '許容誤差をわずかに超えると落ちる',
      expect: 'violation',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > p[0]',
          rect: {
            left: 0,
            top: 0,
            right: context.canvas.width + context.overflowToleranceInPx + 0.01,
            bottom: context.canvas.height,
          },
          hasDirectText: false,
          fontSizePx: 0,
          color: 'rgb(0, 0, 0)',
          backgroundLayers: [],
        },
      ],
    },
    {
      axis: 'boundary',
      name: '左と上へのはみ出しも見る。右下だけ見ると負の方向が素通りする',
      expect: 'violation',
      records: (/** @type {any} */ context) => [
        {
          selector: 'section[0] > p[0]',
          rect: {
            left: -context.overflowToleranceInPx - 0.01,
            top: -context.overflowToleranceInPx - 0.01,
            right: context.canvas.width,
            bottom: context.canvas.height,
          },
          hasDirectText: false,
          fontSizePx: 0,
          color: 'rgb(0, 0, 0)',
          backgroundLayers: [],
        },
      ],
    },
  ],
}
