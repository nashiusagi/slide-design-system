# DR-0037: eslint-plugin-slide の5ルールは、まだ無い実装を前提にしない範囲に絞る

- **状態**: 承認済み
- **日付**: 2026-09-08
- **関連**: [DR-0011](./0011-lint-and-measure.md), [DR-0035](./0035-layout-component-contract-shape.md), [DR-0033](./0033-derived-values-are-generated-and-checked.md)
- **正本**: `design/rules.json`
- **実装**: `packages/eslint-plugin-slide/`

## 文脈

[DR-0011](./0011-lint-and-measure.md) は5つの lint ルールを名前と一行の役割だけで決めていた。#7 で実装するにあたり、具体的な検出方法まではどの DR にも書かれておらず、実装時に決める必要があった。

決める前に次の2点を確認した。

- `design/components/*.json` は component の使用可否と props の形だけを持ち、DOM 構造や React 実装は持たない。実際の React 実装（`SlideTitle` 等）は「別 Issue が決める」と明記されている（[DR-0035](./0035-layout-component-contract-shape.md)）。つまり `component-approved` が「承認外の独自 HTML で部品を再実装しない」を、実際の DOM タグ（`h1` / `ul` 等）を検査する形で実装すると、まだ存在しない実装を前提にすることになり、現状の `src/App.tsx`（ランタイム確認用の仮スライド、素の `h1` / `ul` を使う）を壊す
- deck 契約（`design/decks/*.md`）と、それに対応する実装ファイル（TSX）を紐付ける命名規則はまだ無い。`deck-conformance` を実装するには、この対応をどう解決するかを決める必要がある

## 決定

**まだ無い実装を前提にしない範囲に、各ルールの検出方法を絞る。**

- **`no-raw-color` / `no-raw-scale`**: 検査対象を JSX の `style={{ ... }}` オブジェクトに絞る。CSS ファイル（`design/layout.css` 等）は対象にしない。ESLint に CSS AST パーサが配線されていない（#22 が指摘する状態と同じ）ため、CSS 側は現状「検査していない」ことを明示する
- **`no-raw-color`**: 色を運ぶプロパティを固定の一覧（`COLOR_PROPERTIES`）で持ち、`background` / `border` のようなショートハンドは対象に含めない。ショートハンドの値は色以外（長さ・スタイル種別）も同じ文字列に混ざるため、対象にすると「色ではない部分」を色として誤検出する。生の色値も hex と CSS の色関数（`rgb()` / `oklch()` 等）だけをパターンとして検出し、CSS の名前付きキーワード色（`red` 等）は語彙が広く誤検出が増えるため対象にしない
- **`no-raw-scale`**: 値が「数値、または単位付きの数値」に見えるものだけを対象にする（`NUMERIC_LENGTH` パターン）。`'center'` のようなキーワード値まで対象にすると、長さではない値を誤って報告する
- **`component-approved`**: DOM 構造ではなく、契約名（kebab-case を PascalCase へ変換したもの、例: `slide-title` → `SlideTitle`）の**ローカルでの再定義（シャドーイング）**と、契約名を使う箇所の **layout との対応（`allowedIn`）** だけを見る。正規の実装を import して使うことは妨げない。実際の DOM 構造を検査する版は、component の React 実装が入る Issue で改めて検討する
- **`deck-conformance`**: 対応する deck 契約をファイル名の規則では決めず、ESLint のルールオプション `deck` で明示する。`eslint.config.js` の `files` で対象ファイルを絞り込み、そのブロックで `deck` を指定する（例: `src/App.tsx` ↔ `design/decks/harness-intro.md`）

## 理由

- **まだ無い実装を前提にすると、ルールが導入直後から既存コードを壊すか、既存コードに合わせて未決定の設計（component の DOM 構造）を先に固定することになる。** どちらも [DR-0035](./0035-layout-component-contract-shape.md) が「別 Issue が決める」とした境界を、lint 実装の都合で越える
- シャドーイング検出は、DOM を検査しなくても「契約名を勝手な実装で埋める」という実害のある壊れ方を防げる。将来 component の React 実装が入ったとき、この検出はそのまま活きる
- `deck` オプションを明示する方式は、命名規則を先に決め打ちしない。deck が複数ファイルに分かれる構成（Phase 2 の人間オーサリング）が実際に必要になった時点で、規則化するかどうかを決められる
- CSS ファイルの検査を諦めるのではなく「まだしていない」と明示することで、後から CSS AST パーサ（#22 と同種の対応）を足す Issue が、埋めるべき穴の場所を読み取れる

## 検討した他の選択肢

### `component-approved` を DOM タグのパターンマッチで実装する（`h1` は `slide-title` の代替とみなす、等）

ルールの検出力が高くなる。

**却下理由**: どの DOM タグがどの component の代替にあたるかは、component の React 実装が決めることであり（[DR-0035](./0035-layout-component-contract-shape.md)）、lint 側が先取りして決めると実装 Issue の裁量を奪う。`src/App.tsx` の仮実装もこの時点で壊れる。

### `deck-conformance` の対象ファイルを命名規則（`src/decks/<name>.tsx` ↔ `design/decks/<name>.md`）で解決する

ルールオプションが要らず、ファイルを増やしても設定を書き足さずに済む。

**却下理由**: 現時点で deck 契約は `harness-intro` 一つ、対応する実装ファイルは `src/App.tsx` 一つで、規則化するには実例が少なすぎる。規則を先に固定すると、Phase 2 で deck が複数ファイルに分かれる構成が要るとわかったときに規則を壊すことになる。

## 帰結

- component の React 実装を作る Issue が来たら、`component-approved` に DOM 構造の検査を足すかどうかをこの DR を踏まえて判断する
- `deck-conformance` の対象が増えたら、`eslint.config.js` に `files` ブロックを足す。ファイル数が増えて手書きの対応表が保守しづらくなったら、命名規則化を検討する Issue を起こす
- CSS ファイルへの `no-raw-color` / `no-raw-scale` 適用は、CSS AST パーサを配線する Issue（#22 と統合するか、別に起こすか）で改めて決める
