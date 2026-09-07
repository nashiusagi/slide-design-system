/**
 * URL hash による現在位置の表現（DR-0029）。
 *
 * 書式は `#/<スライド番号>/<段階>`。スライド番号は 1 始まり、段階は 0 始まりで
 * 0 は Fragment を 1 つも表示していない状態を指す。段階が 0 のときは省略して
 * `#/3` と書く。読む側は両方を受け付ける。
 */

/** ランタイム内部での現在位置。`slideIndex` は 0 始まり。 */
export type Position = {
  slideIndex: number
  step: number
}

const HASH_PATTERN = /^#\/(\d+)(?:\/(\d+))?$/

/**
 * hash を位置へ変換する。書式に合わないものは `null` を返す。
 *
 * 呼び出し側でスライド数に対する範囲検査を行う。ここは書式だけを見る。
 */
export function parseHash(hash: string): Position | null {
  const matched = HASH_PATTERN.exec(hash)

  if (!matched) {
    return null
  }

  const slideNumber = Number(matched[1])
  const step = matched[2] === undefined ? 0 : Number(matched[2])

  // `#/0` はスライド番号が 1 始まりである以上、指す先が無い。
  if (slideNumber < 1) {
    return null
  }

  return { slideIndex: slideNumber - 1, step }
}

/** 位置を hash へ変換する。段階 0 は省略する。 */
export function formatHash(position: Position): string {
  const slideNumber = position.slideIndex + 1

  return position.step === 0 ? `#/${slideNumber}` : `#/${slideNumber}/${position.step}`
}
