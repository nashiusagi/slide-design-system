import type { ReactNode } from 'react'

/**
 * `design/components/statement.json` の実装（DR-0050）。
 *
 * 契約の `props.text` は `type: "string"` だが、ここだけ `ReactNode` で受ける。
 * `statement` レイアウトの `slots` は `emphasis` を任意で1つ許しており（DR-0035）、
 * `emphasis` は他の部品の中へ埋め込んで使う部品だ。埋め込める先はこの部品しかない。
 * `string` で受けると、契約が許している組み合わせを実装が作れなくなる。
 *
 * 緩めるのはこの1箇所に留める。`slide-title` / `bullet-list` の `allowedIn` には
 * `emphasis` を伴うレイアウトが無いので、あちらは `string` のままにしてある。
 */
export type StatementProps = {
  /** 伝えたい結論の文言。`Emphasis` を1つだけ埋め込める。 */
  text: ReactNode
}

export function Statement({ text }: StatementProps) {
  return <p className="statement">{text}</p>
}
