# DR-0026: TypeScript は 5 系に留め、7 系へは上げない

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0002](./0002-source-format-jsx-react.md), [DR-0011](./0011-lint-and-measure.md), [DR-0045](./0045-stay-on-eslint-not-biome.md)
- **正本**: `package.json`（`devDependencies.typescript`）

## 文脈

足場（#2）を組む時点で TypeScript は 7 系（ネイティブ移植版）が最新だった。しかし `typescript-eslint` の `peerDependencies` は 5 系までしか受け付けず（2026-09-06 時点）、7 系を入れると満たされない。

このプロジェクトでは lint が飾りではない。契約違反の検出は、すべて TypeScript の AST を読む自作 ESLint プラグインで実装する（[DR-0011](./0011-lint-and-measure.md)。ルールの一覧と severity の正本は `design/rules.json`）。パーサが動かないことは、Harness の半分が動かないことと同じである。

## 決定

TypeScript のバージョンは `package.json` で 5 系に固定する。`typescript-eslint` が対応するまで 7 系へは上げない。

## 理由

- **検査系が言語バージョンより優先される。** 型検査は速くなるが lint が動かない、では [DR-0002](./0002-source-format-jsx-react.md) で JSX を選んだ理由（AST 検査が使える）が失われる
- 5 系で不足している機能は現時点で無い。コンパイル速度も、この規模では判断材料にならない

## 検討した他の選択肢

### TypeScript 7 を入れ、peer dependency の警告を無視する

最新版に乗れる。

**却下理由**: 警告で済む保証がない。パーサが AST を返さなければ自作プラグインは書けず、書けても検出漏れが静かに起きる。検出漏れは「全ルール pass」として現れるため、壊れたことに気づけない。

### TypeScript 7 を入れ、lint を型情報なしのルールだけにする

**却下理由**: 契約検査は JSX の構造と識別子を読む必要があり、対象を減らせない。

## 帰結

- `typescript-eslint` が 7 系に対応した時点で、この DR を見直す Issue を起こす
- **上げてよいかの判定は「lint が違反を検出できるか」で行う。** 自作プラグインができた後は、意図的に契約違反を含む fixture を使った検出テストが、すべて期待どおり違反を報告することを条件にする。プラグインが無い現時点では「`pnpm lint` が正常終了し、かつ `typescript-eslint` の `peerDependencies` を満たすこと」までを条件とする。`eslint .` の終了コードだけを見ると、パーサ変更でルールが1件も発火しなくなった状態を「合格」と読んでしまう
- この制約は [DR-0045](./0045-stay-on-eslint-not-biome.md)（lint 実行系は ESLint に留める）と連動している。ESLint に留まる限りこの DR の前提は生き、ESLint を離れれば `typescript-eslint` の対応状況は判断材料でなくなる。どちらかを見直すときは、もう一方もあわせて見る
