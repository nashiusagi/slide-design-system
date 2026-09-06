# DR-0014: Baseline との比較実験を行う

- **状態**: 承認済み
- **日付**: 2026-09-06
- **関連**: [DR-0021](./0021-starter-contains-runtime-only.md), [DR-0020](./0020-scripts-do-not-invoke-ai.md), [DR-0015](./0015-first-experiment.md)

## 文脈

Atlas の `experiments/` は、同じお題を「設計契約なし（baseline）」と「契約あり（harness）」で生成し、検査結果を返して修正した版（harness-corrected）と併せて比較する装置だった。自分専用の環境（[DR-0005](./0005-single-theme-personal.md)）では、この比較は日常の制作に必須ではない。

## 決定

Baseline 比較を行う。3 条件（baseline / harness / harness-corrected）の Run を保存し、ルール別に採点して比較する。

## 理由

- 「この仕組みに意味があるのか」を自分で検証できる。契約と検査に投じた労力が実際に効いているかを、印象ではなく採点で確認できる
- 保存された Run は、ルールを追加したときに遡って「そのルールは効くのか」を AI の再実行なしで確認できる資産になる
- 将来の登壇やブログの素材になる

## 検討した他の選択肢

### 修正ループのみ（Baseline 比較なし）

生成 → 検査 → 修正の 1 本だけ。Phase 1 の目的に直結し、実行回数が半分で済む。

**却下理由**: 契約の効果を測る手段が無くなる。

### experiments 概念を持たない

**却下理由**: 生成履歴と検査結果が残らず、ルールの効き目を後から検証できない。

## 帰結

- 実行回数と保存コストが倍になる
- 比較の公平性を担保する必要がある。starter は完全に同一とし、渡す情報だけを変える（[DR-0021](./0021-starter-contains-runtime-only.md)）
- Run を public リポジトリへ保存するため、sanitize と audit が必要になる（[DR-0023](./0023-public-repo-with-audit.md)）
