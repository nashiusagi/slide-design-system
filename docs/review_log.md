# 指摘ログ

レビューで指摘されたカテゴリと、その通算回数。

累計が3回以上になったカテゴリは、`design/rules.json` へのルール化候補として扱う。
何度も人が見つけているなら、機械に見つけさせた方がよい。
ルール化するかどうかの判断は人が行う。このファイルは候補を示すところまで。

**数え方**: 1つのカテゴリは、1つの PR につき1回だけ数える。同じ PR の中で同じカテゴリの
違反箇所が5つ見つかっても +1。数えているのは「違反の数」ではなく
「そのカテゴリが問題として浮上した回数」だから。箇所の数で数えると、
1回のレビューで閾値に到達してしまい、ルール化の判断材料にならない。

最終更新: 2026-09-24（PR #66 レビュー 3周目）

## ルール化候補（累計3回以上）

いずれもドキュメント・運用の問題で、`design/rules.json`（スライド生成物の検査）へそのまま載る性質ではない。
機械化するならリポジトリ側の検査になる。判断は人が行う。

| カテゴリID | 要約 | 累計 | 最終指摘 | 状態 |
|---|---|---|---|---|
| `writing/ambiguous-criterion` | 判断基準が曖昧で、契約として実行できない | 12 | PR #66 | 未着手 |
| `writing/term-inconsistency` | 同じものが複数の呼び名を持ち、外延も揺れる | 17 | PR #66 | 未着手 |
| `writing/notation-inconsistency` | 表記の不統一（DR 参照がリンクになっていない等） | 9 | PR #66 | 未着手 |
| `phase/out-of-scope-addition` | フェーズのスコープ外、または DR に接続しないものが混入した | 8 | PR #57 | 未着手 |
| `decisions/undocumented-decision` | DR に無い判断が、PR説明やIssueにだけ書かれている | 17 | PR #66 | 未着手 |
| `decisions/dr-restates-canonical-value` | DR が正本の値を本文に書き写した | 12 | PR #61 | 未着手 |
| `contract/source-of-truth-ambiguous` | 「正本」がどのファイルを指すか一意でない | 10 | PR #66 | 未着手 |
| `inspection/rule-id-mapping-incomplete` | ルールIDと実装の対応検査が一部の method しか覆っていない | 3 | PR #57 | 未着手 |
| `code/fix-lacks-regression-test` | 指摘を受けた修正に、それを守る回帰テストが無い | 4 | PR #61 | 未着手 |
| `inspection/bundle-boundary-unchecked` | 分離すると決めたビルドエントリ間の参照境界を保証する検査が無い | 3 | PR #57 | 未着手 |
| `inspection/rule-has-bypass` | 検査ルールに抜け道があり、書き方を変えると素通りする | 20 | PR #66 | 仕組み化済み（[DR-0044](./decisions/0044-bypass-fixtures-required.md) / #43） |
| `inspection/rule-scope-inconsistent` | 同じルールIDの守備範囲が文書間で食い違う | 6 | PR #55 | 仕組み化済み（[DR-0044](./decisions/0044-bypass-fixtures-required.md) / #43）。守備範囲の宣言を `design/rules.json` に一本化した |
| `decisions/consequence-not-followed` | 既存 DR の帰結が、それを通る手順に反映されていない | 13 | PR #66 | 見送り（意味の問題で機械判定に向かない。レビューの観点が持つ。[DR-0054](./decisions/0054-decision-reference-checked-by-machine.md)） |
| `contract/contract-structure-duplicated` | 正本の中身の一覧が、別の文書へ構造ごと複製された | 9 | PR #66 | 未着手 |
| `contract/value-outside-source-of-truth` | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 6 | PR #66 | 未着手 |
| `contract/design-data-duplicated` | デザインの値が正本以外へ複製された | 13 | PR #56 | 未着手 |
| `writing/inaccurate-rationale` | 説明文が書いている理由付けが、実装の挙動と食い違う | 19 | PR #66 | 未着手 |
| `inspection/invalid-case-untested` | 検査そのものに invalid ケースのテストが無い | 6 | PR #61 | 未着手 |
| `code/test-cannot-detect-regression` | テストが、その名前が示す回帰をフィクスチャの都合で検出できない | 5 | PR #66 | 未着手 |
| `inspection/rule-coverage-partial` | 判定対象の列挙に穴があり、基準を割った組み合わせを見逃す | 12 | PR #66 | 一部（[DR-0044](./decisions/0044-bypass-fixtures-required.md) / #43）。`enumeration-tail` の軸で事例を要求するが、網羅性の証明ではない |
| `phase/completion-criterion-not-verified-e2e` | Issue の完了条件が、単体テストのみで統合パスを通さず検証されている | 10 | PR #66 | 未着手 |
| `writing/contradictory-instruction` | 同じ状況に対する指示が文書間で食い違う | 11 | PR #66 | 未着手 |
| `writing/dangling-quote-reference` | 文書内の引用符付き参照が、書き換え後のどの語句・項目にも対応しなくなった | 8 | PR #58 | 未着手 |
| `writing/test-title-ambiguous` | テストタイトルが、そのテストの固定する不変条件を示していない | 10 | PR #66 | 未着手 |
| `code/dead-check-entry` | より強い条件に覆われ、単独では決して落ちない検査項目がある | 3 | PR #47 | 未着手 |
| `contract/workflow-constant-duplicated` | 他が持つ取り決め（パス・上限値）が書き写された | 4 | PR #56 | 未着手 |
| `decisions/citation-overclaims-source-scope` | 引用した DR・資料の実際の記述範囲より広い主張をしている | 7 | PR #58 | 未着手 |
| `writing/subjectless-predicate` | 文の主語が省略され、何の話かが読み取りにくい | 4 | PR #66 | 未着手 |
| `writing/incomplete-pr-description` | PR 本文が着手時のままで、完成度と残りが読み取れない | 8 | PR #66 | 未着手 |
| `decisions/wrong-dr-citation` | 誤った DR 番号・決定番号を根拠として引用している | 6 | PR #66 | 一部（`decisions:check` が番号の実在とリンクの一致を見る。決定番号の誤りは人が読む。[DR-0054](./decisions/0054-decision-reference-checked-by-machine.md)） |
| `decisions/one-sided-coupling` | 連動する2箇所のうち片方にしか結線が書かれておらず、逆向きに辿れない | 6 | PR #58 | 見送り（一方向の依存は正常な形。落とすべきは置き換えの関係だけで、状態欄の規則が扱う。[DR-0054](./decisions/0054-decision-reference-checked-by-machine.md)） |
| `decisions/citation-points-to-wrong-file` | 正本・検査として引用したファイル・節が、実際にはその内容を持たない | 4 | PR #58 | 一部（`decisions:check` がリンク先の実在と番号の一致を見る。引用先の節がその内容を持つかは人が読む。[DR-0054](./decisions/0054-decision-reference-checked-by-machine.md)） |
| `decisions/implementation-labeled-as-canonical` | DR が実装コードを「正本」として指定している | 3 | PR #61 | 一部（`decisions:check` が冒頭欄の拡張子を見る。本文中の「正本」表現とディレクトリ指定は人が読む。[DR-0054](./decisions/0054-decision-reference-checked-by-machine.md)） |
| `code/duplicate-resolve-readjson-helpers` | 同じ resolve/readJson ヘルパーが複数の scripts/*.mjs へ複製されている | 3 | PR #61 | 未着手 |
| `decisions/index-section-mismatch` | DR の索引登録が、内容と合わない節に置かれた | 4 | PR #61 | 一部（`decisions:check` が網羅と昇順を見る。節の分類が内容と合うかは人が読む。[DR-0054](./decisions/0054-decision-reference-checked-by-machine.md)） |
| `code/sibling-field-test-gap` | 同じ制約を個別に持つ複数対象のうち、一部にしか回帰テストが無い | 4 | PR #66 | 未着手 |
| `code/test-duplicates-prior-assertion` | 追加したテストが既存ケースと同じ経路しか通らず、検出力を持たない | 4 | PR #57 | 未着手 |
| `code/test-misses-core-path` | 実装が分岐を持つのに、テストが片側しか踏まない | 4 | PR #66 | 未着手 |
| `decisions/cited-tally-not-reproducible` | 根拠として挙げた集計の数え方が一意に読めない | 3 | PR #66 | 未着手 |

## 全カテゴリ

| カテゴリID | 観点 | 要約 | 累計 | 初出 | 最終指摘 |
|---|---|---|---|---|---|
| `contract/design-data-duplicated` | 設計契約 | デザインの値が正本以外へ複製された | 13 | PR #13 | PR #56 |
| `contract/value-outside-source-of-truth` | 設計契約 | 正本に置くと決めた値が、正本を参照できない場所にも必要になる | 6 | PR #13 | PR #66 |
| `contract/source-of-truth-ambiguous` | 設計契約 | 「正本」がどのファイルを指すか一意でない | 10 | PR #13 | PR #66 |
| `contract/contract-structure-duplicated` | 設計契約 | 正本の中身の一覧が、別の文書へ構造ごと複製された | 9 | PR #13 | PR #66 |
| `inspection/rule-scope-inconsistent` | 検査 | 同じルールIDの守備範囲が文書間で食い違う | 6 | PR #13 | PR #55 |
| `inspection/rule-id-mapping-incomplete` | 検査 | ルールIDと実装の対応検査が一部の系統しか覆っていない | 3 | PR #13 | PR #57 |
| `inspection/measure-state-unspecified` | 検査 | measure がどの表示状態で測るか規定されていない | 2 | PR #13 | PR #19 |
| `inspection/measure-viewport-unspecified` | 検査 | measure の測定条件が未規定で結果が再現しない | 1 | PR #13 | PR #13 |
| `code/gitignore-hides-tracked-artifacts` | コード品質 | .gitignore が、追跡する方針の成果物を無言で除外する | 1 | PR #13 | PR #13 |
| `writing/ambiguous-criterion` | 日本語 | 判断基準が曖昧で、契約として実行できない | 12 | PR #13 | PR #66 |
| `writing/term-inconsistency` | 日本語 | 同じものが複数の呼び名を持ち、外延も揺れる | 17 | PR #13 | PR #66 |
| `writing/notation-inconsistency` | 日本語 | 表記の不統一 | 9 | PR #13 | PR #66 |
| `phase/out-of-scope-addition` | フェーズ | フェーズのスコープ外、または DR に接続しないものが混入した | 8 | PR #13 | PR #57 |
| `decisions/undocumented-decision` | 決定記録 | DR に無い判断が、PR説明やIssueにだけ書かれている | 17 | PR #13 | PR #66 |
| `contract/workflow-constant-duplicated` | 設計契約 | 他スキルが持つ取り決め（パス・上限値）が書き写された | 4 | PR #17 | PR #56 |
| `code/review-loop-double-counts-log` | コード品質 | 同一 PR の再レビューが指摘ログを二重に計上する | 1 | PR #17 | PR #17 |
| `code/review-artifact-handling-undefined` | コード品質 | レビュー成果物をコミットするかどうかが未定義 | 1 | PR #17 | PR #17 |
| `code/undefined-command-input` | コード品質 | 手順のコマンドが要求する入力の用意が未定義 | 1 | PR #17 | PR #17 |
| `writing/contradictory-instruction` | 日本語 | 同じ状況に対する指示が文書間で食い違う | 11 | PR #17 | PR #66 |
| `decisions/dr-recording-bypass` | 決定記録 | DR の代わりに PR 本文へ書くことを手順が公認している | 1 | PR #17 | PR #17 |
| `decisions/consequence-not-followed` | 決定記録 | 既存 DR の帰結が、それを通る手順に反映されていない | 13 | PR #17 | PR #66 |
| `decisions/dr-restates-canonical-value` | 決定記録 | DR が正本の値を本文に書き写した | 12 | PR #17 | PR #61 |
| `decisions/index-section-mismatch` | 決定記録 | DR の索引登録が、内容と合わない節に置かれた | 4 | PR #17 | PR #61 |
| `code/rereview-overwrites-prior-review` | コード品質 | 再レビューが前周のレビュー記録を上書きする | 1 | PR #17 | PR #17 |
| `code/review-history-row-update-undefined` | コード品質 | レビュー履歴の行の更新方法が書式定義と食い違う | 1 | PR #17 | PR #17 |
| `code/check-skips-workspace-packages` | コード品質 | `pnpm check` が workspace パッケージを型検査もテストもしない | 1 | PR #18 | PR #18 |
| `inspection/lint-warning-not-failing` | 検査 | lint の warn がゲートを落とさない | 1 | PR #18 | PR #18 |
| `code/tsconfig-include-no-op` | コード品質 | tsconfig の include が実際には対象を拾っていない | 1 | PR #18 | PR #18 |
| `code/state-reset-not-recovered` | コード品質 | 状態を防御的にリセットしたが、復帰の経路が無く値が戻らない | 1 | PR #19 | PR #19 |
| `code/effect-timing-mismatch` | コード品質 | effect の実行時期がコメントの主張と食い違う | 1 | PR #19 | PR #19 |
| `code/fix-lacks-regression-test` | コード品質 | 指摘を受けた修正に、それを守る回帰テストが無い | 4 | PR #19 | PR #61 |
| `code/check-false-negative-on-empty-output` | コード品質 | 生成物が空ファイルのとき突き合わせが偽陰性を出す | 1 | PR #20 | PR #20 |
| `inspection/rule-coverage-partial` | 検査 | 判定対象の列挙に穴があり、基準を割った組み合わせを見逃す | 12 | PR #20 | PR #66 |
| `inspection/invalid-case-untested` | 検査 | 検査そのものに invalid ケースのテストが無い | 6 | PR #20 | PR #61 |
| `inspection/checked-artifact-not-in-build` | 検査 | 検査した生成物がビルド出力へ入っておらず、緑が実物を保証しない | 2 | PR #20 | PR #56 |
| `code/test-misses-core-path` | コード品質 | 中核の変換経路がテストで固定されていない | 4 | PR #20 | PR #66 |
| `code/dead-check-entry` | コード品質 | より強い条件に覆われ、単独では決して落ちない検査項目がある | 3 | PR #20 | PR #47 |
| `writing/do-dont-asymmetry` | 日本語 | 北極星の比喩の暴走を止める Don't が無い | 1 | PR #21 | PR #21 |
| `code/redundant-type-only-devdependency` | コード品質 | 型を同梱するパッケージに、別系統の型パッケージを重ねて入れた | 1 | PR #23 | PR #23 |
| `writing/test-title-ambiguous` | 日本語 | テストタイトルが、そのテストの固定する不変条件を示していない | 10 | PR #23 | PR #66 |
| `code/sibling-field-test-gap` | コード品質 | 同じ制約を個別に持つ複数フィールドのうち、一部にしか回帰テストが無い | 4 | PR #23 | PR #66 |
| `inspection/rule-has-bypass` | 検査 | 検査ルールに抜け道があり、書き方を変えると素通りする | 20 | PR #13 | PR #66 |
| `decisions/wrong-dr-citation` | 決定記録 | 誤った DR 番号を根拠として引用している | 6 | PR #24 | PR #66 |
| `decisions/implementation-labeled-as-canonical` | 決定記録 | DR が実装コードを「正本」として指定している | 3 | PR #24 | PR #61 |
| `code/test-duplicates-prior-assertion` | コード品質 | 追加したテストが直前のテストと完全に重複し、検出力を持たない | 4 | PR #20 | PR #57 |
| `writing/inaccurate-rationale` | 日本語 | 説明文が書いている理由付けが、実装の挙動と食い違う | 19 | PR #23 | PR #66 |
| `code/shadow-detection-misses-class-expression` | コード品質 | シャドーイング検出が class 式の代入パターンを見逃す | 1 | PR #24 | PR #24 |
| `code/duplicate-hex-parsing-in-contrast-ratio` | コード品質 | 同じ変換ロジックが複数箇所に重複し、片方だけ直すと同期が崩れる | 1 | PR #25 | PR #25 |
| `phase/completion-criterion-not-verified-e2e` | フェーズ | Issue の完了条件が、単体テストのみで統合パスを通さず検証されている | 10 | PR #25 | PR #66 |
| `code/manifest-shape-not-validated` | コード品質 | manifest のフィールドが期待する型（配列等）であることを検証しておらず、誤った形を渡すと無関係なエラーになる | 1 | PR #26 | PR #26 |
| `code/duplicate-resolve-readjson-helpers` | コード品質 | 同じ resolve/readJson ヘルパーが複数の scripts/*.mjs へ複製されている | 3 | PR #26 | PR #61 |
| `code/generated-artifact-not-gitignored` | コード品質 | 新設した生成物が .gitignore に無く、実行のたびに untracked ファイルが残る | 1 | PR #26 | PR #26 |
| `code/binary-extension-check-case-sensitive` | コード品質 | 拡張子の大文字小文字を無視した判定が、大文字拡張子の入力を取りこぼす | 1 | PR #28 | PR #28 |
| `code/duplicate-binary-extensions-list` | コード品質 | 同じ拡張子一覧が複数の scripts/*.mjs へ複製されている | 1 | PR #28 | PR #28 |
| `code/measure-failure-swallowed` | コード品質 | 検査サブプロセスの失敗を握り潰し、無関係なエラーで落ちる | 1 | PR #27 | PR #27 |
| `decisions/context-broader-than-decision` | 決定記録 | DR の「文脈」が示す範囲より「決定」「帰結」が無言で狭い | 2 | PR #27 | PR #51 |
| `code/audit-test-env-username-coupling` | コード品質 | テストが実行環境のOSユーザー名に依存し、環境次第で無関係な理由で失敗しうる | 1 | PR #28 | PR #28 |
| `decisions/citation-overclaims-source-scope` | 決定記録 | 正本として引用した資料の、実際の記述範囲より広い主張をしている | 7 | PR #28 | PR #58 |
| `writing/subjectless-predicate` | 日本語 | 文の主語が省略され、何の話かが読み取りにくい | 4 | PR #28 | PR #66 |
| `decisions/citation-points-to-wrong-file` | 決定記録 | 正本として引用したファイル・節が、実際にはその内容を記述していない | 4 | PR #28 | PR #58 |
| `writing/dangling-quote-reference` | 日本語 | 文書内の引用符付き参照が、書き換え後のどの語句・項目にも対応しなくなった | 8 | PR #26 | PR #58 |
| `code/ci-workflow-missing-permissions` | コード品質 | CI ワークフローに GITHUB_TOKEN の権限制限が明示されていない | 1 | PR #30 | PR #30 |
| `code/ci-actions-pinned-by-tag` | コード品質 | 外部 Actions がコミット SHA ではなくタグで固定されている | 1 | PR #30 | PR #30 |
| `inspection/ci-check-cancelled-on-push` | 検査 | push トリガーの concurrency が ref 単位で、先行 commit の check が完了前に cancel されうる | 1 | PR #30 | PR #30 |
| `code/parse-error-crashes-validator` | コード品質 | 検査対象の構文エラーを例外として投げっぱなしにし、他の検査を止める | 1 | PR #39 | PR #39 |
| `phase/runtime-capability-foreclosed` | フェーズ | 実装の型が、そのフェーズで持つと決めたランタイム機能を使えなくする | 1 | PR #56 | PR #56 |
| `code/duplicate-css-class-check` | コード品質 | CSS のクラス対応検査が、既存の同種検査のほぼ逐語的な複製になっている | 1 | PR #56 | PR #56 |
| `code/list-key-collides-on-duplicate-items` | コード品質 | 一覧の key を値そのものにしており、同じ値が並ぶと衝突する | 1 | PR #56 | PR #56 |
| `contract/stale-contract-comment` | 設計契約 | 文書の記述が、実装・インタフェースの変更に追従せず古いまま残った | 2 | PR #56 | PR #60 |
| `contract/contract-constraint-unenforced` | 設計契約 | 契約が定めた制約（個数の上限等）を実装も検査も担保していない | 1 | PR #56 | PR #56 |
| `writing/misplaced-correction` | 日本語 | 文書内の訂正が、上書きする元の記述から離れた場所に置かれ、どちらも残る | 1 | PR #56 | PR #56 |
| `code/parse-error-message-lacks-source-path` | コード品質 | 構文エラーのメッセージが実ファイルパスの代わりに内部プレースホルダを含む | 1 | PR #39 | PR #39 |
| `code/non-targeting-pseudo-has-untested` | コード品質 | 意味論を書き分けた疑似クラスの一部だけ、対応する回帰テストが無い | 1 | PR #39 | PR #39 |
| `inspection/bundle-boundary-unchecked` | 検査 | 分離すると決めたビルドエントリ間の参照境界を保証する検査が無い | 3 | PR #40 | PR #57 |
| `code/unreachable-defensive-branch` | コード品質 | 到達しない防御分岐と、型の事実と食い違う根拠コメントが残る | 2 | PR #40 | PR #57 |
| `code/unvalidated-id-format` | コード品質 | 識別子が許容書式に収まることを型でもテストでも保証していない | 1 | PR #40 | PR #40 |
| `writing/ungrammatical-sentence` | 日本語 | 述語が欠けた文があり、意味が確定しない | 2 | PR #40 | PR #55 |
| `writing/incomplete-pr-description` | 日本語 | PR 本文が着手時のままで、完成度と残りが読み取れない | 8 | PR #40 | PR #66 |
| `code/test-cannot-detect-regression` | コード品質 | テストが、その名前が示す回帰をフィクスチャの都合で検出できない | 5 | PR #40 | PR #66 |
| `code/duplicate-test-case` | コード品質 | 追加したテストが既存ケースと同一のアサーションになっている | 1 | PR #40 | PR #40 |
| `decisions/citation-incomplete-after-rewrite` | 決定記録 | 本文を書き換えたが、冒頭の要約欄（実装・関連）が古いまま取り残された | 3 | PR #40 | PR #58 |
| `code/restricted-module-list-duplicated-across-mechanisms` | コード品質 | 同じ禁止対象を別々の記法で二重管理し、片方だけ更新されうる | 1 | PR #40 | PR #40 |
| `contract/schema-order-assumed-as-semantics` | 設計契約 | 正本が約束していないキーの宣言順に、意味（どちらが幅か等）を負わせた | 1 | PR #41 | PR #41 |
| `inspection/raw-css-include-gap` | 検査 | テストで空文字へ差し替えられる読み込みを検知せず、無検査のまま緑になる | 2 | PR #41 | PR #53 |
| `contract/allowlist-key-tracks-canonical-values` | 設計契約 | 例外リストの照合キーが、正本の値どうしの偶然の衝突に依存する | 2 | PR #52 | PR #55 |
| `contract/canonical-scope-not-derived` | 設計契約 | 正本から自動で導くと書いた範囲が、実際には名指しした一部に留まる | 1 | PR #52 | PR #52 |
| `inspection/allowlist-entry-overbroad` | 検査 | 例外1件が、同じ対象についての新しい違反を無制限に抑える | 1 | PR #52 | PR #52 |
| `inspection/false-positive-forces-allowlist` | 検査 | 誤検出が例外登録を招き、その例外がそのファイルの検査を丸ごと黙らせる | 1 | PR #52 | PR #52 |
| `code/pattern-matches-across-code-span-boundary` | コード品質 | 照合パターンがコードスパンの境界を跨いで一致する | 1 | PR #52 | PR #52 |
| `phase/scope-statement-weakened` | フェーズ | 重複を避ける書き換えで、フェーズ境界の宣言が自己言及になった | 1 | PR #52 | PR #52 |
| `decisions/cited-tally-not-reproducible` | 決定記録 | 根拠として挙げた集計の数え方が一意に読めない | 3 | PR #52 | PR #66 |
| `code/enumeration-line-pattern-too-broad` | コード品質 | 行の種類を判定するパターンが広すぎ、無関係な地の文を拾う | 1 | PR #52 | PR #52 |

| `inspection/bypass-case-trivially-satisfiable` | 検査 | 通ることを固定する事例に下限が無く、中身が空でも宣言を「埋めた」ことになる | 1 | PR #47 | PR #47 |
| `inspection/bypass-fixture-wrong-mechanism` | 検査 | 除外の事例が、宣言した理由とは別の理由で通っている | 1 | PR #47 | PR #47 |
| `inspection/fixture-skips-collection-stage` | 検査 | フィクスチャが評価段しか通らず、収集段の抜け道を原理的に扱えない | 1 | PR #47 | PR #47 |
| `contract/requirement-contradicts-review-method` | 設計契約 | 契約が全ルールに機械実行の事例を要求し、人が判断する method と衝突する | 1 | PR #47 | PR #47 |
| `code/unused-exported-helper` | コード品質 | export したヘルパーに使用箇所が無く、説明も実装と食い違う | 1 | PR #47 | PR #47 |
| `code/misleading-failure-message` | コード品質 | 失敗メッセージが実際の原因と別のこと（ファイルが無い）を述べる | 1 | PR #47 | PR #47 |
| `decisions/unsatisfiable-reexamination-criterion` | 決定記録 | 見送りの DR の再検討条件が、字義どおりには満たせない形で書かれている | 1 | PR #51 | PR #51 |
| `decisions/no-recheck-trigger` | 決定記録 | 再検討の条件はあるが、誰がいつ確かめるかの引き金が無い | 1 | PR #51 | PR #51 |
| `writing/unsourced-external-claim` | 日本語 | 外部ツールの現状についての主張に、確認したバージョンと参照先が無い | 1 | PR #51 | PR #51 |
| `decisions/one-sided-coupling` | 決定記録 | DR 間の連動が片方の DR にしか書かれておらず、逆向きに辿れない | 6 | PR #51 | PR #58 |
| `decisions/inconsistent-partition` | 決定記録 | 本文が立てた分類と、その直後の適用範囲が同じ段落内で噛み合わない | 2 | PR #51 | PR #58 |
| `code/test-expectation-contradicts-implementation` | コード品質 | テストの期待値が、実装のフォールバックと逆を書いている | 1 | PR #55 | PR #55 |
| `code/redundant-effect-dependency` | コード品質 | effect の依存が別の依存から一意に決まり、増やしても条件が変わらない | 1 | PR #55 | PR #55 |
| `code/duplicate-contract-loader` | コード品質 | 契約の読み込み関数が、種類ごとにほぼ逐語で複製されている | 1 | PR #55 | PR #55 |

| `contract/canonical-rationale-duplicated` | 設計契約 | 正本の `$comment` の説明が、それを読む実装のコメントへ逐語で複製された | 1 | PR #57 | PR #57 |
| `inspection/mapping-check-ignores-value-shape` | 検査 | 対応の検査が名前の一致しか見ず、引いた値が使える形かを見ていない | 1 | PR #57 | PR #57 |
| `code/dead-style-declaration` | コード品質 | 当たらないクラス名・基底と同値の宣言が CSS に残る | 1 | PR #57 | PR #57 |
| `decisions/citation-missing-governing-decision` | 決定記録 | 実装が従っている決定のうち、片方の決定番号しか引用していない | 1 | PR #57 | PR #57 |

| `inspection/exit-condition-mismatches-state` | 検査 | 抜け条件に当てはまる状態と、そこで出す書式が想定する状態が食い違う | 1 | PR #58 | PR #58 |
| `inspection/exit-decision-unverifiable` | 検査 | 抜け方の判定に使う入力が記録されず、第三者が再現できない | 1 | PR #58 | PR #58 |
| `contract/record-written-by-non-owning-skill` | 設計契約 | 記録ファイルへの書き込みを、その書式を持たない側の Skill が指示している | 1 | PR #58 | PR #58 |
| `decisions/decision-lacks-recorded-basis` | 決定記録 | 決定のひとつに、文脈・理由・却下案のどこにも根拠が無い | 2 | PR #58 | PR #61 |
| `contract/canonical-value-scattered-within-source` | 設計契約 | 正本と決めた節の中で、同じ値が複数の記述に散っている | 1 | PR #58 | PR #58 |
| `decisions/index-entry-out-of-order` | 決定記録 | 索引の行が、節の中の並び規則（番号の昇順）に従っていない | 1 | PR #58 | PR #58 |
| `inspection/retry-loop-unbounded-on-self-declared-failure` | 検査 | 自己申告の失敗でやり直せる回数に上限が無く、強制退出の条件へ到達しない | 1 | PR #58 | PR #58 |
| `contract/source-of-truth-claim-duplicated-in-document` | 設計契約 | 正本の所在を示す宣言が、同じ文書の2箇所に独立して書かれている | 1 | PR #58 | PR #58 |
| `inspection/convergence-ignores-review-coverage` | 検査 | 収束の判定が、その周に実際に結果を返した観点の網羅性を問わない | 1 | PR #58 | PR #58 |
| `code/template-example-omits-required-row` | コード品質 | 書式の例が、直前の指示が必須とする行を欠いている | 2 | PR #58 | PR #60 |
| `contract/convergence-criterion-crosses-undeclared-boundary` | 設計契約 | 判定条件が、その Skill が正式に受け取っていない他方の内部状態に依存している | 2 | PR #58 | PR #60 |
| `decisions/decision-section-scope-creep` | 決定記録 | 決定の見出しに現れない話題が、その決定の本文に積み上がっている | 1 | PR #58 | PR #58 |
| `code/duplicate-instruction-across-steps` | コード品質 | 同じ実行時の指示が複数の手順に重複し、片方だけが他 Skill の手順番号を名指ししている | 1 | PR #58 | PR #58 |
| `code/relative-link-wrong-depth` | コード品質 | 相対リンクの階層が合わず、実在しないパスを指している | 1 | PR #60 | PR #60 |
| `decisions/partial-supersession-not-in-status` | 決定記録 | 決定の一部が置き換わったのに、旧 DR の状態欄がそれを示していない | 1 | PR #60 | PR #60 |
| `contract/format-requirement-duplicated-outside-format-file` | 設計契約 | 書式の必須規定と理由が、書式の正本の外へ書き写された | 2 | PR #60 | PR #61 |
| `writing/scope-claim-mismatches-content` | 日本語 | 冒頭の範囲宣言が、その文書が実際に決めている内容より狭い | 2 | PR #60 | PR #61 |
| `code/branch-unreachable-from-sole-caller` | コード品質 | 唯一の呼び出し元の固定した振る舞いにより、条件分岐が評価されなくなった | 1 | PR #60 | PR #60 |
| `decisions/alternatives-cover-only-one-decision` | 決定記録 | 却下案が一部の決定しか覆わず、他の決定に代案の記録が無い | 1 | PR #60 | PR #60 |
| `code/unclosed-fence-swallows-trailing-prose` | コード品質 | コードフェンスが閉じておらず、以降の地の文をブロックへ呑み込む | 1 | PR #60 | PR #60 |
| `inspection/coverage-list-delimiter-ambiguous` | 検査 | 一覧の区切りが決まっておらず、要素が列の外へ逃げられる | 1 | PR #60 | PR #60 |
| `code/unclosed-fence-disables-remaining-checks` | コード品質 | 閉じていないコードフェンスにより、検査がファイルの残りを見なくなる | 1 | PR #61 | PR #61 |
| `contract/scan-scope-declarations-diverge` | 設計契約 | 走査場所の宣言が複数のスクリプトに独立して存在し、食い違っている | 1 | PR #61 | PR #61 |
| `writing/status-overclaims-coverage` | 日本語 | 状態欄の主張が、検査が実際に覆う範囲より広い | 1 | PR #61 | PR #61 |
| `writing/failure-message-lacks-resolved-path` | 日本語 | 失敗メッセージが、機械が解決した結果を捨てて生の入力だけを出す | 1 | PR #61 | PR #61 |
| `decisions/consequence-omits-decision` | 決定記録 | 決定のひとつに対応する帰結が無く、他の決定との書き分けが非対称 | 1 | PR #61 | PR #61 |
| `decisions/dr-contradicts-own-decision` | 決定記録 | DR の却下案・帰結が、同じ DR の決定と正面から矛盾する | 1 | PR #61 | PR #61 |
| `writing/attributed-rationale-not-at-source` | 日本語 | 「根拠は◯◯にある」と書いた先に、その根拠が無い | 1 | PR #61 | PR #61 |
| `phase/scope-rationale-contradicts-issue-text` | フェーズ | スコープ外と却下した根拠が、Issue 本文の記述と食い違う | 1 | PR #61 | PR #61 |
| `inspection/canonical-value-unmatchable` | 検査 | 正本の値そのものが、正規化処理で照合不能になる | 1 | PR #66 | PR #66 |
| `contract/recorded-value-not-what-was-passed` | 設計契約 | 記録する値を、記録時点で変化した対象から測り直している | 1 | PR #66 | PR #66 |
| `decisions/dr-missing-required-section` | 決定記録 | DR が README の定める節構成を満たしていない | 1 | PR #66 | PR #66 |
| `decisions/alternatives-cover-only-one-decision` | 決定記録 | 却下案が一部の決定しか覆っていない | 1 | PR #66 | PR #66 |
| `inspection/perspective-separator-splits-annotation` | 検査 | 区切り文字での分割が、注記の中の同じ文字でも割れて観点名が壊れる | 1 | PR #66 | PR #66 |
| `inspection/fallback-false-positive-on-dropped-headings` | 検査 | 退避の発動条件が広すぎ、正常な記述でも機能が丸ごと無効になる | 1 | PR #66 | PR #66 |
| `code/diagnostic-misattributes-cause` | コード品質 | 診断が、実際とは違う原因を報告し、本来の対象と見分けが付かなくなる | 1 | PR #66 | PR #66 |

## レビュー履歴

| PR | 日付 | blocker | should | consider | レビュー |
|---|---|---|---|---|---|
| #66 | 2026-09-24 | 3 | 20 | 8 | [pr-66.md](./reviews/pr-66.md) |
| #61 | 2026-09-24 | 8 | 26 | 11 | [pr-61.md](./reviews/pr-61.md) |
| #60 | 2026-09-23 | 1 | 16 | 3 | [pr-60.md](./reviews/pr-60.md) |
| #58 | 2026-09-22 | 5 | 31 | 11 | [pr-58.md](./reviews/pr-58.md) |
| #57 | 2026-09-21 | 0 | 15 | 12 | [pr-57.md](./reviews/pr-57.md) |
| #56 | 2026-09-21 | 2 | 14 | 14 | [pr-56.md](./reviews/pr-56.md) |
| #55 | 2026-09-21 | 0 | 13 | 12 | [pr-55.md](./reviews/pr-55.md) |
| #53 | 2026-09-21 | 0 | 12 | 7 | [pr-53.md](./reviews/pr-53.md) |
| #52 | 2026-09-20 | 0 | 23 | 15 | [pr-52.md](./reviews/pr-52.md) |
| #51 | 2026-09-12 | 1 | 15 | 7 | [pr-51.md](./reviews/pr-51.md) |
| #47 | 2026-09-12 | 2 | 12 | 8 | [pr-47.md](./reviews/pr-47.md) |
| #41 | 2026-09-11 | 1 | 7 | 1 | [pr-41.md](./reviews/pr-41.md) |
| #40 | 2026-09-11 | 0 | 10 | 8 | [pr-40.md](./reviews/pr-40.md) |
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
