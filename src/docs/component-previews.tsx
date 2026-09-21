/**
 * 部品のプレビュー。契約名から引く登録表（DR-0049）へ載せる中身をここが持つ。
 *
 * 描くのは実装そのもの（`src/components/`、DR-0050）で、見た目をカタログ側で作り直さない
 * （レイアウトのプレビューが `design/layout.css` をそのまま当てるのと同じ考え方、DR-0047）。
 * スタイルは `docs.css` が読み込む。
 *
 * **読み込み先に注意。** ここから見た `../components` は部品の実装（`src/components/`）で、
 * 契約の読み込み口（`src/docs/components.ts`）ではない。後者は `./components` になる。
 *
 * 文言は見本として書き下ろす。契約の文章を貼らない（DR-0042 決定2）。
 */
import { BulletList, Emphasis, SlideTitle, Statement } from '../components'

export function SlideTitlePreview() {
  return <SlideTitle text="四半期の振り返り" />
}

export function BulletListPreview() {
  return <BulletList items={['計測は自動で回す', '例外は記録に残す', '判断は人がする']} />
}

export function StatementPreview() {
  return <Statement text="決まりは少ないほど守られる" />
}

/**
 * 単独では描かない。文中の一語を強調する部品なので、地の文が無いと見え方が分からない。
 * 埋め込める先は `Statement` だけ（`allowedIn` が `statement` だけで、そこに居る部品が
 * これしかない）なので、その形のまま見せる。
 */
export function EmphasisPreview() {
  return (
    <Statement
      text={
        <>
          制約は<Emphasis text="一つ" />だけ置く
        </>
      }
    />
  )
}
