# harness-intro 実験結果（第1弾）

Issue #12。お題は「この仕組み自体の紹介」（[DR-0015](../../docs/decisions/0015-first-experiment.md)）。baseline / harness / harness-corrected の3条件を実際に生成し、検査・採点した記録。

## 実行方法

各条件ともサブエージェントを手動で1回ずつ起動して生成した（[DR-0019](../../docs/decisions/0019-claude-only-runner.md)）。ワークスペースの用意・Run の保存・採点・比較は `scripts/prepare-workspace.mjs` / `scripts/evaluate-run.mjs` / `scripts/compare-runs.mjs` を使い、いずれも AI を起動しない（[DR-0020](../../docs/decisions/0020-scripts-do-not-invoke-ai.md)）。

- baseline: `runs/baseline-1`
- harness: `runs/harness-1`
- harness-corrected: `runs/harness-corrected-1`（`harness-1` の指摘をサブエージェントに機械検査の結果として渡し、修正させたもの。`correctedFrom: harness-1`）

## ルール別の結果

| rule | baseline | harness | harness-corrected |
| --- | --- | --- | --- |
| no-raw-color | pass | pass | pass |
| no-raw-scale | pass | pass | pass |
| layout-approved | fail (7) | pass | pass |
| component-approved | pass | fail (3) | pass |
| deck-conformance* | fail | pass | pass |
| no-overflow | pass | pass | pass |
| min-font-size | fail (75) | pass | pass |
| contrast | fail (58) | pass | pass |

\* `deck-conformance` は特定の deck 契約とのlint照合で、`scripts/evaluate-run.mjs` の汎用採点（`SCORED_LINT_RULE_IDS`）には含まれない（ルールオプションで対象 deck を指定する必要があるため）。ここでは `design/decks/harness-intro.md` を指定して個別に確認した値。baseline はそもそも deck 契約を渡されていないため、この行は「契約なしで生成すると当然一致しない」以上の意味を持たない。

`method: "review"` のルールは現時点で `design/rules.json` に存在しないため、該当する結果は無い。

## harness-corrected で fail が 0 になったか

なった。`harness-1` の `component-approved` 違反3件（後述）を修正した結果、lint 違反0件・measure 全項目 pass。

## sanitize / audit

3件すべて `scripts/sanitize-run-artifacts.mjs` を実行後、`scripts/audit-public-data.mjs`（`pnpm public:audit`）で既知パターンの漏洩が無いことを確認した。

## 何が起きたか

### baseline（設計契約なし）

13枚を自由な判断で生成した。配色（紺地＋3色アクセント）や方眼罫線による「設計図」風の演出など、視覚的な統一感自体はあった。しかし実測では **フォントサイズとコントラストが体系的に基準を割った**（133件の違反のうち min-font-size 75件、contrast 58件）。契約が無いと「見た目は整っているようで、実際に読めるか・見えるかの基準は満たさない」という結果になった。`layout-approved` の7件は、承認済み以外の任意の layout 名（`roles` / `diagram` / `split` / `closing` 等）を自由に使った結果で、契約が無ければ当然の帰結。

### harness（設計契約あり）

deck 契約 `design/decks/harness-intro.md` が宣言する3枚（title → bullets → statement）にそのまま従い、`design/theme.css` / `design/layout.css` の実消費・実測（no-overflow / min-font-size / contrast）はすべて一発で pass した。一方で `component-approved` に3件の違反があった。design/components/ の契約名（`SlideTitle` / `BulletList` / `Statement`）と同じ名前のローカル関数を自分で定義してしまい、契約名を騙る自作コンポーネントとして検出された（Phase 1 時点ではこれらの正規の React 実装がまだ存在しないため、契約名をローカルで再定義することは禁止されている）。

### harness-corrected（機械検査結果を渡して修正）

上記3件の指摘をそのままサブエージェントに渡し、素の JSX + 既存の CSS クラス名への置き換えを指示した。視覚的な出力を変えずに修正でき、lint 0件・measure 全項目 pass に到達した。**機械検査 → 指摘 → AI が自己修正、のループが実際に機能することを確認できた。**

