# DR-0045: lint 実行系は ESLint に留め、Biome へ移さない

- **状態**: 承認済み
- **日付**: 2026-09-12
- **関連**: [DR-0011](./0011-lint-and-measure.md), [DR-0026](./0026-typescript-5-for-eslint-ast.md), [DR-0037](./0037-eslint-plugin-slide-rule-scope.md), [DR-0042](./0042-design-catalog-as-separate-build-entry.md), [DR-0044](./0044-bypass-fixtures-required.md)
- **正本**: `eslint.config.js`, `package.json`（`devDependencies`）

## 文脈

lint 実行系を ESLint から Biome へ移す案が出た（#48）。動機は実行速度と設定の単純さで、パーサ・プラグイン・`typescript-eslint` の peer 依存という三段構えが消える。[DR-0026](./0026-typescript-5-for-eslint-ast.md) が TypeScript を 5 系に縛っている理由もその三段構えにある。

移行の可否は「同じ違反を検出し続けられるか」で決まる。このリポジトリの lint は汎用の整形・バグ検出ではなく、契約検査そのものだからである（[DR-0011](./0011-lint-and-measure.md)）。`eslint.config.js` が今持っているものは 3 種類ある。

1. **汎用ルール** — `js.configs.recommended` / `tseslint.configs.recommended`
2. **契約検査** — `design/rules.json` が `method: lint` とする 5 ルール。`packages/eslint-plugin-slide` が実装する
3. **構造の禁止** — ビルドエントリ境界（[DR-0042](./0042-design-catalog-as-separate-build-entry.md)）の静的 import / 動的 import 禁止と、`src/**` での抑止コメント統制（`noInlineConfig`）

Biome 側の現状（2026-09-12 時点）はこうである。プラグインは GritQL のみで、ルールを JavaScript / TypeScript で書くことはできない。GritQL プラグインは CST への問い合わせ・独自診断の報告・コード修正・適用パスの glob 指定までを持つが、**任意の外部ファイルを lint 実行時に読む手段は文書化されていない**。2026 のロードマップにも JS / TS でのルール記述は挙がっていない。

この一点が 2 を直撃する。契約検査 5 ルールはいずれも、判定の基準値を自分の中に持たず、`design/` 配下の契約をその場で読んで判定する（`packages/eslint-plugin-slide/src/lib/design-contracts.mjs`）。`layout-approved` は `design/layouts/*.json` を、`component-approved` は `design/components/*.json` を、`deck-conformance` に至っては Markdown + frontmatter の deck 契約を [DR-0036](./0036-js-yaml-for-deck-frontmatter.md) のパーサで読む。「契約を正本として読む」ことは設計の中心であって実装の都合ではない（[DR-0033](./0033-derived-values-are-generated-and-checked.md)）。許容値を GritQL のパターンへ書き写せば、それは正本の複製になる。

3 も同様に埋まらない。`noInlineConfig` に相当する「抑止コメントを一切効かせない」設定は Biome に見当たらない。`src/**` は無人の生成ループが書く検査対象であり、生成物に混ざった `biome-ignore` で契約検査を無効化できる状態は、検査が在ることの前提を崩す。

## 決定

lint 実行系は ESLint のまま維持し、Biome へ移さない。`packages/eslint-plugin-slide` も ESLint プラグインのまま置く。

この DR が決めるのは lint の実行系だけである。整形（formatter）をどう持つかは、ここでは決めない。

## 理由

