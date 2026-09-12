# DR-0045: lint 実行系は ESLint に留め、Biome へ移さない

- **状態**: 承認済み
- **日付**: 2026-09-12
- **関連**: [DR-0011](./0011-lint-and-measure.md), [DR-0026](./0026-typescript-5-for-eslint-ast.md), [DR-0027](./0027-build-scaffold-workspace-and-test-stack.md), [DR-0028](./0028-single-check-entry-point.md), [DR-0036](./0036-js-yaml-for-deck-frontmatter.md), [DR-0037](./0037-eslint-plugin-slide-rule-scope.md), [DR-0042](./0042-design-catalog-as-separate-build-entry.md), [DR-0044](./0044-bypass-fixtures-required.md)
- **正本**: `package.json`（`devDependencies` の lint ランナー — `eslint` / `typescript-eslint` が入っているかどうか）
- **実装**: `eslint.config.js`, `packages/eslint-plugin-slide`

## 文脈

lint 実行系を ESLint から Biome へ移す案が出た（#48）。動機は実行速度と設定の単純さで、パーサ・プラグイン・`typescript-eslint` の peer 依存という三段構えが消える。[DR-0026](./0026-typescript-5-for-eslint-ast.md) が TypeScript を 5 系に縛っている理由もその三段構えにある。

移行の可否は「同じ違反を検出し続けられるか」で決まる。このリポジトリの lint は汎用の整形・バグ検出ではなく、契約検査そのものだからである（[DR-0011](./0011-lint-and-measure.md)）。`eslint.config.js` が今持っているものは 3 種類ある。

1. **recommended 由来の汎用ルール** — `js.configs.recommended` / `tseslint.configs.recommended` が持つルール。ESLint 組み込みルールでも `no-restricted-imports` / `no-restricted-syntax` はここに含めない（[DR-0044](./0044-bypass-fixtures-required.md) の帰結は「汎用ルール」をこの2つを含む意味で使っている。この DR では含めない）
2. **契約検査** — `design/rules.json` が `method: lint` とするルール群。`packages/eslint-plugin-slide` が実装する
3. **ビルドエントリ境界と抑止コメント統制** — (a) ビルドエントリ境界（[DR-0042](./0042-design-catalog-as-separate-build-entry.md)）の静的 import / 動的 import 禁止、(b) `src/**` での抑止コメント統制（`noInlineConfig`）

Biome 側の現状はこうである（2026-09-12 時点、v2 系。確認先は Linter Plugins のドキュメント <https://biomejs.dev/linter/plugins/>、Suppressions のドキュメント <https://biomejs.dev/analyzer/suppressions/>、v2.5 のリリース記事 <https://biomejs.dev/blog/biome-v2-5/>、2026 のロードマップ <https://biomejs.dev/blog/roadmap-2026/>）。プラグインは GritQL のみで、ルールを JavaScript / TypeScript で書くことはできない。GritQL プラグインは CST への問い合わせ・独自診断の報告・コード修正・適用パスの glob 指定（v2.5）までを持つが、**任意の外部ファイルを lint 実行時に読む手段は、上記のプラグインドキュメントに記述が無い**。2026 のロードマップにも JS / TS でのルール記述は挙がっていない。

この一点が 2（契約検査）を直撃する。ただし直撃の仕方はルールごとに違う。判定の基準値を自分の中に持たず `design/` 配下の契約をその場で読むのは `layout-approved`（`design/layouts/*.json`）・`component-approved`（`design/components/*.json`）・`deck-conformance`（Markdown + frontmatter の deck 契約を [DR-0036](./0036-js-yaml-for-deck-frontmatter.md) のパーサで読む）の3ルールである。`no-raw-scale` は許容リテラルだけを `design/rules.json` から読み、長さの判定パターンは実装に持つ。`no-raw-color` は判定に使う値（色を運ぶプロパティの一覧、生の色値のパターン、トークン接頭辞）をすべて実装に持つ——これは [DR-0037](./0037-eslint-plugin-slide-rule-scope.md) が意図して決めた形である。読み書きの正本は `packages/eslint-plugin-slide/src/lib/design-contracts.mjs` にまとめてある。

