/**
 * 基礎（トークン）のページ。中身はまだ無い（実装は #34）。
 *
 * 中身を書くときは design/tokens.json / design/theme.css を読み込んで描画し、
 * トークン名・値をここへ書き写さない（DR-0042）。
 */
export function Foundations() {
  return (
    <div className="doc-card">
      <h2 className="doc-card__title">準備中</h2>
      <p className="doc-card__body">
        このページの中身は #34 が持つ。ここは足場（エントリ・ルーティング・共通スタイル）だけを置いている。
      </p>
    </div>
  )
}
