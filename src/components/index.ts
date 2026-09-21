/**
 * `design/components/` の4契約の実装の入口（DR-0050）。
 *
 * スライド本体（`src/App.tsx`）とデザインカタログ（`src/docs/`）の両方がここから読む。
 * `src/runtime/` からは公開しない。あちらは starter へ複製される範囲（DR-0021）で、
 * 部品が混ざると Baseline 条件が契約の実装を手に入れ、実験の条件差が壊れる。
 *
 * スタイル（`components.css`）はここから読み込まない。読み込む側が、トークン
 * （`design/theme.css`）と併せて自分で読む。`src/App.tsx` はまだトークンを読んで
 * おらず（DR-0038）、部品の CSS だけが先に載ると、値の定義されていない `--dh-*` を
 * 参照した中途半端な見た目になる。
 */
export { SlideTitle, type SlideTitleProps } from './SlideTitle'
export { BulletList, type BulletListProps } from './BulletList'
export { Statement, type StatementProps } from './Statement'
export { Emphasis, type EmphasisProps } from './Emphasis'