したがって外部ファイル読み取りの不在が移せなくするのは3ルールで、残る2つは別の理由——判定ロジックそのものの再実装と、[DR-0044](./0044-bypass-fixtures-required.md) が固定した bypass フィクスチャの作り直し——で移せない。なお `method: lint` のルールはどれも説明文を `design/rules.json` から引くため（[DR-0044](./0044-bypass-fixtures-required.md)）、lint 実行時のファイル読み取り自体はどのルールにも要る。許容値を GritQL のパターンへ書き写せば、それは正本の複製になる（値を複製しないことはこのプロジェクトの原則である。[DR-0024](./0024-decision-records-not-adr.md)）。

3 も埋まらない。(b) について、`noInlineConfig` に相当する「抑止コメントを一切効かせない」設定は、上記の Suppressions のドキュメントに記述が無い。`src/**` は無人の生成ループが書く検査対象であり（Phase 1 の前提。[DR-0001](./0001-phase-1-is-ai-harness.md)）、生成物に混ざった `biome-ignore` で契約検査を無効化できる状態は、検査が在ることの前提を崩す。(a) については未確認である。`eslint.config.js` の禁止は `no-restricted-imports` のパス glob に加え、`ImportExpression[source.value=/…/]` と `ImportExpression:not([source.type='Literal'])` の2つの AST セレクタで成り立っており、この否定条件を GritQL で表現できるかを確かめていない。

## 決定

lint 実行系は ESLint のまま維持し、Biome へ移さない。`packages/eslint-plugin-slide` も ESLint プラグインのまま置く。

この DR が決めるのは lint の実行系だけである。整形（formatter）をどう持つかは、ここでは決めない。

## 理由

- **移行で得るものは汎用ルールの実行速度と設定の簡素化に限られ、契約検査はその対象外である。** 移せるのは recommended 由来の汎用ルール（上の 1）だけで、契約検査（2）とビルドエントリ境界・抑止コメント統制（3）は移せない。速くなるのは、このリポジトリで最も重要でない部分だけになる
- **払うものは、二重管理か再実装のどちらかである。** 汎用ルールのために Biome を足して契約検査と境界のために ESLint も残せば、lint の設定が 2 ファイルに割れ、どちらがどのファイルを見ているかを人が覚えることになる。避けようとすれば契約検査を ESLint の外へ書き直すことになり、[DR-0044](./0044-bypass-fixtures-required.md) で固定した bypass フィクスチャごと作り直す羽目になる。どちらもツールの数か自作コードの量が増える方向で、**検出できる違反は 1 つも増えない**
- **移行の失敗は静かに起きる。** [DR-0026](./0026-typescript-5-for-eslint-ast.md) の帰結が言うとおり、`pnpm lint` の終了コードは合格の証拠にならない。ルールが 1 件も発火しなくなった状態は「全ルール pass」として現れる。得るものが小さく、失敗が見えにくい取引は受けない
- 速度が問題になっている事実は今のところ無い。この規模では `pnpm check` の所要時間を lint が律速していない

## 検討した他の選択肢

### 全面移行し、契約検査を自前の AST ランナーへ書き直す

Biome 一本になり、設定も依存も減る。契約検査は ESLint のルール形式から離れ、TypeScript AST を直接読む独立スクリプトとして `pnpm check` に載せる（[DR-0028](./0028-single-check-entry-point.md) の実行口は変わらない）。

**却下理由**: ESLint がタダで提供している足場——ファイル走査、パーサ、glob によるルール適用範囲の切り分け、`RuleTester` によるテスト、抑止コメントの統制——を全部自前で持つことになる。判定ロジックそのものは移せても、その周りの足場が新しい自作コードになり、**検査する側のコードが検査されていない**状態が増える（[DR-0027](./0027-build-scaffold-workspace-and-test-stack.md) / [DR-0028](./0028-single-check-entry-point.md) の帰結が扱う懸念——`pnpm check` の対象から外れた検査コードは、壊れていても緑を返す——と同じもの。`eslint.config.js` が `scripts/**` を検査対象に含めているのはこのためである）。エディタ上での即時フィードバックも失う。

### 併用する（汎用ルールは Biome、契約検査は ESLint に残す）

移行コストが最も小さく、速度の利得だけを取れる。

