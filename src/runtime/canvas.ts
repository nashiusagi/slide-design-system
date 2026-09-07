/**
 * 固定キャンバスの寸法。
 *
 * 正本は `design/tokens.json` の `canvas` である（DR-0004）。トークンがまだ無い
 * 時点ではここが実体になる。#4 でトークンを作るときに、この定数と `canvas` が
 * 一致することを検査する（DR-0021 の帰結）。ずれると `no-overflow` の基準面が
 * 条件ごとに変わり、lint では検出できない。
 *
 * ランタイムは設計契約から独立して動く必要がある（DR-0021）ため、CSS 変数では
 * なく数値として持つ。スケールの倍率を算出するのに数値が要る。
 */
export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 720

/**
 * キャンバス全体が収まる最大の倍率を返す。縦横比は保たれる。
 *
 * 表示領域の幅か高さが 0 のとき（描画前や display:none）は 0 ではなく 1 を返す。
 * 0 を返すとキャンバスが潰れ、実測検査（DR-0011）が「はみ出していない」と
 * 誤って判定できてしまう。
 */
export function fitScale(viewportWidth: number, viewportHeight: number): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return 1
  }

  return Math.min(viewportWidth / CANVAS_WIDTH, viewportHeight / CANVAS_HEIGHT)
}
