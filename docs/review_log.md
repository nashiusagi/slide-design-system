# 指摘ログ

レビューで指摘されたカテゴリと、その通算回数。

累計が3回以上になったカテゴリは、`design/rules.json` へのルール化候補として扱う。
何度も人が見つけているなら、機械に見つけさせた方がよい。
ルール化するかどうかの判断は人が行う。このファイルは候補を示すところまで。

**数え方**: 1つのカテゴリは、1つの PR につき1回だけ数える。同じ PR の中で同じカテゴリの
違反箇所が5つ見つかっても +1。数えているのは「違反の数」ではなく
「そのカテゴリが問題として浮上した回数」だから。箇所の数で数えると、
1回のレビューで閾値に到達してしまい、ルール化の判断材料にならない。

最終更新: 2026-09-08

## ルール化候補（累計3回以上）

いずれもドキュメント・運用の問題で、`design/rules.json`（スライド生成物の検査）へそのまま載る性質ではない。
機械化するならリポジトリ側の検査になる。判断は人が行う。

| カテゴリID | 要約 | 累計 | 最終指摘 | 状態 |
|---|---|---|---|---|
| `writing/ambiguous-criterion` | 判断基準が曖昧で、契約として実行できない | 6 | PR #21 | 未着手 |
| `writing/term-inconsistency` | 同じものが複数の呼び名を持ち、外延も揺れる | 6 | PR #21 | 未着手 |
| `writing/notation-inconsistency` | 表記の不統一（DR 参照がリンクになっていない等） | 5 | PR #23 | 未着手 |
| `phase/out-of-scope-addition` | フェーズのスコープ外、または DR に接続しないものが混入した | 5 | PR #20 | 未着手 |
| `decisions/undocumented-decision` | DR に無い判断が、PR説明やIssueにだけ書かれている | 6 | PR #21 | 未着手 |
| `decisions/dr-restates-canonical-value` | DR が正本の値を本文に書き写した | 4 | PR #21 | 未着手 |
| `contract/source-of-truth-ambiguous` | 「正本」がどのファイルを指すか一意でない | 3 | PR #19 | 未着手 |
| `inspection/rule-has-bypass` | 検査ルールに抜け道があり、書き方を変えると素通りする | 6 | PR #23 | 未着手 |
| `inspection/rule-scope-inconsistent` | 同じルールIDの守備範囲が文書間で食い違う | 3 | PR #20 | 未着手 |
| `decisions/consequence-not-followed` | 既存 DR の帰結が、それを通る手順に反映されていない | 3 | PR #20 | 未着手 |
| `contract/contract-structure-duplicated` | 正本の中身の一覧が、別の文書へ構造ごと複製された | 4 | PR #23 | 未着手 |
| `contract/value-outside-source-of-truth` | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 3 | PR #21 | 未着手 |

## 全カテゴリ

