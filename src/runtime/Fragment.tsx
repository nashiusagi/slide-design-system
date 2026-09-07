import { useContext, useId, useLayoutEffect, type ReactNode } from 'react'

import { SlideContext } from './context'

export type FragmentProps = {
  /**
   * 何段階目で現れるか。1 始まり。
   *
   * 出現順から自動採番せず明示させる（DR-0029）。deck 契約（#6）と lint（#7）が
   * 段階を静的に読めるようにするため。
   */
  index: number
  children: ReactNode
}

/**
 * 段階表示。現在の段階が `index` に達するまで描画しない。
 *
 * 隠すのではなく描画そのものを止める（DR-0029）。実測検査（DR-0011）はビルド出力の
 * DOM を見るため、未到達の段階が要素として残っていると「はみ出し」の判定対象に混ざる。
 *
 * 包む要素を足さないのは、`<li>` や表のセルごと Fragment で囲めるようにするため。
 * 中間に要素が挟まると、親（`<ul>` や `<tr>`）との組み合わせが壊れる。
 */
export function Fragment({ index, children }: FragmentProps) {
  const context = useContext(SlideContext)
  const id = useId()
  const registerFragment = context?.registerFragment

  // layout effect で登録する。子の layout effect は親より先に走るので、
  // Slide が段階数を報告する時点では登録が揃っている。passive effect にすると
  // 最初の報告が 0 になり、正しい値は paint 後の再レンダーまで届かない。
  useLayoutEffect(() => {
    if (!registerFragment) {
      return
    }

    return registerFragment(id, index)
  }, [id, index, registerFragment])

  if (!context) {
    throw new Error('Fragment は Slide の中でのみ使える。')
  }

  if (context.step < index) {
    return null
  }

  return <>{children}</>
}
