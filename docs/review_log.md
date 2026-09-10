# 指摘ログ

レビューで指摘されたカテゴリと、その通算回数。

累計が3回以上になったカテゴリは、`design/rules.json` へのルール化候補として扱う。
何度も人が見つけているなら、機械に見つけさせた方がよい。
ルール化するかどうかの判断は人が行う。このファイルは候補を示すところまで。

**数え方**: 1つのカテゴリは、1つの PR につき1回だけ数える。同じ PR の中で同じカテゴリの
違反箇所が5つ見つかっても +1。数えているのは「違反の数」ではなく
「そのカテゴリが問題として浮上した回数」だから。箇所の数で数えると、
1回のレビューで閾値に到達してしまい、ルール化の判断材料にならない。

最終更新: 2026-09-10（PR #39 3周目、収束）

## ルール化候補（累計3回以上）

いずれもドキュメント・運用の問題で、`design/rules.json`（スライド生成物の検査）へそのまま載る性質ではない。
機械化するならリポジトリ側の検査になる。判断は人が行う。

| カテゴリID | 要約 | 累計 | 最終指摘 | 状態 |
|---|---|---|---|---|
| `writing/ambiguous-criterion` | 判断基準が曖昧で、契約として実行できない | 7 | PR #26 | 未着手 |
| `writing/term-inconsistency` | 同じものが複数の呼び名を持ち、外延も揺れる | 10 | PR #39 | 未着手 |
| `writing/notation-inconsistency` | 表記の不統一（DR 参照がリンクになっていない等） | 6 | PR #26 | 未着手 |
| `phase/out-of-scope-addition` | フェーズのスコープ外、または DR に接続しないものが混入した | 6 | PR #30 | 未着手 |
| `decisions/undocumented-decision` | DR に無い判断が、PR説明やIssueにだけ書かれている | 9 | PR #28 | 未着手 |
| `decisions/dr-restates-canonical-value` | DR が正本の値を本文に書き写した | 4 | PR #21 | 未着手 |
| `contract/source-of-truth-ambiguous` | 「正本」がどのファイルを指すか一意でない | 3 | PR #19 | 未着手 |
| `inspection/rule-has-bypass` | 検査ルールに抜け道があり、書き方を変えると素通りする | 12 | PR #39 | 未着手 |
| `inspection/rule-scope-inconsistent` | 同じルールIDの守備範囲が文書間で食い違う | 3 | PR #20 | 未着手 |
| `decisions/consequence-not-followed` | 既存 DR の帰結が、それを通る手順に反映されていない | 5 | PR #31 | 未着手 |
| `contract/contract-structure-duplicated` | 正本の中身の一覧が、別の文書へ構造ごと複製された | 6 | PR #27 | 未着手 |
| `contract/value-outside-source-of-truth` | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 4 | PR #30 | 未着手 |
| `contract/design-data-duplicated` | デザインの値が正本以外へ複製された | 7 | PR #31 | 未着手 |
| `writing/inaccurate-rationale` | 説明文が書いている理由付けが、実装の挙動と食い違う | 6 | PR #39 | 未着手 |
| `inspection/rule-coverage-partial` | 判定対象の列挙に穴があり、基準を割った組み合わせを見逃す | 5 | PR #28 | 未着手 |
| `phase/completion-criterion-not-verified-e2e` | Issue の完了条件が、単体テストのみで統合パスを通さず検証されている | 4 | PR #30 | 未着手 |
| `writing/contradictory-instruction` | 同じ状況に対する指示が文書間で食い違う | 3 | PR #28 | 未着手 |
| `writing/dangling-quote-reference` | 文書内の引用符付き参照が、書き換え後のどの語句・項目にも対応しなくなった | 4 | PR #39 | 未着手 |

## 全カテゴリ