| カテゴリID | 観点 | 要約 | 累計 | 初出 | 最終指摘 |
|---|---|---|---|---|---|
| `contract/design-data-duplicated` | 設計契約 | デザインの値が正本以外へ複製された | 2 | PR #13 | PR #20 |
| `contract/value-outside-source-of-truth` | 設計契約 | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 3 | PR #13 | PR #21 |
| `contract/source-of-truth-ambiguous` | 設計契約 | 「正本」がどのファイルを指すか一意でない | 3 | PR #13 | PR #19 |
| `contract/contract-structure-duplicated` | 設計契約 | 正本の中身の一覧が、別の文書へ構造ごと複製された | 4 | PR #13 | PR #23 |
| `inspection/rule-scope-inconsistent` | 検査 | 同じルールIDの守備範囲が文書間で食い違う | 3 | PR #13 | PR #20 |
| `inspection/rule-has-bypass` | 検査 | 検査ルールに抜け道があり、書き方を変えると素通りする | 6 | PR #13 | PR #23 |
| `inspection/rule-id-mapping-incomplete` | 検査 | ルールIDと実装の対応検査が一部の系統しか覆っていない | 1 | PR #13 | PR #13 |
| `inspection/measure-state-unspecified` | 検査 | measure がどの表示状態で測るか規定されていない | 2 | PR #13 | PR #19 |
| `inspection/measure-viewport-unspecified` | 検査 | measure の測定条件が未規定で結果が再現しない | 1 | PR #13 | PR #13 |
| `code/gitignore-hides-tracked-artifacts` | コード品質 | .gitignore が、追跡する方針の成果物を無言で除外する | 1 | PR #13 | PR #13 |
| `writing/ambiguous-criterion` | 日本語 | 判断基準が曖昧で、契約として実行できない | 6 | PR #13 | PR #21 |
| `writing/term-inconsistency` | 日本語 | 同じものが複数の呼び名を持ち、外延も揺れる | 6 | PR #13 | PR #21 |
| `writing/notation-inconsistency` | 日本語 | 表記の不統一 | 5 | PR #13 | PR #23 |
| `phase/out-of-scope-addition` | フェーズ | フェーズのスコープ外、または DR に接続しないものが混入した | 5 | PR #13 | PR #20 |
| `decisions/undocumented-decision` | 決定記録 | DR に無い判断が、PR説明やIssueにだけ書かれている | 6 | PR #13 | PR #21 |
| `contract/workflow-constant-duplicated` | 設計契約 | 他スキルが持つ取り決め（パス・上限値）が書き写された | 2 | PR #17 | PR #18 |
| `code/review-loop-double-counts-log` | コード品質 | 同一 PR の再レビューが指摘ログを二重に計上する | 1 | PR #17 | PR #17 |
| `code/review-artifact-handling-undefined` | コード品質 | レビュー成果物をコミットするかどうかが未定義 | 1 | PR #17 | PR #17 |
| `code/undefined-command-input` | コード品質 | 手順のコマンドが要求する入力の用意が未定義 | 1 | PR #17 | PR #17 |
| `writing/contradictory-instruction` | 日本語 | 同じ状況に対する指示が文書間で食い違う | 2 | PR #17 | PR #20 |
| `decisions/dr-recording-bypass` | 決定記録 | DR の代わりに PR 本文へ書くことを手順が公認している | 1 | PR #17 | PR #17 |
| `decisions/consequence-not-followed` | 決定記録 | 既存 DR の帰結が、それを通る手順に反映されていない | 3 | PR #17 | PR #20 |
| `decisions/dr-restates-canonical-value` | 決定記録 | DR が正本の値を本文に書き写した | 4 | PR #17 | PR #21 |
| `decisions/index-section-mismatch` | 決定記録 | DR の索引登録が、内容と合わない節に置かれた | 2 | PR #17 | PR #19 |
| `code/rereview-overwrites-prior-review` | コード品質 | 再レビューが前周のレビュー記録を上書きする | 1 | PR #17 | PR #17 |
| `code/review-history-row-update-undefined` | コード品質 | レビュー履歴の行の更新方法が書式定義と食い違う | 1 | PR #17 | PR #17 |
| `code/check-skips-workspace-packages` | コード品質 | `pnpm check` が workspace パッケージを型検査もテストもしない | 1 | PR #18 | PR #18 |
| `inspection/lint-warning-not-failing` | 検査 | lint の warn がゲートを落とさない | 1 | PR #18 | PR #18 |
| `code/tsconfig-include-no-op` | コード品質 | tsconfig の include が実際には対象を拾っていない | 1 | PR #18 | PR #18 |
| `code/state-reset-not-recovered` | コード品質 | 状態を防御的にリセットしたが、復帰の経路が無く値が戻らない | 1 | PR #19 | PR #19 |
| `code/effect-timing-mismatch` | コード品質 | effect の実行時期がコメントの主張と食い違う | 1 | PR #19 | PR #19 |
| `code/fix-lacks-regression-test` | コード品質 | 指摘を受けた修正に、それを守る回帰テストが無い | 1 | PR #19 | PR #19 |
| `code/check-false-negative-on-empty-output` | コード品質 | 生成物が空ファイルのとき突き合わせが偽陰性を出す | 1 | PR #20 | PR #20 |
| `inspection/rule-coverage-partial` | 検査 | 判定対象の列挙に穴があり、基準を割った組み合わせを見逃す | 2 | PR #20 | PR #21 |
| `inspection/invalid-case-untested` | 検査 | 検査そのものに invalid ケースのテストが無い | 1 | PR #20 | PR #20 |
| `inspection/checked-artifact-not-in-build` | 検査 | 検査した生成物がビルド出力へ入っておらず、緑が実物を保証しない | 1 | PR #20 | PR #20 |
| `code/test-misses-core-path` | コード品質 | 中核の変換経路がテストで固定されていない | 1 | PR #20 | PR #20 |
| `code/dead-check-entry` | コード品質 | より強い条件に覆われ、単独では決して落ちない検査項目がある | 2 | PR #20 | PR #23 |
| `code/test-duplicates-prior-assertion` | コード品質 | 追加したテストが直前のテストと完全に重複し、検出力を持たない | 1 | PR #20 | PR #20 |
| `writing/do-dont-asymmetry` | 日本語 | 北極星の比喩の暴走を止める Don't が無い | 1 | PR #21 | PR #21 |
| `code/redundant-type-only-devdependency` | コード品質 | 型を同梱するパッケージに、別系統の型パッケージを重ねて入れた | 1 | PR #23 | PR #23 |
| `writing/test-title-ambiguous` | 日本語 | テストタイトルが、そのテストの固定する不変条件を示していない | 1 | PR #23 | PR #23 |

## レビュー履歴

| PR | 日付 | blocker | should | consider | レビュー |
|---|---|---|---|---|---|
| #23 | 2026-09-08 | 0 | 4 | 3 | [pr-23.md](./reviews/pr-23.md) |
| #21 | 2026-09-08 | 0 | 10 | 1 | [pr-21.md](./reviews/pr-21.md) |
| #20 | 2026-09-08 | 1 | 12 | 8 | [pr-20.md](./reviews/pr-20.md) |
| #19 | 2026-09-07 | 1 | 15 | 7 | [pr-19.md](./reviews/pr-19.md) |
| #18 | 2026-09-07 | 0 | 9 | 9 | [pr-18.md](./reviews/pr-18.md) |
| #17 | 2026-09-06 | 0 | 18 | 10 | [pr-17.md](./reviews/pr-17.md) |
| #13 | 2026-09-06 | 1 | 8 | 6 | [pr-13.md](./reviews/pr-13.md) |
