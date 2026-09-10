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
 * oklch を 0..255 の sRGB 3成分へ。色域外はクリップする（ブラウザの描画に合わせる）。
 *
 * @param {string} value
 * @returns {[number, number, number]}
 */
export function oklchToRgb255(value) {
  return /** @type {[number, number, number]} */ (
    oklchToLinearRgb(parseOklch(value)).map((linear) =>
      Math.round(encodeChannel(Math.min(Math.max(linear, 0), 1)) * 255),
    )
  )
}

/**
 * oklch を `#rrggbb` へ。色域外はクリップする（ブラウザの描画に合わせる）。
 *
 * @param {string} value
 */
export function oklchToHex(value) {
  const channels = oklchToRgb255(value).map((byte) => byte.toString(16).padStart(2, '0'))

  return `#${channels.join('')}`
}

/**
 * WCAG 2.1 の相対輝度。8bit（0..255）に丸めた後の値から求める。
 * 実際に描画されるのは丸めた後の色なので、そこを基準にしないと実測にならない。
 *
 * @param {[number, number, number]} rgb 0..255 の3成分
 */
export function relativeLuminanceFromRgb([r, g, b]) {
  const components = [r, g, b].map((byte) => {
    const channel = byte / 255

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * components[0] + 0.7152 * components[1] + 0.0722 * components[2]
}

/**
 * WCAG 2.1 のコントラスト比。小数第 2 位で切り捨てる。
 * 四捨五入すると 4.495 が 4.5 になり、基準を割った組み合わせを通してしまう。
 *
 * @param {[number, number, number]} rgbA 0..255 の3成分
 * @param {[number, number, number]} rgbB 0..255 の3成分
 */
export function contrastRatioFromRgb(rgbA, rgbB) {
  const [lighter, darker] = [relativeLuminanceFromRgb(rgbA), relativeLuminanceFromRgb(rgbB)].sort(
    (a, b) => b - a,
  )

  return Math.floor(((lighter + 0.05) / (darker + 0.05)) * 100) / 100
}

/**
 * WCAG 2.1 の相対輝度。トークンの oklch を経由する版。
 * `scripts/validate-design.mjs` の `checkContrast`（コントラスト検査。DR-0008 / DR-0011 /
 * DR-0033）が使う。色域検査（`isInSrgbGamut`）はこれを使わず独立している。
 *
 * @param {string} value
 */
export function relativeLuminance(value) {
  const hex = oklchToHex(value)
  const rgb = /** @type {[number, number, number]} */ (
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  )

  return relativeLuminanceFromRgb(rgb)
}

/**
 * WCAG 2.1 のコントラスト比。トークンの oklch を経由する版。
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

/** `rgb(...)` / `rgba(...)` の記法を読む。ブラウザの `getComputedStyle` が返す形式（DR-0011）。 */
const CSS_RGB_PATTERN = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/

/**
 * `oklch(L C H)` / `oklch(L C H / A)` の記法を読む。`design/theme.css` の
 * `--dh-color-*` は oklch で書かれており（DR-0008）、その変数をそのまま
 * `color` 等へ当てた要素は、`getComputedStyle` が rgb() へ変換せず oklch() の
 * まま返す（Chromium が CSS Color 4 の計算値を保持するようになったため）。
 * `parseOklch` は透明度を持たない厳密な形（トークンの記法）しか読めないため、
 * ここでは別に緩い正規表現で受ける。
 */
const CSS_OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/

/**
 * `getComputedStyle` が返す `rgb(...)` / `rgba(...)` / `oklch(...)` 文字列を読む。
 *
 * @param {string} value
 * @returns {{ rgb: [number, number, number], alpha: number }}
 */
export function parseCssRgb(value) {
  const trimmed = value.trim()
  const rgbMatch = CSS_RGB_PATTERN.exec(trimmed)

  if (rgbMatch !== null) {
    return {
      rgb: [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])],
      alpha: rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]),
    }
  }

  const oklchMatch = CSS_OKLCH_PATTERN.exec(trimmed)

  if (oklchMatch !== null) {
    return {
      rgb: oklchToRgb255(`oklch(${oklchMatch[1]} ${oklchMatch[2]} ${oklchMatch[3]})`),
      alpha: oklchMatch[4] === undefined ? 1 : Number(oklchMatch[4]),
    }
  }

  throw new Error(`rgb()/rgba()/oklch() の形で書くこと: ${value}`)
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