| カテゴリID | 観点 | 要約 | 累計 | 初出 | 最終指摘 |
|---|---|---|---|---|---|
| `contract/design-data-duplicated` | 設計契約 | デザインの値が正本以外へ複製された | 7 | PR #13 | PR #31 |
| `contract/value-outside-source-of-truth` | 設計契約 | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 4 | PR #13 | PR #30 |
| `contract/source-of-truth-ambiguous` | 設計契約 | 「正本」がどのファイルを指すか一意でない | 3 | PR #13 | PR #19 |
| `contract/contract-structure-duplicated` | 設計契約 | 正本の中身の一覧が、別の文書へ構造ごと複製された | 6 | PR #13 | PR #27 |
| `inspection/rule-scope-inconsistent` | 検査 | 同じルールIDの守備範囲が文書間で食い違う | 3 | PR #13 | PR #20 |
| `inspection/rule-id-mapping-incomplete` | 検査 | ルールIDと実装の対応検査が一部の系統しか覆っていない | 2 | PR #13 | PR #25 |
| `inspection/measure-state-unspecified` | 検査 | measure がどの表示状態で測るか規定されていない | 2 | PR #13 | PR #19 |
| `inspection/measure-viewport-unspecified` | 検査 | measure の測定条件が未規定で結果が再現しない | 1 | PR #13 | PR #13 |
| `code/gitignore-hides-tracked-artifacts` | コード品質 | .gitignore が、追跡する方針の成果物を無言で除外する | 1 | PR #13 | PR #13 |
| `writing/ambiguous-criterion` | 日本語 | 判断基準が曖昧で、契約として実行できない | 7 | PR #13 | PR #26 |
| `writing/term-inconsistency` | 日本語 | 同じものが複数の呼び名を持ち、外延も揺れる | 10 | PR #13 | PR #39 |
| `writing/notation-inconsistency` | 日本語 | 表記の不統一 | 6 | PR #13 | PR #26 |
| `phase/out-of-scope-addition` | フェーズ | フェーズのスコープ外、または DR に接続しないものが混入した | 6 | PR #13 | PR #30 |
| `decisions/undocumented-decision` | 決定記録 | DR に無い判断が、PR説明やIssueにだけ書かれている | 9 | PR #13 | PR #28 |
| `contract/workflow-constant-duplicated` | 設計契約 | 他スキルが持つ取り決め（パス・上限値）が書き写された | 2 | PR #17 | PR #18 |
| `code/review-loop-double-counts-log` | コード品質 | 同一 PR の再レビューが指摘ログを二重に計上する | 1 | PR #17 | PR #17 |
| `code/review-artifact-handling-undefined` | コード品質 | レビュー成果物をコミットするかどうかが未定義 | 1 | PR #17 | PR #17 |
| `code/undefined-command-input` | コード品質 | 手順のコマンドが要求する入力の用意が未定義 | 1 | PR #17 | PR #17 |
| `writing/contradictory-instruction` | 日本語 | 同じ状況に対する指示が文書間で食い違う | 3 | PR #17 | PR #28 |
| `decisions/dr-recording-bypass` | 決定記録 | DR の代わりに PR 本文へ書くことを手順が公認している | 1 | PR #17 | PR #17 |
| `decisions/consequence-not-followed` | 決定記録 | 既存 DR の帰結が、それを通る手順に反映されていない | 5 | PR #17 | PR #31 |
| `decisions/dr-restates-canonical-value` | 決定記録 | DR が正本の値を本文に書き写した | 4 | PR #17 | PR #21 |
| `decisions/index-section-mismatch` | 決定記録 | DR の索引登録が、内容と合わない節に置かれた | 2 | PR #17 | PR #19 |
| `code/rereview-overwrites-prior-review` | コード品質 | 再レビューが前周のレビュー記録を上書きする | 1 | PR #17 | PR #17 |
| `code/review-history-row-update-undefined` | コード品質 | レビュー履歴の行の更新方法が書式定義と食い違う | 1 | PR #17 | PR #17 |
| `code/check-skips-workspace-packages` | コード品質 | `pnpm check` が workspace パッケージを型検査もテストもしない | 1 | PR #18 | PR #18 |
| `inspection/lint-warning-not-failing` | 検査 | lint の warn がゲートを落とさない | 1 | PR #18 | PR #18 |
| `code/tsconfig-include-no-op` | コード品質 | tsconfig の include が実際には対象を拾っていない | 1 | PR #18 | PR #18 |
| `code/state-reset-not-recovered` | コード品質 | 状態を防御的にリセットしたが、復帰の経路が無く値が戻らない | 1 | PR #19 | PR #19 |
| `code/effect-timing-mismatch` | コード品質 | effect の実行時期がコメントの主張と食い違う | 1 | PR #19 | PR #19 |
| `code/fix-lacks-regression-test` | コード品質 | 指摘を受けた修正に、それを守る回帰テストが無い | 2 | PR #19 | PR #24 |
| `code/check-false-negative-on-empty-output` | コード品質 | 生成物が空ファイルのとき突き合わせが偽陰性を出す | 1 | PR #20 | PR #20 |
| `inspection/rule-coverage-partial` | 検査 | 判定対象の列挙に穴があり、基準を割った組み合わせを見逃す | 5 | PR #20 | PR #28 |
| `inspection/invalid-case-untested` | 検査 | 検査そのものに invalid ケースのテストが無い | 1 | PR #20 | PR #20 |
| `inspection/checked-artifact-not-in-build` | 検査 | 検査した生成物がビルド出力へ入っておらず、緑が実物を保証しない | 1 | PR #20 | PR #20 |
| `code/test-misses-core-path` | コード品質 | 中核の変換経路がテストで固定されていない | 1 | PR #20 | PR #20 |
| `code/dead-check-entry` | コード品質 | より強い条件に覆われ、単独では決して落ちない検査項目がある | 2 | PR #20 | PR #23 |
| `writing/do-dont-asymmetry` | 日本語 | 北極星の比喩の暴走を止める Don't が無い | 1 | PR #21 | PR #21 |
| `code/redundant-type-only-devdependency` | コード品質 | 型を同梱するパッケージに、別系統の型パッケージを重ねて入れた | 1 | PR #23 | PR #23 |
| `writing/test-title-ambiguous` | 日本語 | テストタイトルが、そのテストの固定する不変条件を示していない | 2 | PR #23 | PR #28 |
| `code/sibling-field-test-gap` | コード品質 | 同じ制約を個別に持つ複数フィールドのうち、一部にしか回帰テストが無い | 2 | PR #23 | PR #26 |
| `inspection/rule-has-bypass` | 検査 | 検査ルールに抜け道があり、書き方を変えると素通りする | 12 | PR #13 | PR #39 |
| `decisions/wrong-dr-citation` | 決定記録 | 誤った DR 番号を根拠として引用している | 1 | PR #24 | PR #24 |
| `decisions/implementation-labeled-as-canonical` | 決定記録 | DR が実装コードを「正本」として指定している | 1 | PR #24 | PR #24 |
| `code/test-duplicates-prior-assertion` | コード品質 | 追加したテストが直前のテストと完全に重複し、検出力を持たない | 2 | PR #20 | PR #24 |
| `writing/inaccurate-rationale` | 日本語 | 説明文が書いている理由付けが、実装の挙動と食い違う | 6 | PR #23 | PR #39 |
| `code/shadow-detection-misses-class-expression` | コード品質 | シャドーイング検出が class 式の代入パターンを見逃す | 1 | PR #24 | PR #24 |
| `code/duplicate-hex-parsing-in-contrast-ratio` | コード品質 | 同じ変換ロジックが複数箇所に重複し、片方だけ直すと同期が崩れる | 1 | PR #25 | PR #25 |
| `phase/completion-criterion-not-verified-e2e` | フェーズ | Issue の完了条件が、単体テストのみで統合パスを通さず検証されている | 4 | PR #25 | PR #30 |
| `code/manifest-shape-not-validated` | コード品質 | manifest のフィールドが期待する型（配列等）であることを検証しておらず、誤った形を渡すと無関係なエラーになる | 1 | PR #26 | PR #26 |
| `code/duplicate-resolve-readjson-helpers` | コード品質 | 同じ resolve/readJson ヘルパーが複数の scripts/*.mjs へ複製されている | 1 | PR #26 | PR #26 |
| `code/generated-artifact-not-gitignored` | コード品質 | 新設した生成物が .gitignore に無く、実行のたびに untracked ファイルが残る | 1 | PR #26 | PR #26 |
| `code/binary-extension-check-case-sensitive` | コード品質 | 拡張子の大文字小文字を無視した判定が、大文字拡張子の入力を取りこぼす | 1 | PR #28 | PR #28 |
| `code/duplicate-binary-extensions-list` | コード品質 | 同じ拡張子一覧が複数の scripts/*.mjs へ複製されている | 1 | PR #28 | PR #28 |
| `code/measure-failure-swallowed` | コード品質 | 検査サブプロセスの失敗を握り潰し、無関係なエラーで落ちる | 1 | PR #27 | PR #27 |
| `decisions/context-broader-than-decision` | 決定記録 | DR の「文脈」が示す範囲より「決定」「帰結」が無言で狭い | 1 | PR #27 | PR #27 |
| `code/audit-test-env-username-coupling` | コード品質 | テストが実行環境のOSユーザー名に依存し、環境次第で無関係な理由で失敗しうる | 1 | PR #28 | PR #28 |
| `decisions/citation-overclaims-source-scope` | 決定記録 | 正本として引用した資料の、実際の記述範囲より広い主張をしている | 2 | PR #28 | PR #39 |
| `writing/subjectless-predicate` | 日本語 | 文の主語が省略され、何の話かが読み取りにくい | 2 | PR #28 | PR #39 |
| `decisions/citation-points-to-wrong-file` | 決定記録 | 正本として引用したファイルが、実際にはその内容を記述していない | 1 | PR #28 | PR #28 |
| `writing/dangling-quote-reference` | 日本語 | 文書内の引用符付き参照が、書き換え後のどの語句・項目にも対応しなくなった | 4 | PR #26 | PR #39 |
| `code/ci-workflow-missing-permissions` | コード品質 | CI ワークフローに GITHUB_TOKEN の権限制限が明示されていない | 1 | PR #30 | PR #30 |
| `code/ci-actions-pinned-by-tag` | コード品質 | 外部 Actions がコミット SHA ではなくタグで固定されている | 1 | PR #30 | PR #30 |
| `inspection/ci-check-cancelled-on-push` | 検査 | push トリガーの concurrency が ref 単位で、先行 commit の check が完了前に cancel されうる | 1 | PR #30 | PR #30 |
| `code/parse-error-crashes-validator` | コード品質 | 検査対象の構文エラーを例外として投げっぱなしにし、他の検査を止める | 1 | PR #39 | PR #39 |
| `code/parse-error-message-lacks-source-path` | コード品質 | 構文エラーのメッセージが実ファイルパスの代わりに内部プレースホルダを含む | 1 | PR #39 | PR #39 |
| `code/non-targeting-pseudo-has-untested` | コード品質 | 意味論を書き分けた疑似クラスの一部だけ、対応する回帰テストが無い | 1 | PR #39 | PR #39 |

## レビュー履歴

| PR | 日付 | blocker | should | consider | レビュー |
|---|---|---|---|---|---|
| #39 | 2026-09-10 | 0 | 3 | 7 | [pr-39.md](./reviews/pr-39.md) |
| #31 | 2026-09-10 | 0 | 3 | 1 | [pr-31.md](./reviews/pr-31.md) |
| #30 | 2026-09-10 | 0 | 2 | 4 | [pr-30.md](./reviews/pr-30.md) |
| #28 | 2026-09-10 | 0 | 17 | 4 | [pr-28.md](./reviews/pr-28.md) |
| #27 | 2026-09-09 | 0 | 10 | 0 | [pr-27.md](./reviews/pr-27.md) |
| #26 | 2026-09-09 | 0 | 16 | 5 | [pr-26.md](./reviews/pr-26.md) |
| #25 | 2026-09-09 | 2 | 2 | 3 | [pr-25.md](./reviews/pr-25.md) |
| #24 | 2026-09-09 | 2 | 11 | 5 | [pr-24.md](./reviews/pr-24.md) |
| #23 | 2026-09-08 | 0 | 6 | 4 | [pr-23.md](./reviews/pr-23.md) |
| #21 | 2026-09-08 | 0 | 10 | 1 | [pr-21.md](./reviews/pr-21.md) |
| #20 | 2026-09-08 | 1 | 12 | 8 | [pr-20.md](./reviews/pr-20.md) |
| #19 | 2026-09-07 | 1 | 15 | 7 | [pr-19.md](./reviews/pr-19.md) |
| #18 | 2026-09-07 | 0 | 9 | 9 | [pr-18.md](./reviews/pr-18.md) |
| #17 | 2026-09-06 | 0 | 18 | 10 | [pr-17.md](./reviews/pr-17.md) |
| #13 | 2026-09-06 | 1 | 8 | 6 | [pr-13.md](./reviews/pr-13.md) |
