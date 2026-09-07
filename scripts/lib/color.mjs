/**
 * 色の変換とコントラストの実測。
 *
 * トークンの色は oklch で書く（DR-0008）。人が読むのは oklch だが、コントラストの
 * 基準（WCAG 2.1）は sRGB の相対輝度で定義されている。ここはその橋渡しだけを持ち、
 * 閾値の判定はしない。閾値は `design/rules.json` を正本とする（DR-0011 / DR-0012）。
 */

/** `oklch(L C H)` の記法を読む。トークンで許すのはこの形だけ。 */
const OKLCH_PATTERN = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/

/**
 * @typedef {{ l: number, c: number, h: number }} Oklch
 */

/**
 * @param {string} value
 * @returns {Oklch}
 */
export function parseOklch(value) {
  const matched = OKLCH_PATTERN.exec(value)

  if (matched === null) {
    throw new Error(`oklch(L C H) の形で書くこと: ${value}`)
  }

  return { l: Number(matched[1]), c: Number(matched[2]), h: Number(matched[3]) }
}

/**
 * 線形 sRGB の 1 成分をガンマ補正済みの 0..1 へ。
 *
 * @param {number} linear
 */
function encodeChannel(linear) {
  const encoded =
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055

  return encoded
}

/**
 * oklch を線形 sRGB の 3 成分へ。色域外なら 0..1 を外れた値がそのまま返る。
 *
 * @param {Oklch} color
 * @returns {[number, number, number]}
 */
export function oklchToLinearRgb({ l, c, h }) {
  const radians = (h * Math.PI) / 180
  const a = c * Math.cos(radians)
  const b = c * Math.sin(radians)

  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ]

  return [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ]
}

/**
 * sRGB の色域に収まっているか。外れている色は環境ごとに違うクリップを受け、
 * 実測したコントラストとブラウザの描画結果がずれる。
 *
 * @param {string} value
 */
export function isInSrgbGamut(value) {
  const tolerance = 1e-4

  return oklchToLinearRgb(parseOklch(value)).every(
    (channel) => channel >= -tolerance && channel <= 1 + tolerance,
  )
}

/**
 * oklch を `#rrggbb` へ。色域外はクリップする（ブラウザの描画に合わせる）。
 *
 * @param {string} value
 */
export function oklchToHex(value) {
  const channels = oklchToLinearRgb(parseOklch(value)).map((linear) => {
    const byte = Math.round(encodeChannel(Math.min(Math.max(linear, 0), 1)) * 255)

    return byte.toString(16).padStart(2, '0')
  })

  return `#${channels.join('')}`
}

/**
 * WCAG 2.1 の相対輝度。8bit へ丸めた後の値から求める。
 * 実際に描画されるのは丸めた後の色なので、そこを基準にしないと実測にならない。
 *
 * @param {string} value
 */
export function relativeLuminance(value) {
  const hex = oklchToHex(value)
  const components = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * components[0] + 0.7152 * components[1] + 0.0722 * components[2]
}

/**
 * WCAG 2.1 のコントラスト比。小数第 2 位で切り捨てる。
 * 四捨五入すると 4.495 が 4.5 になり、基準を割った組み合わせを通してしまう。
 *
 * @param {string} foreground
 * @param {string} background
 */
export function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  )

  return Math.floor(((lighter + 0.05) / (darker + 0.05)) * 100) / 100
}

/**
 * 色相の差を 0..180 度で返す。円環なので単純な引き算では 350 度と 10 度が離れて見える。
 *
 * @param {string} a
 * @param {string} b
 */
export function hueDistance(a, b) {
  const difference = Math.abs(parseOklch(a).h - parseOklch(b).h) % 360

  return Math.round(Math.min(difference, 360 - difference) * 10) / 10
}