**却下理由**: 検査系の入口が 2 つに増える。「このファイルはどちらに見られているか」がファイルごとに変わり、`eslint.config.js` の `files` / `ignores` と Biome の `includes` を両方そろえて初めて正しくなる。片方だけ更新されたときに何も落ちないため、[DR-0044](./0044-bypass-fixtures-required.md) が問題にした「守備範囲が複数箇所に別々に書かれる」構造をツールの階層で作ることになる。得るのは汎用ルールの実行時間だけで、釣り合わない。なお整形（formatter）を Biome に持たせる案は、この却下に含まない（「決定」のとおり未決である）。

### Biome の GritQL プラグインで契約検査を書き直す

Biome 一本のまま、契約検査も残せる。

**却下理由**: GritQL は CST のパターンに一致させる言語であり、判定に使う値をパターンの中へ書く。許容 layout 名・component 名・deck の枚数と順序は `design/` 配下の契約が正本であり、これをパターンへ書き写した時点で正本の複製になる。契約を直しても検査が追随しない——[DR-0044](./0044-bypass-fixtures-required.md) が `pnpm design:check` で塞いだ壊れ方（ルールの説明や守備範囲が正本と別の場所にも書かれ、片方だけ更新される）を、検査の側で作る。

## 帰結

- **ESLint に留まる以上、[DR-0026](./0026-typescript-5-for-eslint-ast.md)（TypeScript 5 系固定）の前提も変わらない。** 7 系へ上げられるかは引き続き `typescript-eslint` の対応で決まり、Biome へ移ることで回避できる問題ではなくなった
- **再検討の条件**は、Biome 側で次の 3 つが**すべて**そろったときとする。1 つでも欠ければ、契約検査（上の 2）かビルドエントリ境界・抑止コメント統制（上の 3）のどこかが埋まらない
  - ルールを JavaScript / TypeScript で書けるようになる。または GritQL プラグインが lint 実行時に任意の外部ファイル（`design/` 配下の契約）を読めるようになる
  - 抑止コメントを一切効かせない設定（`noInlineConfig` 相当）を持つ
  - ビルドエントリ境界の禁止（[DR-0042](./0042-design-catalog-as-separate-build-entry.md)）を同じ守備範囲で表現できる。静的 import のパス glob、引数がリテラルの動的 import、および**引数がリテラルでない `import()` そのもの**の3つすべてを指す。3つ目は否定条件であり、表現できるかは未確認である（「文脈」のとおり）
- **この3つが揃ったことに気付いた時点で、この DR を見直す Issue を起こす**（[DR-0026](./0026-typescript-5-for-eslint-ast.md) の帰結が `typescript-eslint` について同じ引き金を持つ。ESLint に留まる判断が両者で連動しているので、どちらかを見直すときはもう一方も見る）。また、却下理由の一部はこちら側の前提（`src/**` を無人の生成ループだけが書く。[DR-0001](./0001-phase-1-is-ai-harness.md) の Phase 1）に乗っているので、その前提が変わったときも見直しの対象とする
- **再検討するときの合否判定は、バージョンや速度ではなく「lint が違反を検出できるか」で行う**（[DR-0026](./0026-typescript-5-for-eslint-ast.md) の帰結と同じ基準）。具体的にはこうする
  - `design/rules.json` の `bypassAxes` / `scopeExclusions` の宣言と、各 `*.bypass.mjs` の事例・期待結果を**1件も追加・削除・書き換えせずに**移行後の実装へ与え、すべてが期待どおり違反 / 通過になること
  - `eslint.config.js` が持つビルドエントリ境界の禁止それぞれについて、違反コードが移行後も報告されること。この禁止は `design/rules.json` にルールIDを持たないため bypass フィクスチャの対象外で、現在テストも無い。移行の可否を判定する前に、まず違反コードを用意する必要がある
  - 事例を据え置く代わりに、実行の入口（`packages/eslint-plugin-slide/src/rules/bypass.test.mjs` 相当）は移行先向けに書き直してよい。ESLint の `RuleTester` に依存しているため、そのままでは動かないからである。**禁じているのはランナーの再実装ではなく、事例ごと作り直すこと**だ。事例を書き直せば、検出できなくなった違反はテストからも消える
