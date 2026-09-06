# DR-0009: 契約は Atlas の 5 層をフル写像する

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0010](./0010-three-layouts.md), [DR-0016](./0016-deck-contract-markdown.md)

## 文脈

Atlas は設計契約を `DESIGN.md` / `tokens.json` / `patterns/` / `components/` / `examples/` / `rules.json` に分け、さらに JSON Schema で契約自体を検証していた。スライド領域へ移植するにあたり、どこまでの層を持つかを決める必要がある。層が少ないほど初期実装は軽いが、AI が参照すべき正本が痩せる。

## 決定

5 層すべてを写像する。

| Atlas | スライド版 | 内容 |
|---|---|---|
| `DESIGN.md` | 同じ | 北極星、Do / Don't、衝突時の優先順位、Global Constraints |
| `tokens.json` | 同じ + canvas | color / space / type / radius / shadow / canvas(1280x720) |
| `patterns/` | `layouts/` | スライドのレイアウト variant と余白・配置 |
| `components/` | 同じ | スライド内部品の使用可否と props |
| `examples/` | `decks/` | 発表ごとの構成（枚数・順序・各枚の役割） |
| `rules.json` | 同じ | lint / measure / review の検査ルール |

契約自体を検証する JSON Schema も持つ。

## 理由

- 各層は小さく始められる。layout 3 種（[DR-0010](./0010-three-layouts.md)）、component 4 種程度で、量は問題にならない
- `examples` → `decks` の写像が特に効く。アウトラインが「AI への入力」であると同時に「機械検査の正本」になり、宣言した構成通りに実装されたかを判定できる
- 層を後から足すと、既存の契約と実装の関係を組み替える必要が出る

## 検討した他の選択肢

### 4 層（deck 契約を持たず、アウトラインは指示文として渡す）

初期実装が軽い。

**却下理由**: 「意図した構成通りか」を判定できなくなる。Atlas の `component.usage` ルールに相当する検査が成立しない。

### 3 層（DESIGN.md + tokens + rules のみ）

layout と component はコードを正本とする。

**却下理由**: 二重管理は避けられるが、AI が参照すべき正本が痩せ、契約による制御が効かなくなる。

## 帰結

- 契約ファイル自体の検証（`pnpm design:check`）が必要になる
- 契約と実装の整合を保つ仕組み（生成された `theme.css` の乖離検査、`layout.css` のクラス名照合）が要る
