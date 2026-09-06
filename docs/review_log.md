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

いずれもドキュメント・運用の問題で、`design/rules.json`（スライド生成物の検査）へそのまま載る性質ではない。
機械化するならリポジトリ側の検査になる。判断は人が行う。

| カテゴリID | 要約 | 累計 | 最終指摘 | 状態 |
|---|---|---|---|---|
| `writing/ambiguous-criterion` | 判断基準が曖昧で、契約として実行できない | 3 | PR #18 | 未着手 |
| `writing/term-inconsistency` | 同じものが複数の呼び名を持ち、外延も揺れる | 3 | PR #18 | 未着手 |
| `writing/notation-inconsistency` | 表記の不統一（DR 参照がリンクになっていない等） | 3 | PR #18 | 未着手 |
| `phase/out-of-scope-addition` | フェーズのスコープ外、または DR に接続しないものが混入した | 3 | PR #18 | 未着手 |
| `decisions/undocumented-decision` | DR に無い判断が、PR説明やIssueにだけ書かれている | 3 | PR #18 | 未着手 |

## 全カテゴリ

| カテゴリID | 観点 | 要約 | 累計 | 初出 | 最終指摘 |
|---|---|---|---|---|---|
| `contract/design-data-duplicated` | 設計契約 | デザインの値が正本以外へ複製された | 1 | PR #13 | PR #13 |
| `contract/value-outside-source-of-truth` | 設計契約 | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 1 | PR #13 | PR #13 |
| `contract/source-of-truth-ambiguous` | 設計契約 | 「正本」がどのファイルを指すか一意でない | 2 | PR #13 | PR #17 |
| `contract/contract-structure-duplicated` | 設計契約 | 正本の中身の一覧が、別の文書へ構造ごと複製された | 2 | PR #13 | PR #18 |
| `inspection/rule-scope-inconsistent` | 検査 | 同じルールIDの守備範囲が文書間で食い違う | 1 | PR #13 | PR #13 |
| `inspection/rule-has-bypass` | 検査 | 検査ルールに抜け道があり、書き方を変えると素通りする | 2 | PR #13 | PR #18 |
| `inspection/rule-id-mapping-incomplete` | 検査 | ルールIDと実装の対応検査が一部の系統しか覆っていない | 1 | PR #13 | PR #13 |
| `inspection/measure-state-unspecified` | 検査 | measure がどの表示状態で測るか規定されていない | 1 | PR #13 | PR #13 |
| `inspection/measure-viewport-unspecified` | 検査 | measure の測定条件が未規定で結果が再現しない | 1 | PR #13 | PR #13 |
| `code/gitignore-hides-tracked-artifacts` | コード品質 | .gitignore が、追跡する方針の成果物を無言で除外する | 1 | PR #13 | PR #13 |
| `writing/ambiguous-criterion` | 日本語 | 判断基準が曖昧で、契約として実行できない | 3 | PR #13 | PR #18 |
| `writing/term-inconsistency` | 日本語 | 同じものが複数の呼び名を持ち、外延も揺れる | 3 | PR #13 | PR #18 |
| `writing/notation-inconsistency` | 日本語 | 表記の不統一 | 3 | PR #13 | PR #18 |
| `phase/out-of-scope-addition` | フェーズ | フェーズのスコープ外、または DR に接続しないものが混入した | 3 | PR #13 | PR #18 |
| `decisions/undocumented-decision` | 決定記録 | DR に無い判断が、PR説明やIssueにだけ書かれている | 3 | PR #13 | PR #18 |
| `contract/workflow-constant-duplicated` | 設計契約 | 他スキルが持つ取り決め（パス・上限値）が書き写された | 1 | PR #17 | PR #17 |
| `code/review-loop-double-counts-log` | コード品質 | 同一 PR の再レビューが指摘ログを二重に計上する | 1 | PR #17 | PR #17 |
| `code/review-artifact-handling-undefined` | コード品質 | レビュー成果物をコミットするかどうかが未定義 | 1 | PR #17 | PR #17 |
| `code/undefined-command-input` | コード品質 | 手順のコマンドが要求する入力の用意が未定義 | 1 | PR #17 | PR #17 |
| `writing/contradictory-instruction` | 日本語 | 同じ状況に対する指示が文書間で食い違う | 1 | PR #17 | PR #17 |
| `decisions/dr-recording-bypass` | 決定記録 | DR の代わりに PR 本文へ書くことを手順が公認している | 1 | PR #17 | PR #17 |
| `decisions/consequence-not-followed` | 決定記録 | 既存 DR の帰結が、それを通る手順に反映されていない | 1 | PR #17 | PR #17 |
| `decisions/dr-restates-canonical-value` | 決定記録 | DR が正本の値を本文に書き写した | 2 | PR #17 | PR #18 |
| `decisions/index-section-mismatch` | 決定記録 | DR の索引登録が、内容と合わない節に置かれた | 1 | PR #17 | PR #17 |
| `code/rereview-overwrites-prior-review` | コード品質 | 再レビューが前周のレビュー記録を上書きする | 1 | PR #17 | PR #17 |
| `code/review-history-row-update-undefined` | コード品質 | レビュー履歴の行の更新方法が書式定義と食い違う | 1 | PR #17 | PR #17 |
| `code/check-skips-workspace-packages` | コード品質 | `pnpm check` が workspace パッケージを型検査もテストもしない | 1 | PR #18 | PR #18 |
| `inspection/lint-warning-not-failing` | 検査 | lint の warn がゲートを落とさない | 1 | PR #18 | PR #18 |
| `code/tsconfig-include-no-op` | コード品質 | tsconfig の include が実際には対象を拾っていない | 1 | PR #18 | PR #18 |

## レビュー履歴

| PR | 日付 | blocker | should | consider | レビュー |
|---|---|---|---|---|---|
| #18 | 2026-09-06 | 0 | 4 | 7 | [pr-18.md](./reviews/pr-18.md) |
| #17 | 2026-09-06 | 0 | 18 | 10 | [pr-17.md](./reviews/pr-17.md) |
| #13 | 2026-09-06 | 1 | 8 | 6 | [pr-13.md](./reviews/pr-13.md) |
