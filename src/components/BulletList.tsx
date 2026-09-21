/**
 * `design/components/bullet-list.json` の実装（DR-0050）。
 *
 * 契約の `props.items` は `type: "string[]"`（DR-0035）。`ReactNode[]` ではなく
 * `string[]` で受けることが、そのまま契約の使い方2つ分の担保になる——項目の中に
 * 改行や入れ子の構造を作れず、`emphasis` も埋め込めない。
 *
 * 順序を持たない `ul` で描く。`ol` にすると番号が項目のあいだに順序の意味を与え、
 * 契約が禁じている読み方をそのまま画面に出してしまう。
 */
export type BulletListProps = {
  /** 箇条書きの各項目。 */
  items: string[]
}

export function BulletList({ items }: BulletListProps) {
  return (
    <ul className="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