- **移行で得るものは汎用ルールの実行速度と設定の簡素化に限られ、契約検査はその対象外である。** 上の 1 だけが移せて、2 と 3 は移せない。速くなるのは、このリポジトリで最も重要でない部分だけになる
- **払うものは、二重管理か再実装のどちらかである。** 1 のために Biome を足して 2 と 3 のために ESLint も残せば、lint の設定が 2 ファイルに割れ、どちらがどのファイルを見ているかを人が覚えることになる。避けようとすれば 5 ルールを ESLint の外へ書き直すことになり、[DR-0044](./0044-bypass-fixtures-required.md) で固定した bypass フィクスチャごと作り直す羽目になる。どちらもツールの数か自作コードの量が増える方向で、**検出できる違反は 1 つも増えない**
- **移行の失敗は静かに起きる。** [DR-0026](./0026-typescript-5-for-eslint-ast.md) の帰結が言うとおり、`pnpm lint` の終了コードは合格の証拠にならない。ルールが 1 件も発火しなくなった状態は「全ルール pass」として現れる。得るものが小さく、失敗が見えにくい取引は受けない
- 速度が問題になっている事実は今のところ無い。この規模では `pnpm check` の所要時間を lint が律速していない

## 検討した他の選択肢

### 全面移行し、契約検査を自前の AST ランナーへ書き直す

Biome 一本になり、設定も依存も減る。契約検査は ESLint のルール形式から離れ、TypeScript AST を直接読む独立スクリプトとして `pnpm check` に載せる（[DR-0028](./0028-single-check-entry-point.md) の実行口は変わらない）。

**却下理由**: ESLint がタダで提供している足場——ファイル走査、パーサ、glob によるルール適用範囲の切り分け、`RuleTester` によるテスト、抑止コメントの統制——を全部自前で持つことになる。5 ルールの判定ロジックそのものは移せても、その周りの足場が新しい自作コードになり、**検査する側のコードが検査されていない**状態が増える（[DR-0027](./0027-build-scaffold-workspace-and-test-stack.md) が `scripts/**` を lint 対象に含めた理由と同じ懸念）。エディタ上での即時フィードバックも失う。

### 併用する（汎用ルールと整形は Biome、契約検査は ESLint に残す）

移行コストが最も小さく、速度の利得だけを取れる。

**却下理由**: 検査系の入口が 2 つに増える。「このファイルはどちらに見られているか」がファイルごとに変わり、`eslint.config.js` の `files` / `ignores` と Biome の `includes` を両方そろえて初めて正しくなる。片方だけ更新されたときに何も落ちないため、[DR-0044](./0044-bypass-fixtures-required.md) が問題にした「守備範囲が複数箇所に別々に書かれる」構造をツールの階層で作ることになる。得るのは汎用ルールの実行時間だけで、釣り合わない。

### Biome の GritQL プラグインで契約検査を書き直す

Biome 一本のまま、契約検査も残せる。

**却下理由**: GritQL は CST のパターンに一致させる言語であり、判定に使う値をパターンの中へ書く。許容 layout 名・component 名・deck の枚数と順序は `design/` 配下の契約が正本であり、これをパターンへ書き写した時点で正本の複製になる。契約を直しても検査が追随しない——`pnpm design:check` が防いでいるはずの壊れ方（[DR-0032](./0032-ajv-for-contract-validation.md)）を、検査の側で作る。

## 帰結

- **ESLint に留まる以上、[DR-0026](./0026-typescript-5-for-eslint-ast.md)（TypeScript 5 系固定）の前提も変わらない。** 7 系へ上げられるかは引き続き `typescript-eslint` の対応で決まり、Biome へ移ることで回避できる問題ではなくなった
- **再検討の条件**は、Biome 側で次の 2 つが**両方**そろったときとする。片方だけでは 2 か 3 のどちらかが埋まらない
  - ルールを JavaScript / TypeScript で書けるようになる。または GritQL プラグインが lint 実行時に任意の外部ファイル（`design/` 配下の契約）を読めるようになる
  - 抑止コメントを一切効かせない設定（`noInlineConfig` 相当）を持つ
- **再検討するときの合否判定は、バージョンや速度ではなく「lint が違反を検出できるか」で行う**（[DR-0026](./0026-typescript-5-for-eslint-ast.md) の帰結と同じ基準）。具体的には、[DR-0044](./0044-bypass-fixtures-required.md) の bypass フィクスチャを含む既存テストが、移行後の実装に対してそのまま通ることを条件にする。移行先で書き直したテストが通ることは条件にならない。テストごと作り直せば、検出できなくなった違反はテストからも消える
