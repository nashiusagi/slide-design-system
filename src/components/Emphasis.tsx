/**
 * `design/components/emphasis.json` の実装（DR-0050）。
 *
 * 色はトークンの `accent` だけを使う。値は `components.css` が `--dh-color-accent`
 * から取り、ここには持たない（DR-0018）。
 *
 * `strong` で描き、太さは継承させる（`components.css`）。強調の手段を色の一点に
 * 絞るのは北極星（DR-0007）の求めで、太さまで変えると同じ一語に2つの手段が重なる。
 *
 * 他の部品の中へ埋め込んで使う。埋め込める先は、`text` を `ReactNode` で受ける
 * `Statement` だけになっている——`emphasis` の `allowedIn` が `statement` だけだからだ。
 */
export type EmphasisProps = {
  /** 強調する語句。 */
  text: string
}

export function Emphasis({ text }: EmphasisProps) {
  return <strong className="emphasis">{text}</strong>
}
