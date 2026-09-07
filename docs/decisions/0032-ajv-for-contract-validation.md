# DR-0032: 契約の JSON Schema 検証は ajv で行い、strict モードで走らせる

- **状態**: 承認済み
- **日付**: 2026-09-07
- **関連**: [DR-0009](./0009-five-layer-contract.md), [DR-0028](./0028-single-check-entry-point.md)
- **実装**: `scripts/validate-design.mjs`

## 文脈

契約自体を JSON Schema で検証すると決めたが（[DR-0009](./0009-five-layer-contract.md)）、検証器は決めていなかった。#4 でトークンの契約を作るにあたり、実際に選ぶ必要が出た。

## 決定

**ajv を devDependency に入れ、draft 2020-12 のエントリ（`ajv/dist/2020.js`）を strict モードで使う。** 検証の呼び出しは `scripts/validate-design.mjs` に集約し、契約ファイルとスキーマの対応表を持つ。

[DR-0009](./0009-five-layer-contract.md) と [DR-0030](./0030-slide-class-derived-from-layout.md) が `pnpm design:check` と名指ししている口は、これのことである。実行口の名前はその通りにし、実装ファイルだけ `scripts/validate-design.mjs` とする。

## 理由

- **strict モードがスキーマ自身の書き間違いを落とす。** 型を伴わない `exclusiveMinimum` や綴りを間違えたキーワードは、緩い検証器では「制約が無い」として黙って通る。契約を検証する仕組みが自分の書き間違いで空振りするのが一番まずい
- draft 2020-12 は `$defs` / `propertyNames` を含む現行の語彙で、契約側で使いたい構文が揃っている
- 実行時の依存はスクリプト側だけで、スライドの成果物（`dist/`）には入らない（[DR-0022](./0022-plain-vite-build-output.md)）

## 検討した他の選択肢

### 検証器を持たず、手書きのチェックだけで済ませる

依存が増えない。

**却下理由**: 契約が 5 層へ増える（[DR-0009](./0009-five-layer-contract.md)）と、手書きの検証は契約ごとに書き足すことになり、書き漏らしが「検査したつもり」を生む。スキーマは契約と同じ場所（`design/schemas/`）に置けるので、契約が増えたときの追随が対応表 1 行で済む。

### Zod などの TypeScript 側のスキーマ

型と検証を一体にできる。

**却下理由**: 契約の正本は JSON であり、AI と人がそのまま読む（[DR-0009](./0009-five-layer-contract.md)）。検証の定義が TypeScript のコードへ移ると、契約を配る先（Agent Skill、starter）でそのまま参照できない。

## 帰結

- 契約を足す Issue は、`design/schemas/` へスキーマを置き、`scripts/validate-design.mjs` の対応表へ 1 行足す
- 検査関数は引数で契約を受け取る純関数として書き、ファイルの読み込みは `main()` に寄せる。壊れた入力を渡して「必ず 1 件返る」ことをテストで固定できる形にしておかないと、何も検出しないルールでも緑のまま通る
- スキーマは「単一テーマ」（[DR-0005](./0005-single-theme-personal.md)）を前提に、キー名を列挙して `additionalProperties: false` で閉じる。名前が増えることは `--dh-*` の増減を意味するので、意図的な契約変更として扱う
