# 指摘ログ

レビューで指摘されたカテゴリと、その通算回数。

累計が3回以上になったカテゴリは、`design/rules.json` へのルール化候補として扱う。
何度も人が見つけているなら、機械に見つけさせた方がよい。
ルール化するかどうかの判断は人が行う。このファイルは候補を示すところまで。

**数え方**: 1つのカテゴリは、1つの PR につき1回だけ数える。同じ PR の中で同じカテゴリの
違反箇所が5つ見つかっても +1。数えているのは「違反の数」ではなく
「そのカテゴリが問題として浮上した回数」だから。箇所の数で数えると、
1回のレビューで閾値に到達してしまい、ルール化の判断材料にならない。

最終更新: 2026-09-06

## ルール化候補（累計3回以上）

現時点でなし。

## 全カテゴリ

| カテゴリID | 観点 | 要約 | 累計 | 初出 | 最終指摘 |
|---|---|---|---|---|---|
| `contract/design-data-duplicated` | 設計契約 | デザインの値が正本以外へ複製された | 1 | PR #13 | PR #13 |
| `contract/value-outside-source-of-truth` | 設計契約 | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 1 | PR #13 | PR #13 |
| `contract/source-of-truth-ambiguous` | 設計契約 | 「正本」がどのファイルを指すか一意でない | 1 | PR #13 | PR #13 |
| `contract/contract-structure-duplicated` | 設計契約 | 正本の中身の一覧が、別の文書へ構造ごと複製された | 1 | PR #13 | PR #13 |
| `inspection/rule-scope-inconsistent` | 検査 | 同じルールIDの守備範囲が文書間で食い違う | 1 | PR #13 | PR #13 |
| `inspection/rule-has-bypass` | 検査 | 検査ルールに抜け道があり、書き方を変えると素通りする | 1 | PR #13 | PR #13 |
| `inspection/rule-id-mapping-incomplete` | 検査 | ルールIDと実装の対応検査が一部の系統しか覆っていない | 1 | PR #13 | PR #13 |
| `inspection/measure-state-unspecified` | 検査 | measure がどの表示状態で測るか規定されていない | 1 | PR #13 | PR #13 |
| `inspection/measure-viewport-unspecified` | 検査 | measure の測定条件が未規定で結果が再現しない | 1 | PR #13 | PR #13 |
| `code/gitignore-hides-tracked-artifacts` | コード品質 | .gitignore が、追跡する方針の成果物を無言で除外する | 1 | PR #13 | PR #13 |
| `writing/ambiguous-criterion` | 日本語 | 判断基準が曖昧で、契約として実行できない | 1 | PR #13 | PR #13 |
| `writing/term-inconsistency` | 日本語 | 同じものが複数の呼び名を持ち、外延も揺れる | 1 | PR #13 | PR #13 |
| `writing/notation-inconsistency` | 日本語 | 表記の不統一 | 1 | PR #13 | PR #13 |
| `phase/out-of-scope-addition` | フェーズ | フェーズのスコープ外、または DR に接続しないものが混入した | 1 | PR #13 | PR #13 |
| `decisions/undocumented-decision` | 決定記録 | DR に無い判断が、PR説明やIssueにだけ書かれている | 1 | PR #13 | PR #13 |

## レビュー履歴

| PR | 日付 | blocker | should | consider | レビュー |
|---|---|---|---|---|---|
| #13 | 2026-09-06 | 1 | 8 | 6 | [pr-13.md](./reviews/pr-13.md) |
