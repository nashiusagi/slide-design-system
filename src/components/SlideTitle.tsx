/**
 * `design/components/slide-title.json` の実装（DR-0050）。
 *
 * 契約の `props.text` は `type: "string"`（DR-0035）。ここではそれをそのまま
 * `string` として受ける。`emphasis` の `allowedIn` に `title` / `bullets` は無いので、
 * 見出しの中へ部品を埋め込む形は契約上ありえない——型で塞いでおく。
 *
 * 見出しの階層は `h1` にする。スライドは1枚ずつ描かれ（`Deck` は現在位置の1枚だけを
 * 出す）、その主題はそのビューの最上位の見出しになる。カタログのプレビューは実物を
 * そのまま描く場所（DR-0049）なので、カタログの都合で階層を変えない。
 */
export type SlideTitleProps = {
  /** 見出しの文言。 */
  text: string
}

export function SlideTitle({ text }: SlideTitleProps) {
  return <h1 className="slide-title">{text}</h1>
}