### 副産物: 実装のバグを1件発見・修正した

harness の Run が `design/theme.css` の `--dh-color-*`（oklch 記法）を実際に消費する初めてのケースになったところ、`scripts/measure-slides.mjs` のコントラスト計算（`scripts/lib/color.mjs` の `parseCssRgb`）と背景色の合成（`backgroundLayers`）が、どちらも例外で落ちた。Chromium が `getComputedStyle` の計算値を `rgb()` へ変換せず `oklch()` のまま返すようになっており、`rgb()`/`rgba()` しか読めなかったのが原因。両箇所に `oklch()` の読み取りを追加して修正した（[コミット](https://github.com/nashiusagi/slide-design-system/commit/0276672)、背景色側は別コミット）。

これは [DR-0038](../../docs/decisions/0038-defer-measure-in-check.md) が名指しした問題（App.tsx がプレースホルダのままだと `no-overflow` / `min-font-size` が実データ不在で誤って落ちる）とは別の原因によるもので、契約の値そのもの（oklch 記法）を実測系が初めて読みにいったことで顕在化した、これまで潜在していたバグである。なお本 PR では、DR-0038 が完了条件として名指ししたトリガー——ルートの `src/App.tsx` が `design/theme.css` / `design/layout.css` を実消費するようになること——は起きていない（実消費したのは各条件の実験ワークスペース側のコピーのみで、ルート側の `src/App.tsx` は未変更）。そのため DR-0038 の完了条件（`pnpm measure` を `pnpm check` へ組み込む）はまだ満たされておらず、`pnpm measure` は引き続き独立コマンドのままにしている。

## 人による品質判断（完了条件）

生成された3条件のスライドを画像化し、比較ギャラリー（`baseline` 全13枚 + `harness-corrected` 全3枚 + ルール別採点結果）としてまとめてユーザーに提示した。

**判断: harness（harness-corrected）の方が良い。**（2026-09-10、ユーザーからの回答「はーねすのほういいかんじ」）

baseline は視覚的な作り込みはあるものの実測で体系的に基準を割り、harness-corrected は北極星（白い紙面と黒い文字、強調は一色）に沿った簡潔な結果になった。枚数は harness-corrected が3枚（deck契約準拠）、baseline が13枚（お題の指定枚数の範囲内）と大きく異なる点は、量ではなく契約遵守と実測合格を優先した結果であり、今回の判断はその質を良いと評価したもの。

## 既知の留意点（結果の解釈時に）

- **自己言及的な題材によるバイアス**（[DR-0015](../../docs/decisions/0015-first-experiment.md) が事前に指摘済み）: お題が「この仕組み自体の紹介」であるため、契約を知っている harness 側が有利になりやすい構造がある。
- **starter 経由の軽微な情報漏れ**: baseline のワークスペースにも `src/runtime/` のランタイム機構（設計契約とは無関係、[DR-0021](../../docs/decisions/0021-starter-contains-runtime-only.md)）は渡っており、そのソースコード中のコメント（例: `canvas.ts` が `design/tokens.json の canvas` に触れる、`runtime.css` が `design/theme.css` / `design/layout.css` に触れる）から、「トークンやレイアウトという契約の概念が存在すること」自体は baseline も間接的に窺い知れる状態だった。実際に baseline の生成報告にもこの旨の記載があった。契約の具体的な値・構造までは渡っていないため実験の結論を覆すものではないが、完全な遮断ではないことは記録しておく。
- **deck-conformance は baseline に構造的に不利**: baseline には比較対象になる deck 契約自体を渡していないため、`deck-conformance` の fail は「契約を守れなかった」のではなく「そもそも対象外」に近い。表には残すが、他のルールと同列の「能力差」の証拠としては読まない。
- **枚数の違い**: harness-corrected は既存の deck 契約（3枚）に厳密に従った結果であり、10〜15枚というお題の指定を字義通りには満たしていない。deck 契約とお題の枚数指定が競合したときに deck 契約を優先するという判断は、生成サブエージェント自身が行った（指示の優先順位に基づく）。
