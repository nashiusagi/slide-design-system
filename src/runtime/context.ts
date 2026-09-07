import { createContext } from 'react'

/**
 * Deck が Slide へ渡す文脈。
 *
 * Deck は表示中のスライドだけを描画するので、ここに現れる Slide は常に 1 枚。
 */
export type DeckContextValue = {
  /** 表示中のスライドの位置。0 始まり。報告の出所を示すために Slide へ渡す。 */
  slideIndex: number
  /** 現在の段階。0 は Fragment を 1 つも表示していない状態。 */
  step: number
  /**
   * そのスライドが持つ段階数を Deck へ報告する。
   *
   * どのスライドの段階数かを添える。Deck は現在位置と一致する報告だけを採るので、
   * スライドを移った直後の古い報告は自動的に無視される。
   */
  reportStepCount: (slideIndex: number, count: number) => void
}

export const DeckContext = createContext<DeckContextValue | null>(null)

/**
 * Slide が Fragment へ渡す文脈。
 *
 * Fragment は自分が何段階目かを `index` として持ち、Slide へ登録する。
 * Slide は登録された最大値をそのスライドの段階数として Deck へ報告する。
 */
export type SlideContextValue = {
  step: number
  /**
   * Fragment を登録する。戻り値は登録解除の関数。
   *
   * `id` は React の `useId` による安定した識別子で、同じ Fragment が
   * 再マウントされても重複計上されない。
   */
  registerFragment: (id: string, index: number) => () => void
}

export const SlideContext = createContext<SlideContextValue | null>(null)
