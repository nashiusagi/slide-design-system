# DESIGN.md

AI がスライドを生成する前に最初に読む設計方針。ここは方針を書く場所であり、値は置かない。値の正本は `design/tokens.json`（トークン）と `design/rules.json`（検査の閾値）にある（[DR-0009](./docs/decisions/0009-five-layer-contract.md)）。

## 北極星

**白い紙面と黒い文字。強調は赤紫の一色だけ。**

装飾で語らず、余白と文字の階層だけで構造を示す。色は意味のある場所にしか現れない。根拠は [DR-0007](./docs/decisions/0007-north-star.md)。

## Do / Don't

**Do**

- 余白と文字の階層だけで構造を示す
- レイアウトは「見た目」ではなく「そのスライドが担う役割」で選ぶ。判断基準は `design/layouts/*.json` の `whenToUse` / `whenNotToUse` にある（[DR-0010](./docs/decisions/0010-three-layouts.md)）
- 色・余白・文字サイズはすべて `design/tokens.json` から生成された `--dh-*` 変数を参照する（[DR-0018](./docs/decisions/0018-plain-css-with-tokens.md)）
- 契約にあるレイアウト / 部品だけを使う。組み合わせは `design/layouts/*.json` の `slots` が定める

**Don't**

- 生の色値・生の px 値を書かない。`--dh-*` を経由しない値は契約を素通りする抜け道になる（[DR-0018](./docs/decisions/0018-plain-css-with-tokens.md)）
- 影・角丸を装飾として使わない。既定は「無し」で、`design/tokens.json` の `shadow.raised` は 1 枚につき 1 箇所までの例外である
- アクセント（強調）を 1 枚の中で複数箇所に重ねない。強調が連発すると強調でなくなる
- 契約に無い、または契約と異なる独自のレイアウト・部品を作らない（`layout-approved` / `component-approved`、[DR-0011](./docs/decisions/0011-lint-and-measure.md)）
- Phase 1 のスコープ外にあるレイアウト（`section` / `code` / `figure`）を先取りして作らない（[DR-0010](./docs/decisions/0010-three-layouts.md)、Phase 1.5）
- 北極星の「紙面」を字義通りに取らない。罫線・枠線・仕切り線で紙や帳票を模す装飾は作らない。北極星が指すのは余白と文字の階層だけで構造を示すことであり、紙の見た目を再現することではない

## 衝突したときの優先順位

方針どうしが衝突したときは、上から順に優先する。

1. **Global Constraints** — 機械検査で担保される、譲れない制約
2. **北極星** — 「白い紙面と黒い文字。強調は赤紫の一色だけ」
3. **レイアウト / 部品契約の選択基準** — 役割に基づく選択（見た目の好みでは選ばない）
4. **見た目の細部の裁量** — トークンの範囲内での、上記のいずれとも衝突しない選択

北極星と Global Constraints が衝突しているように見えるときは、Global Constraints を優先する。たとえば「強調を大きく見せたい」という北極星側の欲求より、「キャンバスからはみ出さない」「コントラスト基準を満たす」という制約が勝つ。

## Global Constraints

- **固定キャンバス**: 寸法は `design/tokens.json` の `canvas` にある。要素はキャンバスからはみ出さない。判定は実測（`no-overflow`、[DR-0011](./docs/decisions/0011-lint-and-measure.md)）で行う
- **単一テーマ**: ダークモードなど条件分岐のテーマは持たない（[DR-0005](./docs/decisions/0005-single-theme-personal.md)）
- **最小フォントサイズ**: 本文には下限がある。値の正本は `design/rules.json`（[DR-0012](./docs/decisions/0012-min-font-size.md)）
- **コントラスト**: 色の組み合わせは水準を満たす。閾値は `design/rules.json` を正本とし、`design/tokens.json` の `$measured` が算出値を記録する（[DR-0008](./docs/decisions/0008-accent-hue-purple.md) / [DR-0033](./docs/decisions/0033-derived-values-are-generated-and-checked.md)）
- **レイアウトは Phase 1 では契約にあるものだけ**: 使ってよいレイアウトは `design/layouts/` にあるものに限る。`design/layouts/` を増やすこと自体が Phase 1.5 の判断で、DR と Issue を伴わない追加はしない（[DR-0010](./docs/decisions/0010-three-layouts.md)）
- **スタイルは素の CSS + トークンのみ**: Tailwind や CSS Modules は使わない。クラス名は契約が定め、実装（`design/layout.css`）がそれに従う（[DR-0018](./docs/decisions/0018-plain-css-with-tokens.md)）

## 契約の構成

5 層すべてを持つ（[DR-0009](./docs/decisions/0009-five-layer-contract.md)）。各層の正本の在り処は [README](./README.md#正本の在り処) にある。

`design/layouts/` は「そのスライドがどんな役割を担うときに選ぶか」を、見た目ではなく役割で書く。`design/components/` は各部品の使用可否と props の形を書く。両者は `slots` / `allowedIn` で対応しており、対応が崩れていないことは `pnpm design:check` が検査する。

## 参照

- [DR-0007](./docs/decisions/0007-north-star.md) 北極星
- [DR-0009](./docs/decisions/0009-five-layer-contract.md) 契約の 5 層
- [DR-0010](./docs/decisions/0010-three-layouts.md) レイアウト 3 種
- [DR-0018](./docs/decisions/0018-plain-css-with-tokens.md) 素の CSS + トークン
- [DR-0035](./docs/decisions/0035-layout-component-contract-shape.md) レイアウト / 部品契約の具体的な形
