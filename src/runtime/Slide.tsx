import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { DeckContext, SlideContext, type SlideContextValue } from './context'

export type SlideProps = {
  /**
   * レイアウトの名前。`design/layouts/` の契約が正本で、ランタイムは値を検査しない
   * （DR-0021）。契約外の名前を弾くのは lint の役目（#7）。
   */
  layout: string
  /**
   * スピーカーノート。受け取るが表示しない（DR-0004）。
   * 表示 UI は Phase 1.5 以降で足す。
   */
  notes?: string
  children: ReactNode
}

/** 登録済み Fragment の最大 index。1 つも無ければ 0。 */
function maxIndex(fragments: Map<string, number>): number {
  let max = 0

  for (const index of fragments.values()) {
    if (index > max) {
      max = index
    }
  }

  return max
}

/**
 * レイアウトの箱。`layout` に対応するクラスを当て、中身をそのまま置く。
 *
 * クラス名は `slide slide--<layout>` の形（DR-0030）。実装は `design/layout.css`（#5）が持ち、
 * ここでは名前を導出するだけ。トークンもレイアウト CSS も無い状態で壊れないこと（DR-0021）。
 */
export function Slide({ layout, notes, children }: SlideProps) {
  const deck = useContext(DeckContext)
  const fragmentsRef = useRef<Map<string, number>>(new Map())
  const [stepCount, setStepCount] = useState(0)

  const registerFragment = useCallback((id: string, index: number) => {
    fragmentsRef.current.set(id, index)
    setStepCount(maxIndex(fragmentsRef.current))

    return () => {
      fragmentsRef.current.delete(id)
      setStepCount(maxIndex(fragmentsRef.current))
    }
  }, [])

  const step = deck?.step ?? 0
  const reportStepCount = deck?.reportStepCount

  // 描画前に段階数を確定させる。paint 後に報告すると、直後のキー入力が
  // 段階を飛ばして次のスライドへ進んでしまう。
  useLayoutEffect(() => {
    reportStepCount?.(stepCount)
  }, [reportStepCount, stepCount])

  const context = useMemo<SlideContextValue>(
    () => ({ step, registerFragment }),
    [step, registerFragment],
  )

  return (
    <SlideContext.Provider value={context}>
      <section className={`slide slide--${layout}`} data-layout={layout} data-notes={notes}>
        {children}
      </section>
    </SlideContext.Provider>
  )
}
