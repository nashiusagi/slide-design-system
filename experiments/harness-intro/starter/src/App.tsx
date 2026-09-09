import './runtime/runtime.css'

import { Deck, Slide } from './runtime'

/**
 * ここから実装を始める。Deck / Slide / Fragment（./runtime）を使ってスライドを
 * 組み立てる。何を伝えるかは experiments/harness-intro/brief.md にある。
 */
export function App() {
  return (
    <Deck>
      <Slide layout="placeholder">
        <p>ここから書き始める</p>
      </Slide>
    </Deck>
  )
}
