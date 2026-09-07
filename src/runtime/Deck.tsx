import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { CANVAS_HEIGHT, CANVAS_WIDTH, fitScale } from './canvas'
import { DeckContext, type DeckContextValue } from './context'
import { formatHash, parseHash, type Position } from './hash'

export type DeckProps = {
  /** `Slide` を並べる。表示するのは現在位置の 1 枚だけ。 */
  children: ReactNode
}

/** 位置をスライド数の範囲へ収める。段階の上限は Slide の報告を待つのでここでは見ない。 */
function clampPosition(position: Position, slideCount: number): Position {
  const lastIndex = Math.max(slideCount - 1, 0)
  const slideIndex = Math.min(Math.max(position.slideIndex, 0), lastIndex)

  return {
    slideIndex,
    // 別のスライドへ丸めたなら、段階は先頭へ戻す。
    step: slideIndex === position.slideIndex ? Math.max(position.step, 0) : 0,
  }
}

/** 読み込み時の位置。hash が無い、または書式に合わなければ先頭。 */
function initialPosition(slideCount: number): Position {
  return clampPosition(parseHash(window.location.hash) ?? { slideIndex: 0, step: 0 }, slideCount)
}

/**
 * スライド全体の入れ物。
 *
 * 現在位置の状態管理、キーボードとクリックでの移動、URL hash との同期、
 * 固定キャンバスのスケーリングを持つ。Phase 1 のランタイムはここまで（DR-0004）。
 */
export function Deck({ children }: DeckProps) {
  const slides = useMemo(() => Children.toArray(children), [children])
  const slideCount = slides.length

  const [position, setPosition] = useState<Position>(() => initialPosition(slideCount))
  const [stepCount, setStepCount] = useState(0)
  const [scale, setScale] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)

  // 段階数は表示中のスライドが報告する。スライドを移ったら報告を待たずに 0 へ戻す。
  // 前のスライドの段階数のまま進めると、存在しない段階を指してしまう。
  const reportStepCount = useCallback((count: number) => {
    setStepCount(count)
  }, [])

  const goToSlide = useCallback((slideIndex: number) => {
    setStepCount(0)
    setPosition({ slideIndex, step: 0 })
  }, [])

  const goNext = useCallback(() => {
    if (position.step < stepCount) {
      setPosition({ slideIndex: position.slideIndex, step: position.step + 1 })
      return
    }

    if (position.slideIndex < slideCount - 1) {
      goToSlide(position.slideIndex + 1)
    }
  }, [goToSlide, position, slideCount, stepCount])

  const goPrevious = useCallback(() => {
    if (position.step > 0) {
      setPosition({ slideIndex: position.slideIndex, step: position.step - 1 })
      return
    }

    // 戻った先の段階数はまだ分からないので、末尾ではなく先頭の段階に置く。
    if (position.slideIndex > 0) {
      goToSlide(position.slideIndex - 1)
    }
  }, [goToSlide, position])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        goNext()
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious])

  // 状態 → URL。履歴を積まずに書き換える。ページ送りのたびに履歴が伸びると、
  // 戻るボタンが「1 手前のスライド」ではなく「1 手前の操作」を辿ることになる。
  useEffect(() => {
    const hash = formatHash(position)

    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [position])

  // URL → 状態。ユーザーが URL を直接書き換えた場合と、履歴を移動した場合に効く。
  useEffect(() => {
    function handleHashChange() {
      const parsed = parseHash(window.location.hash)

      if (!parsed) {
        return
      }

      const next = clampPosition(parsed, slideCount)

      setStepCount(0)
      setPosition(next)
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [slideCount])

  // 表示領域に合わせて倍率を決める。キャンバスの寸法は固定なので、
  // どの幅でも縦横比は保たれ、はみ出しは要素側の問題としてだけ残る（DR-0004）。
  useLayoutEffect(() => {
    const element = viewportRef.current

    if (!element) {
      return
    }

    const viewport: HTMLDivElement = element

    function update() {
      const { width, height } = viewport.getBoundingClientRect()
      setScale(fitScale(width, height))
    }

    update()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)

      return () => window.removeEventListener('resize', update)
    }

    const observer = new ResizeObserver(update)
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [])

  const context = useMemo<DeckContextValue>(
    () => ({ step: position.step, reportStepCount }),
    [position.step, reportStepCount],
  )

  return (
    <div
      className="slide-deck"
      ref={viewportRef}
      onClick={goNext}
      data-slide-count={slideCount}
      data-slide-index={position.slideIndex}
      data-step={position.step}
    >
      <div
        className="slide-canvas"
        style={{
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          transform: `scale(${scale})`,
        }}
      >
        <DeckContext.Provider value={context}>{slides[position.slideIndex]}</DeckContext.Provider>
      </div>
    </div>
  )
}
